import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config(); // This will load .env as fallback

import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { corsOptions, preflightHandler } from './config/cors';
import { aiLimiter, authLimiter, generalLimiter } from './config/rateLimiter';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { flexibleAuth } from './middleware/flexibleAuth';
import { requestIdMiddleware } from './middleware/requestId';
import apiRoutes from './routes/api';
import healthRoutes from './routes/health';
import swaggerRouter from './routes/swagger';
import { logger } from './utils/logger';

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = ['JWT_SECRET'] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.fatal(`FATAL: Required environment variable "${key}" is not set.`);
    process.exit(1);
  }
}

// Create Express application
const app: Application = express();

// Set port from environment variable or default to 3000
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Environment-based configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

// Request correlation ID middleware — assigns X-Request-ID to every request
app.use(requestIdMiddleware);

// Middleware
app.use(compression()); // Gzip/deflate response compression

// Helmet security headers — CSP is relaxed for /api-docs so that
// swagger-ui-express can load its inline scripts and styles in all browsers
// (Safari enforces CSP more strictly than Chrome/Firefox).
app.use((req, res, next) => {
  if (req.path.startsWith('/api-docs')) {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    })(req, res, next);
  }
  return helmet()(req, res, next);
});

// Handle preflight requests explicitly before CORS middleware
app.use(preflightHandler);

app.use(cors(corsOptions)); // Enable CORS with environment-based origins

// Rate limiters MUST come after CORS so that 429 responses still carry
// Access-Control-Allow-Origin headers (otherwise the browser misreports
// a rate-limit rejection as a CORS error).
app.use('/api/v1', generalLimiter);
app.use('/api/v1/admin/users/login', authLimiter);
app.use('/api/v1/admin/users/activate', authLimiter);
app.use('/api/v1/ai', aiLimiter);

app.use(morgan('combined')); // HTTP request logging
app.use(express.json({ limit: '1gb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1gb' })); // Parse URL-encoded bodies

// Serve static files from uploads directory — gated behind flexible auth
// Customers must present a valid Clerk or JWT token to access uploaded files
app.use(
  '/uploads',
  flexibleAuth,
  express.static(path.join(process.cwd(), 'uploads'))
);

// Serve static files from docs directory
app.use('/docs', express.static(path.join(process.cwd(), 'docs')));

// Serve static files from assets directory
app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

// Routes
app.use('/', healthRoutes);

// OpenAPI / Swagger documentation
app.use('/api-docs', swaggerRouter);

// All API routes mounted under /api/v1
app.use('/api/v1', apiRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// Start server only when this file is run directly (not when imported)
/*
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}*/

if (process.env.JEST_WORKER_ID === undefined) {
  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${NODE_ENV}]`);
    logger.info(`API: ${API_BASE_URL}/api`);
    logger.info(`Health: ${API_BASE_URL}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    server.close(() => {
      logger.info('Server shut down gracefully');
      process.exit(0);
    });
    // Force exit if not closed within 10 seconds
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
