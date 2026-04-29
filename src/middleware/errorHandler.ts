import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

/** Returns a 404 JSON response for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404,
  });
}

/** Catches all unhandled errors and returns a standardised 500 response. */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error({ err, path: req.originalUrl }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong!'
        : err.message,
    statusCode: 500,
  });
}
