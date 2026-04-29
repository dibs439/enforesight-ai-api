import type { Request, Response } from 'express';
import { getConvexClient } from '../../utils/convexClient';
import { logger } from '../../utils/logger';

// Dynamic import for API to handle both dev and production environments
let api: any;
try {
  // Try ES module import first (development)
  api = require('../../../convex/_generated/api').api;
} catch {
  try {
    // Fallback to dist location (production)
    api = require('../../convex/_generated/api').api;
  } catch {
    // Final fallback - create a mock API object
    logger.warn('Could not load Convex API - using fallback');
    api = { regulators: {} };
  }
}

export class RegulatorsController {
  /**
   * Get all regulators with pagination
   */
  async getAllRegulators(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Extract filter parameters
      const { name, country } = req.query;

      const client = getConvexClient();
      let result;

      try {
        // Try with new function signature that supports filtering
        result = await client.query(api.regulators.getAllRegulators, {
          offset,
          limit,
          ...(name && { name: name as string }),
          ...(country && { country: country as string }),
        });
      } catch (error: any) {
        // Fall back to old function signature if new parameters are not supported
        if (
          error?.message?.includes('extra field') ||
          error?.message?.includes('not in the validator')
        ) {
          logger.warn('Using legacy regulators function - filters not supported in deployed version');

          // Get all regulators without filtering
          const allRegulatorsResult = await client.query(
            api.regulators.getAllRegulators,
            {
              offset: 0,
              limit: 1000, // Get more records for client-side filtering
            }
          );

          // Apply client-side filtering
          let filteredRegulators = allRegulatorsResult.regulators || [];

          if (name) {
            const searchName = (name as string).toLowerCase();
            filteredRegulators = filteredRegulators.filter((reg: any) =>
              reg.name.toLowerCase().includes(searchName)
            );
          }

          if (country) {
            filteredRegulators = filteredRegulators.filter(
              (reg: any) => reg.country === country
            );
          }

          // Apply pagination to filtered results
          const total = filteredRegulators.length;
          const paginatedRegulators = filteredRegulators.slice(
            offset,
            offset + limit
          );

          result = {
            regulators: paginatedRegulators,
            total: total,
          };
        } else {
          throw error;
        }
      }

      return res.json({
        success: true,
        data: result.regulators,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrev: page > 1,
        },
        filters: {
          ...(name && { name }),
          ...(country && { country }),
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch regulators',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get regulator by ID
   */
  async getRegulatorById(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const regulator = await client.query(api.regulators.getRegulatorById, {
        id: req.params.id as any,
      });
      return res.json({ success: true, data: regulator });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch regulator',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create new regulator
   */
  async createRegulator(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const id = await client.mutation(
        api.regulators.createRegulator,
        req.body
      );
      return res.json({ success: true, id });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a duplicate error
      if (errorMessage.includes('already exists')) {
        return res.status(409).json({
          error: 'Duplicate regulator',
          details: errorMessage,
        });
      }

      return res.status(500).json({
        error: 'Failed to create regulator',
        details: errorMessage,
      });
    }
  }

  /**
   * Update existing regulator
   */
  async updateRegulator(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      await client.mutation(api.regulators.updateRegulator, {
        id: req.params.id as any,
        ...req.body,
      });
      return res.json({ success: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a duplicate error
      if (errorMessage.includes('already exists')) {
        return res.status(409).json({
          error: 'Duplicate regulator',
          details: errorMessage,
        });
      }

      return res.status(500).json({
        error: 'Failed to update regulator',
        details: errorMessage,
      });
    }
  }

  /**
   * Delete regulator
   */
  async deleteRegulator(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      await client.mutation(api.regulators.deleteRegulator, {
        id: req.params.id as any,
      });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to delete regulator',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const regulatorsController = new RegulatorsController();
