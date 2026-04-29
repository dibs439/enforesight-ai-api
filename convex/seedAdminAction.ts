'use node';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { action } from './_generated/server';

/**
 * Seed super admin user with hashed password
 * Email: admin@enforesight.local
 * Password: Admin@123
 */
export default action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    message: string;
    userId: Id<'users'> | undefined;
    credentials?: { email: string; password: string };
  }> => {
    // Check if admin already exists
    const users = (await ctx.runQuery(api.seedAdmin.checkAdminExists)) as {
      exists: boolean;
      userId: Id<'users'> | undefined;
    };

    if (users.exists) {
      return {
        success: false,
        message: 'Admin user already exists',
        userId: users.userId,
      };
    }

    // Hash the password (dynamic import for platform compatibility)
    const bcrypt = await import('bcryptjs');
    const password = 'Admin@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const userId = (await ctx.runMutation(api.seedAdmin.createAdmin, {
      hashedPassword,
    })) as Id<'users'>;

    return {
      success: true,
      message: 'Super admin user created successfully',
      userId,
      credentials: {
        email: 'admin@enforesight.local',
        password: 'Admin@123',
      },
    };
  },
});
