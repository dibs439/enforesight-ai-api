import { Router } from 'express';
import { z } from 'zod';
import { usersController } from '../../controllers/admin/users.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';
import { validateBody, validateMultiple, validateParams } from '../../validation';
import {
    createUserSchema,
    idParamSchema,
    loginSchema,
    paginationSchema,
    updateUserSchema,
    userFiltersSchema,
} from '../../validation/schemas';

const router = Router();

// ============================================
// AUTH / LOGIN (No authentication required)
// ============================================

/**
 * @openapi
 * /admin/users/login:
 *   post:
 *     tags: [Auth]
 *     summary: Admin login
 *     description: Authenticate an admin user and receive a JWT token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', validateBody(loginSchema), (req, res) =>
  usersController.login(req, res)
);

// ============================================
// ACTIVATION ROUTES (No authentication required)
// ============================================

/**
 * @openapi
 * /admin/users/activate/{code}:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Validate an activation code (from email link)
 *     security: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: Activation code received in email
 *         example: abc123xyz789def456
 *     responses:
 *       200:
 *         description: Activation code is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Activation code is valid }
 *       400:
 *         description: Invalid or expired activation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/activate/:code',
  validateParams(z.object({ code: z.string().min(1) })),
  (req, res) => usersController.validateActivationCode(req, res)
);

/**
 * @openapi
 * /admin/users/activate:
 *   post:
 *     tags: [Admin - Users]
 *     summary: Complete account activation with an activation code and new password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activationCode, password]
 *             properties:
 *               activationCode:
 *                 type: string
 *                 description: Activation code received via email
 *                 example: abc123xyz789def456
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password for the account
 *                 example: MySecureP@ss1
 *           example:
 *             activationCode: abc123xyz789def456
 *             password: MySecureP@ss1
 *     responses:
 *       200:
 *         description: Account activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Account activated successfully }
 *       400:
 *         description: Invalid or expired activation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/activate',
  validateBody(
    z.object({
      activationCode: z.string().min(1, 'Activation code is required'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
    })
  ),
  (req, res) => usersController.activateUser(req, res)
);

/**
 * @openapi
 * /admin/users/resend-activation:
 *   post:
 *     tags: [Admin - Users]
 *     summary: Resend activation email to a user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.smith@example.com
 *           example:
 *             email: jane.smith@example.com
 *     responses:
 *       200:
 *         description: Activation email resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Activation email sent }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/resend-activation',
  validateBody(z.object({ email: z.string().email('Invalid email format') })),
  (req, res) => usersController.resendActivation(req, res)
);

/**
 * @openapi
 * /admin/users/set-password:
 *   post:
 *     tags: [Admin - Users]
 *     summary: Set a new password using an activation code (same as activate)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activationCode, password]
 *             properties:
 *               activationCode:
 *                 type: string
 *                 description: Activation code received via email
 *                 example: abc123xyz789def456
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password for the account
 *                 example: MySecureP@ss1
 *           example:
 *             activationCode: abc123xyz789def456
 *             password: MySecureP@ss1
 *     responses:
 *       200:
 *         description: Password set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Password set successfully }
 *       400:
 *         description: Invalid or expired activation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/set-password',
  validateBody(
    z.object({
      activationCode: z.string().min(1, 'Activation code is required'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
    })
  ),
  (req, res) => usersController.setPassword(req, res)
);

// ============================================
// USERS CRUD (Authentication required)
// ============================================

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin - Users]
 *     summary: List all admin users
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
 *         name: q
 *         schema: { type: string }
 *         description: Search by name or email
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUser'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin - Users]
 *     summary: Create a new admin user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.smith@example.com
 *               firstName:
 *                 type: string
 *                 example: Jane
 *               lastName:
 *                 type: string
 *                 example: Smith
 *               role:
 *                 type: string
 *                 enum: [admin, editor]
 *                 example: editor
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *           example:
 *             email: jane.smith@example.com
 *             firstName: Jane
 *             lastName: Smith
 *             role: editor
 *     responses:
 *       201:
 *         description: User created — activation email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
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
  validateMultiple({ query: userFiltersSchema.merge(paginationSchema) }),
  (req, res) => usersController.getAllUsers(req, res)
);
router.post('/', requireJWTAuth, validateBody(createUserSchema), (req, res) =>
  usersController.createUser(req, res)
);

/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get a user by ID
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
 *         description: Admin user object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
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
 *     tags: [Admin - Users]
 *     summary: Update a user
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
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.smith@example.com
 *               firstName:
 *                 type: string
 *                 example: Jane
 *               lastName:
 *                 type: string
 *                 example: Smith
 *               role:
 *                 type: string
 *                 enum: [admin, editor]
 *                 example: admin
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
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
 *     tags: [Admin - Users]
 *     summary: Delete a user
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
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: User deleted }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  usersController.getUserById(req, res)
);
router.patch(
  '/:id',
  requireJWTAuth,
  validateMultiple({ params: idParamSchema, body: updateUserSchema }),
  (req, res) => usersController.updateUser(req, res)
);
router.delete('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  usersController.deleteUser(req, res)
);

/**
 * @openapi
 * /admin/users/{id}/password:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Update a user's password (admin only)
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
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 6, example: NewSecureP@ss1 }
 *           example:
 *             password: NewSecureP@ss1
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Password updated successfully }
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
router.patch(
  '/:id/password',
  requireJWTAuth,
  validateMultiple({
    params: idParamSchema,
    body: z.object({
      password: z.string().min(6, 'Password must be at least 6 characters'),
    }),
  }),
  (req, res) => usersController.updatePassword(req, res)
);

export default router;
