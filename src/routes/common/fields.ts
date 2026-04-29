import express from 'express';
import { referenceDataController } from '../../controllers/referenceData.controller';

const router = express.Router();

/**
 * @openapi
 * /fields:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all available enforcement record field definitions
 *     security: []
 *     responses:
 *       200:
 *         description: Array of field definition objects
 */
router.get('/', referenceDataController.getFields.bind(referenceDataController));

export default router;

