'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

// bcryptjs is the pure-JS port of bcrypt — no native bindings required.
// bcrypt itself uses node-pre-gyp native binaries which are NOT available in
// Convex's Lambda environment (linux/arm64/abi=115/node=20), causing:
//   "No native build was found for platform=linux arch=arm64 ..."
// bcryptjs hashes are 100% wire-compatible with bcrypt hashes already in the DB.

/**
 * Secure action to create user with password hashing
 */
export const createUserSecure = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    password: v.string(),
    active: v.optional(v.boolean()),
    role: v.union(v.literal('admin'), v.literal('editor')),
  },
  handler: async (ctx, args): Promise<string> => {
    // Hash password with bcryptjs (pure-JS, no native bindings — required for Convex Lambda)
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(args.password, 12);

    return await ctx.runMutation(api.users.createUser, {
      ...args,
      password: hashedPassword,
      active: args.active,
    });
  },
});

/**
 * Authenticate user with email and password
 */
export const authenticateUser = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get user with password
    const user: any = await ctx.runQuery(api.users.getUserByEmail, {
      email: args.email.toLowerCase().trim(),
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.active) {
      throw new Error(
        'Account not activated. Please check your email for activation link.'
      );
    }

    // Check if user has password set
    if (!user.password) {
      throw new Error('Password not set. Please complete account activation.');
    }

    // Verify password with bcryptjs (pure-JS, compatible with existing bcrypt hashes)
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(args.password, user.password);

    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Return user without password
    const {
      password,
      activationCode,
      activationCodeExpiry,
      ...userWithoutSensitive
    }: any = user;
    return userWithoutSensitive;
  },
});

/**
 * Create user with activation workflow
 */
export const createUserWithActivation = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    role: v.union(v.literal('admin'), v.literal('editor')),
  },
  handler: async (ctx, args): Promise<any> => {
    // Generate activation code (UUID-like)
    const crypto = globalThis.crypto;
    const activationCode = crypto.randomUUID();

    // Set expiry to 24 hours from now
    const activationCodeExpiry = Date.now() + 24 * 60 * 60 * 1000;

    // Create user with activation code
    const userId: string = await ctx.runMutation(api.users.createUser, {
      ...args,
      activationCode,
      activationCodeExpiry,
    });

    // TODO: Send activation email here
    // For now, we'll return the activation code for testing
    // In production, you would integrate with an email service like SendGrid, AWS SES, etc.

    return {
      userId,
      activationCode, // Remove this in production
      message: 'User created successfully. Activation email sent.',
    };
  },
});

/**
 * Create user with activation workflow and password
 */
export const createUserWithActivationAndPassword = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    role: v.union(v.literal('admin'), v.literal('editor')),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Generate activation code (UUID-like)
    const crypto = globalThis.crypto;
    const activationCode = crypto.randomUUID();

    // Set expiry to 24 hours from now
    const activationCodeExpiry = Date.now() + 24 * 60 * 60 * 1000;

    // Hash password with bcryptjs (pure-JS, no native bindings — required for Convex Lambda)
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(args.password, 12);
    const userId: string = await ctx.runMutation(api.users.createUser, {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      role: args.role,
      password: hashedPassword,
      activationCode,
      activationCodeExpiry,
    });

    return {
      userId,
      activationCode,
      message:
        'User created successfully with password. Activation email sent.',
    };
  },
});

/**
 * Resend activation email
 */
export const resendActivationEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getUserByEmail, {
      email: args.email.toLowerCase().trim(),
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.active) {
      throw new Error('User account is already activated');
    }

    // Generate new activation code
    const crypto = globalThis.crypto;
    const activationCode = crypto.randomUUID();

    // Set new expiry to 24 hours from now
    const activationCodeExpiry = Date.now() + 24 * 60 * 60 * 1000;

    // Update user with new activation code
    await ctx.runMutation(api.users.updateActivationCode, {
      email: args.email.toLowerCase().trim(),
      activationCode,
      activationCodeExpiry,
    });

    // TODO: Send activation email here
    // For now, we'll return the activation code for testing

    return {
      activationCode, // Remove this in production
      message: 'Activation email resent successfully.',
    };
  },
});

/**
 * Set user password after activation
 */
export const setUserPassword = action({
  args: {
    userId: v.id('users'),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate password strength
    if (args.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Hash password with bcryptjs (pure-JS, no native bindings — required for Convex Lambda)
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(args.password, 12);
    await ctx.runMutation(api.users.updateUserPassword, {
      userId: args.userId,
      hashedPassword,
    });

    return {
      success: true,
      message: 'Password set successfully',
    };
  },
});

/**
 * Internal mutation to update user password (for seeding)
 */
export const updateUserPassword = action({
  args: {
    userId: v.id('users'),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.users.updateUserPassword, {
      userId: args.userId,
      hashedPassword: args.hashedPassword,
    });

    return {
      success: true,
      message: 'Password updated successfully',
    };
  },
});
