import { Request, Response } from 'express';
import OpenAI from 'openai';
import { api } from '../../../convex/_generated/api';
import { getConvexClient } from '../../../utils/convexClient';
import { logger } from '../../../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'dummy-key-replace-me',
});

interface EnforcementRecord {
  _id: string;
  enforcementNoticeData?: string;
  enforcementNoticeSummary?: string;
  [key: string]: unknown;
}

interface SearchParams {
  regulator?: string;
  enforcementAction?: string;
  sector?: string;
  country?: string;
  violationType?: string;
  startDate?: string;
  endDate?: string;
  minFineAmount?: string;
  maxFineAmount?: string;
  currency?: string;
}

/**
 * Get enforcement details by ID
 * If enforcementNoticeSummary doesn't exist, generates one from enforcementNoticeData
 */
export async function getEnforcementById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Enforcement ID is required',
      });
      return;
    }

    const client = getConvexClient();

    // Get enforcement from database
    const enforcement = (await client.query(api.enforcements.getById, {
      id: id as Parameters<typeof api.enforcements.getById>[0]['id'],
    })) as EnforcementRecord | null;

    if (!enforcement) {
      res.status(404).json({
        success: false,
        error: 'Enforcement not found',
      });
      return;
    }

    // Check if summary exists
    if (enforcement.enforcementNoticeSummary) {
      // Return with existing summary
      res.json({
        success: true,
        data: enforcement,
      });
      return;
    }

    // Generate summary if it doesn't exist
    if (!enforcement.enforcementNoticeData) {
      // No data to summarize, return as is
      res.json({
        success: true,
        data: enforcement,
      });
      return;
    }

    try {
      logger.debug({ id }, 'Generating summary for enforcement');

      // Call OpenAI to generate summary (3000-4000 characters)
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
            content: `Please summarize the following enforcement notice data:\n\n${enforcement.enforcementNoticeData}`,
          },
        ],
        max_completion_tokens: 1500,
        temperature: 0.3,
      });

      const summary =
        summaryResponse.choices[0]?.message?.content ||
        'Summary generation failed';

      // Save summary to database
      await client.mutation(api.enforcements.updateSummary, {
        id: id as Parameters<typeof api.enforcements.updateSummary>[0]['id'],
        summary,
      });

      logger.info({ id }, 'Summary saved for enforcement');

      // Return enforcement with generated summary
      res.json({
        success: true,
        data: {
          ...enforcement,
          enforcementNoticeSummary: summary,
        },
      });
    } catch (summaryError) {
      logger.error({ err: summaryError }, 'Error generating summary');

      // Return enforcement without summary if generation fails
      res.json({
        success: true,
        data: enforcement,
        warning: 'Could not generate summary',
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Error fetching enforcement');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * Translates search parameters into human-readable English text
 */
function translateSearchToEnglish(params: SearchParams): string {
  const parts: string[] = [];

  if (params.regulator) {
    parts.push(`regulated by ${params.regulator}`);
  }

  if (params.enforcementAction) {
    parts.push(`with enforcement action "${params.enforcementAction}"`);
  }

  if (params.sector) {
    parts.push(`in the ${params.sector} sector`);
  }

  if (params.country) {
    parts.push(`in ${params.country}`);
  }

  if (params.violationType) {
    parts.push(`involving ${params.violationType} violations`);
  }

  if (params.startDate || params.endDate) {
    const fromDate = params.startDate
      ? new Date(params.startDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'any date';
    const toDate = params.endDate
      ? new Date(params.endDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'today';

    if (params.startDate && params.endDate) {
      parts.push(`between ${fromDate} and ${toDate}`);
    } else if (params.startDate) {
      parts.push(`from ${fromDate} onwards`);
    } else if (params.endDate) {
      parts.push(`until ${toDate}`);
    }
  }

  if (params.minFineAmount || params.maxFineAmount) {
    const currency = params.currency || 'USD';
    const minAmount = params.minFineAmount
      ? parseFloat(params.minFineAmount).toLocaleString()
      : '0';
    const maxAmount = params.maxFineAmount
      ? parseFloat(params.maxFineAmount).toLocaleString()
      : 'unlimited';

    if (params.minFineAmount && params.maxFineAmount) {
      parts.push(
        `with fines between ${currency} ${minAmount} and ${currency} ${maxAmount}`
      );
    } else if (params.minFineAmount) {
      parts.push(`with fines of at least ${currency} ${minAmount}`);
    } else if (params.maxFineAmount) {
      parts.push(`with fines up to ${currency} ${maxAmount}`);
    }
  }

  if (parts.length === 0) {
    return 'All enforcement records';
  }

  // Join parts with proper grammar
  if (parts.length === 1) {
    return `Enforcement records ${parts[0]}`;
  }

  const lastPart = parts.pop();
  return `Enforcement records ${parts.join(', ')} and ${lastPart}`;
}

/**
 * POST /api/enforcement/search
 * Advanced search for enforcements with flexible parameters
 * Accepts any combination of filter parameters
 */
export async function searchEnforcements(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Accept params from request body (POST with JSON)
    const params: SearchParams = req.body || {};
    logger.debug({ params }, 'Received search parameters');
    const { offset = 0, limit = 50 } = req.query;

    // Validate pagination parameters
    const parsedOffset = Math.max(0, parseInt(offset as string) || 0);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit as string) || 50)
    );

    // Build filter arguments for Convex query
    const filterArgs: any = {
      offset: parsedOffset,
      limit: parsedLimit,
    };

    // Map frontend parameters to backend field names
    if (params.regulator) {
      filterArgs.regulator = params.regulator;
    }

    if (params.enforcementAction) {
      filterArgs.actionType = params.enforcementAction;
    }

    if (params.sector) {
      filterArgs.sector = params.sector;
    }

    if (params.country) {
      filterArgs.jurisdiction = params.country;
    }

    if (params.violationType) {
      filterArgs.violationType = params.violationType;
    }

    if (params.startDate) {
      filterArgs.dateFrom = params.startDate;
    }

    if (params.endDate) {
      filterArgs.dateTo = params.endDate;
    }

    if (params.minFineAmount) {
      filterArgs.minFineAmount = parseFloat(params.minFineAmount);
      logger.debug(
        { minFineAmount: filterArgs.minFineAmount },
        'Min fine amount filter'
      );
    }

    if (params.maxFineAmount) {
      filterArgs.maxFineAmount = parseFloat(params.maxFineAmount);
      logger.debug(
        { maxFineAmount: filterArgs.maxFineAmount },
        'Max fine amount filter'
      );
    }

    if (params.currency) {
      filterArgs.currency = params.currency;
    }

    const client = getConvexClient();

    // Use cursor-based paginated query to avoid 16MB byte-read limit.
    // Each Convex call is a separate function execution with its own budget.
    const BATCH_SIZE = 150;
    let allItems: any[] = [];
    let cursor: string | null = null;
    let isDone = false;

    // Remove offset/limit from filterArgs – handled client-side
    const { offset: _o, limit: _l, ...convexFilters } = filterArgs;

    logger.debug({ convexFilters }, 'Search filters being sent to Convex');

    while (allItems.length < parsedOffset + parsedLimit && !isDone) {
      try {
        logger.debug({ cursor, convexFilters }, 'Fetching page');
        const result: any = await client.query(
          api.enforcements.listEnforcementsPaginated,
          {
            paginationOpts: { numItems: BATCH_SIZE, cursor },
            ...convexFilters,
          }
        );

        logger.debug(
          { pageSize: result.page?.length || 0, isDone: result.isDone },
          'Page fetched successfully'
        );

        allItems.push(...result.page);
        cursor = result.continueCursor;
        isDone = result.isDone;
      } catch (pageError) {
        logger.error(
          { err: pageError, filters: convexFilters, cursor },
          'Error fetching page'
        );
        throw pageError;
      }
    }

    const records = allItems.slice(parsedOffset, parsedOffset + parsedLimit);

    // Strip sensitive fields from records
    const cleanRecords = records.map(record => {
      const { enforcementNoticeData: _enforcementNoticeData, ...rest } = record;
      return rest;
    });

    // Count remaining for accurate total
    let totalCount = allItems.length;
    while (!isDone) {
      const countResult: any = await client.query(
        api.enforcements.listEnforcementsPaginated,
        {
          paginationOpts: { numItems: BATCH_SIZE, cursor },
          ...convexFilters,
        }
      );
      totalCount += countResult.page.length;
      cursor = countResult.continueCursor;
      isDone = countResult.isDone;
    }

    // Generate human-readable search description
    const searchDescription = translateSearchToEnglish(params);

    // Generate conversation ID (UUID v4 format)
    const conversationId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create a search-based title for the conversation
    const conversationTitle = `Enforcement Search: ${searchDescription}`;

    logger.debug(
      { conversationId, conversationTitle },
      'Creating enforcement search conversation'
    );

    // Save conversation to Convex (using customerConversations table)
    try {
      const userId = req.auth?.userId || 'anonymous';

      // Create conversation record using storeConversation
      await client.mutation(api.customerConversations.storeConversation, {
        customerId: userId,
        conversationId: conversationId,
        title: conversationTitle,
      });
      logger.info(
        { conversationId },
        'Customer conversation saved successfully'
      );

      // Save initial search message to conversationMessages table using addMessage
      const messageContent = `Search filters: ${searchDescription}`;
      await client.mutation(api.conversationMessages.addMessage, {
        conversationId: conversationId,
        role: 'system',
        content: messageContent,
        metadata: { type: 'search_query' },
      });
      logger.info(
        { conversationId },
        'Conversation message saved successfully'
      );
    } catch (convError) {
      logger.error({ err: convError }, 'Error saving conversation/message');
      // Don't fail the search if conversation save fails
    }

    res.json({
      success: true,
      data: {
        records: cleanRecords,
        total: totalCount,
        offset: parsedOffset,
        limit: parsedLimit,
        search_description: searchDescription,
        applied_filters: params,
        conversation_id: conversationId,
        conversation_title: conversationTitle,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error searching enforcements');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
