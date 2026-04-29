process.env.NODE_ENV = 'test';

jest.mock('../../utils/convexClient');

import { executeAggregation } from '../../services/aggregation.service';
import { getConvexClient } from '../../utils/convexClient';

const mockQuery = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getConvexClient as jest.Mock).mockReturnValue({ query: mockQuery });
});

// ─── test data ────────────────────────────────────────────────────────────────

const enforcements = [
  { id: 'e1', regulatorName: 'FCA', year: 2021, fineAmount: 10000, companyName: 'A Ltd', violationType: 'AML', description: '' },
  { id: 'e2', regulatorName: 'FCA', year: 2021, fineAmount: 30000, companyName: 'B Ltd', violationType: 'AML', description: '' },
  { id: 'e3', regulatorName: 'FCA', year: 2022, fineAmount: 0,     companyName: 'C Ltd', violationType: 'AML', description: '' },
  { id: 'e4', regulatorName: 'FCA', year: 2022, fineAmount: 50000, companyName: 'D Ltd', violationType: 'AML', description: '' },
];

function setup(records = enforcements) {
  mockQuery.mockResolvedValue({ enforcements: records });
}

// ─── count metric ─────────────────────────────────────────────────────────────

describe('executeAggregation - count', () => {
  it('returns count=4 for all records', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count' });
    expect(result.count).toBe(4);
  });

  it('filters by year before counting', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count', year: 2021 });
    expect(result.count).toBe(2);
  });

  it('filters fineOnly before counting (excludes fineAmount=0)', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count', fineOnly: true });
    expect(result.count).toBe(3); // e3 has fineAmount=0 → excluded
  });

  it('combines year and fineOnly filters', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count', year: 2022, fineOnly: true });
    expect(result.count).toBe(1); // only e4 (year=2022, fineAmount>0)
  });

  it('returns 0 for an empty enforcement set', async () => {
    mockQuery.mockResolvedValue({ enforcements: [] });
    const result = await executeAggregation({ regulatorName: 'XYZ', metric: 'count' });
    expect(result.count).toBe(0);
  });
});

// ─── maximum metric ───────────────────────────────────────────────────────────

describe('executeAggregation - maximum', () => {
  it('returns the highest fineAmount across all records', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'maximum' });
    expect(result.count).toBe(50000);
  });

  it('respects year filter', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'maximum', year: 2021 });
    expect(result.count).toBe(30000);
  });

  it('respects fineOnly filter', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'maximum', fineOnly: true });
    expect(result.count).toBe(50000);
  });
});

// ─── minimum metric ───────────────────────────────────────────────────────────

describe('executeAggregation - minimum', () => {
  it('returns the lowest fineAmount across all records', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'minimum' });
    expect(result.count).toBe(0); // e3 has 0
  });

  it('respects fineOnly filter (excludes zero amount)', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'minimum', fineOnly: true });
    expect(result.count).toBe(10000);
  });
});

// ─── average metric ───────────────────────────────────────────────────────────

describe('executeAggregation - average', () => {
  it('computes the mean fineAmount', async () => {
    setup();
    // (10000 + 30000 + 0 + 50000) / 4 = 22500
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'average' });
    expect(result.count).toBeCloseTo(22500);
  });

  it('computes average with fineOnly filter', async () => {
    setup();
    // (10000 + 30000 + 50000) / 3 = 30000
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'average', fineOnly: true });
    expect(result.count).toBeCloseTo(30000);
  });

  it('returns 0 average for an empty filtered set', async () => {
    setup();
    // year=2099 → no records
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'average', year: 2099 });
    expect(result.count).toBe(0);
  });
});

// ─── response structure ───────────────────────────────────────────────────────

describe('executeAggregation - response structure', () => {
  it('includes a summary string', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count' });
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('includes sanitized records array', async () => {
    setup();
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count' });
    expect(Array.isArray(result.records)).toBe(true);
    expect(result.records).toHaveLength(4);
    // Sanitized records should not contain extra fields
    expect(result.records[0]).not.toHaveProperty('_id');
  });

  it('returns empty records array when no data', async () => {
    mockQuery.mockResolvedValue({ enforcements: [] });
    const result = await executeAggregation({ regulatorName: 'NONE', metric: 'count' });
    expect(result.records).toEqual([]);
  });

  it('handles missing enforcements key gracefully', async () => {
    mockQuery.mockResolvedValue({});
    const result = await executeAggregation({ regulatorName: 'FCA', metric: 'count' });
    expect(result.count).toBe(0);
    expect(result.records).toEqual([]);
  });
});
