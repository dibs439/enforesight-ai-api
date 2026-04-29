import express, { Request, Response, Router } from 'express';
import { WebhookController } from '../../controllers/webhook.controller';
import { logger } from '../../utils/logger';

const router = Router();
const webhookController = new WebhookController();

/**
 * @openapi
 * /webhook/clerk:
 *   post:
 *     tags: [Webhooks]
 *     summary: Receive Clerk webhook events (user created, updated, deleted)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Clerk webhook event payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid payload
 */
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    // Convert raw buffer to JSON for the controller
    try {
      // Handle both Buffer (from express.raw) and already parsed objects
      if (Buffer.isBuffer(req.body)) {
        req.body = JSON.parse(req.body.toString());
      } else if (typeof req.body === 'string') {
        req.body = JSON.parse(req.body);
      }
      // If already an object, leave it as is

      logger.debug({ body: req.body }, 'Received Clerk webhook');
      return webhookController.handleClerkWebhook(req, res);
    } catch (parseError) {
      logger.error({ err: parseError }, 'Failed to parse webhook body');
      return res.status(400).json({
        error: 'Invalid JSON payload',
        details:
          parseError instanceof Error
            ? parseError.message
            : 'Unknown parsing error',
      });
    }
  }
);

export default router;
