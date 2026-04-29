import { Router } from 'express';
import {
  getProfile,
  getSessions,
  revokeSession,
  updateProfile,
} from '../../controllers/customer/profileController';
import { requireClerkAuth } from '../../middleware/clerkAuth';

const router = Router();

// All routes in this router require Clerk authentication
router.use(requireClerkAuth);

/**
 * @openapi
 * /customer/profile:
 *   get:
 *     tags: [Customer Profile]
 *     summary: Get the current user's profile from Clerk
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: user_2abc123def456 }
 *                     email: { type: string, format: email, example: john.doe@example.com }
 *                     firstName: { type: string, example: John }
 *                     lastName: { type: string, example: Doe }
 *                     imageUrl: { type: string, format: uri }
 *                     publicMetadata: { type: object }
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     tags: [Customer Profile]
 *     summary: Update the current user's profile
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               publicMetadata:
 *                 type: object
 *                 description: Arbitrary key-value metadata stored on the Clerk user
 *                 example: { occupation: Compliance Officer }
 *           example:
 *             firstName: John
 *             lastName: Doe
 *             publicMetadata:
 *               occupation: Compliance Officer
 *     responses:
 *       200:
 *         description: Updated profile object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: user_2abc123def456 }
 *                     email: { type: string, format: email }
 *                     firstName: { type: string, example: John }
 *                     lastName: { type: string, example: Doe }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

/**
 * @openapi
 * /customer/sessions:
 *   get:
 *     tags: [Customer Profile]
 *     summary: Get all active sessions for the current user
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of active session objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, example: sess_2xyz789abc }
 *                       status: { type: string, example: active }
 *                       lastActiveAt: { type: string, format: date-time }
 *                       expireAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/sessions', getSessions);

/**
 * @openapi
 * /customer/sessions/{sessionId}:
 *   delete:
 *     tags: [Customer Profile]
 *     summary: Revoke a specific session
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *         example: sess_2xyz789abc
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Session revoked }
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/sessions/:sessionId', revokeSession);

export default router;
