import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const migrateDateFormats = mutation({
  args: {
    testMode: v.optional(v.boolean()), // If true, only migrate one record for testing
  },
  handler: async (ctx, args) => {
    const enforcements = await ctx.db.query('enforcements').collect();
    let migrated = 0;
    const testMode = args.testMode || false;
    let testedRecordId: string | null = null;

    console.log(`Found ${enforcements.length} enforcement records`);
    console.log(`Running in ${testMode ? 'TEST' : 'FULL'} mode`);

    for (const enforcement of enforcements) {
      const updates: any = {};

      // Standardize dateOfAction to ISO format if needed
      if (enforcement.dateOfAction) {
        const currentDate = enforcement.dateOfAction;
        let standardizedDate = currentDate;
        let year: number | undefined;
        let month: number | undefined;

        // Try to parse the current date and standardize it
        const date = new Date(currentDate);
        if (!isNaN(date.getTime())) {
          const isoDate = date.toISOString().split('T')[0]; // "YYYY-MM-DD"

          // Only update if the format is different
          if (currentDate !== isoDate) {
            standardizedDate = isoDate;
            updates.dateOfAction = isoDate;
          }

          // Extract year and month for indexing
          year = date.getFullYear();
          month = date.getMonth() + 1;

          // Add year and month fields if they don't exist
          if (enforcement.year === undefined) {
            updates.year = year;
          }
          if (enforcement.month === undefined) {
            updates.month = month;
          }
        }

        console.log(
          `Record ${enforcement._id}: "${currentDate}" -> "${standardizedDate}"`
        );
      }

      // Add timestamps if missing
      const now = new Date().toISOString();
      if (!enforcement.createdAt) {
        updates.createdAt = now;
      }
      if (!enforcement.updatedAt) {
        updates.updatedAt = now;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(enforcement._id, updates);
        migrated++;

        if (testMode) {
          testedRecordId = enforcement._id;
          console.log(`TEST MODE: Migrated record ${enforcement._id}`);
          break; // Only migrate one record in test mode
        }
      }

      if (testMode && migrated === 0) {
        // In test mode, if no updates needed, still log the first record for reference
        testedRecordId = enforcement._id;
        console.log(
          `TEST MODE: No updates needed for record ${enforcement._id}`
        );
        console.log(`Current date format: "${enforcement.dateOfAction}"`);
        break;
      }
    }

    return {
      message: testMode
        ? `TEST MODE: Processed 1 record (ID: ${testedRecordId})`
        : `Migrated ${migrated} enforcement records to standardized date format`,
      totalRecords: enforcements.length,
      migratedRecords: migrated,
      testRecordId: testMode ? testedRecordId : null,
      mode: testMode ? 'test' : 'full',
    };
  },
});

// Separate mutation to check current date formats
export const analyzeDateFormats = mutation({
  args: {},
  handler: async ctx => {
    const enforcements = await ctx.db.query('enforcements').take(5);

    const analysis = enforcements.map(enforcement => ({
      _id: enforcement._id,
      documentId: enforcement.documentId,
      subjectName: enforcement.subjectName,
      dateOfAction: enforcement.dateOfAction,
      currentFormat: typeof enforcement.dateOfAction,
      isValidDate: enforcement.dateOfAction ? !isNaN(new Date(enforcement.dateOfAction).getTime()) : false,
      parsedDate: enforcement.dateOfAction ? new Date(enforcement.dateOfAction).toISOString() : null,
    }));

    return {
      message: `Analyzed ${enforcements.length} sample records`,
      sampleData: analysis,
    };
  },
});
