import { Response } from 'express';
import { ClerkAuthRequest } from '../middleware/clerkAuth';
import {
    deleteCustomerConversation,
    getConversationById,
    getCustomerConversations,
    getCustomerConversationsDescending,
    storeCustomerConversation,
} from '../services/customerConversationService';
import { logger } from '../utils/logger';

export class CustomerConversationsController {
  async store(req: ClerkAuthRequest, res: Response): Promise<void> {
    const { conversationId } = req.body;
    const customerId = req.clerkUser?.id;

    if (!customerId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    try {
      const result = await storeCustomerConversation(customerId, conversationId as string);
      res.json({
        success: true,
        data: result,
        message: result.isNew ? 'Conversation created' : 'Conversation updated',
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Store conversation error');
      res.status(500).json({ success: false, error: 'Failed to store conversation', message: error.message });
    }
  }

  async getAll(req: ClerkAuthRequest, res: Response): Promise<void> {
    const customerId = req.clerkUser?.id;

    if (!customerId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    try {
      const conversations = await getCustomerConversations(customerId);
      res.json({ success: true, data: conversations, count: conversations.length });
    } catch (error: any) {
      logger.error({ err: error }, 'Get conversations error');
      res.status(500).json({ success: false, error: 'Failed to get conversations', message: error.message });
    }
  }

  async getById(req: ClerkAuthRequest, res: Response): Promise<void> {
    const { conversationId } = req.params;
    const customerId = req.clerkUser?.id;

    if (!customerId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    try {
      const conversation = await getConversationById(conversationId as string);

      if (!conversation) {
        res.status(404).json({ success: false, error: 'Conversation not found' });
        return;
      }

      if (conversation.customerId !== customerId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.json({ success: true, data: conversation });
    } catch (error: any) {
      logger.error({ err: error }, 'Get conversation error');
      res.status(500).json({ success: false, error: 'Failed to get conversation', message: error.message });
    }
  }

  async remove(req: ClerkAuthRequest, res: Response): Promise<void> {
    const { conversationId } = req.params;
    const customerId = req.clerkUser?.id;

    if (!customerId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    try {
      const result = await deleteCustomerConversation(customerId, conversationId as string);
      res.json({ success: true, data: result, message: 'Conversation deleted successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Delete conversation error');

      if (error.message === 'Conversation not found') {
        res.status(404).json({ success: false, error: 'Conversation not found' });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to delete conversation', message: error.message });
    }
  }

  async getByTokenList(req: ClerkAuthRequest, res: Response): Promise<void> {
    const customerId = req.clerkUser?.id;

    if (!customerId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    try {
      const conversations = await getCustomerConversationsDescending(customerId);
      res.json({ success: true, data: conversations, count: conversations.length });
    } catch (error: any) {
      logger.error({ err: error }, 'Get conversations by token error');
      res.status(500).json({ success: false, error: 'Failed to get conversations', message: error.message });
    }
  }
}

export const customerConversationsController = new CustomerConversationsController();
