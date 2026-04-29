import { query } from './_generated/server';

// Get unique field values from the enforcements table
export const getUniqueFields = query({
  args: {},
  handler: async ctx => {
    const enforcements = await ctx.db.query('enforcements').collect();

    // Extract unique field values
    const fieldSet = new Set<string>();

    enforcements.forEach(enforcement => {
      if (enforcement.field) {
        fieldSet.add(enforcement.field);
      }
    });

    // Convert to sorted array
    const uniqueFields = Array.from(fieldSet).sort();

    return {
      fields: uniqueFields,
      total: uniqueFields.length,
    };
  },
});
