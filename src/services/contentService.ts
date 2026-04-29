import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

// Dynamic API import
let api: any;
try {
  api = require('../convex/_generated/api').api;
} catch {
  api = require('../../convex/_generated/api').api;
}

export interface Content {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

export class ContentService {
  async getAllContents(): Promise<Content[]> {
    logger.debug('Fetching all contents from Convex');
    const client = getConvexClient();

    if (!api?.contents?.getAllContents) {
      logger.warn('Contents API not available');
      return [];
    }

    const contents = await client.query(api.contents.getAllContents);
    logger.debug({ count: contents?.length || 0 }, 'Contents fetched');
    return contents || [];
  }
}
