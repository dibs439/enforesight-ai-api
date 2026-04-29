import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/**
 * Add a message to a conversation
 */
export const addMessage = mutation({
  args: {
    conversationId: v.string(),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),
    metadata: v.optional(v.any()),
    tokenCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const messageId = await ctx.db.insert('conversationMessages', {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      timestamp,
      tokenCount: args.tokenCount,
    });

    return { messageId, timestamp };
  },
});

/**
 * Get a specific message by its ID
 */
export const getMessage = query({
  args: {
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Convert the string ID to a proper Convex ID
    const message = await ctx.db.get(args.messageId as any);
    return message;
  },
});

/**
 * Get all messages for a conversation
 */
export const getMessages = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversation', q =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    return messages.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },
});

/**
 * Get recent messages for a conversation (limited count)
 */
export const getRecentMessages = query({
  args: {
    conversationId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const messages = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversation', q =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    // Sort by timestamp and get most recent N messages
    const sorted = messages.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return sorted.slice(-limit);
  },
});

/**
 * Delete all messages for a conversation
 */
export const deleteMessages = mutation({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversation', q =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    return { deletedCount: messages.length };
  },
});

/**
 * Get message count for a conversation
 */
export const getMessageCount = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversation', q =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    return messages.length;
  },
});

/**
 * Search messages by keyword and return matching conversation IDs
 */
export const searchMessagesByKeyword = query({
  args: {
    customerId: v.string(),
    keyword: v.string(),
  },
  handler: async (ctx, args) => {
    const { customerId, keyword } = args;
    const lowerKeyword = keyword.toLowerCase();

    // Get all conversations for this customer
    const conversations = await ctx.db
      .query('customerConversations')
      .withIndex('by_customer_id', q => q.eq('customerId', customerId))
      .collect();

    const conversationIds = conversations.map((c: any) => c.conversationId);
    const matchingConversationIds: string[] = [];

    // Search messages in each conversation
    for (const conversationId of conversationIds) {
      const messages = await ctx.db
        .query('conversationMessages')
        .withIndex('by_conversation', q =>
          q.eq('conversationId', conversationId)
        )
        .collect();

      // Check if any message contains the keyword
      const hasMatch = messages.some((msg: any) =>
        msg.content.toLowerCase().includes(lowerKeyword)
      );

      if (hasMatch) {
        matchingConversationIds.push(conversationId);
      }
    }

    return matchingConversationIds;
  },
});
