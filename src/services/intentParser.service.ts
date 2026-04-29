import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

export async function parseIntent(query: string) {
  const q = query.toLowerCase();
  const convex = getConvexClient();

  let regulators: any[];
  try {
    const result = await convex.query('regulators:getAllRegulators' as any);
    regulators = result?.regulators || [];
    logger.debug({ regulators: regulators.map((r: any) => r.name || r.abbreviation).join(', ') }, 'Regulators loaded');
  } catch (error) {
    logger.error({ err: error }, 'Error fetching regulators');
    regulators = [];
  }

  let regulatorName: string | null = null;

  if (Array.isArray(regulators)) {
    for (const r of regulators) {
      const abbreviation = r?.abbreviation?.toLowerCase();
      const name = r?.name?.toLowerCase();
      logger.debug({ name, abbreviation }, 'Checking regulator');
      if (
        (abbreviation && q.includes(abbreviation)) ||
        (name && q.includes(name))
      ) {
        regulatorName = r.abbreviation || null;
        break;
      }
    }
  }

  logger.debug({ regulatorName }, 'Identified regulator');

  let metric: string | null = null;

  if (q.includes('how many') || q.includes('total number')) metric = 'count';

  if (q.includes('average')) metric = 'average';

  if (q.includes('maximum') || q.includes('largest')) metric = 'maximum';

  if (q.includes('minimum') || q.includes('smallest')) metric = 'minimum';

  const fineOnly = q.includes('fine');

  logger.debug({ metric, regulatorName, fineOnly }, 'Intent parsed');

  const yearMatch = q.match(/\b(20\d{2})\b/);
  const year = yearMatch && yearMatch[1] ? parseInt(yearMatch[1], 10) : null;

  return {
    isAggregation: !!metric && !!regulatorName,
    regulatorName,
    metric,
    fineOnly,
    year,
  };
}
