import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';

// Get all customers with pagination and filtering
export const getAllCustomers = query({
  args: {
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
    q: v.optional(v.string()), // Search query for firstName, lastName, email, phone
  },
  handler: async (ctx, args) => {
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;

    const allCustomers = await ctx.db
      .query('customers')
      .withIndex('by_active')
      .order('desc')
      .collect();

    // Apply search filter if provided
    let filteredCustomers = allCustomers;
    if (args.q) {
      const searchQuery = args.q.toLowerCase();
      filteredCustomers = allCustomers.filter(customer => {
        const firstName = (customer.firstName || '').toLowerCase();
        const lastName = (customer.lastName || '').toLowerCase();
        const email = (customer.email || '').toLowerCase();
        const phone = (customer.phoneNumber || '').toLowerCase();

        return (
          firstName.includes(searchQuery) ||
          lastName.includes(searchQuery) ||
          email.includes(searchQuery) ||
          phone.includes(searchQuery)
        );
      });
    }

    const total = filteredCustomers.length;
    const customers = filteredCustomers.slice(offset, offset + limit);

    return {
      customers,
      total,
    };
  },
});

// Get customer by ID
export const getCustomerById = query({
  args: { id: v.id('customers') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get customer by Clerk ID
export const getCustomerByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('customers')
      .withIndex('by_clerk_id', q => q.eq('clerkId', args.clerkId))
      .first();
  },
});

// Get customer by email
export const getCustomerByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('customers')
      .withIndex('by_email', q => q.eq('email', args.email))
      .first();
  },
});

// Create new customer (from Clerk webhook)
export const createCustomer = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    active: v.optional(v.boolean()),
    subscriptionTier: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    occupation: v.optional(v.string()),
    isSuspended: v.optional(v.boolean()),
    lastSignInAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if customer already exists
    const existingCustomer = await ctx.db
      .query('customers')
      .withIndex('by_clerk_id', q => q.eq('clerkId', args.clerkId))
      .first();

    if (existingCustomer) {
      throw new Error(
        `Customer with Clerk ID "${args.clerkId}" already exists`
      );
    }

    // Check for duplicate email
    const existingByEmail = await ctx.db
      .query('customers')
      .withIndex('by_email', q => q.eq('email', args.email))
      .first();

    if (existingByEmail) {
      throw new Error(`Customer with email "${args.email}" already exists`);
    }

    const now = new Date().toISOString();
    const customerData = {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName || '',
      lastName: args.lastName || '',
      imageUrl: args.imageUrl || '',
      active: args.active ?? true,
      subscriptionTier: args.subscriptionTier || 'free',
      phoneNumber: args.phoneNumber || '',
      occupation: args.occupation || '',
      isSuspended: args.isSuspended ?? false,
      lastSignInAt: args.lastSignInAt || now,
      createdAt: now,
      updatedAt: now,
    };

    return await ctx.db.insert('customers', customerData);
  },
});

// Update customer
export const updateCustomer = mutation({
  args: {
    id: v.id('customers'),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    active: v.optional(v.boolean()),
    subscriptionTier: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    occupation: v.optional(v.string()),
    isSuspended: v.optional(v.boolean()),
    lastSignInAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error('No updates provided');
    }

    // Check for duplicate email if updating email
    if (cleanUpdates.email && typeof cleanUpdates.email === 'string') {
      const existingByEmail = await ctx.db
        .query('customers')
        .withIndex('by_email', q => q.eq('email', cleanUpdates.email as string))
        .first();

      if (existingByEmail && existingByEmail._id !== id) {
        throw new Error(
          `Customer with email "${cleanUpdates.email}" already exists`
        );
      }
    }

    return await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Update customer by Clerk ID (useful for webhook updates)
export const updateCustomerByClerkId = mutation({
  args: {
    clerkId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    active: v.optional(v.boolean()),
    subscriptionTier: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    occupation: v.optional(v.string()),
    isSuspended: v.optional(v.boolean()),
    lastSignInAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkId, ...updates } = args;

    // Find customer by Clerk ID
    const customer = await ctx.db
      .query('customers')
      .withIndex('by_clerk_id', q => q.eq('clerkId', clerkId))
      .first();

    if (!customer) {
      throw new Error(`Customer with Clerk ID "${clerkId}" not found`);
    }

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error('No updates provided');
    }

    // Check for duplicate email if updating email
    if (cleanUpdates.email && typeof cleanUpdates.email === 'string') {
      const existingByEmail = await ctx.db
        .query('customers')
        .withIndex('by_email', q => q.eq('email', cleanUpdates.email as string))
        .first();

      if (existingByEmail && existingByEmail._id !== customer._id) {
        throw new Error(
          `Customer with email "${cleanUpdates.email}" already exists`
        );
      }
    }

    return await ctx.db.patch(customer._id, {
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Delete customer
export const deleteCustomer = mutation({
  args: { id: v.id('customers') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Delete customer by Clerk ID (useful for webhook deletions)
export const deleteCustomerByClerkId = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query('customers')
      .withIndex('by_clerk_id', q => q.eq('clerkId', args.clerkId))
      .first();

    if (!customer) {
      throw new Error(`Customer with Clerk ID "${args.clerkId}" not found`);
    }

    await ctx.db.delete(customer._id);
    return { success: true };
  },
});

// Update last sign in time
export const updateLastSignIn = mutation({
  args: {
    clerkId: v.string(),
    lastSignInAt: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query('customers')
      .withIndex('by_clerk_id', q => q.eq('clerkId', args.clerkId))
      .first();

    if (!customer) {
      throw new Error(`Customer with Clerk ID "${args.clerkId}" not found`);
    }

    return await ctx.db.patch(customer._id, {
      lastSignInAt: args.lastSignInAt,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Get customers with pagination and filtering
export const getCustomers = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    search: v.optional(v.string()), // Legacy support
    q: v.optional(v.string()), // New unified search parameter
    active: v.optional(v.boolean()),
    subscriptionTier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = args.page || 1;
    const limit = args.limit || 20;
    const offset = (page - 1) * limit;

    let query = ctx.db.query('customers');

    // Apply filters
    if (args.active !== undefined) {
      query = query.filter(q => q.eq(q.field('active'), args.active));
    }

    if (args.subscriptionTier) {
      query = query.filter(q =>
        q.eq(q.field('subscriptionTier'), args.subscriptionTier)
      );
    }

    const allCustomers = await query.collect();

    // Apply search filter - support both 'search' (legacy) and 'q' (new) parameters
    let filteredCustomers = allCustomers;
    const searchTerm = args.q || args.search;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredCustomers = allCustomers.filter(
        customer =>
          customer.email.toLowerCase().includes(searchLower) ||
          customer.firstName?.toLowerCase().includes(searchLower) ||
          customer.lastName?.toLowerCase().includes(searchLower) ||
          customer.phoneNumber?.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const customers = filteredCustomers.slice(offset, offset + limit);

    return {
      customers,
      total: filteredCustomers.length,
      page,
      limit,
    };
  },
});

// Get customer statistics
export const getCustomerStats = query({
  args: {},
  handler: async ctx => {
    const customers = await ctx.db.query('customers').collect();

    const total = customers.length;
    const active = customers.filter(c => c.active).length;
    const inactive = total - active;

    // Get date ranges
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Calculate yesterday
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Calculate week start (7 days ago)
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const weekStart = weekAgo.toISOString().split('T')[0];

    // Calculate previous week start (14 days ago to 7 days ago)
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 14);
    const prevWeekStart = twoWeeksAgo.toISOString().split('T')[0];

    // Calculate month start (30 days ago)
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);
    const monthStart = monthAgo.toISOString().split('T')[0];

    // Calculate previous month start (60 days ago to 30 days ago)
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setDate(now.getDate() - 60);
    const prevMonthStart = twoMonthsAgo.toISOString().split('T')[0];

    // Count users who signed in today
    const activeToday = customers.filter(customer => {
      if (!customer.lastSignInAt) return false;
      const signInDate = customer.lastSignInAt.split('T')[0];
      return signInDate === today;
    }).length;

    // Count users who signed in yesterday
    const activeYesterday = customers.filter(customer => {
      if (!customer.lastSignInAt) return false;
      const signInDate = customer.lastSignInAt.split('T')[0];
      return signInDate === yesterday;
    }).length;

    // Count users who signed in this week (last 7 days)
    const activeThisWeek = customers.filter(customer => {
      if (!customer.lastSignInAt) return false;
      const signInDate = customer.lastSignInAt.split('T')[0];
      return signInDate >= weekStart && signInDate <= today;
    }).length;

    // Count users who signed in previous week (14 days ago to 7 days ago)
    const activePrevWeek = customers.filter(customer => {
      if (!customer.lastSignInAt) return false;
      const signInDate = customer.lastSignInAt.split('T')[0];
      return signInDate >= prevWeekStart && signInDate < weekStart;
    }).length;

    // Count users who signed in this month (last 30 days)
    const activeThisMonth = customers.filter(customer => {
      if (!customer.lastSignInAt) return false;
      const signInDate = customer.lastSignInAt.split('T')[0];
      return signInDate >= monthStart && signInDate <= today;
    }).length;

    // Count users who signed in previous month (60 days ago to 30 days ago)
    const activePrevMonth = customers.filter(customer => {
      if (!customer.lastSignInAt) return false;
      const signInDate = customer.lastSignInAt.split('T')[0];
      return signInDate >= prevMonthStart && signInDate < monthStart;
    }).length;

    // Calculate percentage changes
    const dailyChangePercent =
      activeYesterday === 0
        ? activeToday > 0
          ? 100
          : 0
        : ((activeToday - activeYesterday) / activeYesterday) * 100;

    const weeklyChangePercent =
      activePrevWeek === 0
        ? activeThisWeek > 0
          ? 100
          : 0
        : ((activeThisWeek - activePrevWeek) / activePrevWeek) * 100;

    const monthlyChangePercent =
      activePrevMonth === 0
        ? activeThisMonth > 0
          ? 100
          : 0
        : ((activeThisMonth - activePrevMonth) / activePrevMonth) * 100;

    const subscriptionTiers = customers.reduce((acc: any, customer) => {
      const tier = customer.subscriptionTier || 'free';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      active,
      inactive,
      activeToday,
      activeYesterday,
      dailyChangePercent: Number(dailyChangePercent.toFixed(2)),
      activeThisWeek,
      activePrevWeek,
      weeklyChangePercent: Number(weeklyChangePercent.toFixed(2)),
      activeThisMonth,
      activePrevMonth,
      monthlyChangePercent: Number(monthlyChangePercent.toFixed(2)),
      subscriptionTiers,
    };
  },
});
