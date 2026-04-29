import { Router } from 'express';
import { clientsController } from '../../controllers/admin/clients.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';
import { validateBody, validateMultiple, validateParams } from '../../validation';
import {
    clientFiltersSchema,
    createClientSchema,
    idParamSchema,
    paginationSchema,
    updateClientSchema,
} from '../../validation/schemas';

const router = Router();

/**
 * @openapi
 * /admin/clients:
 *   get:
 *     tags: [Admin - Clients]
 *     summary: List all clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated client list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin - Clients]
 *     summary: Create a new client
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Client name
 *                 example: Acme Corp
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@acme.com
 *               company:
 *                 type: string
 *                 example: Acme Corporation
 *               phone:
 *                 type: string
 *                 example: '+14155552671'
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *           example:
 *             name: Acme Corp
 *             email: contact@acme.com
 *             company: Acme Corporation
 *     responses:
 *       200:
 *         description: Client created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Client'
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
 */
router.get(
  '/',
  requireJWTAuth,
  validateMultiple({ query: clientFiltersSchema.merge(paginationSchema) }),
  (req, res) => clientsController.getAllClients(req, res)
);
router.post('/', requireJWTAuth, validateBody(createClientSchema), (req, res) =>
  clientsController.createClient(req, res)
);

/**
 * @openapi
 * /admin/clients/{id}:
 *   get:
 *     tags: [Admin - Clients]
 *     summary: Get a client by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     responses:
 *       200:
 *         description: Client object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Client'
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
 *     tags: [Admin - Clients]
 *     summary: Update a client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: Acme Corp }
 *               email: { type: string, format: email, example: contact@acme.com }
 *               company: { type: string, example: Acme Corporation }
 *               phone: { type: string, example: '+14155552671' }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Client updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Client'
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
 *   delete:
 *     tags: [Admin - Clients]
 *     summary: Delete a client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     responses:
 *       200:
 *         description: Client deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Client deleted }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  clientsController.getClientById(req, res)
);
router.patch(
  '/:id',
  requireJWTAuth,
  validateMultiple({ params: idParamSchema, body: updateClientSchema }),
  (req, res) => clientsController.updateClient(req, res)
);
router.delete('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  clientsController.deleteClient(req, res)
);

export default router;
