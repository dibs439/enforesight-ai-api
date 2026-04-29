import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

const configuredOrigins = [
  ...parseOrigins(process.env.CORS_ORIGIN),
  ...parseOrigins(process.env.CORS_ORIGINS),
  process.env.FRONTEND_URL,
  process.env.API_BASE_URL,
].filter((origin): origin is string => Boolean(origin));

export const CORS_ORIGINS: string[] = Array.from(new Set(configuredOrigins));

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(
        { origin, allowedOrigins: CORS_ORIGINS },
        'CORS: origin not allowed'
      );
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  // Let the CORS middleware reflect requested headers instead of rejecting
  // modern browser-added headers (e.g. baggage, sentry-trace, etc.).
  allowedHeaders: undefined,
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

/**
 * Handles OPTIONS preflight requests before the main CORS middleware.
 * Responds immediately with the appropriate CORS headers for allowed origins.
 */
export function preflightHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && CORS_ORIGINS.includes(origin)) {
      const requestedHeaders = req.headers['access-control-request-headers'];

      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH'
      );
      if (requestedHeaders) {
        res.header('Access-Control-Allow-Headers', String(requestedHeaders));
      }
      res.status(200).end();
      return;
    }
  }
  next();
}
