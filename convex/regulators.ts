import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';

// Get all regulators with pagination and filtering
export const getAllRegulators = query({
  args: {
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;

    let allRegulators;

    // Apply country filter first if provided (use index)
    if (args.country) {
      allRegulators = await ctx.db
        .query('regulators')
        .withIndex('by_country', q => q.eq('country', args.country!))
        .order('desc')
        .collect();
    } else {
      allRegulators = await ctx.db.query('regulators').order('desc').collect();
    }

    // If name filter is applied, do additional client-side filtering for partial matches
    let filteredRegulators = allRegulators;
    if (args.name) {
      const searchName = args.name.toLowerCase();
      filteredRegulators = allRegulators.filter(reg =>
        reg.name.toLowerCase().includes(searchName)
      );
    }

    const total = filteredRegulators.length;
    const regulators = filteredRegulators.slice(offset, offset + limit);

    return {
      regulators,
      total,
    };
  },
});

// Get regulator by ID
export const getRegulatorById = query({
  args: { id: v.id('regulators') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Add new regulator
export const createRegulator = mutation({
  args: {
    name: v.string(),
    country: v.string(),
    currency: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate name (case-sensitive)
    const existingByName = await ctx.db
      .query('regulators')
      .withIndex('by_name', q => q.eq('name', args.name))
      .first();

    if (existingByName) {
      throw new Error(
        `A regulator with the name "${args.name}" already exists`
      );
    }

    const regulatorData = {
      name: args.name,
      country: args.country,
      currency: args.currency,
      active: args.active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await ctx.db.insert('regulators', regulatorData);
  },
});

// Update regulator
export const updateRegulator = mutation({
  args: {
    id: v.id('regulators'),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    active: v.optional(v.boolean()),
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

    // Check for duplicate name if updating name
    if (cleanUpdates.name && typeof cleanUpdates.name === 'string') {
      const existingByName = await ctx.db
        .query('regulators')
        .withIndex('by_name', q => q.eq('name', cleanUpdates.name as string))
        .first();

      if (existingByName && existingByName._id !== id) {
        throw new Error(
          `A regulator with the name "${cleanUpdates.name}" already exists`
        );
      }
    }

    return await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Delete regulator
export const deleteRegulator = mutation({
  args: { id: v.id('regulators') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
