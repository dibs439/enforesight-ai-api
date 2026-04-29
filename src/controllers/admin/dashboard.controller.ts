import type { Request, Response } from 'express';
import { getConvexClient } from '../../utils/convexClient';
import { logger } from '../../utils/logger';

export class DashboardController {
  async getDashboard(_req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();

      const customers = await client.query(
        'customers:getCustomerStats' as any,
        {}
      );
      // TODO: Optimize the call to avoid failing when there are too many enforcements. Consider implementing pagination or summary stats in the backend.
      /*
      const enforcements = await client.query(
        'enforcements:getEnforcementsStats' as any,
        {}
      );*/

      return res.status(200).json({
        success: true,
        data: {
          totalUsers: customers?.total || 0,
          enforcementActions: {
            count: 781, // Placeholder value until we optimize the enforcements query,
            //countIsMinimum: enforcements?.hasMore ?? false,
            percentageChange: 8,
            direction: 'up',
          },
          activeUsers: {
            daily: {
              count: customers?.activeToday || 0,
              percentageChange: customers?.dailyChangePercent || 0,
              direction: customers?.dailyChangePercent >= 0 ? 'up' : 'down',
            },
            weekly: {
              count: customers?.activeThisWeek || 0,
              percentageChange: customers?.weeklyChangePercent || 0,
              direction: customers?.weeklyChangePercent >= 0 ? 'up' : 'down',
            },
            monthly: {
              count: customers?.activeThisMonth || 0,
              percentageChange: customers?.monthlyChangePercent || 0,
              direction: customers?.monthlyChangePercent >= 0 ? 'up' : 'down',
            },
          },
        },
        statusCode: 200,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching dashboard data');
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        statusCode: 500,
      });
    }
  }
}

export const dashboardController = new DashboardController();
