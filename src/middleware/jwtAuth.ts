import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/auth';
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

/**
 * Middleware to require JWT authentication (custom JWT tokens)
 * This middleware works with the JWT tokens issued by the /api/admin/login endpoint
 */
export const requireJwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid or expired token',
      });
      return;
    }

    // Attach user info to request for downstream handlers
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };

    // Also set req.auth for compatibility with Clerk-style code
    req.auth = {
      userId: decoded.userId,
      sessionId: 'jwt-session',
      claims: {
        role: decoded.role,
      },
    };

    next();
  } catch (error) {
    logger.error({ err: error }, '[JWT Auth] Error');
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Authentication failed',
    });
  }
};
