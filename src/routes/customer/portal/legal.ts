import express from 'express';
import { getConvexClient } from '../../../utils/convexClient';
import { logger } from '../../../utils/logger';

const router = express.Router();
const convex = getConvexClient();

// Dynamic API import
let api: any;
try {
  api = require('../../../convex/_generated/api').api;
} catch {
  api = require('../../../../convex/_generated/api').api;
}

/**
 * @openapi
 * /customer/portal/privacy-policy:
 *   get:
 *     tags: [Customer Portal]
 *     summary: Get the Privacy Policy content
 *     description: Public endpoint — no authentication required.
 *     security: []
 *     responses:
 *       200:
 *         description: Privacy Policy content object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: k57abc123def456ghi789 }
 *                     title: { type: string, example: Privacy Policy }
 *                     slug: { type: string, example: privacy }
 *                     body: { type: string, example: 'We collect the following data...' }
 *                     bullets:
 *                       type: array
 *                       items: { type: string }
 *                       example: ['We do not sell your data', 'Data is encrypted at rest']
 *                     image: { type: string, nullable: true, example: null }
 *                     lastUpdated: { type: number, example: 1710000000000 }
 *       404:
 *         description: Privacy Policy not found or not published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/privacy-policy', async (req, res) => {
  try {
    if (!api?.contents?.getBySlug) {
      return res.status(500).json({
        success: false,
        message: 'Contents API not available',
        statusCode: 500,
      });
    }

    const content = await convex.query(api.contents.getBySlug, {
      slug: 'privacy',
    });
    logger.debug({ content }, 'Privacy policy content retrieved');

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Privacy Policy not found',
        statusCode: 404,
      });
    }

    if (!content.published) {
      return res.status(404).json({
        success: false,
        message: 'Privacy Policy is not published',
        statusCode: 404,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: content._id,
        title: content.title,
        slug: content.slug,
        body: content.body,
        bullets: content.bullets,
        image: content.image,
        lastUpdated: content._creationTime,
      },
      statusCode: 200,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching privacy policy');
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500,
    });
  }
});

/**
 * @openapi
 * /customer/portal/terms-of-use:
 *   get:
 *     tags: [Customer Portal]
 *     summary: Get the Terms of Use content
 *     description: Public endpoint — no authentication required.
 *     security: []
 *     responses:
 *       200:
 *         description: Terms of Use content object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: k57abc123def456ghi789 }
 *                     title: { type: string, example: Terms of Use }
 *                     slug: { type: string, example: terms }
 *                     body: { type: string, example: 'By using this service you agree to...' }
 *                     bullets:
 *                       type: array
 *                       items: { type: string }
 *                       example: ['You must be 18 or older', 'No unauthorized use']
 *                     image: { type: string, nullable: true, example: null }
 *                     lastUpdated: { type: number, example: 1710000000000 }
 *       404:
 *         description: Terms of Use not found or not published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/terms-of-use', async (req, res) => {
  try {
    if (!api?.contents?.getBySlug) {
      return res.status(500).json({
        success: false,
        message: 'Contents API not available',
        statusCode: 500,
      });
    }

    const content = await convex.query(api.contents.getBySlug, {
      slug: 'terms',
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Terms of Use not found',
        statusCode: 404,
      });
    }

    if (!content.published) {
      return res.status(404).json({
        success: false,
        message: 'Terms of Use is not published',
        statusCode: 404,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: content._id,
        title: content.title,
        slug: content.slug,
        body: content.body,
        bullets: content.bullets,
        image: content.image,
        lastUpdated: content._creationTime,
      },
      statusCode: 200,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching terms of use');
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500,
    });
  }
});

/**
 * @openapi
 * /customer/portal/legal-documents:
 *   get:
 *     tags: [Customer Portal]
 *     summary: Get both Privacy Policy and Terms of Use in a single request
 *     description: Public endpoint — no authentication required. Returns whichever documents are currently published.
 *     security: []
 *     responses:
 *       200:
 *         description: Object containing the published legal documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     privacyPolicy:
 *                       nullable: true
 *                       type: object
 *                       properties:
 *                         id: { type: string, example: k57abc123def456ghi789 }
 *                         title: { type: string, example: Privacy Policy }
 *                         slug: { type: string, example: privacy }
 *                         body: { type: string, example: 'We collect the following data...' }
 *                         bullets: { type: array, items: { type: string } }
 *                         image: { type: string, nullable: true }
 *                         lastUpdated: { type: number, example: 1710000000000 }
 *                     termsOfUse:
 *                       nullable: true
 *                       type: object
 *                       properties:
 *                         id: { type: string, example: m8xyz987abc654def321 }
 *                         title: { type: string, example: Terms of Use }
 *                         slug: { type: string, example: terms }
 *                         body: { type: string, example: 'By using this service you agree to...' }
 *                         bullets: { type: array, items: { type: string } }
 *                         image: { type: string, nullable: true }
 *                         lastUpdated: { type: number, example: 1710000000000 }
 *       404:
 *         description: No published legal documents found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/legal-documents', async (req, res) => {
  try {
    if (!api?.contents?.getBySlug) {
      return res.status(500).json({
        success: false,
        message: 'Contents API not available',
        statusCode: 500,
      });
    }

    const [privacy, terms] = await Promise.all([
      convex.query(api.contents.getBySlug, { slug: 'privacy' }),
      convex.query(api.contents.getBySlug, { slug: 'terms' }),
    ]);

    const result: {
      success: boolean;
      data: {
        privacyPolicy?: any;
        termsOfUse?: any;
      };
      statusCode: number;
    } = {
      success: true,
      data: {},
      statusCode: 200,
    };

    if (privacy && privacy.published) {
      result.data.privacyPolicy = {
        id: privacy._id,
        title: privacy.title,
        slug: privacy.slug,
        body: privacy.body,
        bullets: privacy.bullets,
        image: privacy.image,
        lastUpdated: privacy._creationTime,
      };
    }

    if (terms && terms.published) {
      result.data.termsOfUse = {
        id: terms._id,
        title: terms.title,
        slug: terms.slug,
        body: terms.body,
        bullets: terms.bullets,
        image: terms.image,
        lastUpdated: terms._creationTime,
      };
    }

    if (!result.data.privacyPolicy && !result.data.termsOfUse) {
      return res.status(404).json({
        success: false,
        message: 'No legal documents found',
        statusCode: 404,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching legal documents');
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500,
    });
  }
});

export default router;
