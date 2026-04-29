import { Router } from 'express';
import { contentsController } from '../../controllers/admin/contents.controller';
import { requireJWTAuth } from '../../middleware/adminAuth';
import { validateBody, validateMultiple, validateParams } from '../../validation';
import {
    contentFiltersSchema,
    createContentSchema,
    idParamSchema,
    paginationSchema,
    updateContentSchema,
} from '../../validation/schemas';

const router = Router();

/**
 * @openapi
 * /admin/contents:
 *   get:
 *     tags: [Admin - Content]
 *     summary: List all content records
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated content list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ContentRecord'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Admin - Content]
 *     summary: Create a new content record
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, type]
 *             properties:
 *               title:
 *                 type: string
 *                 description: Content title
 *                 example: Privacy Policy
 *               content:
 *                 type: string
 *                 description: Main content body
 *                 example: 'We collect the following personal data...'
 *               type:
 *                 type: string
 *                 enum: [article, news, update]
 *                 example: article
 *               isPublished:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *               publishedAt:
 *                 type: string
 *                 format: date-time
 *                 example: '2025-06-01T00:00:00.000Z'
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [privacy, legal]
 *           example:
 *             title: Privacy Policy
 *             content: 'We collect the following personal data...'
 *             type: article
 *             isPublished: false
 *     responses:
 *       200:
 *         description: Content record created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ContentRecord'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  requireJWTAuth,
  validateMultiple({ query: contentFiltersSchema.merge(paginationSchema) }),
  (req, res) => contentsController.getAllContents(req, res)
);
router.post('/', requireJWTAuth, validateBody(createContentSchema), (req, res) =>
  contentsController.createContent(req, res)
);

/**
 * @openapi
 * /admin/contents/{id}:
 *   get:
 *     tags: [Admin - Content]
 *     summary: Get a content record by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     responses:
 *       200:
 *         description: Content object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ContentRecord'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     tags: [Admin - Content]
 *     summary: Update a content record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: Privacy Policy }
 *               content: { type: string, example: 'Updated policy text...' }
 *               type: { type: string, enum: [article, news, update], example: article }
 *               isPublished: { type: boolean, example: true }
 *               publishedAt: { type: string, format: date-time, example: '2025-06-01T00:00:00.000Z' }
 *               tags: { type: array, items: { type: string }, example: [privacy, legal] }
 *     responses:
 *       200:
 *         description: Content record updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ContentRecord'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Admin - Content]
 *     summary: Delete a content record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: k57abc123def456ghi789
 *     responses:
 *       200:
 *         description: Content record deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Content deleted }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  contentsController.getContentById(req, res)
);
router.patch(
  '/:id',
  requireJWTAuth,
  validateMultiple({ params: idParamSchema, body: updateContentSchema }),
  (req, res) => contentsController.updateContent(req, res)
);
router.delete('/:id', requireJWTAuth, validateParams(idParamSchema), (req, res) =>
  contentsController.deleteContent(req, res)
);

export default router;
