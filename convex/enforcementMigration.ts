import { mutation } from './_generated/server';

export const migrateEnforcementActionTypeToArray = mutation({
  args: {},
  handler: async ctx => {
    const enforcements = await ctx.db.query('enforcements').collect();
    let migratedCount = 0;

    console.log(`Found ${enforcements.length} enforcement records to migrate`);

    for (const enforcement of enforcements) {
      // Check if enforcementActionType is already an array
      if (!Array.isArray(enforcement.enforcementActionType)) {
        // Convert string to array
        await ctx.db.patch(enforcement._id, {
          enforcementActionType: [enforcement.enforcementActionType],
        });
        migratedCount++;
      }
    }

    console.log(`Migration complete: ${migratedCount} records migrated`);
    return {
      totalRecords: enforcements.length,
      migratedCount,
      message: `Migration complete: ${migratedCount} records migrated`,
    };
  },
});
