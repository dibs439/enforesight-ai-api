import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ========================================
  // ENFORCEMENT DATA (Enhanced from ai-engine)
  // ========================================
  enforcements: defineTable({
    // Core identification
    documentId: v.optional(v.string()),
    regulatorName: v.string(),
    subjectName: v.string(),
    jurisdiction: v.string(),

    // Classification
    sector: v.optional(v.string()),
    field: v.optional(v.string()),

    // Date information
    dateOfAction: v.optional(v.string()),
    year: v.optional(v.number()),
    month: v.optional(v.number()),

    // Action details (flexible types - supports both string and array)
    enforcementActionType: v.optional(v.union(v.string(), v.array(v.string()))),
    violationTypes: v.optional(v.union(v.string(), v.array(v.string()))),

    // Financial penalties
    fineAmount: v.optional(v.number()),
    currency: v.optional(v.string()),

    // Status
    underAppeal: v.optional(v.boolean()),

    // Content
    enforcementNoticeUrl: v.optional(v.string()),
    enforcementNoticeData: v.optional(v.string()),
    enforcementNoticeSummary: v.optional(v.string()),
    enforcementFile: v.optional(v.union(v.null(), v.string())),

    // AI Embeddings for semantic search
    summaryEmbedding: v.optional(v.array(v.number())),
    fullTextEmbedding: v.optional(v.array(v.number())),

    // Metadata
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    // Combined indexes from both projects
    .index('by_regulator', ['regulatorName']) // AI-engine index
    .index('by_jurisdiction', ['jurisdiction'])
    .index('by_year', ['year'])
    .index('by_subject', ['subjectName']) // AI-engine index
    .index('by_sector', ['sector'])
    .index('by_currency', ['currency'])
    .index('by_date', ['dateOfAction'])
    .index('by_year_month', ['year', 'month'])
    .index('by_fine_amount', ['fineAmount'])
    .index('by_document_subject', ['documentId', 'subjectName']) // Unique constraint enforcement
    .searchIndex('search_content', {
      searchField: 'enforcementNoticeData',
    }),

  // ========================================
  // AI ENGINE TABLES (New additions)
  // ========================================

  // Separate vector storage for semantic search
  enforcementVectors: defineTable({
    enforcementId: v.id('enforcements'),
    text: v.string(),
    embedding: v.array(v.number()),
    metadata: v.object({
      regulator: v.string(),
      subject_name: v.string(),
      fine_amount: v.optional(v.number()),
      currency: v.optional(v.string()),
      enforcement_date: v.optional(v.string()),
      jurisdiction: v.string(),
      sector: v.optional(v.string()),
      violation_types: v.optional(v.array(v.string())),
      action_types: v.optional(v.array(v.string())),
      url: v.optional(v.string()),
    }),
  })
    .index('by_enforcement', ['enforcementId'])
    .index('by_regulator', ['metadata.regulator'])
    .searchIndex('search_text', {
      searchField: 'text',
    }),

  // AI chatbot conversation management (inline messages)
  conversations: defineTable({
    conversation_id: v.string(),
    user_id: v.optional(v.string()),
    thread_id: v.optional(v.string()),
    status: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
    messages: v.array(
      v.object({
        id: v.string(),
        role: v.string(),
        content: v.string(),
        timestamp: v.string(),
        metadata: v.optional(v.any()),
      })
    ),
    context: v.optional(v.any()),
  })
    .index('by_conversation_id', ['conversation_id'])
    .index('by_user', ['user_id'])
    .index('by_status', ['status'])
    .index('by_updated', ['updated_at']),

  // Analytics and metrics for AI chatbot
  chatbotAnalytics: defineTable({
    queryType: v.string(),
    regulator: v.optional(v.string()),
    responseTime: v.number(),
    userSatisfaction: v.optional(v.number()),
    timestamp: v.string(),
  }).index('by_timestamp', ['timestamp']),

  // ========================================
  // EXISTING API TABLES (Preserved)
  // ========================================

  users: defineTable({
    // User fields
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('editor')),
    active: v.optional(v.boolean()),
    // Legacy fields for backward compatibility (optional)
    name: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    country: v.optional(v.string()),
    activationCode: v.optional(v.string()),
    activationCodeExpiry: v.optional(v.number()),
  }),

  contents: defineTable({
    title: v.string(),
    slug: v.string(),
    page: v.string(), // e.g. "about", "home", "contact"
    body: v.string(),
    bullets: v.array(v.string()),
    image: v.optional(v.string()),
    published: v.boolean(),
  }).index('by_slug', ['slug']),

  clients: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    logo: v.optional(v.string()),
  }).index('by_name', ['name']),

  regulators: defineTable({
    name: v.string(),
    country: v.string(),
    currency: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
    abbreviation: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  })
    .index('by_name', ['name'])
    .index('by_country', ['country'])
    .index('by_active', ['active']),

  customers: defineTable({
    clerkId: v.string(), // Unique ID from Clerk
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    active: v.boolean(),
    subscriptionTier: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    occupation: v.optional(v.string()),
    isSuspended: v.optional(v.boolean()),
    lastSignInAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email'])
    .index('by_active', ['active']),

  customerConversations: defineTable({
    customerId: v.string(), // Clerk user ID
    conversationId: v.string(), // Conversation ID from AI engine
    title: v.optional(v.string()), // AI-generated conversation title
    isPinned: v.optional(v.number()), // Pin status (0 = unpinned, 1 = pinned), default 0
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_customer_id', ['customerId'])
    .index('by_conversation_id', ['conversationId'])
    .index('by_customer_conversation', ['customerId', 'conversationId']), // Unique constraint

  conversationMessages: defineTable({
    conversationId: v.string(),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.string(),
    tokenCount: v.optional(v.number()),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_conversation_timestamp', ['conversationId', 'timestamp']),
});
