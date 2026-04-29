import { z } from 'zod';

export const chatMessageSchema = z.object({
  query: z.string().min(1, 'Query is required'),
});

export const conversationIdParamSchema = z.object({
  id: z.string().min(1, 'Conversation ID is required'),
});

export const conversationIdFromConversationsParamSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
});

export const historyQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(v => (v ? parseInt(v) : 50)),
});

export const updatePinnedSchema = z.object({
  isPinned: z
    .number({ error: 'isPinned is required and must be a number' })
    .refine(v => v === 0 || v === 1, 'isPinned must be 0 (unpinned) or 1 (pinned)'),
});

export const storeConversationSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
});
