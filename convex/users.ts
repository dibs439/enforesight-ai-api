import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Note: Actions with bcrypt hashing are in userActions.ts (Node.js runtime)

// ============================================
// QUERIES
// ============================================

/**
 * Get all users with pagination and filtering
 */
export const getAllUsers = query({
  args: {
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
    q: v.optional(v.string()), // Search query for firstName, lastName, email
  },
  handler: async (ctx, args) => {
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;

    let allUsers = await ctx.db.query('users').collect();

    // Apply search filter if provided
    let filteredUsers = allUsers;
    if (args.q) {
      const searchQuery = args.q.toLowerCase();
      filteredUsers = allUsers.filter(user => {
        const firstName = (user.firstName || '').toLowerCase();
        const lastName = (user.lastName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const name = (user.name || '').toLowerCase();

        return (
          firstName.includes(searchQuery) ||
          lastName.includes(searchQuery) ||
          email.includes(searchQuery) ||
          name.includes(searchQuery)
        );
      });
    }

    const total = filteredUsers.length;
    const users = filteredUsers.slice(offset, offset + limit);

    return {
      users,
      total,
    };
  },
});

/**
 * Get user by ID
 */
export const getUserById = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get user by ID (accepts string userId)
 * Used by admin controllers
 */
export const getUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get user by activation code
 */
export const getUserByActivationCode = query({
  args: { activationCode: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    return users.find(
      user =>
        user.activationCode === args.activationCode &&
        user.activationCode !== undefined &&
        user.activationCode !== null
    );
  },
});

/**
 * Get user by email
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    return users.find(user => user.email === args.email?.toLowerCase());
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new user
 */
export const createUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('editor')),
    active: v.optional(v.boolean()),
    activationCode: v.optional(v.string()),
    activationCodeExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if user with email already exists
    const existingUsers = await ctx.db.query('users').collect();
    const existingUser = existingUsers.find(
      u => u.email === args.email.toLowerCase()
    );

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate required fields
    if (!args.firstName.trim() || !args.lastName.trim() || !args.email.trim()) {
      throw new Error('First name, last name, and email are required');
    }

    const userObject: any = {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email: args.email.trim().toLowerCase(),
      role: args.role,
      active: args.active ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add optional fields if provided
    if (args.password) {
      userObject.password = args.password;
    }
    if (args.activationCode) {
      userObject.activationCode = args.activationCode;
    }
    if (args.activationCodeExpiry) {
      userObject.activationCodeExpiry = args.activationCodeExpiry;
    }

    return await ctx.db.insert('users', userObject);
  },
});

/**
 * Update an existing user
 */
export const updateUser = mutation({
  args: {
    id: v.id('users'),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal('admin'), v.literal('editor'))),
    password: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Check if user exists
    const user = await ctx.db.get(id);
    if (!user) {
      throw new Error('User not found');
    }

    // If email is being updated, check for conflicts
    if (updates.email) {
      const allUsers = await ctx.db.query('users').collect();
      const existingUser = allUsers.find(
        u => u.email === updates.email?.toLowerCase()
      );

      if (existingUser && existingUser._id !== id) {
        throw new Error('User with this email already exists');
      }

      updates.email = updates.email.trim().toLowerCase();
    }

    // Trim text fields
    if (updates.firstName) {
      updates.firstName = updates.firstName.trim();
      if (!updates.firstName) {
        throw new Error('First name cannot be empty');
      }
    }

    if (updates.lastName) {
      updates.lastName = updates.lastName.trim();
      if (!updates.lastName) {
        throw new Error('Last name cannot be empty');
      }
    }

    // Remove undefined values
    const cleanUpdates: any = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }

    // Add updatedAt timestamp
    cleanUpdates.updatedAt = Date.now();

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

/**
 * Delete a user
 */
export const deleteUser = mutation({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ============================================
// ACTIVATION MUTATIONS
// ============================================

/**
 * Activate user account with activation code
 */
export const activateUser = mutation({
  args: {
    activationCode: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    const user = users.find(u => u.activationCode === args.activationCode);

    if (!user) {
      throw new Error('Invalid activation code');
    }

    // Check if activation code is expired
    const now = Date.now();
    if (!user.activationCodeExpiry || now > user.activationCodeExpiry) {
      throw new Error('Activation code has expired');
    }

    // Check if user is already active
    if (user.active) {
      throw new Error('User account is already activated');
    }

    // Activate user and clear activation code
    await ctx.db.patch(user._id, {
      active: true,
      activationCode: undefined,
      activationCodeExpiry: undefined,
      updatedAt: now,
    });

    return { userId: user._id, email: user.email };
  },
});

/**
 * Update user password (after activation)
 */
export const updateUserPassword = mutation({
  args: {
    userId: v.id('users'),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.active) {
      throw new Error('User account is not activated');
    }

    await ctx.db.patch(args.userId, {
      password: args.hashedPassword,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update activation code for resending activation email
 */
export const updateActivationCode = mutation({
  args: {
    email: v.string(),
    activationCode: v.string(),
    activationCodeExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    const user = users.find(u => u.email === args.email);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.active) {
      throw new Error('User account is already activated');
    }

    await ctx.db.patch(user._id, {
      activationCode: args.activationCode,
      activationCodeExpiry: args.activationCodeExpiry,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
