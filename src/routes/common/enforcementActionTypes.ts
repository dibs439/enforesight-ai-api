import express from 'express';
import { referenceDataController } from '../../controllers/referenceData.controller';
import { validateQuery } from '../../validation';
import { searchQuerySchema } from '../../validation/schemas/common.schema';

const router = express.Router();

/**
 * @openapi
 * /enforcement-action-types:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all enforcement action types
 *     security: []
 *     responses:
 *       200:
 *         description: Array of enforcement action type objects
 */
router.get('/', referenceDataController.getEnforcementActionTypes.bind(referenceDataController));

/**
 * @openapi
 * /enforcement-action-types/search:
 *   get:
 *     tags: [Reference Data]
 *     summary: Search enforcement action types
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching enforcement action types
 */
router.get('/search', validateQuery(searchQuerySchema), referenceDataController.searchEnforcementActionTypes.bind(referenceDataController));

/**
 * @openapi
 * /enforcement-action-types/categories:
 *   get:
 *     tags: [Reference Data]
 *     summary: List enforcement action type categories
 *     security: []
 *     responses:
 *       200:
 *         description: List of category names
 */
router.get('/categories', referenceDataController.getEnforcementActionTypeCategories.bind(referenceDataController));

export default router;

