import { mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Update admin password by email
 * This is an internal mutation for admin password management
 */
export const updateAdminPassword = mutation({
  args: {
    email: v.string(),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const users = await ctx.db.query('users').collect();
    const user = users.find(u => u.email === args.email.toLowerCase());

    if (!user) {
      throw new Error(`User with email ${args.email} not found`);
    }

    // Update the password
    await ctx.db.patch(user._id, {
      password: args.hashedPassword,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: `Password updated successfully for ${args.email}`,
      userId: user._id,
    };
  },
});
