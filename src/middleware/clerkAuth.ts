import { clerkClient, verifyToken } from '@clerk/express';
import { NextFunction, Request, Response } from 'express';
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
export interface ClerkAuthRequest extends Request {
  clerkUser?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
}

/**
 * Extract Clerk issuer from publishable key
 * Format: pk_test_<base64_encoded_domain>
 */
function getClerkIssuer(): string {
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error('CLERK_PUBLISHABLE_KEY is required');
  }

  // Extract the base64 part after pk_test_ or pk_live_
  const parts = publishableKey.split('_');
  if (parts.length >= 3 && parts[2]) {
    const base64Domain = parts[2];
    try {
      // Decode base64 and trim any non-alphanumeric characters (like $ padding)
      const domain = Buffer.from(base64Domain, 'base64')
        .toString('utf-8')
        .replace(/[^a-zA-Z0-9.-]/g, ''); // Remove any special characters
      return `https://${domain}`;
    } catch (error) {
      logger.error({ err: error }, 'Failed to decode publishable key');
    }
  }

  // Could not extract issuer from publishable key
  throw new Error('Could not extract Clerk issuer from CLERK_PUBLISHABLE_KEY');
}

/**
 * Clerk authentication middleware for CUSTOMER PORTAL routes only
 * Admin routes use separate JWT authentication (src/middleware/auth.ts)
 *
 * Verifies JWT session token from Authorization header
 * Automatically fetches JWKS from Clerk to validate token signature
 */
export const requireClerkAuth = async (
  req: ClerkAuthRequest,
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

    const token = authHeader.substring(7).trim(); // Remove 'Bearer ' and trim whitespace

    // Validate JWT format (should have 3 parts separated by dots)
    if (!token || token.split('.').length !== 3) {
      logger.error({ tokenParts: token.split('.').length }, 'Invalid JWT format');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message:
          'Invalid token format. JWT must have 3 parts (header.payload.signature)',
      });
    }

    // Verify JWT token - Clerk SDK will fetch JWKS via the Backend API using secretKey
    // This validates the token signature using the correct public key
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      authorizedParties: [getClerkIssuer()],
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired session token',
      });
    }

    // Attach session info to request (use existing auth property from auth.ts)
    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid as string,
      claims: payload as any,
    };

    // Fetch user details from Clerk
    const user = await clerkClient.users.getUser(payload.sub);

    req.clerkUser = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      imageUrl: user.imageUrl || null,
    };

    // Also set the user object for compatibility with chat API
    req.user = {
      userId: user.id,
      username:
        user.username || user.emailAddresses[0]?.emailAddress || user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
    };

    return next();
  } catch (error: any) {
    logger.error({ err: error }, 'Clerk auth error');
    // Handle JWT parsing errors
    if (
      error.message?.includes('Unexpected end of data') ||
      error.message?.includes('parse') ||
      error.message?.includes('decode')
    ) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message:
          'Malformed token. Please ensure you are sending a valid Clerk session token.',
      });
    }

    // Handle JWKS key mismatch errors
    if (
      error.message?.includes('signing key') ||
      error.reason === 'jwk-remote-missing'
    ) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message:
          'Token signing key not found. Please generate a fresh token from your Clerk session.',
      });
    }

    // Handle specific Clerk errors
    if (
      error.status === 401 ||
      error.message?.includes('Invalid') ||
      error.message?.includes('expired')
    ) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired session token',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional middleware to attach Clerk user without requiring auth
 * Use for routes that should work with or without authentication
 * Uses networkless token verification (recommended by Clerk)
 */
export const optionalClerkAuth = async (
  req: ClerkAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without auth
    }

    const token = authHeader.substring(7);

    // Verify JWT token using networkless verification
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      authorizedParties: [getClerkIssuer()],
    });

    if (payload && payload.sub) {
      req.auth = {
        userId: payload.sub,
        sessionId: payload.sid as string,
        claims: payload as any,
      };

      const user = await clerkClient.users.getUser(payload.sub);
      req.clerkUser = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        imageUrl: user.imageUrl || null,
      };
    }

    return next();
  } catch (_error) {
    // Silently continue without auth on error
    return next();
  }
};
