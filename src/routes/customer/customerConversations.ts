import { Router } from 'express';
import { customerConversationsController } from '../../controllers/customerConversations.controller';
import { requireClerkAuth } from '../../middleware/clerkAuth';
import { validateBody, validateParams } from '../../validation';
import { conversationIdFromConversationsParamSchema, storeConversationSchema } from '../../validation/schemas/chat.schema';

const router = Router();

/**
 * @openapi
 * /customer/conversations/by-token/list:
 *   get:
 *     tags: [Customer Conversations]
 *     summary: Get conversations for the authenticated customer (token-based lookup)
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of customer conversation objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CustomerConversation'
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// NOTE: /by-token/list must be before /:conversationId to prevent path shadowing
router.get('/by-token/list', requireClerkAuth, customerConversationsController.getByTokenList.bind(customerConversationsController));

/**
 * @openapi
 * /customer/conversations:
 *   post:
 *     tags: [Customer Conversations]
 *     summary: Create a new customer conversation
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 description: Initial message to open the conversation with
 *                 example: I need help understanding the latest FCA sanctions
 *           example:
 *             message: I need help understanding the latest FCA sanctions
 *     responses:
 *       201:
 *         description: Conversation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/CustomerConversation'
 *       400:
 *         description: Validation error — message is required
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
 *   get:
 *     tags: [Customer Conversations]
 *     summary: List all conversations for the authenticated customer
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of customer conversation objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CustomerConversation'
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', requireClerkAuth, validateBody(storeConversationSchema), customerConversationsController.store.bind(customerConversationsController));
router.get('/', requireClerkAuth, customerConversationsController.getAll.bind(customerConversationsController));

/**
 * @openapi
 * /customer/conversations/{conversationId}:
 *   get:
 *     tags: [Customer Conversations]
 *     summary: Get a customer conversation by ID
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *         example: conv_abc123def456
 *     responses:
 *       200:
 *         description: Conversation object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/CustomerConversation'
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Customer Conversations]
 *     summary: Delete a customer conversation permanently
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *         example: conv_abc123def456
 *     responses:
 *       200:
 *         description: Conversation deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Conversation deleted }
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:conversationId', requireClerkAuth, validateParams(conversationIdFromConversationsParamSchema), customerConversationsController.getById.bind(customerConversationsController));
router.delete('/:conversationId', requireClerkAuth, validateParams(conversationIdFromConversationsParamSchema), customerConversationsController.remove.bind(customerConversationsController));

export default router;
