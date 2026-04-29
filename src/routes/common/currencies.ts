import { Router } from 'express';
import { referenceDataController } from '../../controllers/referenceData.controller';
import { validateQuery } from '../../validation';
import { searchQuerySchema } from '../../validation/schemas/common.schema';

const router = Router();

/**
 * @openapi
 * /currencies:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all currencies
 *     security: []
 *     responses:
 *       200:
 *         description: Array of currency objects
 */
router.get('/', referenceDataController.getCurrencies.bind(referenceDataController));

/**
 * @openapi
 * /currencies/search:
 *   get:
 *     tags: [Reference Data]
 *     summary: Search currencies by name or code
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching currencies
 */
router.get('/search', validateQuery(searchQuerySchema), referenceDataController.searchCurrencies.bind(referenceDataController));

/**
 * @openapi
 * /currencies/categories:
 *   get:
 *     tags: [Reference Data]
 *     summary: List currency categories
 *     security: []
 *     responses:
 *       200:
 *         description: List of category names
 */
router.get('/categories', referenceDataController.getCurrencyCategories.bind(referenceDataController));

/**
 * @openapi
 * /currencies/major:
 *   get:
 *     tags: [Reference Data]
 *     summary: List major / widely-traded currencies
 *     security: []
 *     responses:
 *       200:
 *         description: Array of major currency objects
 */
router.get('/major', referenceDataController.getMajorCurrencies.bind(referenceDataController));

export default router;

