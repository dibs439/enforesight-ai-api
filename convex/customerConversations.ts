import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Store or update a customer conversation
 * Prevents duplicates by checking customerId + conversationId
 */
export const storeConversation = mutation({
  args: {
    customerId: v.string(),
    conversationId: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, conversationId, title } = args;

    // Check if conversation already exists for this customer
    const existing = await ctx.db
      .query('customerConversations')
      .withIndex('by_customer_conversation', q =>
        q.eq('customerId', customerId).eq('conversationId', conversationId)
      )
      .first();

    const now = new Date().toISOString();

    if (existing) {
      // Update the existing record with new updatedAt timestamp
      const updateData: any = {
        updatedAt: now,
      };
      // Only update title if it's provided and doesn't already exist
      if (title && !existing.title) {
        updateData.title = title;
      }
      await ctx.db.patch(existing._id, updateData);
      return {
        _id: existing._id,
        customerId: existing.customerId,
        conversationId: existing.conversationId,
        createdAt: existing.createdAt,
        updatedAt: now,
        isNew: false,
        title: existing.title || title,
      };
    } else {
      // Create new conversation record
      const conversationData: any = {
        customerId,
        conversationId,
        createdAt: now,
        updatedAt: now,
      };
      // Add title if provided
      if (title) {
        conversationData.title = title;
      }

      const conversationRecordId = await ctx.db.insert(
        'customerConversations',
        conversationData
      );

      return {
        _id: conversationRecordId,
        customerId,
        conversationId,
        createdAt: now,
        updatedAt: now,
        isNew: true,
        title: title || undefined,
      };
    }
  },
});

/**
 * Get all conversations for a customer
 */
export const getCustomerConversations = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query('customerConversations')
      .withIndex('by_customer_id', q => q.eq('customerId', args.customerId))
      .collect();

    return conversations.map(conv => ({
      _id: conv._id,
      customerId: conv.customerId,
      conversationId: conv.conversationId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      title: conv.title,
      isPinned: conv.isPinned,
    }));
  },
});

/**
 * Get all conversations for a customer in descending order (by updatedAt)
 */
export const getCustomerConversationsDescending = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query('customerConversations')
      .withIndex('by_customer_id', q => q.eq('customerId', args.customerId))
      .collect();

    // Sort by updatedAt in descending order (most recent first)
    const sorted = conversations.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order
    });

    return sorted.map(conv => ({
      _id: conv._id,
      customerId: conv.customerId,
      conversationId: conv.conversationId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      title: conv.title,
      isPinned: conv.isPinned,
    }));
  },
});

/**
 * Get a specific conversation by ID
 */
export const getConversation = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query('customerConversations')
      .withIndex('by_conversation_id', q =>
        q.eq('conversationId', args.conversationId)
      )
      .first();

    if (!conversation) {
      return null;
    }

    return {
      _id: conversation._id,
      customerId: conversation.customerId,
      conversationId: conversation.conversationId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      title: conversation.title,
    };
  },
});

/**
 * Get all conversations without titles (for batch updating)
 */
export const getConversationsWithoutTitles = query({
  async handler(ctx) {
    const conversations = await ctx.db.query('customerConversations').collect();

    // Filter for records without titles
    const withoutTitles = conversations.filter(
      conv => !conv.title || conv.title.trim() === ''
    );

    return withoutTitles.map(conv => ({
      _id: conv._id,
      customerId: conv.customerId,
      conversationId: conv.conversationId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));
  },
});

/**
 * Update a conversation with a title
 */
export const updateConversationTitle = mutation({
  args: {
    conversationId: v.string(),
    title: v.string(),
  },
  async handler(ctx, args) {
    const conversation = await ctx.db
      .query('customerConversations')
      .withIndex('by_conversation_id', q =>
        q.eq('conversationId', args.conversationId)
      )
      .first();

    if (!conversation) {
      throw new Error(`Conversation not found: ${args.conversationId}`);
    }

    const now = new Date().toISOString();

    await ctx.db.patch(conversation._id, {
      title: args.title,
      updatedAt: now,
    });

    return {
      _id: conversation._id,
      conversationId: conversation.conversationId,
      title: args.title,
      updatedAt: now,
    };
  },
});

/**
 * Delete a conversation record
 */
export const deleteConversation = mutation({
  args: {
    conversationId: v.string(),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query('customerConversations')
      .withIndex('by_customer_conversation', q =>
        q
          .eq('customerId', args.customerId)
          .eq('conversationId', args.conversationId)
      )
      .first();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await ctx.db.delete(conversation._id);

    return {
      success: true,
      conversationId: args.conversationId,
    };
  },
});

/**
 * Update the title of a customer conversation
 */
export const updateTitle = mutation({
  args: {
    id: v.id('customerConversations'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, title } = args;

    const conversation = await ctx.db.get(id);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const now = new Date().toISOString();

    await ctx.db.patch(id, {
      title,
      updatedAt: now,
    });

    return {
      _id: id,
      title,
      updatedAt: now,
    };
  },
});

/**
 * Batch migrate titles for conversations without them
 * Useful for populating legacy records with titles
 */
export const batchUpdateTitles = mutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id('customerConversations'),
        title: v.string(),
      })
    ),
  },
  async handler(ctx, args) {
    const now = new Date().toISOString();
    const results = [];

    for (const update of args.updates) {
      try {
        const conversation = await ctx.db.get(update.id);
        if (
          conversation &&
          (!conversation.title || conversation.title.trim() === '')
        ) {
          await ctx.db.patch(update.id, {
            title: update.title,
            updatedAt: now,
          });
          results.push({
            id: update.id,
            success: true,
            title: update.title,
          });
        } else {
          results.push({
            id: update.id,
            success: false,
            reason: 'Already has a title or not found',
          });
        }
      } catch (error) {
        results.push({
          id: update.id,
          success: false,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  },
});

/**
 * Get all conversations for a specific conversationId
 */
export const getByConversationId = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query('customerConversations')
      .withIndex('by_conversation_id', q =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    return conversations.map(conv => ({
      _id: conv._id,
      customerId: conv.customerId,
      conversationId: conv.conversationId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      title: conv.title,
    }));
  },
});

/**
 * Get first conversation for a specific conversationId
 */
export const getFirstByConversationId = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query('customerConversations')
      .withIndex('by_conversation_id', q =>
        q.eq('conversationId', args.conversationId)
      )
      .first();

    if (!conversation) {
      return null;
    }

    return {
      _id: conversation._id,
      customerId: conversation.customerId,
      conversationId: conversation.conversationId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      title: conversation.title,
    };
  },
});

/**
 * Update conversation pinned status
 */
export const updateConversationPinned = mutation({
  args: {
    conversationId: v.string(),
    isPinned: v.number(), // 0 or 1
  },
  handler: async (ctx, args) => {
    const { conversationId, isPinned } = args;

    // Find the conversation by conversationId
    const conversation = await ctx.db
      .query('customerConversations')
      .withIndex('by_conversation_id', q =>
        q.eq('conversationId', conversationId)
      )
      .first();

    if (!conversation) {
      return null;
    }

    // Update the conversation with new isPinned status
    await ctx.db.patch(conversation._id, {
      isPinned,
      updatedAt: new Date().toISOString(),
    });

    return {
      _id: conversation._id,
      conversationId,
      isPinned,
      updatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Populate isPinned field with random boolean values for all records
 * Direct mutation that updates all records
 */
export const populateRandomPinnedStatus = mutation({
  async handler(ctx) {
    // Get all conversations
    const allConversations = await ctx.db
      .query('customerConversations')
      .collect();

    let updated = 0;

    // Update each conversation with random isPinned value
    for (const conversation of allConversations) {
      const randomBool = Math.random() < 0.5 ? 0 : 1; // 50% chance for 0 or 1

      await ctx.db.patch(conversation._id, {
        isPinned: randomBool,
        updatedAt: new Date().toISOString(),
      });

      updated++;
    }

    return {
      success: true,
      totalRecordsUpdated: updated,
      message: `Successfully updated ${updated} records with random isPinned values`,
    };
  },
});
