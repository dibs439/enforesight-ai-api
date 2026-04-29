process.env.NODE_ENV = 'test';

jest.mock('../../utils/convexClient');

import { parseIntent } from '../../services/intentParser.service';
import { getConvexClient } from '../../utils/convexClient';

const mockQuery = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getConvexClient as jest.Mock).mockReturnValue({ query: mockQuery });
  // Default: empty regulator list so tests that don't care about regulator matching are lean
  mockQuery.mockResolvedValue({ regulators: [] });
});

// ─── metric detection ─────────────────────────────────────────────────────────

describe('parseIntent - metric detection', () => {
  it('detects "count" metric from "how many"', async () => {
    const result = await parseIntent('how many cases');
    expect(result.metric).toBe('count');
  });

  it('detects "count" metric from "total number"', async () => {
    const result = await parseIntent('total number of violations');
    expect(result.metric).toBe('count');
  });

  it('detects "average" metric', async () => {
    const result = await parseIntent('what is the average fine');
    expect(result.metric).toBe('average');
  });

  it('detects "maximum" metric from "maximum"', async () => {
    const result = await parseIntent('maximum fine issued');
    expect(result.metric).toBe('maximum');
  });

  it('detects "maximum" metric from "largest"', async () => {
    const result = await parseIntent('what is the largest fine');
    expect(result.metric).toBe('maximum');
  });

  it('detects "minimum" metric from "minimum"', async () => {
    const result = await parseIntent('minimum penalty amount');
    expect(result.metric).toBe('minimum');
  });

  it('detects "minimum" metric from "smallest"', async () => {
    const result = await parseIntent('smallest fine recorded');
    expect(result.metric).toBe('minimum');
  });

  it('returns null metric when no metric keyword is present', async () => {
    const result = await parseIntent('list all enforcement actions');
    expect(result.metric).toBeNull();
  });
});

// ─── year extraction ──────────────────────────────────────────────────────────

describe('parseIntent - year extraction', () => {
  it('extracts a 4-digit year starting with 20', async () => {
    const result = await parseIntent('how many fines in 2021');
    expect(result.year).toBe(2021);
  });

  it('returns null when no year is present', async () => {
    const result = await parseIntent('how many fines');
    expect(result.year).toBeNull();
  });

  it('does not match a year that does not start with 20', async () => {
    const result = await parseIntent('how many fines in 1998');
    expect(result.year).toBeNull();
  });

  it('extracts the first matching year when multiple are present', async () => {
    const result = await parseIntent('how many from 2019 to 2023');
    expect(result.year).toBe(2019);
  });
});

// ─── fineOnly flag ────────────────────────────────────────────────────────────

describe('parseIntent - fineOnly flag', () => {
  it('sets fineOnly=true when "fine" appears in the query', async () => {
    const result = await parseIntent('how many fine actions');
    expect(result.fineOnly).toBe(true);
  });

  it('sets fineOnly=false when "fine" is absent', async () => {
    const result = await parseIntent('how many enforcement actions');
    expect(result.fineOnly).toBe(false);
  });
});

// ─── regulator matching ───────────────────────────────────────────────────────

describe('parseIntent - regulator detection', () => {
  beforeEach(() => {
    mockQuery.mockResolvedValue({
      regulators: [
        { name: 'financial conduct authority', abbreviation: 'FCA' },
        { name: 'securities and exchange commission', abbreviation: 'SEC' },
      ],
    });
  });

  it('matches a regulator by abbreviation (case-insensitive)', async () => {
    const result = await parseIntent('how many fca fines');
    expect(result.regulatorName).toBe('FCA');
  });

  it('matches a regulator by full name (case-insensitive)', async () => {
    const result = await parseIntent('average fine for financial conduct authority');
    expect(result.regulatorName).toBe('FCA');
  });

  it('matches SEC by abbreviation', async () => {
    const result = await parseIntent('maximum sec penalty in 2022');
    expect(result.regulatorName).toBe('SEC');
  });

  it('returns null regulatorName when no match', async () => {
    const result = await parseIntent('how many fines for some random body');
    expect(result.regulatorName).toBeNull();
  });
});

// ─── isAggregation flag ───────────────────────────────────────────────────────

describe('parseIntent - isAggregation flag', () => {
  beforeEach(() => {
    mockQuery.mockResolvedValue({
      regulators: [{ name: 'fca', abbreviation: 'FCA' }],
    });
  });

  it('sets isAggregation=true when both metric and regulatorName are present', async () => {
    const result = await parseIntent('how many fca fines in 2022');
    expect(result.isAggregation).toBe(true);
  });

  it('sets isAggregation=false when metric is missing', async () => {
    const result = await parseIntent('list fca actions');
    expect(result.isAggregation).toBe(false);
  });

  it('sets isAggregation=false when regulatorName is missing', async () => {
    const result = await parseIntent('how many total actions');
    expect(result.isAggregation).toBe(false);
  });
});

// ─── Convex error resilience ──────────────────────────────────────────────────

describe('parseIntent - Convex error resilience', () => {
  it('returns regulatorName=null when Convex query throws', async () => {
    mockQuery.mockRejectedValue(new Error('Convex unavailable'));
    const result = await parseIntent('average fine');
    expect(result.regulatorName).toBeNull();
    // Metric and year should still parse correctly even without regulators
    expect(result.metric).toBe('average');
  });
});
