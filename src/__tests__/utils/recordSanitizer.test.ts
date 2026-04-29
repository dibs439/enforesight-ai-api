process.env.NODE_ENV = 'test';

import {
  sanitizeRecord,
  sanitizeRecords,
} from '../../utils/recordSanitizer';

describe('utils/recordSanitizer', () => {
  // rawRecord uses Convex source field names (as stored in the database).
  // sanitizeRecords() maps these to the public API output shape.
  const rawRecord = {
    _id: 'rec1',
    regulatorName: 'FCA',
    year: 2022,
    fineAmount: 50000,
    subjectName: 'Acme Corp',
    violationTypes: 'AML',
    enforcementNoticeSummary: 'Failed to report suspicious transactions',
    // extra fields that should be stripped
    internalCode: 'XYZ-999',
    _secretField: 'sensitive',
    convexId: 'abc123',
    createdAt: '2022-01-01',
  };

  describe('sanitizeRecords', () => {
    it('returns an array of the same length', () => {
      expect(sanitizeRecords([rawRecord, rawRecord])).toHaveLength(2);
    });

    it('keeps all expected fields', () => {
      const [result] = sanitizeRecords([rawRecord]);
      expect(result.id).toBe('rec1');
      expect(result.regulatorName).toBe('FCA');
      expect(result.year).toBe(2022);
      expect(result.fineAmount).toBe(50000);
      expect(result.companyName).toBe('Acme Corp');
      expect(result.violationType).toBe('AML');
      expect(result.description).toBe('Failed to report suspicious transactions');
    });

    it('strips fields not in the allow-list', () => {
      const [result] = sanitizeRecords([rawRecord]);
      expect(result).not.toHaveProperty('internalCode');
      expect(result).not.toHaveProperty('_secretField');
      expect(result).not.toHaveProperty('convexId');
      expect(result).not.toHaveProperty('createdAt');
    });

    it('returns an empty array for an empty input', () => {
      expect(sanitizeRecords([])).toEqual([]);
    });

    it('handles missing optional fields gracefully (undefined becomes undefined)', () => {
      const partial = { _id: 'r2', regulatorName: 'SEC' };
      const [result] = sanitizeRecords([partial]);
      expect(result.id).toBe('r2');
      expect(result.regulatorName).toBe('SEC');
      expect(result.fineAmount).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('does not mutate the original record', () => {
      const clone = { ...rawRecord };
      sanitizeRecords([clone]);
      expect(clone).toEqual(rawRecord);
    });
  });

  describe('sanitizeRecord', () => {
    it('delegates to sanitizeRecords and returns the first element', () => {
      const result = sanitizeRecord(rawRecord);
      expect(result.id).toBe('rec1');
      expect(result.companyName).toBe('Acme Corp');
      expect(result).not.toHaveProperty('internalCode');
    });

    it('produces the same output as sanitizeRecords([ record ])[0]', () => {
      expect(sanitizeRecord(rawRecord)).toEqual(sanitizeRecords([rawRecord])[0]);
    });
  });
});
