/**
 * AI Chat Service — TypeScript port of the Python advanced chatbot pipeline.
 *
 * Replaces all Python child-process calls previously made from ai-chat.ts.
 * Pipeline: classify query → fetch enforcements (Convex) → in-process aggregation /
 * vector-similarity search → OpenAI Chat Completions response.
 *
 * Model is configurable via OPENAI_MODEL env var (default: gpt-5.5).
 * Uses temperature=1 for all API calls (required by gpt-5.5 model).
 */

import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

// ─── Configuration ────────────────────────────────────────────────────────────

const AI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.5';
console.log(`Using AI model: ${AI_MODEL}`);
const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS ?? '800', 10);
const EMBEDDING_MAX_CHARS = parseInt(
  process.env.EMBEDDING_MAX_CHARS ?? '8000',
  10
);
const MAX_CONVERSATION_HISTORY = parseInt(
  process.env.MAX_CONVERSATION_HISTORY ?? '10',
  10
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueryEntities {
  companies?: string[];
  regulators?: string[];
  dates?: { start?: string; end?: string } | string[];
  violation_types?: string[];
  jurisdictions?: string[];
  sectors?: string[];
  fields?: string[];
  years?: string[];
}

interface QueryParams {
  query_type?:
    | 'aggregation'
    | 'record_lookup'
    | 'record_search'
    | 'comparative_analysis'
    | 'grounded_summary'
    | 'unsupported';
  intent?: string;
  entities?: QueryEntities;
  requires_aggregation?: boolean;
  requires_semantic_search?: boolean;
  semantic_depth?: 'summary' | 'detailed' | 'comprehensive';
  convex_filters?: Record<string, any>;
  metric?: string;
  fine_only?: boolean;
  non_fine_only?: boolean;
  original_query?: string;
  error?: string;
  confidence?: 'high' | 'medium' | 'low';
  ambiguities?: string[];
  unsupported_reason?: string | null;
}

interface CurrencyStat {
  total: number;
  count: number;
  average: number;
  min: number;
  max: number;
}

interface AggregationData {
  count: number;
  fines_count: number;
  total_fines: number;
  average_fine: number;
  currency_breakdown: Record<string, CurrencyStat>;
  regulator_breakdown: Record<string, number>;
  field_breakdown: Record<string, number>;
  sector_breakdown: Record<string, number>;
  sector_fine_breakdown: Record<string, number>;
  violation_breakdown: Record<string, number>;
  year_breakdown: Record<string, number>;
  jurisdiction_breakdown: Record<string, number>;
  action_type_breakdown: Record<string, number>;
  error?: string;
}

interface RetrievalResults {
  aggregations: AggregationData | null;
  semantic_results: any[];
  exact_matches: any[];
  total_count: number;
  top_records: any[];
}

export interface ChatQueryData {
  query: string;
  conversation_id?: string;
  user_id?: string;
  is_new_conversation?: boolean;
  conversation_title?: string;
}

export interface ChatResult {
  response: {
    summary: string;
    count: number;
    records: any[];
  };
  conversation_id: string;
  message_id: string;
  metadata: {
    model: string;
    tokens_used: number;
    response_time_seconds: number;
    search_time_seconds: number;
    openai_time_seconds: number;
    enforcements_found: number;
    is_followup_question: boolean;
  };
  error?: string;
}

// ─── OpenAI singleton ─────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── Math ─────────────────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Date-range parsing ───────────────────────────────────────────────────────

function parseRelativeTimePeriod(
  query: string
): { start: string; end: string } | null {
  const q = query.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();
  const mostRecentComplete = currentYear - 1;

  // "last/past/recent/previous X years"
  const rel = q.match(/(?:last|past|recent|previous)\s+(\d+)\s+years?/);
  if (rel?.[1]) {
    const n = parseInt(rel[1], 10);
    return {
      start: `${mostRecentComplete - n + 1}-01-01`,
      end: `${mostRecentComplete}-12-31`,
    };
  }

  // "between YYYY and YYYY" / "from YYYY to YYYY" / "YYYY-YYYY"
  const range = q.match(
    /between\s+(\d{4})\s+(?:and|to|-)\s+(\d{4})|from\s+(\d{4})\s+(?:to|through|until|-)\s+(\d{4})|(\d{4})\s*[-–]\s*(\d{4})/
  );
  if (range) {
    const s = range[1] ?? range[3] ?? range[5];
    const e = range[2] ?? range[4] ?? range[6];
    if (s && e) return { start: `${s}-01-01`, end: `${e}-12-31` };
  }

  // "since YYYY-MM-DD"
  const sinceIso = q.match(/since\s+(\d{4}-\d{2}-\d{2})/);
  if (sinceIso?.[1])
    return { start: sinceIso[1], end: now.toISOString().slice(0, 10) };

  // "since YYYY"
  const sinceYear = q.match(/since\s+(\d{4})(?!\s*-)/);
  if (sinceYear?.[1])
    return {
      start: `${sinceYear[1]}-01-01`,
      end: now.toISOString().slice(0, 10),
    };

  // "in YYYY" / "during YYYY" / "for YYYY"
  const specific = q.match(/(?:in|during|for|of)\s+(\d{4})/);
  if (specific?.[1]) {
    const yr = parseInt(specific[1], 10);
    if (yr >= 1990 && yr <= currentYear + 1) {
      return { start: `${yr}-01-01`, end: `${yr}-12-31` };
    }
  }

  return null;
}

// ─── Query classification ─────────────────────────────────────────────────────

const SUPPORTED_REGULATORS = [
  'AUSTRAC',
  'FCA',
  'FINCEN',
  'FINTRAC',
  'MAS',
  'HKMA',
  'SARB',
  'DFSA',
  'ADGM',
  'CBI',
  'CBUAE',
  'VARA',
  'SEC',
  'CFTC',
  'FRB',
  'OCC',
  'FINMA',
  'BaFin',
  'AMF',
  'ASIC',
  'FSA',
  'PRA',
  'ESMA',
];

const SUPPORTED_VIOLATION_TYPES = [
  'SAR Reporting',
  'Currency Transaction Reporting',
  'AML Program',
  'KYC',
  'CTF',
  'Sanctions',
  'Beneficial Ownership',
  'Record Keeping',
  'Customer Due Diligence',
  'Enhanced Due Diligence',
  'Transaction Monitoring',
  'Reporting Failures',
  'Compliance Program',
  'Staff Training',
  'Customer Identification',
];

function detectMetric(query: string): string | undefined {
  const q = query.toLowerCase();
  if (/\b(?:most|largest|biggest|highest|maximum|max)\b/.test(q)) return 'max';
  if (/\b(?:least|smallest|lowest|minimum|min)\b/.test(q)) return 'min';
  if (/\b(?:average|mean)\b/.test(q)) return 'average';
  if (/\b(?:total|sum)\b/.test(q)) return 'sum';
  // When query asks about "fines" with count language, use specific fine_count metric
  if (/\b(?:how many|number of|count)\b/.test(q) && /\bfines?\b/.test(q))
    return 'fine_count';
  if (/\b(?:how many|number of|count)\b/.test(q)) return 'count';
  if (/\b(?:trend|over time|year by year|per year)\b/.test(q)) return 'trend';
  return undefined;
}

function detectFineOnly(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\bfines?\b|\bpenalt(?:y|ies)\b|\bmonetary\b/.test(q) &&
    !/\bcases?\b|\bactions?\b|\benforcements?\b/.test(q)
  );
}

function detectNonFineOnly(query: string): boolean {
  const q = query.toLowerCase();

  // Extract what comes after exclusion phrases and check if it's fine-related
  // This handles: "apart from imposing fines", "other than penalties", etc.
  const exclusionMatch = q.match(
    /\b(?:apart from|other than|excluding|without|besides)\s+(.+?)(?:\.|$|[?!])/
  );

  if (exclusionMatch && exclusionMatch[1]) {
    const excluded = exclusionMatch[1];
    // Check if the excluded item is fine-related
    if (/fines?|penalt(?:y|ies)|monetary|sanctions?|financial/.test(excluded)) {
      return true;
    }
  }

  // Also catch explicit non-monetary patterns not preceded by exclusion phrases
  if (/non[-\s]?monetar|no monetary|\bno fine/.test(q)) {
    return true;
  }

  return false;
}

export async function classifyQuery(query: string): Promise<QueryParams> {
  const openai = getOpenAI();
  const convex = getConvexClient();

  // Fetch lookup tables dynamically from Convex
  let violationTypesStr = SUPPORTED_VIOLATION_TYPES.join(', ');
  let sectorsStr = 'Various sectors';
  let enforcementActionTypesStr = 'Various enforcement action types';

  try {
    // Fetch violation types
    const violationTypesData = (await convex.query(
      'violationTypes:getAllViolationTypes' as any
    )) as any[];
    if (Array.isArray(violationTypesData)) {
      const names = violationTypesData
        .map((vt: any) => vt.name)
        .filter((n: string) => n && n.trim())
        .sort();
      if (names.length > 0) {
        violationTypesStr = names.join(', ');
      }
    }

    // Fetch sectors
    const sectorsData = (await convex.query(
      'sectors:getAllSectors' as any
    )) as any[];
    if (Array.isArray(sectorsData)) {
      const names = sectorsData
        .map((s: any) => s.name)
        .filter((n: string) => n && n.trim())
        .sort();
      if (names.length > 0) {
        sectorsStr = names.join(', ');
      }
    }

    // Fetch enforcement action types
    const actionTypesData = (await convex.query(
      'enforcementActionTypes:getAllActionTypes' as any
    )) as any[];
    if (Array.isArray(actionTypesData)) {
      const names = actionTypesData
        .map((at: any) => at.name)
        .filter((n: string) => n && n.trim())
        .sort();
      if (names.length > 0) {
        enforcementActionTypesStr = names.join(', ');
      }
    }
  } catch (err) {
    logger.warn(
      { err },
      '[aiChatService] Failed to fetch lookup tables, using defaults'
    );
  }

  //console.log(`Sectors: ${sectorsStr}`);
  //console.log(`Violation Types: ${violationTypesStr}`);
  //console.log(`Enforcement Action Types: ${enforcementActionTypesStr}`);

  const systemPrompt = `You are a deterministic query analyzer for ENFORESIGHT regulatory enforcement data.

CRITICAL DOMAIN RULES
================================================
- The database contains ONLY Anti-Money Laundering (AML) enforcement actions
- "Sanctioned", "fined", "penalised", "enforced against" describe ENFORCEMENT ACTIONS, NOT violationTypes
- NEVER extract violationTypes from these words
- Do NOT infer violationTypes unless explicitly mentioned in the query

AVAILABLE FIELDS (ONLY THESE)
================================================
Core:
- regulatorName (string)
- subjectName (string)
- jurisdiction (string)

Classification:
- sector (string | optional) — financial sector
- field (string | optional) — primary classification (AML, Banking, Securities, etc.)

Dates:
- dateOfAction (string | ISO format)
- year (number)
- month (number)

Actions & Violations:
- enforcementActionType (string | string[]) — type of enforcement action taken
- violationTypes (string | string[]) — specific violations within AML context

Penalties:
- fineAmount (number) — monetary penalty
- currency (string) — currency of fine

Status:
- underAppeal (boolean)

Content:
- enforcementNoticeUrl / enforcementNoticeURL
- enforcementNoticeSummary
- enforcementNoticeData

EXPLICIT INTERPRETATION RULES
================================================
NEVER treat these as violationTypes:
- "sanctioned" / "fined" / "penalised" / "enforced against" → these describe enforcement actions
- "Most sanctioned sector" → extract sector filter, use case_count metric, NOT violation_types
- "Largest fines" → extract fineAmount metric (max), NOT violation_types
- "Actions against Company X" → extract company name, NOT violation_types

DO extract violationTypes ONLY when:
- "violations of X", "violated X", "charged with X", "KYC breach", "SAR reporting failure", etc.

METRIC INTERPRETATION
================================================
- "how many / case_count" → statistical query, requires_aggregation=true
- "largest / biggest / highest fine" → statistical, metric='max_penalty'
- "smallest / lowest fine" → statistical, metric='min_penalty'
- "total fines" → statistical, metric='total_penalty'
- "average fine" → statistical, metric='average_penalty'
- "most common violation" → statistical, metric='violation_frequency'
- "proportion / percentage" → statistical, metric='proportion'
- "average per year / per period" → statistical, metric='average_per_period'
- "trend / over time / year by year" → statistical with year grouping
- "most sanctioned / most fined" → statistical, case_count metric
- "top N sectors / regulators" → statistical, sorted descending
- "describe / explain / learn about" → semantic query, requires_semantic_search=true
- "compare X vs Y" → hybrid query (both statistical and semantic)
- "find record of Company X" → exact_match query

CRITICAL DISTINCTIONS
================================================
- "fines" = records with fineAmount > 0
- "cases" = all enforcement records (regardless of fine)
- "sanctioned" = enforcement action taken (could include non-monetary actions)
- "non-monetary actions" = records where fineAmount = 0

QUERY TYPE SELECTION
================================================
- aggregation: counts, averages, totals, rankings, trends (requires aggregation logic)
- record_lookup: exact company/date/action lookup (retrieve specific record)
- record_search: find cases matching filters (exploratory search with semantic ranking)
- comparative_analysis: compare two regulators/sectors/periods (side-by-side analysis)
- grounded_summary: explain retrieved cases only (analysis of found cases, not generating summaries)
- unsupported: meta-questions about database schema, bulk exports without filters

IMPLICIT FIELD MAPPING
================================================
- "Country" / "which countries" → jurisdiction
- "Warnings", "bans", "suspensions" → enforcementActionType values
- "Issues / problems" → violationTypes

CONFIDENCE SCORING
================================================
Assign confidence level:
- high: Clear intent, all entities unambiguous, well-defined scope
- medium: Some ambiguity (e.g., "most fined" without specifying by whom), multiple possible interpretations
- low: Very ambiguous query, requires clarification, could mean multiple things

AMBIGUITIES & SPECIAL HANDLING
================================================
- Multiple currencies involved in comparison → flag ambiguity
- "sanctioned" used but no clear metric → flag ambiguity
- "most" without specifying dimension → flag ambiguity
- Missing key context (e.g., "in which sector?") → flag ambiguity
- Queries requesting "all data" or "entire database" without filters → flag ambiguity + set limit to 100
- Meta-questions about database scope/content → query_type='unsupported', reason='system_info_request'

Supported Regulators (case-insensitive): ${SUPPORTED_REGULATORS.join(', ')}
Supported Violation Types: ${violationTypesStr}
Available Sectors: ${sectorsStr}
Enforcement Action Types: ${enforcementActionTypesStr}

Return ONLY valid JSON with schema:
{
  "query_type": "aggregation|record_lookup|record_search|comparative_analysis|grounded_summary|unsupported",
  "intent": "count|sum|describe|explain|analyze|compare|list",
  "entities": {
    "companies": [], 
    "regulators": [], 
    "dates": {},
    "violation_types": [], 
    "jurisdictions": [], 
    "sectors": [], 
    "fields": []
  },
  "requires_aggregation": boolean,
  "requires_semantic_search": boolean,
  "semantic_depth": "summary|detailed|comprehensive",
  "confidence": "high|medium|low",
  "ambiguities": [],
  "metric": "case_count|total_penalty|average_penalty|max_penalty|min_penalty|proportion|average_per_period|fine_count|null",
  "fine_only": boolean,
  "non_fine_only": boolean,
  "unsupported_reason": null
}`;

  const userPrompt = `Analyze this query and extract structured information: "${query}". Now analyze and return JSON:`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 1,
      response_format: { type: 'json_object' },
    });

    console.log('LLM response:', response.choices[0]?.message.content);

    const result: QueryParams = JSON.parse(
      response.choices[0]?.message.content ?? '{}'
    );

    // ✅ DEBUG OUTPUT - Check the parsed query classification
    console.log('=== QUERY CLASSIFICATION RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('===================================');

    // Remove generic "AML" — the entire platform is AML, so it's not a useful filter
    if (result.entities?.violation_types?.length) {
      result.entities.violation_types = result.entities.violation_types.filter(
        vt =>
          !['AML', 'AML/CFT', 'ANTI-MONEY LAUNDERING'].includes(
            vt.toUpperCase()
          )
      );
    }

    // Normalize regulator names to uppercase for consistent matching
    if (result.entities?.regulators?.length) {
      result.entities.regulators = result.entities.regulators.map(r =>
        r.toUpperCase()
      );
    }

    // Inject parsed relative time periods (regex-based, more reliable than LLM for dates)
    const timePeriod = parseRelativeTimePeriod(query);
    if (timePeriod) {
      if (!result.entities) result.entities = {};
      if (!result.entities.dates || Array.isArray(result.entities.dates)) {
        result.entities.dates = {};
      }
      (result.entities.dates as { start?: string; end?: string }).start =
        timePeriod.start;
      (result.entities.dates as { start?: string; end?: string }).end =
        timePeriod.end;
    }

    const metric = detectMetric(query);
    if (metric !== undefined) result.metric = metric;
    result.fine_only = detectFineOnly(query);
    result.non_fine_only = detectNonFineOnly(query);
    // non_fine_only overrides fine_only — they are mutually exclusive
    if (result.non_fine_only) result.fine_only = false;
    result.original_query = query;

    // ✅ MAP NEW QUERY TYPES TO DATA RETRIEVAL FLAGS
    // This determines how data will be fetched and processed
    switch (result.query_type) {
      case 'aggregation':
        result.requires_aggregation = true;
        result.requires_semantic_search = false;
        break;
      case 'record_lookup':
        result.requires_aggregation = false;
        result.requires_semantic_search = false;
        break;
      case 'record_search':
        result.requires_aggregation = false;
        result.requires_semantic_search = true;
        break;
      case 'comparative_analysis':
        result.requires_aggregation = true;
        result.requires_semantic_search = true;
        break;
      case 'grounded_summary':
        result.requires_aggregation = false;
        result.requires_semantic_search = true;
        break;
      case 'unsupported':
        result.requires_aggregation = false;
        result.requires_semantic_search = false;
        break;
      default:
        // Fallback to semantic if unknown
        result.requires_aggregation = false;
        result.requires_semantic_search = true;
    }

    result.convex_filters = buildFilters(result.entities ?? {});

    logger.debug(
      { queryType: result.query_type, entities: result.entities },
      '[aiChatService] Query classified'
    );
    return result;
  } catch (err) {
    logger.warn(
      { err },
      '[aiChatService] Query classification failed, using semantic fallback'
    );
    return {
      query_type: 'record_search',
      intent: 'search',
      entities: {},
      convex_filters: {},
      requires_aggregation: false,
      requires_semantic_search: true,
      semantic_depth: 'summary',
      original_query: query,
      fine_only: detectFineOnly(query),
      non_fine_only: detectNonFineOnly(query),
      error: err instanceof Error ? err.message : String(err),
      ...(detectMetric(query) !== undefined && {
        metric: detectMetric(query) as string,
      }),
    };
  }
}

// ─── Filter building ──────────────────────────────────────────────────────────

const VIOLATION_TO_FIELD: Record<string, string> = {
  AML: 'AML',
  'ANTI-MONEY LAUNDERING': 'AML',
  KYC: 'AML',
  SANCTIONS: 'AML',
  BANKING: 'Banking',
  INSURANCE: 'Insurance',
  SECURITIES: 'Securities',
  'VIRTUAL ASSETS': 'Virtual Assets',
  CRYPTO: 'Virtual Assets',
  'MARKET ABUSE': 'Securities',
  'MARKET MANIPULATION': 'Securities',
};

function buildFilters(entities: QueryEntities): Record<string, any> {
  const f: Record<string, any> = {};

  const regs = entities.regulators ?? [];
  if (regs.length) f.regulatorName = regs.length === 1 ? regs[0] : regs;

  const companies = entities.companies ?? [];
  if (companies.length)
    f.subjectName = companies.length === 1 ? companies[0] : companies;

  const jurs = entities.jurisdictions ?? [];
  if (jurs.length) f.jurisdiction = jurs.length === 1 ? jurs[0] : jurs;

  const sectors = entities.sectors ?? [];
  if (sectors.length) f.sector = sectors.length === 1 ? sectors[0] : sectors;

  const fields = entities.fields ?? [];
  const violations = entities.violation_types ?? [];
  if (fields.length) {
    f.field = fields.length === 1 ? fields[0] : fields;
  } else if (violations.length) {
    const firstViolation = violations[0];
    if (firstViolation) {
      const mapped = VIOLATION_TO_FIELD[firstViolation.toUpperCase()];
      if (mapped) f.field = mapped;
    }
  }

  const dates = entities.dates;
  if (dates && !Array.isArray(dates)) {
    if (dates.start) f.dateOfAction_gte = dates.start;
    if (dates.end) f.dateOfAction_lte = dates.end;
  } else if (Array.isArray(dates) && dates.length) {
    f.year = dates.length === 1 ? dates[0] : dates;
  }

  const years = entities.years ?? [];
  if (years.length && !f.year) {
    f.year = years.length === 1 ? years[0] : years;
  }

  // ✅ NOTE: fine_only and non_fine_only are set separately in classifyQuery()
  // after buildFilters() completes, not passed through convex_filters.
  // They are used in executeAggregation() to determine which records
  // to include in the fine-amount calculation (before deduplication).

  return f;
}

// ─── Data fetching (cursor-based pagination via getAllEnforcementsForBatch) ────

async function fetchAllEnforcementsPaginated(
  includeEmbeddings: boolean,
  serverRegulator?: string
): Promise<any[]> {
  const convex = getConvexClient();
  const all: any[] = [];
  let cursor: string | undefined;

  // When scoped to a single regulator the dataset is much smaller, so larger
  // batches are safe. For unscoped (full-table) scans use small batches because
  // documents can contain large enforcementNoticeData fields and Convex counts
  // every byte read from storage against its 16 MB per-execution limit.
  const batchSize = serverRegulator
    ? includeEmbeddings
      ? 50
      : 200
    : includeEmbeddings
      ? 20
      : 50;

  while (true) {
    const result: any = await convex.query(
      'enforcements:getAllEnforcementsForBatch' as any,
      {
        cursor,
        limit: batchSize,
        ...(serverRegulator ? { regulatorName: serverRegulator } : {}),
      }
    );

    const items: any[] = result.items ?? [];
    if (!includeEmbeddings) {
      for (const {
        summaryEmbedding: _se,
        fullTextEmbedding: _fe,
        enforcementNoticeData: _end,
        ...rest
      } of items) {
        all.push(rest);
      }
    } else {
      // Even when embeddings are needed, strip the raw document text
      for (const { enforcementNoticeData: _end, ...rest } of items) {
        all.push(rest);
      }
    }

    if (!result.hasMore || items.length === 0) break;
    cursor = result.nextCursor;
  }

  logger.debug(
    { count: all.length, includeEmbeddings, serverRegulator },
    '[aiChatService] Fetched enforcements'
  );
  return all;
}

// ─── Full Text Search / Fuzzy Matching ────────────────────────────────────────

/**
 * Normalize sector names for comparison.
 * - Lowercase
 * - Remove extra spaces
 * - Handle common variations (singular/plural)
 * - Remove articles
 */
function normalizeSector(s: string): string {
  if (!s || typeof s !== 'string') return '';

  return (
    s
      .toLowerCase()
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Normalize common plural variations
      .replace(/\b(provider)s\b/g, '$1')
      .replace(/\b(asset)s\b/g, '$1')
      .replace(/\b(service)s\b/g, '$1')
      .replace(/\b(institution)s\b/g, '$1')
      .replace(/\b(exchange)s\b/g, '$1')
      .replace(/\b(fund)s\b/g, '$1')
      .replace(/\b(company|companies)\b/g, 'company')
      .replace(/\b(bank)s\b/g, '$1')
      // Remove trailing 's' for other words
      .replace(/s\b/g, '')
  );
}

/**
 * Calculate Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions).
 */
function levenshteinDistance(a: string, b: string): number {
  const len1 = a.length;
  const len2 = b.length;
  const matrix: number[][] = Array.from({ length: len1 + 1 }, (_, i) =>
    Array.from({ length: len2 + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= len1; i++) {
    const row = matrix[i];
    const prevRow = matrix[i - 1];
    if (!row || !prevRow) continue;

    for (let j = 1; j <= len2; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        (prevRow[j] ?? 0) + 1, // deletion
        (row[j - 1] ?? 0) + 1, // insertion
        (prevRow[j - 1] ?? 0) + cost // substitution
      );
    }
  }

  return matrix[len1]?.[len2] ?? 0;
}

/**
 * Calculate similarity score between two strings (0-1).
 * Based on normalized comparison and Levenshtein distance.
 */
function stringSimilarity(a: string, b: string): number {
  const norm_a = normalizeSector(a);
  const norm_b = normalizeSector(b);

  // Exact match after normalization
  if (norm_a === norm_b) return 1.0;

  // Substring match (fuzzy inclusion)
  if (norm_a.includes(norm_b) || norm_b.includes(norm_a)) return 0.95;

  // Levenshtein-based similarity
  const maxLen = Math.max(norm_a.length, norm_b.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(norm_a, norm_b);
  return 1.0 - distance / maxLen;
}

/**
 * Fuzzy match sector names with configurable threshold.
 * Default threshold is 0.85 (85% similarity required).
 */
function fuzzyMatchSector(
  recordSector: string,
  querySector: string,
  threshold = 0.85
): boolean {
  const similarity = stringSimilarity(recordSector, querySector);
  return similarity >= threshold;
}

// ─── Manual in-process filtering ─────────────────────────────────────────────

function filterRecordsManually(
  records: any[],
  filters: Record<string, any>
): any[] {
  const subjectFilter = filters.subjectName;
  const regulatorFilter = filters.regulatorName;
  const jurisdictionFilter = filters.jurisdiction;
  const sectorFilter = filters.sector;
  const fieldFilter = filters.field;
  const yearFilter = filters.year;
  const dateGte = filters.dateOfAction_gte;
  const dateLte = filters.dateOfAction_lte;

  return records.filter(record => {
    if (subjectFilter) {
      const rs = (record.subjectName ?? '').toLowerCase();
      const match = Array.isArray(subjectFilter)
        ? subjectFilter.some(sf => rs.includes(sf.toLowerCase()))
        : rs.includes((subjectFilter as string).toLowerCase());
      if (!match) return false;
    }

    if (fieldFilter) {
      const rf = record.field ?? '';
      const match = Array.isArray(fieldFilter)
        ? fieldFilter.some(
            ff =>
              ff === rf ||
              rf.toLowerCase().includes((ff as string).toLowerCase())
          )
        : fieldFilter === rf ||
          rf.toLowerCase().includes((fieldFilter as string).toLowerCase());
      if (!match) return false;
    }

    if (regulatorFilter) {
      const rr = (record.regulatorName ?? '').toUpperCase();
      const match = Array.isArray(regulatorFilter)
        ? regulatorFilter.some(rf => rr.includes((rf as string).toUpperCase()))
        : rr.includes((regulatorFilter as string).toUpperCase());
      if (!match) return false;
    }

    if (jurisdictionFilter) {
      const rj = (record.jurisdiction ?? '').toLowerCase();
      const match = Array.isArray(jurisdictionFilter)
        ? jurisdictionFilter.some(jf =>
            rj.includes((jf as string).toLowerCase())
          )
        : rj.includes((jurisdictionFilter as string).toLowerCase());
      if (!match) return false;
    }

    if (sectorFilter) {
      const rs = record.sector ?? '';
      const match = Array.isArray(sectorFilter)
        ? sectorFilter.some((sf: any) => fuzzyMatchSector(rs, sf, 0.85))
        : fuzzyMatchSector(rs, sectorFilter as string, 0.85);
      if (!match) return false;
    }

    if (yearFilter) {
      const rd = record.dateOfAction ?? '';
      if (!rd) return false;
      const ry = rd.slice(0, 4);
      const match = Array.isArray(yearFilter)
        ? yearFilter.some(yf => String(yf) === ry)
        : String(yearFilter) === ry;
      if (!match) return false;
    }

    if (dateGte && (record.dateOfAction ?? '') < dateGte) return false;
    if (dateLte && (record.dateOfAction ?? '') > dateLte) return false;

    return true;
  });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function executeAggregation(
  allRecords: any[],
  filters: Record<string, any>,
  queryParams: QueryParams
): AggregationData {
  const fineOnly = queryParams.fine_only ?? false;
  const nonFineOnly = queryParams.non_fine_only ?? false;
  let working = allRecords;
  let preDedupFineCount = 0;

  // Apply fine-only filter BEFORE dedup for accurate pre-dedup count
  if (fineOnly) {
    working = allRecords.filter(r => (r.fineAmount ?? 0) > 0);
    preDedupFineCount = working.length;
  }

  // Apply non-fine filter: keep only records with no monetary penalty
  if (nonFineOnly) {
    working = allRecords.filter(
      r =>
        r.fineAmount === null ||
        r.fineAmount === undefined ||
        (r.fineAmount ?? 0) === 0
    );
  }

  // Dedup by _id (documentId may repeat for distinct enforcement actions)
  const seen = new Set<string>();
  const deduped = working.filter(r => {
    if (!r._id || seen.has(r._id)) return false;
    seen.add(r._id);
    return true;
  });

  // Apply manual multi-field filtering
  const records = filterRecordsManually(deduped, filters);

  if (!records.length) {
    return {
      count: 0,
      fines_count: 0,
      total_fines: 0,
      average_fine: 0,
      currency_breakdown: {},
      regulator_breakdown: {},
      field_breakdown: {},
      sector_breakdown: {},
      sector_fine_breakdown: {},
      violation_breakdown: {},
      year_breakdown: {},
      jurisdiction_breakdown: {},
      action_type_breakdown: {},
    };
  }

  const fineByCurrency: Record<
    string,
    { total: number; count: number; amounts: number[] }
  > = {};
  const regulatorCounts: Record<string, number> = {};
  const fieldCounts: Record<string, number> = {};
  const sectorCounts: Record<string, number> = {};
  const sectorFineTotals: Record<string, number> = {};
  const violationCounts: Record<string, number> = {};
  const yearCounts: Record<string, number> = {};
  const jurisdictionCounts: Record<string, number> = {};
  const actionTypeCounts: Record<string, number> = {};
  const recordsWithFines: any[] = [];

  for (const record of records) {
    const currency = record.currency ?? 'USD';
    const fine = record.fineAmount ?? 0;

    if (fine > 0) {
      recordsWithFines.push(record);
      if (!fineByCurrency[currency])
        fineByCurrency[currency] = { total: 0, count: 0, amounts: [] };
      fineByCurrency[currency].total += fine;
      fineByCurrency[currency].count++;
      fineByCurrency[currency].amounts.push(fine);
    }

    const reg = record.regulatorName ?? 'Unknown';
    regulatorCounts[reg] = (regulatorCounts[reg] ?? 0) + 1;

    const field = record.field ?? 'Unknown';
    fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;

    const sector = record.sector ?? 'Unknown';
    sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1;
    if (fine > 0)
      sectorFineTotals[sector] = (sectorFineTotals[sector] ?? 0) + fine;

    const rawViolations = record.violationTypes;
    const vList = Array.isArray(rawViolations)
      ? rawViolations
      : rawViolations
        ? [rawViolations]
        : [];
    for (const v of vList) {
      if (
        v &&
        !['aml', 'anti-money laundering'].includes((v as string).toLowerCase())
      ) {
        violationCounts[v] = (violationCounts[v] ?? 0) + 1;
      }
    }

    const jur = record.jurisdiction ?? 'Unknown';
    jurisdictionCounts[jur] = (jurisdictionCounts[jur] ?? 0) + 1;

    const rawActions = record.enforcementActionType;
    const aList = Array.isArray(rawActions)
      ? rawActions
      : rawActions
        ? [rawActions]
        : [];
    for (const a of aList) {
      if (a)
        actionTypeCounts[a as string] =
          (actionTypeCounts[a as string] ?? 0) + 1;
    }

    const dateStr = record.dateOfAction ?? '';
    if (dateStr.length >= 4) {
      const yr = dateStr.slice(0, 4);
      yearCounts[yr] = (yearCounts[yr] ?? 0) + 1;
    }
  }

  const currencyBreakdown: Record<string, CurrencyStat> = {};
  for (const [curr, data] of Object.entries(fineByCurrency)) {
    currencyBreakdown[curr] = {
      total: data.total,
      count: data.count,
      average: data.count > 0 ? data.total / data.count : 0,
      min: data.amounts.length ? Math.min(...data.amounts) : 0,
      max: data.amounts.length ? Math.max(...data.amounts) : 0,
    };
  }

  const finesCount = recordsWithFines.length;
  const totalActions = records.length;
  const reportedCount =
    fineOnly && preDedupFineCount > 0 ? preDedupFineCount : totalActions;
  const totalFinesValue = Object.values(fineByCurrency).reduce(
    (acc, v) => acc + v.total,
    0
  );

  return {
    count: reportedCount,
    fines_count:
      fineOnly && preDedupFineCount > 0 ? preDedupFineCount : finesCount,
    total_fines: totalFinesValue,
    average_fine: finesCount > 0 ? totalFinesValue / finesCount : 0,
    currency_breakdown: currencyBreakdown,
    regulator_breakdown: regulatorCounts,
    field_breakdown: fieldCounts,
    sector_breakdown: sectorCounts,
    sector_fine_breakdown: sectorFineTotals,
    violation_breakdown: violationCounts,
    year_breakdown: yearCounts,
    jurisdiction_breakdown: jurisdictionCounts,
    action_type_breakdown: actionTypeCounts,
  };
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const truncated = text.slice(0, EMBEDDING_MAX_CHARS);
  if (!truncated.trim()) return new Array(1536).fill(0);
  try {
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncated,
    });
    return res.data[0]?.embedding ?? new Array(1536).fill(0);
  } catch (err) {
    logger.warn({ err }, '[aiChatService] Embedding generation failed');
    return new Array(1536).fill(0);
  }
}

// ─── Semantic search ──────────────────────────────────────────────────────────

async function executeSemanticSearch(
  queryText: string,
  records: any[],
  filters: Record<string, any>,
  limit = 10
): Promise<any[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const filtered = filterRecordsManually(records, filters);
  const withEmbeddings = filtered.filter(
    r => Array.isArray(r.summaryEmbedding) && r.summaryEmbedding.length
  );

  const scored = withEmbeddings.map(r => ({
    ...r,
    _similarity: cosineSimilarity(
      queryEmbedding,
      r.summaryEmbedding as number[]
    ),
  }));
  scored.sort((a, b) => b._similarity - a._similarity);
  return scored.slice(0, limit);
}

// ─── Retrieval orchestration ──────────────────────────────────────────────────

async function retrieveEnforcements(
  queryParams: QueryParams
): Promise<RetrievalResults> {
  const filters = queryParams.convex_filters ?? {};
  const needsAggregation = queryParams.requires_aggregation ?? false;
  const needsSemantic = queryParams.requires_semantic_search ?? true;

  // If the query targets a single regulator, push that filter to Convex so it
  // uses the by_regulator index and reads only that regulator's documents.
  // This is the primary guard against Convex's 16 MB per-execution read limit.
  const serverRegulator =
    typeof filters.regulatorName === 'string'
      ? filters.regulatorName
      : undefined;

  const results: RetrievalResults = {
    aggregations: null,
    semantic_results: [],
    exact_matches: [],
    total_count: 0,
    top_records: [],
  };

  if (needsAggregation) {
    const allLite = await fetchAllEnforcementsPaginated(false, serverRegulator);
    results.aggregations = executeAggregation(allLite, filters, queryParams);
    results.total_count = results.aggregations.count;

    // Top 10 records by fine amount (for context building)
    const seen = new Set<string>();
    const deduped = allLite.filter(r => {
      if (!r._id || seen.has(r._id)) return false;
      seen.add(r._id);
      return true;
    });
    results.top_records = filterRecordsManually(deduped, filters)
      .sort((a, b) => (b.fineAmount ?? 0) - (a.fineAmount ?? 0))
      .slice(0, 10);
  }

  if (needsSemantic) {
    const allWithEmbed = await fetchAllEnforcementsPaginated(
      true,
      serverRegulator
    );
    results.semantic_results = await executeSemanticSearch(
      queryParams.original_query ?? '',
      allWithEmbed,
      filters,
      10
    );
    if (!needsAggregation)
      results.total_count = results.semantic_results.length;
  }

  // ✅ HANDLE RECORD LOOKUP (EXACT MATCH) - when neither aggregation nor semantic search is needed
  if (!needsAggregation && !needsSemantic) {
    const source = results.top_records.length
      ? results.top_records
      : await fetchAllEnforcementsPaginated(false, serverRegulator);
    results.exact_matches = filterRecordsManually(source, filters).slice(0, 5);
    results.total_count = results.exact_matches.length;
  }

  return results;
}

// ─── Context building ─────────────────────────────────────────────────────────

function buildContext(
  queryParams: QueryParams,
  retrieval: RetrievalResults
): string {
  const parts: string[] = [];
  const agg = retrieval.aggregations;

  if (agg) {
    let totalCases = agg.count;
    let finesCount = agg.fines_count;

    // Prefer filtered total_count over raw aggregation count for accuracy
    if (retrieval.total_count > 0 && retrieval.total_count !== totalCases) {
      totalCases = retrieval.total_count;
      finesCount = Math.min(finesCount, retrieval.total_count);
    }

    parts.push('⚠️ VERIFIED DATABASE STATISTICS - USE THESE EXACT NUMBERS ⚠️');
    parts.push(`EXACT total enforcement actions found: ${totalCases}`);
    parts.push(`EXACT total actions with monetary fines: ${finesCount}`);
    parts.push('');
    parts.push('=== STATISTICAL DATA ===');
    parts.push(`Total Enforcement Actions: ${totalCases}`);
    parts.push(`Total Actions with Monetary Fines: ${finesCount}`);

    const cb = agg.currency_breakdown;
    if (Object.keys(cb).length) {
      const totalFineValue = Object.values(cb).reduce((s, d) => s + d.total, 0);
      parts.push('\n🔴 FINES BREAKDOWN:');
      parts.push(`  Actions with monetary fines: ${finesCount}`);
      parts.push(`  Actions with NO monetary fine: ${totalCases - finesCount}`);
      parts.push(
        `  Total fine value (all currencies): ${totalFineValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
      parts.push('\nFine Amounts by Currency (fined cases only):');
      for (const [curr, data] of Object.entries(cb)) {
        parts.push(
          `  ${curr}: Total=${data.total.toLocaleString()}, Count=${data.count} fines, Average=${data.average.toFixed(2)}, Min=${data.min.toFixed(2)}, Max=${data.max.toFixed(2)}`
        );
      }
    }

    const yb = agg.year_breakdown;
    if (Object.keys(yb).length) {
      parts.push('\n🔴 By Year (for trend analysis - USE THIS DATA):');
      for (const [yr, cnt] of Object.entries(yb).sort(([a], [b]) =>
        a.localeCompare(b)
      )) {
        parts.push(`  ${yr}: ${cnt} cases`);
      }
    }

    const breakdowns: [string, Record<string, number>][] = [
      ['By Regulator', agg.regulator_breakdown],
      ['By Field (Primary Classification)', agg.field_breakdown],
      ['By Jurisdiction', agg.jurisdiction_breakdown],
    ];
    for (const [label, bd] of breakdowns) {
      if (Object.keys(bd).length) {
        parts.push(`\n${label}:`);
        for (const [k, v] of Object.entries(bd)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)) {
          parts.push(`  ${k}: ${v} cases`);
        }
      }
    }

    // For fine-amount queries (largest/total/average), sort sectors by fine total;
    // for count queries, sort by number of cases.
    const fineAmountQuery =
      queryParams.fine_only ||
      ['max', 'sum', 'average', 'min'].includes(queryParams.metric ?? '');
    if (fineAmountQuery && Object.keys(agg.sector_fine_breakdown).length) {
      parts.push(
        '\nBy Sector (sorted by total fine amount — USE THIS for "largest/highest/total fine" questions):'
      );
      for (const [k, v] of Object.entries(agg.sector_fine_breakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)) {
        const count = agg.sector_breakdown[k] ?? 0;
        parts.push(
          `  ${k}: ${v.toLocaleString()} total fine (${count} fined cases)`
        );
      }
    } else if (Object.keys(agg.sector_breakdown).length) {
      parts.push('\nBy Sector (sorted by number of cases):');
      for (const [k, v] of Object.entries(agg.sector_breakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)) {
        parts.push(`  ${k}: ${v} cases`);
      }
    }

    const vb = agg.violation_breakdown;
    const filteredViolations = Object.entries(vb).filter(
      ([v]) => !['aml', 'anti-money laundering'].includes(v.toLowerCase())
    );
    if (filteredViolations.length) {
      parts.push('\nBy Violation Type (Detailed):');
      for (const [v, c] of filteredViolations
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)) {
        parts.push(`  ${v}: ${c} cases`);
      }
    }

    const ab = agg.action_type_breakdown;
    if (ab && Object.keys(ab).length) {
      // When non_fine_only is active, label clearly so the LLM understands the filter
      const nonFineCtx = queryParams.non_fine_only
        ? ' (NON-MONETARY ACTIONS ONLY — records with fineAmount = 0)'
        : '';
      parts.push(`\n🔴 By Enforcement Action Type${nonFineCtx}:`);
      const topActions = Object.entries(ab)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
      for (const [action, count] of topActions) {
        parts.push(`  ${action}: ${count} case${count !== 1 ? 's' : ''}`);
      }
      // Surface top 3-4 explicitly for the LLM prompt
      const top4 = topActions
        .slice(0, 4)
        .map(([a, c]) => `${a} (${c})`)
        .join(', ');
      parts.push(`  → Top action types: ${top4}`);
    }

    parts.push('');
  }

  if (retrieval.semantic_results.length) {
    parts.push('=== RELEVANT ENFORCEMENT RECORDS ===');
    for (let i = 0; i < Math.min(5, retrieval.semantic_results.length); i++) {
      const r = retrieval.semantic_results[i];
      if (typeof r !== 'object' || !r) continue;
      parts.push(`\n[Record ${i + 1}]`);
      parts.push(`Company: ${r.subjectName ?? 'N/A'}`);
      parts.push(`Regulator: ${r.regulatorName ?? 'N/A'}`);
      parts.push(`Date: ${r.dateOfAction ?? 'N/A'}`);
      parts.push(`Jurisdiction: ${r.jurisdiction ?? 'N/A'}`);
      parts.push(`Sector: ${r.sector ?? 'N/A'}`);
      const at = Array.isArray(r.enforcementActionType)
        ? r.enforcementActionType
        : r.enforcementActionType
          ? [r.enforcementActionType]
          : [];
      if (at.length) parts.push(`Action Types: ${at.join(', ')}`);
      const vt = Array.isArray(r.violationTypes)
        ? r.violationTypes
        : r.violationTypes
          ? [r.violationTypes]
          : [];
      if (vt.length) parts.push(`Violations: ${vt.join(', ')}`);
      const fine = r.fineAmount ?? 0;
      parts.push(
        fine > 0
          ? `Fine: ${r.currency ?? 'USD'} ${fine.toLocaleString()}`
          : 'Fine: No monetary fine imposed'
      );
      if (r._similarity !== undefined)
        parts.push(
          `Relevance: ${((r._similarity as number) * 100).toFixed(1)}%`
        );
      if (r.enforcementNoticeSummary)
        parts.push(
          `Summary: ${String(r.enforcementNoticeSummary).slice(0, 500)}...`
        );
    }
  }

  if (retrieval.exact_matches.length) {
    parts.push('\n=== EXACT MATCHES ===');
    for (const r of retrieval.exact_matches.slice(0, 3)) {
      parts.push(`\nExact Match: ${r.subjectName ?? 'N/A'}`);
      parts.push(`Date: ${r.dateOfAction ?? 'N/A'}`);
      if (r.enforcementNoticeSummary)
        parts.push(
          `Details: ${String(r.enforcementNoticeSummary).slice(0, 300)}`
        );
    }
  }

  return parts.join('\n');
}

// ─── AI response generation ───────────────────────────────────────────────────

const AML_CAVEAT = `🔴 CRITICAL PLATFORM SCOPE: Enforesight tracks ANTI-MONEY LAUNDERING (AML) enforcement actions ONLY.
- ALL statistics are for AML enforcement actions exclusively
- "FINES" = monetary penalties only (fineAmount > 0)
- "CASES" or "ACTIONS" = all enforcement actions
- ALWAYS preface statistical responses with: "Based on AML enforcement actions in our database:"

🔴 CRITICAL: Understand semantic differences:
- "FINES" = monetary penalties only (count records where fineAmount > 0)
- "CASES" or "ACTIONS" = all enforcement actions (regardless of fine amount)
- "SANCTIONS" = all types of penalties (fines, warnings, bans, suspensions, etc.)
- what other actions apart from imposing fines means where fineAmount=0.`;

// ═════════════════════════════════════════════════════════════════════════════
// 6 SPECIALIZED SYSTEM PROMPTS FOR NEW QUERY TAXONOMY
// ═════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_AGGREGATION = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Keep answers SHORT and CONCISE (2-3 sentences maximum). State the final answer directly.
CRITICAL COUNTING RULES:
1. "fines"/"monetary penalties" → use fines_count (records with fineAmount > 0)
2. "cases"/"actions" → use total count (all records)
3. "LARGEST"/"BIGGEST"/"HIGHEST" → use Max value from currency breakdown
4. "SMALLEST"/"LOWEST" → use Min value from currency breakdown
5. "AVERAGE"/"MEAN" → use Average value from currency breakdown
6. "TRENDS"/"over time" → use ONLY the "By Year" breakdown data — NEVER make up year counts`;

const SYSTEM_PROMPT_RECORD_LOOKUP = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Focus on the specific record found. Present key details: company, regulator, date, action type, violations, fine amount.
KEY POINTS:
- Always identify which regulator took action
- Clearly state the enforcement action type(s)
- Quote violation types exactly as they appear in data
- For monetary penalties: always show currency and amount
- Keep answer SHORT (2-3 sentences) — user is looking for a specific case`;

const SYSTEM_PROMPT_RECORD_SEARCH = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: List the matching records found, ordered by relevance. For each: company, regulator, date, key violations.
KEY POINTS:
- Start with count: "Found X matching enforcement actions"
- Show top 3-5 most relevant cases
- For each case: company name, regulator, date, key violation types
- Note if additional records exist beyond the shown sample
- Keep descriptions SHORT (50 words max per record)`;

const SYSTEM_PROMPT_COMPARATIVE_ANALYSIS = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Present side-by-side comparison. Start with summary (e.g., "FCA took X actions vs MAS took Y actions").
KEY POINTS:
- Lead with the numerical comparison
- Break down by regulator/sector/period as relevant
- Highlight key differences and patterns
- Use aggregation data (counts, totals, averages) for comparison
- Keep answer CONCISE (3-4 sentences) — focus on the comparative insight`;

const SYSTEM_PROMPT_GROUNDED_SUMMARY = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Analyze and explain the RETRIEVED enforcement cases. Do NOT generate unsupported statements.
KEY POINTS:
- Base ALL observations on the retrieved cases shown above
- Identify patterns: common violation types, action types, sectors, or regulated entities
- Quote specific case details when relevant
- If cases show a pattern (e.g., "banks were warned more than fined"), explain it
- NEVER make claims about data you haven't seen — stick to retrieved cases only
- Keep answer CONCISE (3-5 sentences) focused on what the data shows`;

const SYSTEM_PROMPT_UNSUPPORTED = `You are a helpful assistant for the ENFORESIGHT regulatory enforcement database.

RESPONSE FORMAT: Explain why the query cannot be answered and suggest a reformulation.
KEY POINTS:
- Acknowledge what the user asked for
- Clearly state: "This database is limited to AML (anti-money laundering) enforcement actions"
- Suggest a related question that CAN be answered (e.g., if they ask about bulk exports, suggest "Show me all AUSTRAC enforcement actions")
- Keep answer SHORT (2-3 sentences)
- Offer a helpful alternative`;

// ═════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_STATISTICAL = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Keep answers SHORT and CONCISE (2-3 sentences maximum). State the final answer directly.
CRITICAL COUNTING RULES:
1. "fines"/"monetary penalties" → use fines_count (records with fineAmount > 0)
2. "cases"/"actions" → use total count (all records)
3. "LARGEST"/"BIGGEST"/"HIGHEST" → use Max value from currency breakdown
4. "SMALLEST"/"LOWEST" → use Min value from currency breakdown
5. "AVERAGE"/"MEAN" → use Average value from currency breakdown
6. "TRENDS"/"over time" → use ONLY the "By Year" breakdown data — NEVER make up year counts`;

const SYSTEM_PROMPT_SEMANTIC = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Keep answers SHORT and CONCISE. Focus on key findings and outcomes. Avoid unnecessary detail.`;

const SYSTEM_PROMPT_DEFAULT = `You are an expert financial enforcement analyst specializing in AML enforcement.
${AML_CAVEAT}

RESPONSE FORMAT: Keep answers SHORT and CONCISE (2-4 sentences). Combine numbers with brief context. Do NOT show calculation steps.`;

async function generateAIResponse(
  userQuery: string,
  context: string,
  queryParams: QueryParams,
  history: { role: string; content: string }[],
  retrieval: RetrievalResults
): Promise<{ content: string; tokens_used: number }> {
  const openai = getOpenAI();
  const queryType = queryParams.query_type ?? 'record_search';

  // ✅ ROUTE TO SPECIALIZED SYSTEM PROMPT BASED ON NEW 6-TYPE TAXONOMY
  const systemPrompt =
    queryType === 'aggregation'
      ? SYSTEM_PROMPT_AGGREGATION
      : queryType === 'record_lookup'
        ? SYSTEM_PROMPT_RECORD_LOOKUP
        : queryType === 'record_search'
          ? SYSTEM_PROMPT_RECORD_SEARCH
          : queryType === 'comparative_analysis'
            ? SYSTEM_PROMPT_COMPARATIVE_ANALYSIS
            : queryType === 'grounded_summary'
              ? SYSTEM_PROMPT_GROUNDED_SUMMARY
              : queryType === 'unsupported'
                ? SYSTEM_PROMPT_UNSUPPORTED
                : SYSTEM_PROMPT_DEFAULT;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] =
    [{ role: 'system', content: systemPrompt }];

  for (const msg of history.slice(-MAX_CONVERSATION_HISTORY)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content ?? '',
      });
    }
  }

  // Build verified count summary for mandatory injection
  const agg = retrieval.aggregations;
  let verifiedCount = agg?.count ?? 0;
  let verifiedFinesCount = agg?.fines_count ?? 0;
  if (retrieval.total_count > 0 && retrieval.total_count !== verifiedCount) {
    verifiedCount = retrieval.total_count;
    verifiedFinesCount = Math.min(verifiedFinesCount, retrieval.total_count);
  }

  const currencyTotals = Object.entries(agg?.currency_breakdown ?? {})
    .map(
      ([curr, data]) =>
        `${curr} ${data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    )
    .join(', ');

  messages.push({
    role: 'user',
    content: `User Question: ${userQuery}

Available Data and Context:
${context}

⚠️ MANDATORY: The VERIFIED count from the database is EXACTLY ${verifiedCount} total enforcement actions and ${verifiedFinesCount} fines${currencyTotals ? ` totaling ${currencyTotals}` : ''}.
You MUST use these exact numbers in your response. Do NOT estimate, round, or use any other numbers.

Please answer the user's question accurately based on the data provided above.`,
  });

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    max_completion_tokens: MAX_TOKENS,
    temperature: 1,
  });

  return {
    content: response.choices[0]?.message.content ?? 'No response generated',
    tokens_used: response.usage?.total_tokens ?? 0,
  };
}

// ─── Output structuring ───────────────────────────────────────────────────────

function structureOutput(
  llmResponse: string,
  queryParams: QueryParams,
  retrieval: RetrievalResults
): any {
  const output: any = {
    answer: llmResponse,
    query_type: queryParams.query_type,
    entities_detected: queryParams.entities ?? {},
    data: { total_records: retrieval.total_count },
  };

  if (retrieval.aggregations) output.data.statistics = retrieval.aggregations;

  const pickFields = (r: any, extra?: Record<string, any>) => ({
    _id: r._id,
    documentId: r.documentId,
    regulatorName: r.regulatorName,
    subjectName: r.subjectName,
    jurisdiction: r.jurisdiction,
    sector: r.sector,
    field: r.field,
    dateOfAction: r.dateOfAction,
    enforcementActionType: r.enforcementActionType,
    violationTypes: r.violationTypes,
    fineAmount: r.fineAmount,
    currency: r.currency,
    underAppeal: r.underAppeal ?? null,
    ...extra,
  });

  if (retrieval.semantic_results.length) {
    output.data.relevant_records = retrieval.semantic_results
      .slice(0, 5)
      .map(r => pickFields(r, { similarity: r._similarity }));
  }

  if (retrieval.exact_matches.length) {
    output.data.exact_matches = retrieval.exact_matches
      .slice(0, 3)
      .map(r => pickFields(r));
  }

  if (retrieval.top_records.length) {
    output.data.top_records = retrieval.top_records.map(r => pickFields(r));
  }

  return output;
}

// ─── Conversation management ──────────────────────────────────────────────────

export async function createConversation(userId: string): Promise<string> {
  const conversationId = randomUUID();
  const convex = getConvexClient();
  await convex.mutation('customerConversations:storeConversation' as any, {
    customerId: userId,
    conversationId,
  });
  logger.debug(
    { userId, conversationId },
    '[aiChatService] Conversation created'
  );
  return conversationId;
}

export async function getConversation(
  conversationId: string
): Promise<any | null> {
  const convex = getConvexClient();
  return convex.query('customerConversations:getConversation' as any, {
    conversationId,
  });
}

export async function getConversationHistory(
  conversationId: string,
  limit = 100
): Promise<{ conversationId: string; messageCount: number; messages: any[] }> {
  const convex = getConvexClient();
  const messages: any[] = await convex.query(
    'conversationMessages:getMessages' as any,
    { conversationId }
  );
  const limited =
    limit && messages.length > limit ? messages.slice(-limit) : messages;
  return { conversationId, messageCount: limited.length, messages: limited };
}

export async function archiveConversation(
  conversationId: string,
  userId = 'system'
): Promise<{ archived: boolean }> {
  const convex = getConvexClient();
  try {
    await convex.mutation('customerConversations:deleteConversation' as any, {
      conversationId,
      customerId: userId,
    });
    return { archived: true };
  } catch (err) {
    logger.warn(
      { err, conversationId },
      '[aiChatService] Archive conversation failed'
    );
    return { archived: false };
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

function isFollowupQuestion(query: string, history: any[]): boolean {
  if (!history.length) return false;
  const q = query.toLowerCase();
  return [
    'these',
    'those',
    'them',
    'their',
    'above',
    'that',
    'this',
    'violation types',
    'violations',
    'what were',
    'for them',
    'in that case',
    'for those',
    'from these',
    'same',
    'previous',
    'earlier',
    'mentioned',
  ].some(w => q.includes(w));
}

export async function processAIQuery(
  chatData: ChatQueryData
): Promise<ChatResult> {
  const startTime = Date.now();
  const {
    query,
    conversation_id: conversationId,
    user_id: userId = 'anonymous',
    is_new_conversation: isNewConversation = false,
    conversation_title: conversationTitle,
  } = chatData;

  try {
    const convex = getConvexClient();

    // Step 1: Load conversation history (last 10 messages = 5 user/assistant pairs)
    let conversationHistory: any[] = [];
    if (conversationId) {
      try {
        const msgs: any[] = await convex.query(
          'conversationMessages:getRecentMessages' as any,
          {
            conversationId,
            limit: 10,
          }
        );
        if (Array.isArray(msgs)) {
          conversationHistory = msgs.map(m => ({
            role: m.role,
            content: m.content,
            metadata: m.metadata,
          }));
        }
      } catch (err) {
        logger.warn(
          { err },
          '[aiChatService] Could not load conversation history'
        );
      }
    }

    console.log(query);

    const isFollowup = isFollowupQuestion(query, conversationHistory);
    const formattedHistory = conversationHistory.map(m => ({
      role: m.role as string,
      content: m.content as string,
    }));

    // Step 2: Classify query (entity extraction + query type)
    const queryParams = await classifyQuery(query);

    // ✅ EARLY EXIT FOR UNSUPPORTED QUERIES
    if (queryParams.query_type === 'unsupported') {
      const unsupportedMessage =
        queryParams.unsupported_reason ||
        'This query is outside the scope of the ENFORESIGHT database. The system is limited to AML (anti-money laundering) enforcement actions. Please rephrase your question to focus on specific regulators, companies, sectors, or enforcement actions in our database.';

      let messageId = '';
      if (conversationId) {
        try {
          await convex.mutation('conversationMessages:addMessage' as any, {
            conversation_id: conversationId,
            role: 'user',
            content: query,
          });
          const msgResult: any = await convex.mutation(
            'conversationMessages:addMessage' as any,
            {
              conversation_id: conversationId,
              role: 'assistant',
              content: unsupportedMessage,
              metadata: {
                query_type: 'unsupported',
                unsupported_reason: queryParams.unsupported_reason,
              },
            }
          );
          messageId =
            typeof msgResult === 'object'
              ? String(msgResult?.messageId ?? '')
              : String(msgResult ?? '');
        } catch (err) {
          logger.warn(
            { err },
            '[aiChatService] Could not persist unsupported query message'
          );
        }
      }

      return {
        response: {
          summary: unsupportedMessage,
          count: 0,
          records: [],
        },
        conversation_id: conversationId ?? '',
        message_id: messageId,
        metadata: {
          model: AI_MODEL,
          tokens_used: 0,
          response_time_seconds: (Date.now() - startTime) / 1000,
          search_time_seconds: 0,
          openai_time_seconds: 0,
          enforcements_found: 0,
          is_followup_question: isFollowup,
        },
      };
    }

    // Step 3: Retrieve enforcements (aggregation + vector search as applicable)
    const searchStart = Date.now();
    const retrieval = await retrieveEnforcements(queryParams);
    const searchTime = (Date.now() - searchStart) / 1000;

    // Step 4: Build context and generate AI response
    const context = buildContext(queryParams, retrieval);
    const aiResult = await generateAIResponse(
      query,
      context,
      queryParams,
      formattedHistory,
      retrieval
    );
    const structured = structureOutput(
      aiResult.content,
      queryParams,
      retrieval
    );

    // Step 5: Persist messages to Convex
    let messageId = '';
    if (conversationId) {
      try {
        await convex.mutation('conversationMessages:addMessage' as any, {
          conversationId,
          role: 'user',
          content: query,
        });

        const assistantArgs: any = {
          conversationId,
          role: 'assistant',
          content: aiResult.content,
        };
        if (aiResult.tokens_used > 0)
          assistantArgs.tokenCount = aiResult.tokens_used;
        if (isFollowup) assistantArgs.metadata = { is_followup: true };

        const msgResult: any = await convex.mutation(
          'conversationMessages:addMessage' as any,
          assistantArgs
        );
        messageId =
          typeof msgResult === 'object'
            ? String(msgResult?.messageId ?? '')
            : String(msgResult ?? '');

        const storeArgs: any = { conversationId, customerId: userId };
        if (isNewConversation && conversationTitle)
          storeArgs.title = conversationTitle;
        await convex.mutation(
          'customerConversations:storeConversation' as any,
          storeArgs
        );
      } catch (err) {
        logger.warn(
          { err },
          '[aiChatService] Failed to store conversation messages'
        );
      }
    }

    // Build response payload matching the original Python response format
    const dataSection = structured.data;
    const enforcementData =
      dataSection.top_records ?? dataSection.relevant_records ?? [];
    const totalRecords: number = dataSection.total_records ?? 0;
    const records = (Array.isArray(enforcementData) ? enforcementData : [])
      .filter(r => typeof r === 'object')
      .slice(0, 30);

    const totalTime = (Date.now() - startTime) / 1000;

    return {
      response: { summary: aiResult.content, count: totalRecords, records },
      conversation_id: conversationId ?? '',
      message_id: messageId,
      metadata: {
        model: AI_MODEL,
        tokens_used: aiResult.tokens_used,
        response_time_seconds: Math.round(totalTime * 100) / 100,
        search_time_seconds: Math.round(searchTime * 100) / 100,
        openai_time_seconds: Math.round(searchTime * 100) / 100,
        enforcements_found: totalRecords,
        is_followup_question: isFollowup,
      },
    };
  } catch (err) {
    logger.error({ err }, '[aiChatService] processAIQuery failed');
    return {
      response: {
        summary:
          'I apologize, but I encountered an error processing your request. Please try again.',
        count: 0,
        records: [],
      },
      conversation_id: conversationId ?? '',
      message_id: '',
      metadata: {
        model: AI_MODEL,
        tokens_used: 0,
        response_time_seconds: (Date.now() - startTime) / 1000,
        search_time_seconds: 0,
        openai_time_seconds: 0,
        enforcements_found: 0,
        is_followup_question: false,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
