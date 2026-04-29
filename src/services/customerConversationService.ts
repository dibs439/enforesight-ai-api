import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { logger } from '../utils/logger';

const convexUrl = process.env.CONVEX_URL ?? 'https://placeholder.convex.cloud';

const convex = new ConvexHttpClient(convexUrl);

export interface CustomerConversation {
  _id: string;
  customerId: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreConversationResult extends CustomerConversation {
  isNew: boolean;
}

/**
 * Store or update a customer conversation in Convex
 * Automatically prevents duplicates
 * @param customerId - The customer ID
 * @param conversationId - The conversation ID
 * @param title - Optional title for the conversation (first user message)
 */
export async function storeCustomerConversation(
  customerId: string,
  conversationId: string,
  title?: string
): Promise<StoreConversationResult> {
  try {
    const result = await convex.mutation(
      api.customerConversations.storeConversation,
      {
        customerId,
        conversationId,
        title,
      }
    );
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Failed to store customer conversation');
    throw error;
  }
}

/**
 * Get all conversations for a customer
 */
export async function getCustomerConversations(
  customerId: string
): Promise<CustomerConversation[]> {
  try {
    const conversations = await convex.query(
      api.customerConversations.getCustomerConversations,
      {
        customerId,
      }
    );
    return conversations;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get customer conversations');
    throw error;
  }
}

/**
 * Get all conversations for a customer in descending order (most recent first)
 */
export async function getCustomerConversationsDescending(
  customerId: string
): Promise<CustomerConversation[]> {
  try {
    const conversations = await convex.query(
      api.customerConversations.getCustomerConversationsDescending,
      {
        customerId,
      }
    );
    return conversations;
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to get customer conversations (descending)'
    );
    throw error;
  }
}

/**
 * Get a specific conversation by ID
 */
export async function getConversationById(
  conversationId: string
): Promise<CustomerConversation | null> {
  try {
    const conversation = await convex.query(
      api.customerConversations.getConversation,
      {
        conversationId,
      }
    );
    return conversation;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get conversation');
    throw error;
  }
}

/**
 * Delete a conversation record
 */
export async function deleteCustomerConversation(
  customerId: string,
  conversationId: string
): Promise<{ success: boolean; conversationId: string }> {
  try {
    const result = await convex.mutation(
      api.customerConversations.deleteConversation,
      {
        customerId,
        conversationId,
      }
    );
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete conversation');
    throw error;
  }
}
