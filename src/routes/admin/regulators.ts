import { Router } from 'express';
import { regulatorsController } from '../../controllers/admin/regulators.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';
import { validateBody, validateMultiple, validateParams } from '../../validation';
import {
    createRegulatorSchema,
    idParamSchema,
    paginationSchema,
    regulatorFiltersSchema,
    updateRegulatorSchema,
} from '../../validation/schemas';

const router = Router();

/**
 * @openapi
 * /admin/regulators:
 *   get:
 *     tags: [Admin - Regulators]
 *     summary: List all regulators (admin)
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
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated regulator list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Regulator'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin - Regulators]
 *     summary: Create a new regulator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, country, currency]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Regulator name
 *                 example: Financial Conduct Authority
 *               country:
 *                 type: string
 *                 description: Country code or name
 *                 example: United Kingdom
 *               currency:
 *                 type: string
 *                 description: Default currency code
 *                 example: GBP
 *               active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *           example:
 *             name: Financial Conduct Authority
 *             country: United Kingdom
 *             currency: GBP
 *     responses:
 *       201:
 *         description: Regulator created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Regulator'
 *       400:
 *         description: Validation error
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
 *       409:
 *         description: A regulator with this name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  requireJWTAuth,
  validateMultiple({ query: regulatorFiltersSchema.merge(paginationSchema) }),
  (req, res) => regulatorsController.getAllRegulators(req, res)
);
router.post('/', requireJWTAuth, validateBody(createRegulatorSchema), (req, res) =>
  regulatorsController.createRegulator(req, res)
);

/**
 * @openapi
 * /admin/regulators/{id}:
 *   get:
 *     tags: [Admin - Regulators]
 *     summary: Get a regulator by ID
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
 *         description: Regulator object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Regulator'
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
 *     tags: [Admin - Regulators]
 *     summary: Update a regulator
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: Financial Conduct Authority }
 *               country: { type: string, example: United Kingdom }
 *               currency: { type: string, example: GBP }
 *               active: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Regulator updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Regulator'
 *       400:
 *         description: Validation error
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
 *       409:
 *         description: Duplicate regulator name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Admin - Regulators]
 *     summary: Delete a regulator
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
 *         description: Regulator deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Regulator deleted }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  regulatorsController.getRegulatorById(req, res)
);
router.patch(
  '/:id',
  requireJWTAuth,
  validateMultiple({ params: idParamSchema, body: updateRegulatorSchema }),
  (req, res) => regulatorsController.updateRegulator(req, res)
);
router.delete('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  regulatorsController.deleteRegulator(req, res)
);

export default router;
