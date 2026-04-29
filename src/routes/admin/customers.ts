import { Router } from 'express';
import { customersController } from '../../controllers/customers.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';
import { validateBody, validateParams, validateQuery } from '../../validation';
import { idParamSchema } from '../../validation/schemas/common.schema';
import { createCustomerSchema, customerListQuerySchema, patchCustomerSchema, updateCustomerSchema } from '../../validation/schemas/customer.schema';

const router = Router();

/**
 * @openapi
 * /admin/customers/stats:
 *   get:
 *     tags: [Admin - Customers]
 *     summary: Get aggregate customer statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total: { type: integer, example: 1240 }
 *                     active: { type: integer, example: 1100 }
 *                     suspended: { type: integer, example: 140 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @openapi
 * /admin/customers/sync:
 *   post:
 *     tags: [Admin - Customers]
 *     summary: Sync customers from Clerk to the database
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync result summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     synced: { type: integer, example: 45 }
 *                     skipped: { type: integer, example: 3 }
 *                     errors: { type: integer, example: 0 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// NOTE: /stats and /sync must be registered before /:id to prevent path shadowing
router.get('/stats', requireJWTAuth, customersController.getStats.bind(customersController));
router.post('/sync', requireJWTAuth, customersController.sync.bind(customersController));

/**
 * @openapi
 * /admin/customers:
 *   get:
 *     tags: [Admin - Customers]
 *     summary: List all customers with optional search and pagination
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
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Paginated list of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Customer'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin - Customers]
 *     summary: Create a new customer account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Secur3P@ss!
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               subscriptionTier:
 *                 type: string
 *                 example: professional
 *               active:
 *                 type: boolean
 *                 default: true
 *               phoneNumber:
 *                 type: string
 *                 example: "+1-555-0100"
 *               occupation:
 *                 type: string
 *                 example: Compliance Officer
 *               isSuspended:
 *                 type: boolean
 *                 default: false
 *           example:
 *             email: john.doe@example.com
 *             password: Secur3P@ss!
 *             firstName: John
 *             lastName: Doe
 *             subscriptionTier: professional
 *     responses:
 *       201:
 *         description: Customer created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
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
router.get('/', requireJWTAuth, validateQuery(customerListQuerySchema), customersController.getAll.bind(customersController));
router.post('/', requireJWTAuth, validateBody(createCustomerSchema), customersController.create.bind(customersController));

/**
 * @openapi
 * /admin/customers/{id}:
 *   get:
 *     tags: [Admin - Customers]
 *     summary: Get a customer by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: j57d8f2c3e1a4b9e0
 *     responses:
 *       200:
 *         description: Customer object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     tags: [Admin - Customers]
 *     summary: Replace a customer record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: j57d8f2c3e1a4b9e0
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               subscriptionTier:
 *                 type: string
 *                 example: enterprise
 *               active:
 *                 type: boolean
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               phoneNumber:
 *                 type: string
 *                 example: "+1-555-0100"
 *               occupation:
 *                 type: string
 *                 example: Chief Compliance Officer
 *               isSuspended:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated customer object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
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
 *   patch:
 *     tags: [Admin - Customers]
 *     summary: Partially update a customer (e.g. suspend or unsuspend)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: j57d8f2c3e1a4b9e0
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isSuspended]
 *             properties:
 *               isSuspended:
 *                 type: boolean
 *                 description: Set to true to suspend, false to unsuspend
 *                 example: true
 *           example:
 *             isSuspended: true
 *     responses:
 *       200:
 *         description: Customer patched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
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
 *     tags: [Admin - Customers]
 *     summary: Delete a customer permanently
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: j57d8f2c3e1a4b9e0
 *     responses:
 *       200:
 *         description: Customer deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Customer deleted successfully }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', requireJWTAuth, validateParams(idParamSchema), customersController.getById.bind(customersController));
router.put('/:id', requireJWTAuth, validateParams(idParamSchema), validateBody(updateCustomerSchema), customersController.update.bind(customersController));
router.patch('/:id', requireJWTAuth, validateParams(idParamSchema), validateBody(patchCustomerSchema), customersController.patch.bind(customersController));
router.delete('/:id', requireJWTAuth, validateParams(idParamSchema), customersController.remove.bind(customersController));

export default router;
