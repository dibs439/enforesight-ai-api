import { Router } from 'express';
import { referenceDataController } from '../../controllers/referenceData.controller';
import { validateQuery } from '../../validation';
import { searchQuerySchema } from '../../validation/schemas/common.schema';

const router = Router();

/**
 * @openapi
 * /violation-types:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all violation types
 *     security: []
 *     responses:
 *       200:
 *         description: Array of violation type objects
 */
router.get('/', referenceDataController.getViolationTypes.bind(referenceDataController));

/**
 * @openapi
 * /violation-types/search:
 *   get:
 *     tags: [Reference Data]
 *     summary: Search violation types
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching violation types
 */
router.get('/search', validateQuery(searchQuerySchema), referenceDataController.searchViolationTypes.bind(referenceDataController));

/**
 * @openapi
 * /violation-types/categories:
 *   get:
 *     tags: [Reference Data]
 *     summary: List violation type categories
 *     security: []
 *     responses:
 *       200:
 *         description: List of category names
 */
router.get('/categories', referenceDataController.getViolationTypeCategories.bind(referenceDataController));

export default router;

