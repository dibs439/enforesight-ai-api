import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Check if admin user exists
 */
export const checkAdminExists = query({
  args: {},
  handler: async ctx => {
    const users = await ctx.db.query('users').collect();
    const existingAdmin = users.find(
      u => u.email === 'admin@enforesight.local'
    );

    return {
      exists: !!existingAdmin,
      userId: existingAdmin?._id,
    };
  },
});

/**
 * Create admin user (internal mutation)
 */
export const createAdmin = mutation({
  args: {
    hashedPassword: v.string(),
  },
  handler: async (ctx, { hashedPassword }) => {
    const adminUser = {
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@enforesight.local',
      password: hashedPassword,
      role: 'admin' as const,
      active: true,
    };

    return await ctx.db.insert('users', adminUser);
  },
});
