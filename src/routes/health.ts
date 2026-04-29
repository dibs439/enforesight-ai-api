import { Request, Response, Router } from 'express';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: Returns server health status and dependency reachability. No auth required.
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: One or more dependencies are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
router.get('/health', async (req: Request, res: Response) => {
  const convexUrl = process.env.CONVEX_URL;

  // Deep check: attempt a lightweight HTTP HEAD request to Convex
  let convexStatus: 'ok' | 'degraded' | 'unconfigured' = 'unconfigured';
  if (convexUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(convexUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      convexStatus = response.ok || response.status < 500 ? 'ok' : 'degraded';
    } catch {
      convexStatus = 'degraded';
    }
  }

  const healthy = convexStatus !== 'degraded';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    message: healthy ? 'Server is running' : 'One or more dependencies are unhealthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      convex: convexStatus,
    },
  });
});

export default router;
