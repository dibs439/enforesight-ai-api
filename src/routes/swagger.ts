import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';

const router = Router();

/**
 * @openapi
 * /api-docs:
 *   get:
 *     tags: [Docs]
 *     summary: OpenAPI documentation (Swagger UI)
 *     description: Interactive API documentation. No auth required.
 *     security: []
 *     responses:
 *       200:
 *         description: Swagger UI HTML page
 */

// Serve raw OpenAPI JSON spec at /api-docs/spec.json
router.get('/spec.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, { explorer: true }));

export default router;
