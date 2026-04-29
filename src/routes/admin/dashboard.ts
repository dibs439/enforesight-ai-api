import { Router } from 'express';
import { dashboardController } from '../../controllers/admin/dashboard.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';

const router = Router();

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get dashboard statistics
 *     description: Returns aggregated statistics for customers and enforcements. Requires admin JWT.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     customers:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 1240 }
 *                         active: { type: integer, example: 1100 }
 *                         suspended: { type: integer, example: 140 }
 *                         newThisMonth: { type: integer, example: 37 }
 *                     enforcements:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 8760 }
 *                         newThisMonth: { type: integer, example: 124 }
 *                         totalFineAmount: { type: number, example: 4520000000 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', requireJWTAuth, (req, res) => dashboardController.getDashboard(req, res));

export default router;
