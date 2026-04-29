import type { Request, Response } from 'express';
import { deleteOldImage, uploadClientLogo } from '../../middleware/upload';
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
    api = { clients: {} };
  }
}

export class ClientsController {
  /**
   * Get all clients with pagination
   */
  async getAllClients(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const client = getConvexClient();
      const result = await client.query(api.clients.getAllClients, {
        offset,
        limit,
      });

      return res.json({
        success: true,
        data: result.clients,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch clients',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get client by ID
   */
  async getClientById(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const clientData = await client.query(api.clients.getClientById, {
        id: req.params.id as any,
      });
      return res.json({ success: true, data: clientData });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch client',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create new client with optional logo upload
   */
  createClient(req: Request, res: Response): void {
    uploadClientLogo(req, res, async err => {
      if (err) {
        return res.status(400).json({
          error: 'File upload failed',
          details: err.message,
        });
      }

      try {
        const client = getConvexClient();

        // Prepare client data
        const clientData: any = {
          name: req.body.name,
          email: req.body.email,
        };

        // Add optional fields if provided
        if (req.body.phone) clientData.phone = req.body.phone;
        if (req.body.address) clientData.address = req.body.address;
        if (req.body.contactPerson)
          clientData.contactPerson = req.body.contactPerson;
        if (req.body.subscriptionTier)
          clientData.subscriptionTier = req.body.subscriptionTier;
        if (req.body.notes) clientData.notes = req.body.notes;

        // Handle active status
        if (req.body.active !== undefined) {
          clientData.active =
            req.body.active === 'true' || req.body.active === true;
        }

        // Add logo filename if file was uploaded
        if (req.file) {
          clientData.logo = req.file.filename;
        } else if (req.body.logo) {
          clientData.logo = req.body.logo;
        }

        const id = await client.mutation(api.clients.createClient, clientData);

        return res.json({
          success: true,
          id,
          logo: clientData.logo || null,
        });
      } catch (error) {
        // If client creation fails and we uploaded a file, delete it
        if (req.file) {
          deleteOldImage(req.file.filename, 'client');
        }

        return res.status(500).json({
          error: 'Failed to create client',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Update existing client with optional logo upload
   */
  updateClient(req: Request, res: Response): void {
    uploadClientLogo(req, res, async err => {
      if (err) {
        return res.status(400).json({
          error: 'File upload failed',
          details: err.message,
        });
      }

      try {
        const client = getConvexClient();

        // Get existing client to check for old logo
        const existingClient = await client.query(api.clients.getClientById, {
          id: req.params.id as any,
        });

        // Prepare update data
        const updateData: any = {
          id: req.params.id as any,
        };

        // Add fields if provided
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.email !== undefined) updateData.email = req.body.email;
        if (req.body.phone !== undefined) updateData.phone = req.body.phone;
        if (req.body.address !== undefined)
          updateData.address = req.body.address;
        if (req.body.contactPerson !== undefined)
          updateData.contactPerson = req.body.contactPerson;
        if (req.body.subscriptionTier !== undefined)
          updateData.subscriptionTier = req.body.subscriptionTier;
        if (req.body.notes !== undefined) updateData.notes = req.body.notes;

        if (req.body.active !== undefined) {
          updateData.active =
            req.body.active === 'true' || req.body.active === true;
        }

        // Handle logo update
        if (req.file) {
          // New logo uploaded
          updateData.logo = req.file.filename;

          // Delete old logo if it exists
          if (existingClient?.logo) {
            deleteOldImage(existingClient.logo, 'client');
          }
        } else if (req.body.logo !== undefined) {
          // Logo field explicitly set (could be empty string to remove logo)
          updateData.logo = req.body.logo;

          // If clearing the logo, delete the old file
          if (!req.body.logo && existingClient?.logo) {
            deleteOldImage(existingClient.logo, 'client');
          }
        }

        await client.mutation(api.clients.updateClient, updateData);

        return res.json({
          success: true,
          logo:
            updateData.logo !== undefined
              ? updateData.logo
              : existingClient?.logo,
        });
      } catch (error) {
        // If update fails and we uploaded a new file, delete it
        if (req.file) {
          deleteOldImage(req.file.filename, 'client');
        }

        return res.status(500).json({
          error: 'Failed to update client',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Delete client and associated logo
   */
  async deleteClient(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();

      // Get existing client to check for logo
      const existingClient = await client.query(api.clients.getClientById, {
        id: req.params.id as any,
      });

      // Delete the client from database
      await client.mutation(api.clients.deleteClient, {
        id: req.params.id as any,
      });

      // Delete associated logo file if it exists
      if (existingClient?.logo) {
        deleteOldImage(existingClient.logo, 'client');
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to delete client',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const clientsController = new ClientsController();
