import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Assigns a unique X-Request-ID to every request for request correlation/tracing.
 * Reuses the client-supplied header if present, otherwise generates a new UUID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
