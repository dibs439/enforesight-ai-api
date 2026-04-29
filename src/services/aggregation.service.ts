import { getConvexClient } from '../utils/convexClient';
import { sanitizeRecords } from '../utils/recordSanitizer';

export async function executeAggregation(params: any) {
  const convex = getConvexClient();

  const result = await convex.query('enforcements:getByRegulator' as any, {
    regulatorName: params.regulatorName,
  });

  const enforcements = result?.enforcements || [];

  let filtered = enforcements;

  if (params.year) {
    filtered = filtered.filter((r: any) => r.year === params.year);
  }

  if (params.fineOnly) {
    filtered = filtered.filter((r: any) => (r.fineAmount || 0) > 0);
  }

  let value = 0;

  if (params.metric === 'count') {
    value = filtered.length;
  }

  if (params.metric === 'maximum') {
    value = Math.max(...filtered.map((r: any) => r.fineAmount || 0));
  }

  if (params.metric === 'minimum') {
    value = Math.min(...filtered.map((r: any) => r.fineAmount || 0));
  }

  if (params.metric === 'average') {
    const total = filtered.reduce(
      (sum: number, r: any) => sum + (r.fineAmount || 0),
      0
    );
    value = filtered.length ? total / filtered.length : 0;
  }

  return {
    summary: `Based on AML enforcement actions in our database: The result is ${value}.`,
    count: value,
    records: sanitizeRecords(filtered),
  };
}
