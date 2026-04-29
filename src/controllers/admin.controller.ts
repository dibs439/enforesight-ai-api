import type { Request, Response } from 'express';
import { ClerkAuthService } from '../services/clerkAuthService';
import { ContentService } from '../services/contentService';
import { logger } from '../utils/logger';

const secretKey = process.env.CLERK_SECRET_KEY || '';
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || '';

export class AdminController {
  private clerkAuthService: ClerkAuthService;
  private contentService: ContentService;

  constructor() {
    this.clerkAuthService = new ClerkAuthService(secretKey, publishableKey);
    this.contentService = new ContentService();
  }

  async getContents(req: Request, res: Response): Promise<void> {
    try {
      logger.info({ path: '/contents' }, 'Contents route called');
      logger.debug({ authHeaderPrefix: req.headers.authorization?.substring(0, 20) }, 'Authorization header present');

      // Authenticate the request
      const authResult = await this.clerkAuthService.authenticateRequest(req);

      if (!authResult.isSignedIn) {
        logger.warn({ reason: authResult.reason }, 'Authentication failed - user not signed in');
        res.status(401).json({
          status: 401,
          error: 'Unauthorized',
          reason: authResult.reason || 'No authentication found',
          debug: {
            hasAuthHeader: !!req.headers.authorization,
          },
        });
        return;
      }

      logger.info('Authentication successful, fetching contents...');

      // Fetch contents from service
      const contents = await this.contentService.getAllContents();

      res.json({
        success: true,
        count: contents.length,
        contents: contents,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error in /contents route');
      res.status(500).json({
        error: 'Failed to fetch contents',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }
}
