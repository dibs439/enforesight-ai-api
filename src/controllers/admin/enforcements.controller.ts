import { parse } from 'csv-parse/sync';
import type { Request, Response } from 'express';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { getConvexClient } from '../../utils/convexClient';
import { logger } from '../../utils/logger';
import { isValidUrl, parseLocalPdf } from '../../utils/pdfUtils';
import { fetchUrlContentWithRetry } from '../../utils/webUtils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'dummy-key-replace-me',
});

// Dynamic import for API to handle both dev and production environments
let api: any;
try {
  // Try ES module import first (development)
  api = require('../../../convex/_generated/api').api;
} catch {
  try {
    // Fallback to dist location (production)
    api = require('../../convex/_generated/api').api;
  } catch {
    // Final fallback - create a mock API object
    logger.warn('Could not load Convex API - using fallback');
    api = { enforcements: {} };
  }
}

export class EnforcementsController {
  /**
   * Get all enforcements with optional filtering and pagination.
   *
   * Uses cursor-based Convex calls internally (each within the 16MB
   * byte-read limit) and translates to offset/page-based pagination
   * for the REST response.
   */
  async getAllEnforcements(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const client = getConvexClient();

      // Extract all filter parameters
      const {
        regulator,
        regulatorName,
        jurisdiction,
        sector,
        actionType,
        violationType,
        currency,
        minFineAmount,
        maxFineAmount,
        dateFrom,
        dateTo,
        search,
        field,
      } = req.query;

      const appliedFilters: any = {};

      // Use regulator filter if provided (legacy support)
      const regulatorFilter = regulator || regulatorName;

      // Build filter params for the paginated Convex function
      const filterParams: any = {};

      // Add filters if provided
      if (regulatorFilter && typeof regulatorFilter === 'string') {
        filterParams.regulator = regulatorFilter;
        appliedFilters.regulator = regulatorFilter;
      }
      if (jurisdiction) {
        filterParams.jurisdiction = jurisdiction as string;
        appliedFilters.jurisdiction = jurisdiction;
      }
      if (field) {
        filterParams.field = field as string;
        appliedFilters.field = field;
      }
      if (sector) {
        filterParams.sector = sector as string;
        appliedFilters.sector = sector;
      }
      if (actionType) {
        filterParams.actionType = actionType as string;
        appliedFilters.actionType = actionType;
      }
      if (violationType) {
        filterParams.violationType = violationType as string;
        appliedFilters.violationType = violationType;
      }
      if (currency) {
        filterParams.currency = currency as string;
        appliedFilters.currency = currency;
      }
      if (minFineAmount) {
        filterParams.minFineAmount = parseFloat(minFineAmount as string);
        appliedFilters.minFineAmount = minFineAmount;
      }
      if (maxFineAmount) {
        filterParams.maxFineAmount = parseFloat(maxFineAmount as string);
        appliedFilters.maxFineAmount = maxFineAmount;
      }
      if (dateFrom) {
        filterParams.dateFrom = dateFrom as string;
        appliedFilters.dateFrom = dateFrom;
      }
      if (dateTo) {
        filterParams.dateTo = dateTo as string;
        appliedFilters.dateTo = dateTo;
      }
      if (search) {
        filterParams.search = search as string;
        appliedFilters.search = search;
      }

      // ── Cursor-based iteration ──
      // Each Convex call is a separate function execution with its own
      // 16MB byte-read budget, so deep pages no longer crash.
      const BATCH_SIZE = 150; // records per Convex call
      let allItems: any[] = [];
      let cursor: string | null = null;
      let isDone = false;

      // Phase 1: Accumulate records until we have enough for the requested page
      while (allItems.length < offset + limit && !isDone) {
        const result: any = await client.query(
          api.enforcements.listEnforcementsPaginated,
          {
            paginationOpts: { numItems: BATCH_SIZE, cursor },
            ...filterParams,
          }
        );

        allItems.push(...result.page);
        cursor = result.continueCursor;
        isDone = result.isDone;
      }

      // Slice the requested page
      const pageData = allItems.slice(offset, offset + limit);

      // Phase 2: Count remaining records for an accurate total
      let totalCount = allItems.length;
      while (!isDone) {
        const countResult: any = await client.query(
          api.enforcements.listEnforcementsPaginated,
          {
            paginationOpts: { numItems: BATCH_SIZE, cursor },
            ...filterParams,
          }
        );

        totalCount += countResult.page.length;
        cursor = countResult.continueCursor;
        isDone = countResult.isDone;
      }

      return res.json({
        success: true,
        data: pageData,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
        filters:
          Object.keys(appliedFilters).length > 0 ? appliedFilters : undefined,
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch enforcements',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get enforcement by ID
   */
  async getEnforcementById(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const enforcement = await client.query(
        api.enforcements.getEnforcementById,
        {
          id: req.params.id as any,
        }
      );
      return res.json({ success: true, data: enforcement });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch enforcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create new enforcement
   */
  async createEnforcement(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const data = req.body;

      // Handle file upload if present
      const uploadedFile = req.file;

      // Check if we have either URL or uploaded file
      const hasUrl =
        data.enforcementNoticeUrl &&
        typeof data.enforcementNoticeUrl === 'string' &&
        data.enforcementNoticeUrl.trim();
      const hasFile = uploadedFile && uploadedFile.filename;

      // Process content data based on priority: URL first, then uploaded file
      if (hasUrl) {
        // Priority 1: URL provided - validate and fetch content from URL
        if (!isValidUrl(data.enforcementNoticeUrl)) {
          return res.status(400).json({
            error: 'Invalid enforcement notice URL',
            details: 'Please provide a valid HTTP or HTTPS URL',
          });
        }

        try {
          logger.info(
            { url: data.enforcementNoticeUrl },
            'Fetching content from URL'
          );
          // Fetch content (auto-detects PDF vs web page)
          const textData = await fetchUrlContentWithRetry(
            data.enforcementNoticeUrl,
            30000, // 30 second timeout
            2 // 2 retries
          );
          data.enforcementNoticeData = textData;
          logger.info(
            { length: textData.length },
            'Content extracted successfully from URL'
          );
        } catch (urlError) {
          logger.error({ err: urlError }, 'URL content fetch error');
          return res.status(400).json({
            error: 'Failed to fetch and extract content from URL',
            details:
              urlError instanceof Error ? urlError.message : 'Unknown error',
          });
        }
      } else if (hasFile) {
        // Priority 2: File uploaded - parse uploaded file
        try {
          logger.info(
            { filename: uploadedFile.filename },
            'Parsing uploaded file'
          );

          const isProduction =
            process.env.NODE_ENV === 'production' ||
            process.env.NODE_ENV === 'staging';
          const baseDir = isProduction
            ? '/var/data'
            : path.join(process.cwd(), 'uploads');
          const filePath = path.join(
            baseDir,
            'enforcements',
            uploadedFile.filename
          );
          const textData = await parseLocalPdf(filePath);

          data.enforcementNoticeData = textData;
          data.enforcementFile = uploadedFile.filename;
          logger.info(
            { length: textData.length },
            'File text extracted successfully from uploaded file'
          );
        } catch (fileError) {
          logger.error({ err: fileError }, 'File parsing error');
          return res.status(400).json({
            error: 'Failed to parse uploaded file',
            details:
              fileError instanceof Error ? fileError.message : 'Unknown error',
          });
        }
      } else {
        // Neither URL nor file provided - this is acceptable, just log it
        logger.debug(
          'No content source provided (neither URL nor file upload)'
        );
      }

      // Ensure required fields have default values
      if (!data.enforcementNoticeData) {
        data.enforcementNoticeData = '';
      }

      if (!data.enforcementNoticeUrl) {
        data.enforcementNoticeUrl = '';
      }

      // Generate summary from enforcementNoticeData if available
      if (data.enforcementNoticeData && data.enforcementNoticeData.trim()) {
        try {
          logger.debug('Generating summary for enforcement notice');
          // Truncate to avoid token limits (roughly 8000 chars ≈ 2000 tokens)
          const maxChars = 8000;
          const truncatedData = data.enforcementNoticeData.substring(
            0,
            maxChars
          );
          const isTruncated = data.enforcementNoticeData.length > maxChars;

          const summaryResponse = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
            messages: [
              {
                role: 'system',
                content: `You are a legal document summarizer. Create a comprehensive summary of enforcement notices. 
                The summary should be between 3000-4000 characters (approximately 500-700 words).
                Include key details such as: violations, penalties, regulatory body, subject organization, dates, and key findings.
                Format as clear, readable paragraphs.`,
              },
              {
                role: 'user',
                content: `Please summarize the following enforcement notice data:\n\n${truncatedData}${isTruncated ? '\n\n[Note: Document content truncated due to length]' : ''}`,
              },
            ],
            max_completion_tokens: 1500,
            temperature: 0.3,
          });

          const summary = summaryResponse.choices[0]?.message?.content;
          if (summary) {
            data.enforcementNoticeSummary = summary;
            logger.debug(
              { length: summary.length },
              'Summary generated for enforcement notice'
            );
          }
        } catch (summaryError) {
          logger.error(
            {
              err: summaryError,
              dataLength: data.enforcementNoticeData.length,
            },
            'Error generating summary for enforcement notice'
          );
          // Continue without summary - don't fail the entire record
        }
      }

      // Validate and convert data types
      // Convert fineAmount to number if it's a string
      if (typeof data.fineAmount === 'string') {
        const parsedAmount = parseFloat(data.fineAmount);
        if (isNaN(parsedAmount)) {
          return res.status(400).json({
            error: 'Invalid fine amount',
            details: 'Fine amount must be a valid number',
          });
        }
        data.fineAmount = parsedAmount;
      }

      // Ensure violationTypes is an array
      if (typeof data.violationTypes === 'string') {
        data.violationTypes = [data.violationTypes];
      } else if (!Array.isArray(data.violationTypes)) {
        return res.status(400).json({
          error: 'Invalid violation types',
          details: 'Violation types must be a string or array of strings',
        });
      }

      // Ensure enforcementActionType is an array
      if (typeof data.enforcementActionType === 'string') {
        data.enforcementActionType = [data.enforcementActionType];
      } else if (!Array.isArray(data.enforcementActionType)) {
        return res.status(400).json({
          error: 'Invalid enforcement action type',
          details:
            'Enforcement action type must be a string or array of strings',
        });
      }

      // Validate required fields
      const requiredFields = [
        'documentId',
        'jurisdiction',
        'regulatorName',
        'subjectName',
        'sector',
        'dateOfAction',
        'field',
        'currency',
      ];

      for (const field of requiredFields) {
        if (
          !data[field] ||
          (typeof data[field] === 'string' && data[field].trim() === '')
        ) {
          return res.status(400).json({
            error: `Missing required field: ${field}`,
            details: `The field '${field}' is required and cannot be empty`,
          });
        }
      }

      const id = await client.mutation(
        api.enforcements.createEnforcement,
        data
      );
      return res.json({ success: true, id });
    } catch (error) {
      // Handle duplicate record error specifically
      if (
        error instanceof Error &&
        error.message.includes('enforcement record already exists')
      ) {
        return res.status(409).json({
          error: 'Duplicate enforcement record',
          details: error.message,
        });
      }

      return res.status(500).json({
        error: 'Failed to create enforcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } /**
   * Update existing enforcement
   */
  async updateEnforcement(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const { id, ...data } = { id: req.params.id, ...req.body };

      // First, fetch the existing enforcement record to compare URLs
      const existingEnforcement = await client.query(
        api.enforcements.getEnforcementById,
        {
          id: req.params.id as any,
        }
      );

      if (!existingEnforcement) {
        return res.status(404).json({
          error: 'Enforcement not found',
          details: 'The enforcement record does not exist',
        });
      }

      // Handle file upload if present
      const uploadedFile = req.file;

      // Check if we have either URL or uploaded file
      const hasUrl =
        data.enforcementNoticeUrl &&
        typeof data.enforcementNoticeUrl === 'string' &&
        data.enforcementNoticeUrl.trim();
      const hasFile = uploadedFile && uploadedFile.filename;

      // Check if URL has changed to determine if we need to crawl
      const urlChanged =
        hasUrl &&
        data.enforcementNoticeUrl !== existingEnforcement.enforcementNoticeUrl;

      // Process content data based on priority: URL first, then uploaded file
      if (hasUrl && urlChanged) {
        // Priority 1: URL provided and changed - validate and fetch content from URL
        if (!isValidUrl(data.enforcementNoticeUrl)) {
          return res.status(400).json({
            error: 'Invalid enforcement notice URL',
            details: 'Please provide a valid HTTP or HTTPS URL',
          });
        }

        try {
          logger.info(
            {
              from: existingEnforcement.enforcementNoticeUrl,
              to: data.enforcementNoticeUrl,
            },
            'URL changed, fetching new content'
          );
          // Fetch content (auto-detects PDF vs web page)
          const textData = await fetchUrlContentWithRetry(
            data.enforcementNoticeUrl,
            30000, // 30 second timeout
            2 // 2 retries
          );
          data.enforcementNoticeData = textData;
          logger.info(
            { length: textData.length },
            'Content extracted successfully from URL'
          );
        } catch (urlError) {
          logger.error({ err: urlError }, 'URL content fetch error');
          return res.status(400).json({
            error: 'Failed to fetch and extract content from URL',
            details:
              urlError instanceof Error ? urlError.message : 'Unknown error',
          });
        }
      } else if (hasUrl && !urlChanged) {
        // URL provided but unchanged - skip crawling
        logger.debug(
          { url: data.enforcementNoticeUrl },
          'URL unchanged, skipping content crawling'
        );
        // Only remove enforcementNoticeData if it wasn't explicitly provided in the request
        // This allows manual editing of the content
        if (!('enforcementNoticeData' in req.body)) {
          delete data.enforcementNoticeData;
        }
      }

      // Always handle file if uploaded (independent of URL handling)
      if (hasFile) {
        // Priority 2: File uploaded - parse uploaded file
        try {
          logger.info(
            { filename: uploadedFile.filename },
            'Parsing uploaded file'
          );

          const isProduction =
            process.env.NODE_ENV === 'production' ||
            process.env.NODE_ENV === 'staging';
          const baseDir = isProduction
            ? '/var/data'
            : path.join(process.cwd(), 'uploads');
          const filePath = path.join(
            baseDir,
            'enforcements',
            uploadedFile.filename
          );
          const textData = await parseLocalPdf(filePath);

          data.enforcementNoticeData = textData;
          data.enforcementFile = uploadedFile.filename;
          logger.info(
            { length: textData.length },
            'File text extracted successfully from uploaded file'
          );
        } catch (fileError) {
          logger.error({ err: fileError }, 'File parsing error');
          return res.status(400).json({
            error: 'Failed to parse uploaded file',
            details:
              fileError instanceof Error ? fileError.message : 'Unknown error',
          });
        }
      }

      // Generate summary from enforcementNoticeData if available
      if (data.enforcementNoticeData && data.enforcementNoticeData.trim()) {
        try {
          logger.debug('Generating summary for enforcement notice');
          // Truncate to avoid token limits (roughly 8000 chars ≈ 2000 tokens)
          const maxChars = 8000;
          const truncatedData = data.enforcementNoticeData.substring(
            0,
            maxChars
          );
          const isTruncated = data.enforcementNoticeData.length > maxChars;

          const summaryResponse = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
            messages: [
              {
                role: 'system',
                content: `You are a legal document summarizer. Create a comprehensive summary of enforcement notices. 
                The summary should be between 3000-4000 characters (approximately 500-700 words).
                Include key details such as: violations, penalties, regulatory body, subject organization, dates, and key findings.
                Format as clear, readable paragraphs.`,
              },
              {
                role: 'user',
                content: `Please summarize the following enforcement notice data:\n\n${truncatedData}${isTruncated ? '\n\n[Note: Document content truncated due to length]' : ''}`,
              },
            ],
            max_completion_tokens: 1500,
            temperature: 0.3,
          });

          const summary = summaryResponse.choices[0]?.message?.content;
          if (summary) {
            data.enforcementNoticeSummary = summary;
            logger.debug(
              { length: summary.length },
              'Summary generated for enforcement notice'
            );
          }
        } catch (summaryError) {
          logger.error(
            {
              err: summaryError,
              dataLength: data.enforcementNoticeData.length,
            },
            'Error generating summary for enforcement notice'
          );
          // Continue without summary - don't fail the entire record
        }
      }

      // Data validation and type conversion for update
      // Convert fineAmount to number if it's provided as a string
      if (data.fineAmount !== undefined) {
        if (typeof data.fineAmount === 'string') {
          const parsedAmount = parseFloat(data.fineAmount);
          if (isNaN(parsedAmount)) {
            return res.status(400).json({
              error: 'Invalid fine amount',
              details: 'Fine amount must be a valid number',
            });
          }
          data.fineAmount = parsedAmount;
        }
      }

      // Ensure violationTypes is an array if provided
      if (data.violationTypes !== undefined) {
        if (typeof data.violationTypes === 'string') {
          data.violationTypes = [data.violationTypes];
        } else if (!Array.isArray(data.violationTypes)) {
          return res.status(400).json({
            error: 'Invalid violation types',
            details: 'Violation types must be a string or array of strings',
          });
        }
      }

      // Ensure enforcementActionType is an array if provided
      if (data.enforcementActionType !== undefined) {
        if (typeof data.enforcementActionType === 'string') {
          data.enforcementActionType = [data.enforcementActionType];
        } else if (!Array.isArray(data.enforcementActionType)) {
          return res.status(400).json({
            error: 'Invalid enforcement action type',
            details:
              'Enforcement action type must be a string or array of strings',
          });
        }
      }

      await client.mutation(api.enforcements.updateEnforcement, {
        id: id as any,
        data,
      });

      // Return the updated enforcement with file data if available
      const updatedEnforcement = await client.query(
        api.enforcements.getEnforcementById,
        {
          id: req.params.id as any,
        }
      );

      return res.json({
        success: true,
        data: {
          id: updatedEnforcement._id,
          enforcementFileData: updatedEnforcement.enforcementNoticeData || null,
          enforcementFile: updatedEnforcement.enforcementFile || null,
          ...updatedEnforcement,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to update enforcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete enforcement
   */
  async deleteEnforcement(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      await client.mutation(api.enforcements.deleteEnforcement, {
        id: req.params.id as any,
      });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to delete enforcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Download enforcement PDF file
   */
  async downloadEnforcementFile(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const client = getConvexClient();
      const enforcement = await client.query(
        api.enforcements.getEnforcementById,
        {
          id: req.params.id as any,
        }
      );

      if (!enforcement) {
        return res.status(404).json({
          error: 'Enforcement not found',
          details: 'The enforcement record does not exist',
        });
      }

      if (!enforcement.enforcementFile) {
        return res.status(404).json({
          error: 'File not found',
          details: 'No PDF file has been uploaded for this enforcement record',
        });
      }

      const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.NODE_ENV === 'staging';
      const baseDir = isProduction
        ? '/var/data'
        : path.join(process.cwd(), 'uploads');
      const filePath = path.join(
        baseDir,
        'enforcements',
        enforcement.enforcementFile
      );

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.error(
          { filePath, enforcementId: req.params.id },
          'PDF file not found on disk'
        );
        return res.status(404).json({
          error: 'File not found',
          details:
            'The PDF file exists in the database but could not be found on disk',
        });
      }

      // Get file stats
      const fileStats = fs.statSync(filePath);

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${enforcement.enforcementFile}"`
      );
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', err => {
        logger.error({ err, filePath }, 'Error streaming PDF file');
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to download file',
            details: 'An error occurred while reading the file',
          });
        }
      });

      fileStream.pipe(res);
      return res as any;
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to download enforcement file',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Bulk upload enforcements from CSV file
   */
  async bulkUploadEnforcements(req: Request, res: Response): Promise<Response> {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          details: 'Please upload a CSV file',
        });
      }

      // Validate file type
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      if (fileExtension !== '.csv') {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Invalid file type',
          details: 'Only CSV files are allowed',
        });
      }

      // Read and parse CSV file
      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      let records: any[];

      try {
        records = parse(fileContent, {
          columns: true, // Use first row as column names
          skip_empty_lines: true,
          trim: true,
        });
      } catch (parseError) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Invalid CSV format',
          details:
            parseError instanceof Error
              ? parseError.message
              : 'Failed to parse CSV file',
        });
      }

      // Validate row count
      if (records.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Empty CSV file',
          details: 'CSV file contains no data rows',
        });
      }

      if (records.length > 500) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Too many rows',
          details: `CSV file contains ${records.length} rows. Maximum allowed is 500 rows`,
        });
      }

      const client = getConvexClient();
      const results = {
        total: records.length,
        inserted: 0,
        skipped: 0,
        errors: [] as Array<{ row: number; error: string; data: any }>,
      };

      // Process each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // +2 because: +1 for 0-index, +1 for header row

        try {
          // Validate required fields
          if (!record.subjectName || !record.regulatorName) {
            results.errors.push({
              row: rowNumber,
              error:
                'Missing required fields: subjectName and regulatorName are required',
              data: record,
            });
            results.skipped++;
            continue;
          }

          // Check for duplicate using efficient query
          const duplicateCheck = await client.query(
            api.enforcements.checkDuplicateExists,
            {
              subjectName: record.subjectName,
              regulatorName: record.regulatorName,
              dateOfAction: record.dateOfAction || undefined,
            }
          );

          if (duplicateCheck.exists) {
            results.skipped++;
            continue;
          }

          // Prepare data for insertion
          const enforcementData: any = {
            documentId: record.documentId || undefined,
            regulatorName: record.regulatorName,
            subjectName: record.subjectName,
            subjectNameCase: record.subjectNameCase || record.subjectName,
            jurisdiction: record.jurisdiction || '',
            sector: record.sector || undefined,
            field: record.field || undefined,
            dateOfAction: record.dateOfAction || undefined,
            enforcementNoticeUrl: record.enforcementNoticeUrl || undefined,
            enforcementNoticeURL: record.enforcementNoticeURL || undefined,
            enforcementNoticeData: record.enforcementNoticeData || undefined,
            enforcementFile: record.enforcementFile || undefined,
            currency: record.currency || undefined,
            underAppeal:
              record.underAppeal === 'true' ||
              record.underAppeal === '1' ||
              record.underAppeal === true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Generate summary from enforcementNoticeData if available
          if (
            record.enforcementNoticeData &&
            record.enforcementNoticeData.trim()
          ) {
            try {
              logger.debug({ rowNumber }, 'Generating summary for row');
              // Truncate to avoid token limits (roughly 8000 chars ≈ 2000 tokens)
              const maxChars = 8000;
              const truncatedData = record.enforcementNoticeData.substring(
                0,
                maxChars
              );
              const isTruncated =
                record.enforcementNoticeData.length > maxChars;

              const summaryResponse = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
                messages: [
                  {
                    role: 'system',
                    content: `You are a legal document summarizer. Create a comprehensive summary of enforcement notices. 
                    The summary should be between 3000-4000 characters (approximately 500-700 words).
                    Include key details such as: violations, penalties, regulatory body, subject organization, dates, and key findings.
                    Format as clear, readable paragraphs.`,
                  },
                  {
                    role: 'user',
                    content: `Please summarize the following enforcement notice data:\n\n${truncatedData}${isTruncated ? '\n\n[Note: Document content truncated due to length]' : ''}`,
                  },
                ],
                max_completion_tokens: 1500,
                temperature: 0.3,
              });

              const summary = summaryResponse.choices[0]?.message?.content;
              if (summary) {
                enforcementData.enforcementNoticeSummary = summary;
                logger.debug(
                  { rowNumber, length: summary.length },
                  'Summary generated for row'
                );
              }
            } catch (summaryError) {
              logger.error(
                {
                  err: summaryError,
                  rowNumber,
                  dataLength: record.enforcementNoticeData.length,
                },
                'Error generating summary for row'
              );
              // Continue without summary - don't fail the entire record
            }
          }

          // Handle fineAmount - parse as number
          if (record.fineAmount !== undefined && record.fineAmount !== '') {
            const parsedAmount = parseFloat(
              String(record.fineAmount).replace(/[^0-9.-]/g, '')
            );
            if (!isNaN(parsedAmount)) {
              enforcementData.fineAmount = parsedAmount;
            }
          }

          // Handle year and month
          if (record.year !== undefined && record.year !== '') {
            const year = parseInt(String(record.year));
            if (!isNaN(year)) {
              enforcementData.year = year;
            }
          }
          if (record.month !== undefined && record.month !== '') {
            const month = parseInt(String(record.month));
            if (!isNaN(month) && month >= 1 && month <= 12) {
              enforcementData.month = month;
            }
          }

          // Handle arrays - enforcementActionType
          if (record.enforcementActionType) {
            const actionType = record.enforcementActionType;
            if (typeof actionType === 'string') {
              // Check if it's a JSON array string
              if (actionType.startsWith('[')) {
                try {
                  enforcementData.enforcementActionType =
                    JSON.parse(actionType);
                } catch {
                  // If JSON parse fails, split by comma or use as single string
                  enforcementData.enforcementActionType = actionType.includes(
                    ','
                  )
                    ? actionType.split(',').map((s: string) => s.trim())
                    : actionType;
                }
              } else if (actionType.includes(',')) {
                enforcementData.enforcementActionType = actionType
                  .split(',')
                  .map((s: string) => s.trim());
              } else {
                enforcementData.enforcementActionType = actionType;
              }
            }
          }

          // Handle arrays - violationTypes
          if (record.violationTypes) {
            const violationTypes = record.violationTypes;
            if (typeof violationTypes === 'string') {
              // Check if it's a JSON array string
              if (violationTypes.startsWith('[')) {
                try {
                  enforcementData.violationTypes = JSON.parse(violationTypes);
                } catch {
                  // If JSON parse fails, split by comma or use as single string
                  enforcementData.violationTypes = violationTypes.includes(',')
                    ? violationTypes.split(',').map((s: string) => s.trim())
                    : violationTypes;
                }
              } else if (violationTypes.includes(',')) {
                enforcementData.violationTypes = violationTypes
                  .split(',')
                  .map((s: string) => s.trim());
              } else {
                enforcementData.violationTypes = violationTypes;
              }
            }
          }

          // Insert the record
          await client.mutation(
            api.enforcements.createEnforcement,
            enforcementData
          );
          results.inserted++;
        } catch (error) {
          results.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: record,
          });
          results.skipped++;
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      return res.json({
        success: true,
        message: 'Bulk upload completed',
        results: {
          total: results.total,
          inserted: results.inserted,
          skipped: results.skipped,
          errors: results.errors,
        },
      });
    } catch (error) {
      // Clean up uploaded file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        error: 'Bulk upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const enforcementsController = new EnforcementsController();
