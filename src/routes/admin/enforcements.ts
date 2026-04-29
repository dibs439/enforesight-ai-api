import { Router } from 'express';
import path from 'path';
import { enforcementsController } from '../../controllers/admin/enforcements.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';
import {
  uploadEnforcementCsv,
  uploadEnforcementPdf,
} from '../../middleware/upload';
import { logger } from '../../utils/logger';
import { validateMultiple, validateParams } from '../../validation';
import {
  createEnforcementSchema,
  enforcementFiltersSchema,
  idParamSchema,
  paginationSchema,
  updateEnforcementSchema,
} from '../../validation/schemas';

const router = Router();

/**
 * @openapi
 * /admin/enforcements:
 *   get:
 *     tags: [Admin - Enforcements]
 *     summary: List enforcements with optional filtering and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: regulator
 *         schema: { type: string }
 *       - in: query
 *         name: jurisdiction
 *         schema: { type: string }
 *       - in: query
 *         name: sector
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated enforcement list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Enforcement'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin - Enforcements]
 *     summary: Create an enforcement record (multipart/form-data, optional PDF)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [documentId, jurisdiction, regulatorName, subjectName, sector, dateOfAction, field, currency, fineAmount, enforcementActionType, violationTypes]
 *             properties:
 *               documentId:
 *                 type: string
 *                 description: Unique document identifier
 *                 example: DOC-2025-001
 *               jurisdiction:
 *                 type: string
 *                 description: Jurisdiction country or region
 *                 example: United States
 *               regulatorName:
 *                 type: string
 *                 description: Name of the regulating authority
 *                 example: SEC
 *               subjectName:
 *                 type: string
 *                 description: Name of the entity subject to enforcement
 *                 example: Acme Trading Ltd
 *               sector:
 *                 type: string
 *                 description: Industry sector
 *                 example: Finance
 *               dateOfAction:
 *                 type: string
 *                 format: date
 *                 description: Date of enforcement action (YYYY-MM-DD)
 *                 example: '2025-03-15'
 *               field:
 *                 type: string
 *                 description: Field of law or regulation
 *                 example: Securities
 *               currency:
 *                 type: string
 *                 description: Currency code for the fine
 *                 example: USD
 *               fineAmount:
 *                 type: number
 *                 description: Fine amount (non-negative)
 *                 example: 250000
 *               enforcementActionType:
 *                 type: string
 *                 description: >-
 *                   Action type(s). Submit a single value (e.g. `Fine`) or comma-separated values
 *                   (e.g. `Fine,Suspension`) — parsed server-side into an array.
 *                 example: Fine
 *               violationTypes:
 *                 type: string
 *                 description: >-
 *                   Violation type(s). Submit a single value (e.g. `Market Manipulation`) or
 *                   comma-separated values — parsed server-side into an array.
 *                 example: Market Manipulation
 *               enforcementNoticeUrl:
 *                 type: string
 *                 format: uri
 *                 description: Public URL to the enforcement notice (optional if file is uploaded)
 *                 example: 'https://www.sec.gov/litigation/admin/2025/some-notice.pdf'
 *               enforcementNoticeData:
 *                 type: string
 *                 description: Raw text content of the enforcement notice
 *               enforcementFile:
 *                 type: string
 *                 format: binary
 *                 description: PDF file upload (optional if URL is provided)
 *     responses:
 *       200:
 *         description: Enforcement record created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Enforcement'
 *       400:
 *         description: Validation error or file upload failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  requireJWTAuth,
  validateMultiple({ query: enforcementFiltersSchema.merge(paginationSchema) }),
  (req, res) => enforcementsController.getAllEnforcements(req, res)
);
router.post('/', requireJWTAuth, (req, res) => {
  uploadEnforcementPdf(req, res, err => {
    if (err) {
      return res
        .status(400)
        .json({ error: 'File upload failed', details: err.message });
    }
    const bodyValidation = createEnforcementSchema.safeParse({
      ...req.body,
      enforcementFile: req.file ? req.file.originalname : '',
    });
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: bodyValidation.error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
    }
    req.body = bodyValidation.data;
    return enforcementsController.createEnforcement(req, res);
  });
});

/**
 * @openapi
 * /admin/enforcements/bulk-upload:
 *   post:
 *     tags: [Admin - Enforcements]
 *     summary: Bulk upload enforcement records from a CSV file
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Bulk upload result summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     created: { type: integer, example: 42 }
 *                     skipped: { type: integer, example: 3 }
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row: { type: integer, example: 5 }
 *                           message: { type: string, example: 'Missing required field: fineAmount' }
 *       400:
 *         description: File upload error or invalid CSV
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/bulk-upload', requireJWTAuth, (req, res) => {
  uploadEnforcementCsv(req, res, err => {
    if (err) {
      return res
        .status(400)
        .json({ error: 'File upload failed', details: err.message });
    }
    return enforcementsController.bulkUploadEnforcements(req, res);
  });
});

/**
 * @openapi
 * /admin/enforcements/templates/{templateName}:
 *   get:
 *     tags: [Admin - Enforcements]
 *     summary: Download a CSV bulk-upload template
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [enforcement-bulk-upload-template.csv, enforcement-bulk-upload-headers.csv]
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Template not found
 */
// NOTE: /bulk-upload and /templates/:templateName must be registered before /:id
router.get('/templates/:templateName', requireJWTAuth, (req, res) => {
  const { templateName } = req.params;

  if (!templateName || typeof templateName !== 'string') {
    return res.status(400).json({ error: 'Invalid template name' });
  }

  const allowedTemplates = [
    'enforcement-bulk-upload-template.csv',
    'enforcement-bulk-upload-headers.csv',
  ];

  if (!allowedTemplates.includes(templateName)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const filePath = path.join(__dirname, '../../../docs/', templateName);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${templateName}"`
  );
  return res.download(filePath, err => {
    if (err) {
      logger.error({ err }, 'Error serving template file');
      return res.status(404).json({ error: 'Template file not found' });
    }
    return;
  });
});

/**
 * @openapi
 * /admin/enforcements/{id}:
 *   get:
 *     tags: [Admin - Enforcements]
 *     summary: Get an enforcement record by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: jsgvmtb9fh0hwfm3bxcxm6fd3s77cks0
 *     responses:
 *       200:
 *         description: Enforcement record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Enforcement'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     tags: [Admin - Enforcements]
 *     summary: Update an enforcement record (multipart/form-data, optional PDF)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: jsgvmtb9fh0hwfm3bxcxm6fd3s77cks0
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documentId: { type: string, example: DOC-2025-001 }
 *               jurisdiction: { type: string, example: United States }
 *               regulatorName: { type: string, example: SEC }
 *               subjectName: { type: string, example: Acme Trading Ltd }
 *               sector: { type: string, example: Finance }
 *               dateOfAction:
 *                 type: string
 *                 format: date
 *                 example: '2025-03-15'
 *               field: { type: string, example: Securities }
 *               currency: { type: string, example: USD }
 *               fineAmount: { type: number, example: 250000 }
 *               enforcementActionType:
 *                 type: string
 *                 description: >-
 *                   Action type(s). Submit a single value (e.g. `Fine`) or comma-separated values
 *                   (e.g. `Fine,Suspension`) — parsed server-side into an array.
 *                 example: Fine
 *               violationTypes:
 *                 type: string
 *                 description: >-
 *                   Violation type(s). Submit a single value or comma-separated values
 *                   — parsed server-side into an array.
 *                 example: Market Manipulation
 *               enforcementNoticeUrl:
 *                 type: string
 *                 format: uri
 *                 example: 'https://www.sec.gov/litigation/admin/2025/some-notice.pdf'
 *               enforcementNoticeData: { type: string }
 *               enforcementFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Enforcement record updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Enforcement'
 *       400:
 *         description: Validation error or file upload failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Admin - Enforcements]
 *     summary: Delete an enforcement record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: jsgvmtb9fh0hwfm3bxcxm6fd3s77cks0
 *     responses:
 *       200:
 *         description: Enforcement record deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Enforcement deleted successfully }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  enforcementsController.getEnforcementById(req, res)
);
router.patch('/:id', requireJWTAuth, (req, res) => {
  uploadEnforcementPdf(req, res, err => {
    if (err) {
      return res
        .status(400)
        .json({ error: 'File upload failed', details: err.message });
    }
    const paramsValidation = idParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: paramsValidation.error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
    }
    const bodyValidation = updateEnforcementSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: bodyValidation.error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
    }
    req.params = paramsValidation.data;
    req.body = bodyValidation.data;
    return enforcementsController.updateEnforcement(req, res);
  });
});
router.get(
  '/file/:id',
  requireJWTAuth,
  validateParams(idParamSchema),
  (req, res) => enforcementsController.downloadEnforcementFile(req, res)
);
router.delete(
  '/:id',
  requireJWTAuth,
  validateParams(idParamSchema),
  (req, res) => enforcementsController.deleteEnforcement(req, res)
);

export default router;
