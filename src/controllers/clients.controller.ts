import { Request, Response } from 'express';
import { getConvexClient } from '../utils/convexClient';

let api: any;
try {
  api = require('../convex/_generated/api').api;
} catch {
  api = require('../../convex/_generated/api').api;
}

export class ClientsController {
  async getActiveClients(_req: Request, res: Response): Promise<void> {
    try {
      if (!api?.clients?.getActiveClients) {
        res.status(500).json({ error: 'Clients API not available', details: 'API module could not be loaded' });
        return;
      }
      const convex = getConvexClient();
      const clients = await convex.query(api.clients.getActiveClients);
      res.json(clients);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
}

export const clientsController = new ClientsController();
