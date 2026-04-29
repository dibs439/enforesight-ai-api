import { Router } from 'express';
import { referenceDataController } from '../../controllers/referenceData.controller';
import { validateQuery } from '../../validation';
import { searchQuerySchema } from '../../validation/schemas/common.schema';

const router = Router();

/**
 * @openapi
 * /sectors:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all industry sectors
 *     security: []
 *     responses:
 *       200:
 *         description: Array of sector objects
 */
router.get('/', referenceDataController.getSectors.bind(referenceDataController));

/**
 * @openapi
 * /sectors/search:
 *   get:
 *     tags: [Reference Data]
 *     summary: Search sectors by name
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching sectors
 */
router.get('/search', validateQuery(searchQuerySchema), referenceDataController.searchSectors.bind(referenceDataController));

/**
 * @openapi
 * /sectors/categories:
 *   get:
 *     tags: [Reference Data]
 *     summary: List sector categories
 *     security: []
 *     responses:
 *       200:
 *         description: List of category names
 */
router.get('/categories', referenceDataController.getSectorCategories.bind(referenceDataController));

export default router;

