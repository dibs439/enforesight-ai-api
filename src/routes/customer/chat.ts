import { Request, Response, Router } from 'express';
import { aiChatController } from '../../controllers/aiChat.controller';
import { requireClerkAuth } from '../../middleware/clerkAuth';
import { flexibleAuth } from '../../middleware/flexibleAuth';
import { getCustomerConversationsDescending } from '../../services/customerConversationService';
import { logger } from '../../utils/logger';
import { validateBody, validateParams, validateQuery } from '../../validation';
import {
  chatMessageSchema,
  conversationIdParamSchema,
  conversationIdFromConversationsParamSchema,
  historyQuerySchema,
  updatePinnedSchema,
} from '../../validation/schemas/chat.schema';

const router = Router();

// ============================================
// AI CHAT ROUTES  (served under /ai/...)
// ============================================

/**
 * @openapi
 * /ai/chat:
 *   post:
 *     tags: [AI Chat]
 *     summary: Send a message to the AI assistant
 *     description: |
 *       Accepts a **Clerk session token** or an **admin JWT** in the `Authorization: Bearer <token>` header.
 *       Provide `conversationId` to continue an existing conversation; omit it to start a new one.
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
 *                 description: The user's message to the AI assistant
 *                 example: What enforcement actions has the SEC taken against banks this year?
 *               conversationId:
 *                 type: string
 *                 description: Optional — ID of an existing conversation to continue
 *                 example: k57abc123def456ghi789
 *           example:
 *             message: What enforcement actions has the SEC taken against banks this year?
 *             conversationId: k57abc123def456ghi789
 *     responses:
 *       200:
 *         description: AI-generated response with conversation context
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: AI-generated response text
 *                       example: "The SEC has taken 47 enforcement actions against banks in 2025, totaling $2.1B in fines..."
 *                     conversationId:
 *                       type: string
 *                       description: ID of the conversation (new or continued)
 *                       example: k57abc123def456ghi789
 *                     role:
 *                       type: string
 *                       enum: [assistant]
 *                       example: assistant
 *       400:
 *         description: Validation error — message field is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/ai/chat',
  flexibleAuth,
  validateBody(chatMessageSchema),
  aiChatController.chat.bind(aiChatController)
);

/**
 * @openapi
 * /ai/chat/conversations:
 *   get:
 *     tags: [AI Chat]
 *     summary: Get all conversations for the authenticated user
 *     description: Accepts a **Clerk session token** or an **admin JWT**.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of conversation objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 count:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/ai/chat/conversations',
  flexibleAuth,
  aiChatController.getAllConversations.bind(aiChatController)
);

/**
 * @openapi
 * /ai/chat/conversations/{id}:
 *   get:
 *     tags: [AI Chat]
 *     summary: Get a specific conversation by ID
 *     description: Requires a **Clerk session token** (not admin JWT).
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
 *         description: Conversation object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
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
 *     tags: [AI Chat]
 *     summary: Archive (soft-delete) a conversation
 *     description: Requires a **Clerk session token** (not admin JWT).
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
 *         description: Conversation archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Conversation archived }
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
router.get(
  '/ai/chat/conversations/:id',
  requireClerkAuth,
  validateParams(conversationIdParamSchema),
  aiChatController.getConversation.bind(aiChatController)
);
router.delete(
  '/ai/chat/conversations/:id',
  requireClerkAuth,
  validateParams(conversationIdParamSchema),
  aiChatController.archiveConversation.bind(aiChatController)
);

/**
 * @openapi
 * /ai/chat/conversations/{conversationId}:
 *   put:
 *     tags: [AI Chat]
 *     summary: Update the pinned status of a conversation
 *     description: |
 *       Accepts a **Clerk session token** or an **admin JWT**.
 *       Also available at the legacy singular path `/ai/chat/conversation/{conversationId}`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pinned]
 *             properties:
 *               pinned:
 *                 type: boolean
 *                 description: Set to true to pin, false to unpin
 *                 example: true
 *           example:
 *             pinned: true
 *     responses:
 *       200:
 *         description: Conversation updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Validation error — pinned must be a boolean
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/ai/chat/conversation/:conversationId',
  flexibleAuth,
  validateBody(updatePinnedSchema),
  aiChatController.updatePinned.bind(aiChatController)
);
router.put(
  '/ai/chat/conversations/:conversationId',
  flexibleAuth,
  validateBody(updatePinnedSchema),
  aiChatController.updatePinned.bind(aiChatController)
);

/**
 * @openapi
 * /ai/chat/history/{conversationId}:
 *   get:
 *     tags: [AI Chat]
 *     summary: Get paginated message history for a conversation
 *     description: Requires a **Clerk session token** (not admin JWT).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Number of messages per page
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Pagination cursor from a previous response
 *     responses:
 *       200:
 *         description: Paginated message history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ConversationMessage'
 *                     nextCursor:
 *                       type: string
 *                       nullable: true
 *                       description: Pass as `cursor` in the next request to fetch the previous page
 *                       example: msg_cursor_xyz
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/ai/chat/history/:conversationId',
  requireClerkAuth,
  validateParams(conversationIdFromConversationsParamSchema),
  validateQuery(historyQuerySchema),
  aiChatController.getHistory.bind(aiChatController)
);

/**
 * @openapi
 * /ai/chat/export/{conversationId}:
 *   get:
 *     tags: [AI Chat]
 *     summary: Export a full conversation as a plain-text file
 *     description: Requires a **Clerk session token** (not admin JWT). Returns the conversation as a downloadable text file.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     responses:
 *       200:
 *         description: Conversation exported as plain text
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "User: What is the SEC fine limit?\nAssistant: The SEC fine limit is..."
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/ai/chat/export/:conversationId',
  requireClerkAuth,
  aiChatController.exportConversation.bind(aiChatController)
);

/**
 * @openapi
 * /ai/chat/messages/{messageId}/export:
 *   get:
 *     tags: [AI Chat]
 *     summary: Export a single AI message as plain text
 *     description: |
 *       Accepts a **Clerk session token** or an **admin JWT**.
 *       Also available at the legacy path `/ai/chat/message/{messageId}/export` (singular).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string }
 *         example: m5xabc987def321ghi
 *     responses:
 *       200:
 *         description: Message content as plain text
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "The SEC announced a $450M fine against..."
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/ai/chat/messages/:messageId/export',
  flexibleAuth,
  aiChatController.exportMessage.bind(aiChatController)
);
// Legacy singular path variant
router.get(
  '/ai/chat/message/:messageId/export',
  flexibleAuth,
  aiChatController.exportMessage.bind(aiChatController)
);

/**
 * @openapi
 * /ai/health:
 *   get:
 *     tags: [AI Chat]
 *     summary: AI chat service health check
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: ok }
 *                     service: { type: string, example: ai-chat }
 *                     timestamp: { type: string, format: date-time }
 */
router.get('/ai/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'ai-chat',
      timestamp: new Date().toISOString(),
    },
  })
);

// ============================================
// LEGACY CHAT ROUTES  (served under /chat/...)
// ============================================

/**
 * @openapi
 * /chat/conversations:
 *   get:
 *     tags: [AI Chat]
 *     summary: "[Legacy] Get all conversations for the authenticated user"
 *     description: |
 *       **Deprecated** — use `GET /ai/chat/conversations` instead.
 *       Accepts a **Clerk session token** or an **admin JWT**.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of conversation objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 count:
 *                   type: integer
 *                   example: 3
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/chat/conversations',
  flexibleAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const conversations = await getCustomerConversationsDescending(userId);

      const conversationsWithTitles = conversations.map((conv: any) => ({
        ...conv,
        title: conv.title || undefined,
      }));

      logger.debug(
        { count: conversationsWithTitles.length, userId },
        'Returning conversations'
      );

      return res.json({
        success: true,
        data: conversationsWithTitles,
        count: conversationsWithTitles.length,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Get conversations error');
      return res.status(500).json({
        success: false,
        error: 'Failed to get conversations',
        message: error.message,
      });
    }
  }
);

export default router;
