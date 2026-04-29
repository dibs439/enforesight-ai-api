import { createClerkClient } from '@clerk/express';
import type { Request } from 'express';
import { logger } from '../utils/logger';

export interface AuthResult {
  isSignedIn: boolean;
  reason?: string | null;
}

export class ClerkAuthService {
  private clerkClient;

  constructor(secretKey: string, publishableKey: string) {
    this.clerkClient = createClerkClient({
      secretKey,
      publishableKey,
    });
  }

  async authenticateRequest(req: Request): Promise<AuthResult> {
    // Construct the full URL from the Express request
    const protocol = req.protocol || 'http';
    const host = req.get('host') || new URL(process.env.API_BASE_URL || 'http://localhost:3000').host;
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    logger.debug({ url: fullUrl }, 'Authenticating request');

    // Create a proper Request object for Clerk
    const clerkRequest = new Request(fullUrl, {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    });

    const jwtKey = process.env.CLERK_JWT_KEY;

    // Build authorized parties from env vars only — no hardcoded URLs
    const authorizedParties: string[] = [
      process.env.API_BASE_URL,
      process.env.FRONTEND_URL,
    ].filter((p): p is string => Boolean(p));

    const authOptions: {
      authorizedParties: string[];
      jwtKey?: string;
    } = {
      authorizedParties,
    };

    if (jwtKey) {
      authOptions.jwtKey = jwtKey;
    }

    logger.debug({ authOptions }, 'Auth options');

    const authResult = await this.clerkClient.authenticateRequest(
      clerkRequest,
      authOptions
    );

    logger.debug({ isSignedIn: authResult.isSignedIn }, 'Auth result');

    return authResult;
  }
}
