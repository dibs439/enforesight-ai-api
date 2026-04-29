import { clerkClient, verifyToken } from '@clerk/express';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      userId: string;
      sessionId: string;
      claims?: {
        role?: string;
        metadata?: { role?: string; [key: string]: unknown };
        [key: string]: unknown;
      };
    };
    user?: {
      userId: string;
      username: string;
      email?: string;
      role?: string;
    };
  }
}

// Use module augmentation above - Express Request extended with auth and user properties
export interface AuthRequest extends Request {
  clerkUser?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
}

/**
 * Flexible authentication middleware
 * Accepts both Clerk session tokens (RS256) and custom JWT tokens (HS256)
 * Supports TEST_MODE for bypassing authentication during testing
 */
export const flexibleAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // TEST_MODE is only permitted in non-production environments
    const testMode =
      process.env.NODE_ENV !== 'production' &&
      process.env.TEST_MODE === 'true';
    if (testMode) {
      const testUserId = process.env.TEST_USER_ID || 'test-user-123';
      req.user = {
        userId: testUserId,
        username: 'test-user',
        email: 'test@example.com',
      };
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authorization token provided',
      });
    }

    const token = authHeader.substring(7).trim();

    // Validate JWT format
    if (!token || token.split('.').length !== 3) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token format',
      });
    }

    // Decode token header to check algorithm
    const tokenParts = token.split('.');
    if (!tokenParts[0]) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token format',
      });
    }
    const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());

    // Try Clerk authentication first (RS256 tokens with kid)
    if (header.alg === 'RS256' && header.kid) {
      try {
        logger.debug('[flexibleAuth] Attempting Clerk token verification (RS256)...');
        const payload = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY!,
          authorizedParties: [process.env.API_BASE_URL, process.env.FRONTEND_URL].filter((p): p is string => Boolean(p)),
        });

        if (payload && payload.sub) {
          const user = await clerkClient.users.getUser(payload.sub);

          req.clerkUser = {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            imageUrl: user.imageUrl || null,
          };

          req.user = {
            userId: user.id,
            username:
              user.username || user.emailAddresses[0]?.emailAddress || user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
          };

        logger.debug({ userId: user.id }, '[flexibleAuth] Clerk auth OK');
        return next();
        }
      } catch (clerkError: any) {
        logger.warn({ err: clerkError.message }, '[flexibleAuth] Clerk verification failed');
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid Clerk session token',
        });
      }
    }

    // Try custom JWT verification (HS256 tokens)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('[flexibleAuth] JWT_SECRET not configured for custom JWT verification');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication service not configured',
      });
    }

    try {
      logger.debug('[flexibleAuth] Attempting custom JWT verification (HS256)...');
      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        username: string;
        email?: string;
        role?: string;
      };

      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email || '',
      };

      logger.debug({ userId: decoded.userId }, '[flexibleAuth] JWT auth OK');
      return next();
    } catch (jwtError: any) {
      logger.warn({ err: jwtError.message }, '[flexibleAuth] JWT verification failed');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  } catch (error: any) {
    logger.error({ err: error }, '[flexibleAuth] Authentication error');

    return res.status(500).json({
      success: false,
      error: 'Authentication Error',
      message: 'An error occurred during authentication',
    });
  }
};
