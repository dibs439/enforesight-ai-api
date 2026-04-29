import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';

// Get contents by page
export const getByPage = query({
  args: { page: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contents')
      .filter(q => q.eq(q.field('page'), args.page))
      .collect();
  },
});

// Get content by slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contents')
      .withIndex('by_slug', q => q.eq('slug', args.slug))
      .unique();
  },
});

// Admin functions for content management
export const getAllContents = query({
  args: {},
  handler: async ctx => {
    return await ctx.db.query('contents').order('desc').collect();
  },
});

// Get content by ID
export const getContentById = query({
  args: { id: v.id('contents') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createContent = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    page: v.string(),
    body: v.string(),
    bullets: v.array(v.string()),
    image: v.string(),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('contents', args);
  },
});

export const updateContent = mutation({
  args: {
    id: v.id('contents'),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    page: v.optional(v.string()),
    body: v.optional(v.string()),
    bullets: v.optional(v.array(v.string())),
    image: v.optional(v.string()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error('No updates provided');
    }

    return await ctx.db.patch(id, cleanUpdates);
  },
});

export const deleteContent = mutation({
  args: { id: v.id('contents') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const toggleContentStatus = mutation({
  args: {
    id: v.id('contents'),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, { published: args.published });
  },
});
