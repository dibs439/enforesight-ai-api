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
 * JWT Authentication Middleware for Admin Panel
 * Verifies JWT token from Authorization header and attaches user info to request
 */
export const requireJWTAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
      return;
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token is required',
      });
      return;
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.error({ err: error }, 'Error in requireJWTAuth middleware');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Role-based Authorization Middleware
 * Requires user to have admin role
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin role required',
    });
    return;
  }

  next();
};
