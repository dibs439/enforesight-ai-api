import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Get all clients with pagination
export const getAllClients = query({
  args: {
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;

    const allClients = await ctx.db.query('clients').order('desc').collect();
    const total = allClients.length;
    const clients = allClients.slice(offset, offset + limit);

    return {
      clients,
      total,
    };
  },
});

// Get all active clients (for customer portal)
export const getActiveClients = query({
  args: {},
  handler: async ctx => {
    const clients = await ctx.db.query('clients').collect();
    // Filter for active clients (treat undefined as active for backwards compatibility)
    return clients.filter(client => client.active !== false);
  },
});

// Get client by ID
export const getClientById = query({
  args: { id: v.id('clients') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get client by name
export const getClientByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('clients')
      .withIndex('by_name', q => q.eq('name', args.name))
      .unique();
  },
});

// Create client
export const createClient = mutation({
  args: {
    name: v.string(),
    logo: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Set default active status if not provided
    const clientData = {
      ...args,
      active: args.active !== undefined ? args.active : true,
    };
    return await ctx.db.insert('clients', clientData);
  },
});

// Update client
export const updateClient = mutation({
  args: {
    id: v.id('clients'),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    logo: v.optional(v.string()),
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

    return await ctx.db.patch(id, cleanUpdates);
  },
});

// Delete client
export const deleteClient = mutation({
  args: { id: v.id('clients') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
