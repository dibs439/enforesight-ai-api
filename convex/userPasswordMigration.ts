import { mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Add default passwords to existing users who don't have passwords
 */
export const addPasswordsToExistingUsers = mutation({
  args: {},
  handler: async ctx => {
    const users = await ctx.db.query('users').collect();
    const updatedUsers = [];

    for (const user of users) {
      if (!user.password || user.password === 'temp_password_change_me') {
        // Set default password (should be changed by admin)
        const defaultPassword = 'admin123'; // This will be hashed in production

        await ctx.db.patch(user._id, {
          password: defaultPassword,
        });

        updatedUsers.push({
          id: user._id,
          email: user.email,
          message: 'Default password set to "admin123"',
        });
      }
    }

    return {
      message: `Updated ${updatedUsers.length} users with default passwords`,
      updatedUsers,
    };
  },
});
