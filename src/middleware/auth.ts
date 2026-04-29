import { createClerkClient } from '@clerk/express';
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

// Ensure environment variables are set
if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY is required');
}

logger.info({ clerkSecretKeySet: !!process.env.CLERK_SECRET_KEY, clerkPublishableKeySet: !!process.env.CLERK_PUBLISHABLE_KEY }, 'Clerk keys loaded');

// Middleware to require authentication using @clerk/backend
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const secretKey = process.env.CLERK_SECRET_KEY || '';
    const jwtKey = process.env.CLERK_JWT_KEY;

    if (!secretKey) {
      logger.error('CLERK_SECRET_KEY is not configured');
      res.status(500).json({ error: 'Server misconfiguration' });
      return;
    }

    const clerkOptions: { secretKey: string; publishableKey?: string } = {
      secretKey,
    };
    if (process.env.CLERK_PUBLISHABLE_KEY) {
      clerkOptions.publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    }

    const clerkClient = createClerkClient(clerkOptions);

    // Build a Request-like object for Clerk's authenticateRequest
    const protocol = req.protocol || 'http';
    const host = req.get('host') || new URL(process.env.API_BASE_URL || 'http://localhost:3000').host;
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    // Normalize headers to string->string
    const headerEntries = Object.entries(req.headers).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(',') : (v ?? ''),
    ]);
    const headersObj = Object.fromEntries(headerEntries) as Record<
      string,
      string
    >;

    const clerkRequest = new Request(fullUrl, {
      method: req.method,
      headers: new Headers(headersObj),
    });

    const authOptions: {
      authorizedParties?: string[];
      jwtKey?: string;
      audience?: string[];
      clockSkewInSeconds?: number;
    } = {
      clockSkewInSeconds: 60, // Allow 60 seconds clock skew
    };

    // Build authorized parties from env vars only — no hardcoded URLs
    const authorizedParties = [
      process.env.API_BASE_URL,
      process.env.FRONTEND_URL,
    ].filter((p): p is string => Boolean(p));

    authOptions.authorizedParties = authorizedParties;

    // Only add jwtKey if explicitly provided
    if (jwtKey && jwtKey.trim()) {
      authOptions.jwtKey = jwtKey;
      logger.debug('Using custom JWT key for verification');
    } else {
      logger.debug('Using default Clerk JWT verification');
    }

    const authResult = await clerkClient.authenticateRequest(
      clerkRequest,
      authOptions
    );

    if (!authResult || !authResult.isSignedIn) {
      const errorDetails = authResult?.reason || 'Not signed in';
logger.warn({ reason: errorDetails, url: fullUrl, method: req.method }, 'Authentication failed');

      res.status(401).json({
        error: 'Unauthorized',
        details: errorDetails,
      });
      return;
    }

    // Attach auth result to request for downstream handlers
    (req as unknown as { auth?: unknown }).auth = authResult;
    logger.debug({ userId: (authResult as any).userId }, 'Authentication successful');
    next();
  } catch (error) {
    logger.error({ err: error }, 'Error in requireAuth middleware');
    res.status(500).json({
      error: 'Authentication error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Middleware to require admin role
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.debug({ authExists: !!req.auth }, 'Admin middleware auth check');

  if (!req.auth) {
    logger.warn('No auth object found - authentication failed');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      details:
        'No authentication context found. Token may be expired or invalid.',
    });
    return;
  }

  // Check if user has admin role
  const userRole = req.auth.claims?.role || req.auth.claims?.metadata?.role;

  if (userRole !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }

  next();
};

// Combined middleware for admin routes
export const requireAdminAuth = [requireAuth, requireAdmin];

// JWT-based authentication middleware (for admin API endpoints)
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
