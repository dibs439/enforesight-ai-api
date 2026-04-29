import express from 'express';
import { referenceDataController } from '../../controllers/referenceData.controller';
import { validateQuery } from '../../validation';
import { searchQuerySchema } from '../../validation/schemas/common.schema';

const router = express.Router();

/**
 * @openapi
 * /countries:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all countries
 *     security: []
 *     responses:
 *       200:
 *         description: Array of country objects
 */
router.get('/', referenceDataController.getCountries.bind(referenceDataController));

/**
 * @openapi
 * /countries/search:
 *   get:
 *     tags: [Reference Data]
 *     summary: Search countries by name or code
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search term
 *     responses:
 *       200:
 *         description: Matching countries
 */
router.get('/search', validateQuery(searchQuerySchema), referenceDataController.searchCountries.bind(referenceDataController));

export default router;

