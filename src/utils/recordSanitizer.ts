/**
 * Sanitizes enforcement records for API responses
 * Removes sensitive data and formats fields appropriately
 */
export function sanitizeRecords(records: any[]): any[] {
  return records.map(record => ({
    id: record._id,
    regulatorName: record.regulatorName,
    year: record.year,
    fineAmount: record.fineAmount,
    companyName: record.subjectName,
    violationType: record.violationTypes,
    description: record.enforcementNoticeSummary,
    // Internal fields (summaryEmbedding, fullTextEmbedding, enforcementNoticeData) are excluded
  }));
}

/**
 * Sanitizes a single record
 */
export function sanitizeRecord(record: any): any {
  return sanitizeRecords([record])[0];
}
