import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ─── Paginated listing (safe against 16MB byte-read limit) ──────────
// Each call from the API layer is a SEPARATE Convex function execution,
// so each gets its own 16MB budget. The Express controller iterates
// through pages using the continueCursor returned here.
export const listEnforcementsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    // Filter options (same as getAllEnforcements)
    regulator: v.optional(v.string()),
    field: v.optional(v.string()),
    jurisdiction: v.optional(v.string()),
    sector: v.optional(v.string()),
    actionType: v.optional(v.string()),
    violationType: v.optional(v.string()),
    currency: v.optional(v.string()),
    minFineAmount: v.optional(v.number()),
    maxFineAmount: v.optional(v.number()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ── 1. Start with base query ──
    let queryBuilder: any = ctx.db.query('enforcements');

    // ── 2. Apply filters ──
    if (args.regulator) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.eq(q.field('regulatorName'), args.regulator)
      );
    }
    if (args.jurisdiction) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.eq(q.field('jurisdiction'), args.jurisdiction)
      );
    }
    if (args.sector) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.eq(q.field('sector'), args.sector)
      );
    }
    if (args.currency) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.eq(q.field('currency'), args.currency)
      );
    }
    if (args.field) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.eq(q.field('field'), args.field)
      );
    }
    if (args.minFineAmount !== undefined) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.gte(q.field('fineAmount'), args.minFineAmount!)
      );
    }
    if (args.maxFineAmount !== undefined) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.lte(q.field('fineAmount'), args.maxFineAmount!)
      );
    }
    if (args.dateFrom) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.gte(q.field('dateOfAction'), args.dateFrom!)
      );
    }
    if (args.dateTo) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.lte(q.field('dateOfAction'), args.dateTo!)
      );
    }

    // ── 3. Paginate (bounded read per execution) ──
    const result = await queryBuilder.paginate(args.paginationOpts);

    // ── 4. JS-level filters for things Convex filter() can't express ──
    let filteredPage = result.page as any[];

    if (args.actionType) {
      filteredPage = filteredPage.filter(e => {
        const types = Array.isArray(e.enforcementActionType)
          ? e.enforcementActionType
          : e.enforcementActionType
            ? [e.enforcementActionType]
            : [];
        return types.includes(args.actionType);
      });
    }

    if (args.violationType) {
      filteredPage = filteredPage.filter(e => {
        const types = Array.isArray(e.violationTypes)
          ? e.violationTypes
          : e.violationTypes
            ? [e.violationTypes]
            : [];
        return types.includes(args.violationType);
      });
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filteredPage = filteredPage.filter(
        e =>
          e.subjectName?.toLowerCase().includes(searchLower) ||
          e.enforcementNoticeData?.toLowerCase().includes(searchLower)
      );
    }

    // ── 5. Strip large fields not needed for list views ──
    const lightPage = filteredPage.map(
      ({
        summaryEmbedding,
        fullTextEmbedding,
        enforcementNoticeData,
        ...rest
      }: any) => rest
    );

    return {
      page: lightPage,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// Get all enforcements with pagination and filtering
export const getAllEnforcements = query({
  args: {
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
    // Filter options
    regulator: v.optional(v.string()),
    field: v.optional(v.string()),
    jurisdiction: v.optional(v.string()),
    sector: v.optional(v.string()),
    actionType: v.optional(v.string()),
    violationType: v.optional(v.string()),
    currency: v.optional(v.string()),
    minFineAmount: v.optional(v.number()),
    maxFineAmount: v.optional(v.number()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    search: v.optional(v.string()), // Search in subjectName and enforcementNoticeData
  },
  handler: async (ctx, args) => {
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;

    // Use paginated approach to avoid 16MB limit
    // Apply regulator filter at index level to avoid loading too much data
    const batchSize = 100;
    let allFilteredEnforcements: any[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      let queryObj = ctx.db.query('enforcements').withIndex('by_regulator');

      // CRITICAL FIX: Apply regulator filter at index level if specified
      if (args.regulator) {
        queryObj = queryObj.filter(q =>
          q.eq(q.field('regulatorName'), args.regulator)
        );
      }

      if (cursor) {
        const [cursorRegulator, cursorId] = cursor.split('|');
        queryObj = queryObj.filter(q =>
          q.or(
            q.gt(q.field('regulatorName'), cursorRegulator),
            q.and(
              q.eq(q.field('regulatorName'), cursorRegulator),
              q.gt(q.field('_id'), cursorId as any)
            )
          )
        );
      }

      const records = await queryObj.take(batchSize + 1);
      hasMore = records.length > batchSize;
      const items = records.slice(0, batchSize);

      if (items.length === 0) break;

      // Apply filters to this batch
      const filteredBatch = items.filter(e => {
        // Exact match filters (regulator already filtered at index level)
        if (args.jurisdiction && e.jurisdiction !== args.jurisdiction)
          return false;
        if (args.sector && e.sector !== args.sector) return false;
        if (args.currency && e.currency !== args.currency) return false;
        if (args.field && e.field !== args.field) return false;

        // Array field filters
        if (args.actionType) {
          const actionTypes = Array.isArray(e.enforcementActionType)
            ? e.enforcementActionType
            : e.enforcementActionType
              ? [e.enforcementActionType]
              : [];
          if (!actionTypes.includes(args.actionType)) return false;
        }

        if (args.violationType) {
          const violationTypes = Array.isArray(e.violationTypes)
            ? e.violationTypes
            : e.violationTypes
              ? [e.violationTypes]
              : [];
          if (!violationTypes.includes(args.violationType)) return false;
        }

        // Fine amount range filter
        if (
          args.minFineAmount !== undefined &&
          (e.fineAmount ?? 0) < args.minFineAmount
        )
          return false;
        if (
          args.maxFineAmount !== undefined &&
          (e.fineAmount ?? 0) > args.maxFineAmount
        )
          return false;

        // Date range filter
        if (
          args.dateFrom &&
          (!e.dateOfAction || e.dateOfAction < args.dateFrom)
        )
          return false;
        if (args.dateTo && (!e.dateOfAction || e.dateOfAction > args.dateTo))
          return false;

        // Search filter
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          const subjectMatch =
            e.subjectName?.toLowerCase().includes(searchLower) || false;
          const noticeMatch =
            e.enforcementNoticeData?.toLowerCase().includes(searchLower) ||
            false;
          if (!subjectMatch && !noticeMatch) return false;
        }

        return true;
      });

      allFilteredEnforcements.push(...filteredBatch);

      // If we have enough results for the requested page, we can stop early
      if (allFilteredEnforcements.length >= offset + limit) {
        break;
      }

      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        cursor = `${lastItem.regulatorName}|${String(lastItem._id)}`;
      }
    }

    const total = allFilteredEnforcements.length;
    const enforcements = allFilteredEnforcements.slice(offset, offset + limit);

    return {
      enforcements,
      total,
    };
  },
});

// Get enforcement by ID
export const getEnforcementById = query({
  args: { id: v.id('enforcements') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get enforcements by jurisdiction
export const getByJurisdiction = query({
  args: { jurisdiction: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('enforcements')
      .filter(q => q.eq(q.field('jurisdiction'), args.jurisdiction))
      .collect();
  },
});

// Get enforcements by regulator with pagination
export const getByRegulator = query({
  args: {
    regulatorName: v.string(),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;

    const allFilteredEnforcements = await ctx.db
      .query('enforcements')
      .filter(q => q.eq(q.field('regulatorName'), args.regulatorName))
      .collect();

    const total = allFilteredEnforcements.length;
    const enforcements = allFilteredEnforcements.slice(offset, offset + limit);

    return {
      enforcements,
      total,
    };
  },
});

//	 by sector
export const getBySector = query({
  args: { sector: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('enforcements')
      .filter(q => q.eq(q.field('sector'), args.sector))
      .collect();
  },
});

// Check if enforcement exists by documentId and subjectName
export const getByDocumentIdAndSubject = query({
  args: {
    documentId: v.string(),
    subjectName: v.string(),
    enforcementNoticeUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query('enforcements')
      .withIndex('by_document_subject', q =>
        q.eq('documentId', args.documentId).eq('subjectName', args.subjectName)
      )
      .collect();

    if (!candidates.length) return null;

    // If enforcementNoticeUrl provided, apply 3rd-field uniqueness check in JS
    if (args.enforcementNoticeUrl !== undefined) {
      const incomingUrl = (args.enforcementNoticeUrl ?? '')
        .trim()
        .toLowerCase();
      return (
        candidates.find(
          r =>
            (r.enforcementNoticeUrl ?? '').trim().toLowerCase() === incomingUrl
        ) ?? null
      );
    }

    return candidates[0];
  },
});

// Get enforcement by ID
export const getById = query({
  args: { id: v.id('enforcements') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create enforcement
export const createEnforcement = mutation({
  args: {
    documentId: v.string(),
    jurisdiction: v.string(),
    regulatorName: v.string(),
    subjectName: v.string(),
    subjectNameCase: v.optional(v.string()),
    sector: v.string(),
    dateOfAction: v.string(),
    enforcementActionType: v.array(v.string()),
    field: v.string(),
    violationTypes: v.array(v.string()),
    fineAmount: v.number(),
    currency: v.optional(v.string()),
    enforcementNoticeUrl: v.optional(v.string()),
    enforcementFile: v.optional(v.union(v.string(), v.null())),
    enforcementNoticeData: v.string(),
    enforcementNoticeSummary: v.optional(v.string()),
    summaryEmbedding: v.optional(v.array(v.number())),
    fullTextEmbedding: v.optional(v.array(v.number())),
    underAppeal: v.optional(v.boolean()),
    year: v.optional(v.number()),
    month: v.optional(v.number()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing record with same documentId + subjectName + enforcementNoticeUrl (3-field composite uniqueness)
    const candidates = await ctx.db
      .query('enforcements')
      .withIndex('by_document_subject', q =>
        q.eq('documentId', args.documentId).eq('subjectName', args.subjectName)
      )
      .collect();

    if (candidates.length > 0) {
      const incomingUrl = (args.enforcementNoticeUrl ?? '')
        .trim()
        .toLowerCase();
      const duplicate = candidates.find(
        r => (r.enforcementNoticeUrl ?? '').trim().toLowerCase() === incomingUrl
      );

      if (duplicate) {
        throw new Error(
          `An enforcement record already exists for Document ID "${args.documentId}", Subject "${args.subjectName}" and URL "${args.enforcementNoticeUrl ?? 'n/a'}". All three fields must be unique together.`
        );
      }
    }

    return await ctx.db.insert('enforcements', args);
  },
});

// Update enforcement
export const updateEnforcement = mutation({
  args: {
    id: v.id('enforcements'),
    data: v.object({
      documentId: v.optional(v.string()),
      jurisdiction: v.optional(v.string()),
      regulatorName: v.optional(v.string()),
      subjectName: v.optional(v.string()),
      sector: v.optional(v.string()),
      dateOfAction: v.optional(v.string()),
      enforcementActionType: v.optional(v.array(v.string())),
      field: v.optional(v.string()),
      violationTypes: v.optional(v.array(v.string())),
      fineAmount: v.optional(v.number()),
      currency: v.optional(v.string()),
      enforcementNoticeUrl: v.optional(v.string()),
      enforcementFile: v.optional(v.union(v.string(), v.null())),
      enforcementNoticeData: v.optional(v.string()),
      enforcementNoticeSummary: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { id, data } = args;

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(data).filter(
        ([_, value]) => value !== undefined && value !== null
      )
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error('No updates provided');
    }

    return await ctx.db.patch(id, cleanUpdates);
  },
});

// Delete enforcement
export const deleteEnforcement = mutation({
  args: { id: v.id('enforcements') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Update embeddings for an enforcement record
export const updateEmbeddings = mutation({
  args: {
    id: v.id('enforcements'),
    summaryEmbedding: v.optional(v.array(v.number())),
    fullTextEmbedding: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (args.summaryEmbedding) {
      updates.summaryEmbedding = args.summaryEmbedding;
    }

    if (args.fullTextEmbedding) {
      updates.fullTextEmbedding = args.fullTextEmbedding;
    }

    await ctx.db.patch(args.id, updates);
    return { success: true };
  },
});

// Get enforcement statistics
export const getEnforcementsStats = query({
  args: {},
  handler: async ctx => {
    // Reading full documents on a large table exceeds Convex's 16MB
    // per-execution byte limit. We fetch only _id values via a single
    // paginate call (one page) which is orders of magnitude smaller.
    // numItems is capped at 8192 by Convex – well within the byte limit
    // when only _ids are projected.
    const page = await ctx.db
      .query('enforcements')
      .paginate({ cursor: null, numItems: 8192 });

    // If the table has more records than one page, isDone will be false.
    // We return the page count plus a flag so the UI can show "8192+".
    return {
      total: page.page.length,
      hasMore: !page.isDone,
    };
  },
});

// Get all enforcement records that have URL but no extracted data
export const getRecordsNeedingExtraction = query({
  args: {},
  handler: async ctx => {
    // Use paginated approach to avoid 16MB limit
    let total = 0;
    let withUrlAndData = 0;
    let recordsNeedingExtraction: any[] = [];
    let cursor: string | null = null;
    const batchSize = 100;

    while (true) {
      let queryObj = ctx.db.query('enforcements').withIndex('by_regulator');

      if (cursor) {
        const [cursorRegulator, cursorId] = cursor.split('|');
        queryObj = queryObj.filter(q =>
          q.or(
            q.gt(q.field('regulatorName'), cursorRegulator),
            q.and(
              q.eq(q.field('regulatorName'), cursorRegulator),
              q.gt(q.field('_id'), cursorId as any)
            )
          )
        );
      }

      const records = await queryObj.take(batchSize + 1);
      const hasMore = records.length > batchSize;
      const items = records.slice(0, batchSize);

      total += items.length;

      for (const record of items) {
        if (
          record.enforcementNoticeUrl?.trim() &&
          record.enforcementNoticeData?.trim()
        ) {
          withUrlAndData++;
        }
        if (
          record.enforcementNoticeUrl &&
          record.enforcementNoticeUrl.trim() &&
          (!record.enforcementNoticeData ||
            !record.enforcementNoticeData.trim())
        ) {
          recordsNeedingExtraction.push(record);
        }
      }

      if (!hasMore) break;

      const lastItem = items[items.length - 1];
      cursor = `${lastItem.regulatorName}|${String(lastItem._id)}`;
    }

    return {
      total,
      withUrlAndData,
      needsExtraction: recordsNeedingExtraction.length,
      records: recordsNeedingExtraction,
    };
  },
});

// Get all enforcements for batch processing
//
// Uses Convex's built-in .paginate() so each call seeks directly to the cursor
// position rather than re-scanning from the start of the index (the old manual
// .filter() cursor caused O(N²) byte reads and reliably blew the 16 MB limit).
//
// Pass regulatorName to scope the query to a single regulator via the
// by_regulator index — this is the primary guard against the 16 MB limit when
// the caller knows the target regulator (e.g. all FCA-specific queries).
export const getAllEnforcementsForBatch = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    regulatorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const paginationOpts = { cursor: args.cursor ?? null, numItems: limit };

    let result;
    if (args.regulatorName) {
      // Scoped to one regulator: only reads that regulator's documents
      result = await ctx.db
        .query('enforcements')
        .withIndex('by_regulator', q =>
          q.eq('regulatorName', args.regulatorName!)
        )
        .paginate(paginationOpts);
    } else {
      // Full scan — callers should use small limits to avoid hitting 16 MB
      result = await ctx.db
        .query('enforcements')
        .withIndex('by_regulator')
        .paginate(paginationOpts);
    }

    // Strip heavy fields before sending over the wire.
    // summaryEmbedding / fullTextEmbedding are large float arrays (~12 KB each).
    // enforcementNoticeData is raw document text that can be several MB.
    // None of these are needed by any consumer of this batch query.
    const items = result.page.map(
      ({
        summaryEmbedding: _se,
        fullTextEmbedding: _fe,
        enforcementNoticeData: _end,
        ...rest
      }) => rest
    );

    return {
      items,
      hasMore: !result.isDone,
      nextCursor: result.continueCursor,
    };
  },
});

// Update enforcement notice summary
export const updateSummary = mutation({
  args: {
    id: v.id('enforcements'),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      enforcementNoticeSummary: args.summary,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Update enforcement summary (alias for batch job compatibility)
export const updateEnforcementSummary = mutation({
  args: {
    id: v.id('enforcements'),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      enforcementNoticeSummary: args.summary,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Check if duplicate enforcement exists (efficient for bulk upload)
export const checkDuplicateExists = query({
  args: {
    subjectName: v.string(),
    regulatorName: v.string(),
    dateOfAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use by_regulator index for efficient filtering
    let queryObj = ctx.db
      .query('enforcements')
      .withIndex('by_regulator', q =>
        q.eq('regulatorName', args.regulatorName)
      );

    // Take a small batch to check
    const records = await queryObj.take(50);

    // Check for exact match in the batch
    const duplicate = records.find(
      record =>
        record.subjectName === args.subjectName &&
        record.dateOfAction === args.dateOfAction
    );

    return { exists: !!duplicate };
  },
});
