import { Request, Response } from 'express';
import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

let api: any;
try {
  api = require('../convex/_generated/api').api;
} catch {
  api = require('../../convex/_generated/api').api;
}

export class RegulatorsController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      if (!api?.regulators?.getAllRegulators) {
        res.status(500).json({ success: false, error: 'Regulators API not available', statusCode: 500 });
        return;
      }
      const searchQuery = req.query.q as string | undefined;
      const convex = getConvexClient();
      const result = await convex.query(api.regulators.getAllRegulators, {
        name: searchQuery,
        limit: 1000,
      });

      const sortedRegulators = (result.regulators || []).sort((a: any, b: any) =>
        a.name.localeCompare(b.name)
      );

      res.json({ success: true, data: sortedRegulators, total: result.total || 0, statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching regulators');
      res.status(500).json({ success: false, error: 'Failed to fetch regulators', statusCode: 500 });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      if (!api?.regulators?.getRegulatorById) {
        res.status(500).json({ success: false, error: 'Regulators API not available', statusCode: 500 });
        return;
      }
      const { id } = req.params;
      const convex = getConvexClient();
      const regulator = await convex.query(api.regulators.getRegulatorById, { id: id as any });

      if (!regulator) {
        res.status(404).json({ success: false, error: 'Regulator not found', statusCode: 404 });
        return;
      }

      res.json({ success: true, data: regulator, statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching regulator');
      res.status(500).json({ success: false, error: 'Failed to fetch regulator', statusCode: 500 });
    }
  }
}

export const regulatorsController = new RegulatorsController();
