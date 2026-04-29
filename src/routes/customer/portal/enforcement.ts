import { Request, Response, Router } from 'express';
import { requireClerkAuth } from '../../../middleware/clerkAuth';
import { logger } from '../../../utils/logger';
import * as enforcementController from './enforcement.controller';

const router = Router();

/**
 * @openapi
 * /customer/portal/enforcement/search:
 *   post:
 *     tags: [Customer Portal]
 *     summary: Advanced enforcements search with flexible filter parameters
 *     description: Requires a **Clerk session token** passed as a Bearer token in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 type: string
 *                 description: Free-text keyword search
 *                 example: insider trading
 *               regulator:
 *                 type: string
 *                 description: Regulator Convex ID
 *                 example: jsgvmtb9fh0hwfm3bxcxm6fd3s77cks0
 *               regulatorName:
 *                 type: string
 *                 example: SEC
 *               jurisdiction:
 *                 type: string
 *                 example: United States
 *               sector:
 *                 type: string
 *                 example: Finance
 *               actionType:
 *                 type: string
 *                 example: Fine
 *               violationType:
 *                 type: string
 *                 example: Market Manipulation
 *               currency:
 *                 type: string
 *                 example: USD
 *               minFineAmount:
 *                 type: number
 *                 example: 10000
 *               maxFineAmount:
 *                 type: number
 *                 example: 5000000
 *               dateFrom:
 *                 type: string
 *                 format: date
 *                 example: '2024-01-01'
 *               dateTo:
 *                 type: string
 *                 format: date
 *                 example: '2025-12-31'
 *               page:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 *               limit:
 *                 type: integer
 *                 default: 20
 *                 example: 20
 *           example:
 *             search: insider trading
 *             jurisdiction: United States
 *             sector: Finance
 *             page: 1
 *             limit: 20
 *     responses:
 *       200:
 *         description: Filtered enforcement results with pagination and AI-generated search description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Enforcement'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     searchDescription:
 *                       type: string
 *                       example: Found 12 enforcement actions in United States for the Finance sector
 *       401:
 *         description: Unauthorized — Clerk token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/search',
  requireClerkAuth,
  async (req: Request, res: Response) => {
    logger.debug('Enforcement search endpoint hit');
    await enforcementController.searchEnforcements(req, res);
  }
);

/**
 * @openapi
 * /customer/portal/enforcement/{id}:
 *   get:
 *     tags: [Customer Portal]
 *     summary: Get enforcement details by ID (generates AI summary if not cached)
 *     description: Public endpoint — no authentication required. An AI summary is generated and cached on first access.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: jsgvmtb9fh0hwfm3bxcxm6fd3s77cks0
 *     responses:
 *       200:
 *         description: Enforcement detail object with AI summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Enforcement'
 *       404:
 *         description: Enforcement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req: Request, res: Response) => {
  logger.debug({ id: req.params.id }, 'Enforcement get by ID endpoint hit');
  await enforcementController.getEnforcementById(req, res);
});

export default router;
