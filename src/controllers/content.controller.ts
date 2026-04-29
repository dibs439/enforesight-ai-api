import { Request, Response } from 'express';
import { getConvexClient } from '../utils/convexClient';

let api: any;
try {
  api = require('../convex/_generated/api').api;
} catch {
  api = require('../../convex/_generated/api').api;
}

export class ContentController {
  async getByPage(req: Request, res: Response): Promise<void> {
    try {
      if (!api?.contents?.getByPage) {
        res.status(500).json({ error: 'Contents API not available', details: 'API module could not be loaded' });
        return;
      }
      const convex = getConvexClient();
      const records = await convex.query(api.contents.getByPage, { page: req.params.page as string });
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      if (!api?.contents?.getBySlug) {
        res.status(500).json({ error: 'Contents API not available', details: 'API module could not be loaded' });
        return;
      }
      const convex = getConvexClient();
      const record = await convex.query(api.contents.getBySlug, { slug: req.params.slug as string });
      if (!record) {
        res.status(404).json({ error: 'Content not found' });
        return;
      }
      res.json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
}

export const contentController = new ContentController();
