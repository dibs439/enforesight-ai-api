import { mutation } from './_generated/server';

export const migrateExistingUsersToActivationSchema = mutation({
  args: {},
  handler: async ctx => {
    // Get all users
    const users = await ctx.db.query('users').collect();
    const now = Date.now();

    for (const user of users) {
      const updates: any = {};

      // Set missing fields
      if (user.active === undefined) {
        updates.active = true; // Existing users are considered activated
      }

      if (user.createdAt === undefined) {
        updates.createdAt = now;
      }

      if (user.updatedAt === undefined) {
        updates.updatedAt = now;
      }

      // Only update if there are changes needed
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(user._id, updates);
      }
    }

    return {
      message: `Migrated ${users.length} users to activation schema`,
      migratedUsers: users.length,
    };
  },
});
