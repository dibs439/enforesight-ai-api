import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const replaceUserDocument = mutation({
  args: {
    id: v.id('users'),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal('admin'), v.literal('editor')),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.replace(id, updates);
    return { success: true };
  },
});
