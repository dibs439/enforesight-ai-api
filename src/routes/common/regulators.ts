import { Router } from 'express';
import { regulatorsController } from '../../controllers/regulators.controller';
import { validateParams } from '../../validation';
import { idParamSchema } from '../../validation/schemas/common.schema';

const router = Router();

/**
 * @openapi
 * /regulators:
 *   get:
 *     tags: [Reference Data]
 *     summary: List all regulators
 *     security: []
 *     responses:
 *       200:
 *         description: Array of regulator objects
 */
router.get('/', regulatorsController.getAll.bind(regulatorsController));

/**
 * @openapi
 * /regulators/{id}:
 *   get:
 *     tags: [Reference Data]
 *     summary: Get a regulator by ID
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Regulator object
 *       404:
 *         description: Not found
 */
router.get('/:id', validateParams(idParamSchema), regulatorsController.getById.bind(regulatorsController));

export default router;

