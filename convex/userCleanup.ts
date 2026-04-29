'use node';

import { api } from './_generated/api';
import { Doc } from './_generated/dataModel';
import { action } from './_generated/server';

export const cleanupUserData = action({
  args: {},
  handler: async (
    ctx,
    _args
  ): Promise<{ success: boolean; processedCount: number }> => {
    // Get all users
    const result = (await ctx.runQuery(api.users.getAllUsers, {})) as {
      users: Doc<'users'>[];
      total: number;
    };
    const users = result.users ?? (result as unknown as Doc<'users'>[]);

    const bcrypt = await import('bcryptjs');

    for (const user of users) {
      // If user has a plain password, hash it
      let hashedPassword;
      if (user.password) {
        if (!user.password.startsWith('$2')) {
          // Not already hashed
          hashedPassword = await bcrypt.hash(user.password, 10);
        } else {
          hashedPassword = user.password;
        }
      } else {
        // Set a default password for users without one
        hashedPassword = await bcrypt.hash('defaultpass123', 10);
      }

      // Replace the entire user document with cleaned data
      await ctx.runMutation(api.userCleanupMutations.replaceUserDocument, {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: hashedPassword,
        role: user.role,
      });
    }

    return { success: true, processedCount: users.length };
  },
});
