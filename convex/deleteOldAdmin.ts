import { mutation } from './_generated/server';

/**
 * Delete old admin user with username field
 */
export default mutation({
  args: {},
  handler: async ctx => {
    const users = await ctx.db.query('users').collect();
    const oldAdmin = users.find(u => u.firstName === 'Admin');

    if (oldAdmin) {
      await ctx.db.delete(oldAdmin._id);
      return {
        success: true,
        message: 'Old admin user deleted',
        deletedId: oldAdmin._id,
      };
    }

    return {
      success: false,
      message: 'No old admin user found',
    };
  },
});
