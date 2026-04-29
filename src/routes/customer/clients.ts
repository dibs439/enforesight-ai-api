import { Router } from 'express';
import { clientsController } from '../../controllers/clients.controller';

const router = Router();

/**
 * @openapi
 * /clients/active:
 *   get:
 *     tags: [Clients]
 *     summary: Get all active clients
 *     security: []
 *     responses:
 *       200:
 *         description: Array of active client objects
 */
router.get('/active', clientsController.getActiveClients.bind(clientsController));

export default router;
