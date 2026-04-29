import type { Request, Response } from 'express';
import { Webhook } from 'svix';
import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

// Dynamic API import
let api: any;
try {
  api = require('../convex/_generated/api').api;
} catch {
  api = require('../../convex/_generated/api').api;
}

// Clerk webhook event types
interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    object: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
      verification?: {
        status: string;
      };
    }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    last_sign_in_at?: number;
    created_at: number;
    updated_at: number;
  };
  object: string;
}

export class WebhookController {
  /**
   * Handle Clerk webhooks for user events
   */
  async handleClerkWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

      if (!webhookSecret) {
        logger.error('CLERK_WEBHOOK_SECRET not found in environment variables');
        return res.status(500).json({
          error: 'Webhook secret not configured',
        });
      }

      // Get webhook headers
      const svix_id = req.headers['svix-id'] as string;
      const svix_timestamp = req.headers['svix-timestamp'] as string;
      const svix_signature = req.headers['svix-signature'] as string;

      // If there are no headers, error out
      if (!svix_id || !svix_timestamp || !svix_signature) {
        logger.error('Missing svix headers');
        return res.status(400).json({
          error: 'Missing webhook verification headers',
        });
      }

      // Get the body
      const body = req.body;

      // Create a new Svix instance with your webhook secret
      const wh = new Webhook(webhookSecret);

      let evt: ClerkWebhookEvent;

      // Verify the webhook
      try {
        evt = wh.verify(JSON.stringify(body), {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        }) as ClerkWebhookEvent;
      } catch (err) {
        logger.error({ err }, 'Error verifying webhook');
        return res.status(400).json({
          error: 'Webhook verification failed',
        });
      }

      // Handle the webhook
      const { type, data } = evt;
      logger.info({ type, userId: data.id }, 'Received Clerk webhook');

      const client = getConvexClient();

      switch (type) {
        case 'user.created':
          await this.handleUserCreated(client, data);
          break;
        case 'user.updated':
          await this.handleUserUpdated(client, data);
          break;
        case 'user.deleted':
          await this.handleUserDeleted(client, data);
          break;
        default:
          logger.warn({ type }, 'Unhandled webhook type');
          break;
      }

      return res.status(200).json({
        success: true,
        message: `Webhook ${type} processed successfully`,
      });
    } catch (error) {
      logger.error({ err: error }, 'Webhook processing error');
      return res.status(500).json({
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleUserCreated(client: any, userData: any) {
    try {
      // Get primary email address
      const primaryEmail = userData.email_addresses?.find(
        (email: any) =>
          email.verification?.status === 'verified' ||
          userData.email_addresses.length === 1
      );

      if (!primaryEmail) {
        throw new Error('No verified email address found');
      }

      const customerData = {
        clerkId: userData.id,
        email: primaryEmail.email_address,
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        imageUrl: userData.image_url || '',
        active: true,
        subscriptionTier: 'free', // Default subscription tier
        lastSignInAt: userData.last_sign_in_at
          ? new Date(userData.last_sign_in_at).toISOString()
          : new Date().toISOString(),
      };

      if (!api?.customers?.createCustomer) {
        throw new Error('Customers API not available');
      }

      const customerId = await client.mutation(
        api.customers.createCustomer,
        customerData
      );

      logger.info({ customerId, clerkUserId: userData.id }, 'Created customer');
    } catch (error) {
      logger.error({ err: error }, 'Error creating customer');
      // Check if it's a duplicate error
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.info('Customer already exists, skipping creation');
        return;
      }
      throw error;
    }
  }

  private async handleUserUpdated(client: any, userData: any) {
    try {
      // Get primary email address
      const primaryEmail = userData.email_addresses?.find(
        (email: any) =>
          email.verification?.status === 'verified' ||
          userData.email_addresses.length === 1
      );

      if (!primaryEmail) {
        throw new Error('No verified email address found');
      }

      const updateData = {
        clerkId: userData.id,
        email: primaryEmail.email_address,
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        imageUrl: userData.image_url || '',
        lastSignInAt: userData.last_sign_in_at
          ? new Date(userData.last_sign_in_at).toISOString()
          : undefined,
      };

      if (!api?.customers?.updateCustomerByClerkId) {
        throw new Error('Customers API not available');
      }

      await client.mutation(api.customers.updateCustomerByClerkId, updateData);

      logger.info({ clerkUserId: userData.id }, 'Updated customer');
    } catch (error) {
      logger.error({ err: error }, 'Error updating customer');
      // If customer doesn't exist, create them
      if (error instanceof Error && error.message.includes('not found')) {
        logger.info('Customer not found, creating new one');
        await this.handleUserCreated(client, userData);
        return;
      }
      throw error;
    }
  }

  private async handleUserDeleted(client: any, userData: any) {
    try {
      if (!api?.customers?.deleteCustomerByClerkId) {
        throw new Error('Customers API not available');
      }

      await client.mutation(api.customers.deleteCustomerByClerkId, {
        clerkId: userData.id,
      });

      logger.info({ clerkUserId: userData.id }, 'Deleted customer');
    } catch (error) {
      logger.error({ err: error }, 'Error deleting customer');
      // If customer doesn't exist, that's fine
      if (error instanceof Error && error.message.includes('not found')) {
        logger.info('Customer not found, nothing to delete');
        return;
      }
      throw error;
    }
  }
}
