import type { Request, Response } from 'express';
import { deleteOldImage, uploadContentImage } from '../../middleware/upload';
import { getConvexClient } from '../../utils/convexClient';
import { logger } from '../../utils/logger';

// Dynamic import for API to handle both dev and production environments
let api: any;
try {
  // Try ES module import first (development)
  api = require('../../../convex/_generated/api').api;
} catch {
  try {
    // Fallback to dist location (production)
    api = require('../../convex/_generated/api').api;
  } catch {
    // Final fallback - create a mock API object
    logger.warn('Could not load Convex API - using fallback');
    api = { contents: {} };
  }
}

export class ContentsController {
  /**
   * Get all contents
   */
  async getAllContents(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const contents = await client.query(api.contents.getAllContents);
      return res.json({ success: true, data: contents });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching contents');
      return res.status(500).json({
        error: 'Failed to fetch contents',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const content = await client.query(api.contents.getContentById, {
        id: req.params.id as any,
      });
      return res.json({ success: true, data: content });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch content',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create new content with optional image upload
   */
  createContent(req: Request, res: Response): void {
    uploadContentImage(req, res, async err => {
      if (err) {
        return res.status(400).json({
          error: 'File upload failed',
          details: err.message,
        });
      }

      try {
        const client = getConvexClient();

        // Prepare content data
        const contentData: any = {
          title: req.body.title,
          slug: req.body.slug,
          page: req.body.page,
          body: req.body.body,
          published:
            req.body.published === 'true' || req.body.published === true,
        };

        // Add bullets if provided (handle both string and array)
        if (req.body.bullets) {
          if (typeof req.body.bullets === 'string') {
            try {
              contentData.bullets = JSON.parse(req.body.bullets);
            } catch {
              contentData.bullets = [req.body.bullets];
            }
          } else {
            contentData.bullets = req.body.bullets;
          }
        } else {
          contentData.bullets = [];
        }

        // Add image filename if file was uploaded, otherwise leave it undefined
        if (req.file) {
          contentData.image = req.file.filename;
        } else if (req.body.image) {
          contentData.image = req.body.image;
        }
        // If no image provided, image field will be undefined and optional

        const id = await client.mutation(
          api.contents.createContent,
          contentData
        );

        return res.json({
          success: true,
          id,
          image: contentData.image || null,
        });
      } catch (error) {
        // If content creation fails and we uploaded a file, delete it
        if (req.file) {
          deleteOldImage(req.file.filename);
        }

        return res.status(500).json({
          error: 'Failed to create content',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Update existing content with optional image upload
   */
  updateContent(req: Request, res: Response): void {
    uploadContentImage(req, res, async err => {
      if (err) {
        return res.status(400).json({
          error: 'File upload failed',
          details: err.message,
        });
      }

      try {
        const client = getConvexClient();

        // Get existing content to check for old image
        const existingContent = await client.query(
          api.contents.getContentById,
          {
            id: req.params.id as any,
          }
        );

        // Prepare update data
        const updateData: any = {
          id: req.params.id as any,
        };

        // Add fields if provided
        if (req.body.title !== undefined) updateData.title = req.body.title;
        if (req.body.slug !== undefined) updateData.slug = req.body.slug;
        if (req.body.page !== undefined) updateData.page = req.body.page;
        if (req.body.body !== undefined) updateData.body = req.body.body;
        if (req.body.published !== undefined) {
          updateData.published =
            req.body.published === 'true' || req.body.published === true;
        }

        // Handle bullets
        if (req.body.bullets !== undefined) {
          if (typeof req.body.bullets === 'string') {
            try {
              updateData.bullets = JSON.parse(req.body.bullets);
            } catch {
              updateData.bullets = [req.body.bullets];
            }
          } else {
            updateData.bullets = req.body.bullets;
          }
        }

        // Handle image update
        if (req.file) {
          // New image uploaded
          updateData.image = req.file.filename;

          // Delete old image if it exists
          if (existingContent?.image) {
            deleteOldImage(existingContent.image);
          }
        } else if (req.body.image !== undefined) {
          // Image field explicitly set (could be empty string to remove image)
          updateData.image = req.body.image;

          // If clearing the image, delete the old file
          if (!req.body.image && existingContent?.image) {
            deleteOldImage(existingContent.image);
          }
        }

        await client.mutation(api.contents.updateContent, updateData);

        return res.json({
          success: true,
          image:
            updateData.image !== undefined
              ? updateData.image
              : existingContent?.image,
        });
      } catch (error) {
        // If update fails and we uploaded a new file, delete it
        if (req.file) {
          deleteOldImage(req.file.filename);
        }

        return res.status(500).json({
          error: 'Failed to update content',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Delete content and associated image
   */
  async deleteContent(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();

      // Get existing content to check for image
      const existingContent = await client.query(api.contents.getContentById, {
        id: req.params.id as any,
      });

      // Delete the content from database
      await client.mutation(api.contents.deleteContent, {
        id: req.params.id as any,
      });

      // Delete associated image file if it exists
      if (existingContent?.image) {
        deleteOldImage(existingContent.image);
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to delete content',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const contentsController = new ContentsController();
