import { Router } from 'express';
import { contentController } from '../../controllers/content.controller';

const router = Router();

/**
 * @openapi
 * /content/page/{page}:
 *   get:
 *     tags: [Content]
 *     summary: Get content by page identifier
 *     security: []
 *     parameters:
 *       - in: path
 *         name: page
 *         required: true
 *         schema: { type: string }
 *         description: Page identifier
 *     responses:
 *       200:
 *         description: Content object for the given page
 *       404:
 *         description: Content not found
 */
router.get('/page/:page', contentController.getByPage.bind(contentController));

/**
 * @openapi
 * /content/slug/{slug}:
 *   get:
 *     tags: [Content]
 *     summary: Get content by slug
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL slug
 *     responses:
 *       200:
 *         description: Content object for the given slug
 *       404:
 *         description: Content not found
 */
router.get('/slug/:slug', contentController.getBySlug.bind(contentController));

export default router;
