import { Request, Response } from 'express';
import type { CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer';
import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

let api: any;
try {
  api = require('../../convex/_generated/api').api;
} catch {
  try {
    api = require('../convex/_generated/api').api;
  } catch {
    logger.warn('Could not load Convex API - using fallback');
    api = { customers: {} };
  }
}

function initClerk() {
  if (!process.env.CLERK_API_KEY) return null;
  try {
    const { createClerkClient } = require('@clerk/express');
    return createClerkClient({ secretKey: process.env.CLERK_API_KEY });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Clerk');
    return null;
  }
}

export class CustomersController {
  private get convex() {
    return getConvexClient();
  }

  private get clerk() {
    return initClerk();
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, search, q, active, subscriptionTier } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const queryParams: any = { page: pageNum, limit: limitNum };
      if (q) queryParams.q = q as string;
      else if (search) queryParams.search = search as string;
      if (active === 'true') queryParams.active = true;
      else if (active === 'false') queryParams.active = false;
      if (subscriptionTier) queryParams.subscriptionTier = subscriptionTier as string;

      const convexCustomers = await this.convex.query(api.customers.getCustomers, queryParams);

      const enhancedCustomers = convexCustomers.customers.map((customer: any) => ({
        ...customer,
        subscriptionTier: customer.subscriptionTier || 'free',
        phoneNumber: customer.phoneNumber || '',
        occupation: customer.occupation || '',
        isSuspended: customer.isSuspended || false,
      }));

      res.json({
        success: true,
        data: enhancedCustomers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: convexCustomers.total,
          totalPages: Math.ceil(convexCustomers.total / limitNum),
          hasNext: pageNum < Math.ceil(convexCustomers.total / limitNum),
          hasPrev: pageNum > 1,
        },
        filters: queryParams,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching customers');
      res.status(500).json({ success: false, error: 'Failed to fetch customers', statusCode: 500 });
    }
  }

  async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.convex.query(api.customers.getCustomerStats, {});
      res.json({ success: true, data: stats, statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching customer stats');
      res.status(500).json({ success: false, error: 'Failed to fetch customer statistics', statusCode: 500 });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await this.convex.query(api.customers.getCustomerById, { id: id as any });

      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }

      const clerk = this.clerk;
      if (clerk && customer.clerkId) {
        try {
          const clerkUser = await clerk.users.getUser(customer.clerkId);
          res.json({
            success: true,
            data: {
              ...customer,
              subscriptionTier: customer.subscriptionTier || 'free',
              phoneNumber: customer.phoneNumber || '',
              occupation: customer.occupation || '',
              isSuspended: customer.isSuspended || false,
              clerkData: {
                emailAddresses: clerkUser.emailAddresses,
                phoneNumbers: clerkUser.phoneNumbers,
                lastSignInAt: clerkUser.lastSignInAt,
                createdAt: clerkUser.createdAt,
                updatedAt: clerkUser.updatedAt,
              },
            },
            statusCode: 200,
          });
          return;
        } catch (clerkError) {
          logger.warn({ err: clerkError }, 'Failed to fetch Clerk data');
        }
      }

      res.json({
        success: true,
        data: {
          ...customer,
          subscriptionTier: customer.subscriptionTier || 'free',
          phoneNumber: customer.phoneNumber || '',
          occupation: customer.occupation || '',
          isSuspended: customer.isSuspended || false,
        },
        statusCode: 200,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Error fetching customer');
      res.status(500).json({ success: false, error: 'Failed to fetch customer', statusCode: 500 });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const customerData: CreateCustomerRequest = req.body;
      const clerk = this.clerk;

      if (!clerk) {
        res.status(500).json({ success: false, error: 'Clerk not configured', statusCode: 500 });
        return;
      }

      const clerkUser = await clerk.users.createUser({
        emailAddress: [customerData.email],
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        password: customerData.password,
        publicMetadata: {
          role: 'customer',
          subscriptionTier: customerData.subscriptionTier || 'free',
        },
      });

      const convexCustomerData: any = {
        clerkId: clerkUser.id,
        email: customerData.email,
        active: customerData.active !== undefined ? customerData.active : true,
        subscriptionTier: customerData.subscriptionTier || 'free',
        phoneNumber: customerData.phoneNumber || '',
        occupation: customerData.occupation || '',
        isSuspended: customerData.isSuspended || false,
      };

      if (customerData.firstName) convexCustomerData.firstName = customerData.firstName;
      if (customerData.lastName) convexCustomerData.lastName = customerData.lastName;
      if (clerkUser.imageUrl) convexCustomerData.imageUrl = clerkUser.imageUrl;
      if (clerkUser.lastSignInAt) convexCustomerData.lastSignInAt = clerkUser.lastSignInAt.toString();

      const convexCustomerId = await this.convex.mutation(api.customers.createCustomer, convexCustomerData);

      res.status(201).json({
        success: true,
        data: {
          id: convexCustomerId,
          clerkId: clerkUser.id,
          email: customerData.email,
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          active: customerData.active !== undefined ? customerData.active : true,
          subscriptionTier: customerData.subscriptionTier || 'free',
          phoneNumber: customerData.phoneNumber || '',
          occupation: customerData.occupation || '',
          isSuspended: customerData.isSuspended || false,
          createdAt: new Date().toISOString(),
        },
        message: 'Customer created successfully',
        statusCode: 201,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Error creating customer');

      if (error.status === 422 || error.statusCode === 422) {
        res.status(400).json({
          success: false,
          error: 'Invalid customer data: ' + (error.message || 'Validation failed'),
          statusCode: 400,
        });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to create customer', statusCode: 500 });
    }
  }

  async patch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isSuspended } = req.body;

      const existingCustomer = await this.convex.query(api.customers.getCustomerById, { id: id as any });

      if (!existingCustomer) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }

      await this.convex.mutation(api.customers.updateCustomer, { id: id as any, isSuspended });

      const updatedCustomer = await this.convex.query(api.customers.getCustomerById, { id: id as any });

      res.json({
        success: true,
        data: {
          ...updatedCustomer,
          subscriptionTier: updatedCustomer.subscriptionTier || 'free',
          phoneNumber: updatedCustomer.phoneNumber || '',
          occupation: updatedCustomer.occupation || '',
          isSuspended: updatedCustomer.isSuspended || false,
        },
        message: `Customer ${isSuspended ? 'suspended' : 'unsuspended'} successfully`,
        statusCode: 200,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Error updating customer suspension status');

      if (error.status === 404 || error.statusCode === 404) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to update customer suspension status', statusCode: 500 });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateCustomerRequest = req.body;

      const existingCustomer = await this.convex.query(api.customers.getCustomerById, { id: id as any });

      if (!existingCustomer) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }

      const clerk = this.clerk;
      if (clerk && existingCustomer.clerkId) {
        const clerkUpdateData: any = {};
        if (updateData.firstName !== undefined) clerkUpdateData.firstName = updateData.firstName;
        if (updateData.lastName !== undefined) clerkUpdateData.lastName = updateData.lastName;
        if (updateData.subscriptionTier !== undefined) {
          clerkUpdateData.publicMetadata = { role: 'customer', subscriptionTier: updateData.subscriptionTier };
        }

        try {
          await clerk.users.updateUser(existingCustomer.clerkId, clerkUpdateData);
        } catch (clerkError) {
          logger.warn({ err: clerkError }, 'Failed to update Clerk user, proceeding with Convex update');
        }
      }

      await this.convex.mutation(api.customers.updateCustomer, { id: id as any, ...updateData });

      const updatedCustomer = await this.convex.query(api.customers.getCustomerById, { id: id as any });

      res.json({ success: true, data: updatedCustomer, message: 'Customer updated successfully', statusCode: 200 });
    } catch (error: any) {
      logger.error({ err: error }, 'Error updating customer');

      if (error.status === 404 || error.statusCode === 404) {
        res.status(404).json({ success: false, error: 'Customer not found in external system', statusCode: 404 });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to update customer', statusCode: 500 });
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existingCustomer = await this.convex.query(api.customers.getCustomerById, { id: id as any });

      if (!existingCustomer) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }

      const clerk = this.clerk;
      if (clerk && existingCustomer.clerkId) {
        try {
          await clerk.users.deleteUser(existingCustomer.clerkId);
        } catch (clerkError) {
          logger.warn({ err: clerkError }, 'Failed to delete Clerk user, proceeding with Convex deletion');
        }
      }

      await this.convex.mutation(api.customers.deleteCustomer, { id: id as any });

      res.json({ success: true, message: 'Customer deleted successfully', statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error deleting customer');
      res.status(500).json({ success: false, error: 'Failed to delete customer', statusCode: 500 });
    }
  }

  async sync(_req: Request, res: Response): Promise<void> {
    try {
      const clerk = this.clerk;

      if (!clerk) {
        res.status(500).json({ success: false, error: 'Clerk not configured', statusCode: 500 });
        return;
      }

      const clerkUsers = await clerk.users.getUserList({ limit: 500 });

      let syncedCount = 0;
      let errorCount = 0;

      for (const clerkUser of clerkUsers.data) {
        try {
          const existingCustomer = await this.convex.query(api.customers.getCustomerByClerkId, {
            clerkId: clerkUser.id,
          });

          const customerData = {
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            imageUrl: clerkUser.imageUrl,
            active: true,
            subscriptionTier: (clerkUser.publicMetadata as any)?.subscriptionTier || 'free',
            phoneNumber: '',
            occupation: '',
            isSuspended: false,
            lastSignInAt: clerkUser.lastSignInAt?.toString(),
            updatedAt: new Date().toISOString(),
          };

          if (existingCustomer) {
            await this.convex.mutation(api.customers.updateCustomer, { id: existingCustomer._id, ...customerData });
          } else {
            await this.convex.mutation(api.customers.createCustomer, customerData);
          }
          syncedCount++;
        } catch (error) {
          logger.error({ err: error, userId: clerkUser.id }, `Failed to sync user ${clerkUser.id}`);
          errorCount++;
        }
      }

      res.json({
        success: true,
        data: { syncedCount, errorCount, totalProcessed: clerkUsers.data.length },
        message: 'Sync completed successfully',
        statusCode: 200,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error syncing customer data');
      res.status(500).json({ success: false, error: 'Failed to sync customer data', statusCode: 500 });
    }
  }

  // ---- Customer-portal methods (used by customer.ts routes) ----

  async getCustomerByClerkId(req: Request, res: Response): Promise<void> {
    try {
      const { clerkId } = req.params;
      const customer = await this.convex.query(api.customers.getCustomerByClerkId, { clerkId });
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }
      res.json({ success: true, data: customer, statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching customer by Clerk ID');
      res.status(500).json({ success: false, error: 'Failed to fetch customer', statusCode: 500 });
    }
  }

  async getCustomerByEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.params;
      const customer = await this.convex.query(api.customers.getCustomerByEmail, { email });
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found', statusCode: 404 });
        return;
      }
      res.json({ success: true, data: customer, statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching customer by email');
      res.status(500).json({ success: false, error: 'Failed to fetch customer', statusCode: 500 });
    }
  }

  async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { subscriptionTier } = req.body;

      if (!subscriptionTier) {
        res.status(400).json({ success: false, error: 'subscriptionTier is required', statusCode: 400 });
        return;
      }

      const updated = await this.convex.mutation(api.customers.updateCustomer, {
        id: id as any,
        subscriptionTier,
      });

      res.json({ success: true, data: updated, message: 'Subscription updated successfully', statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error updating subscription');
      res.status(500).json({ success: false, error: 'Failed to update subscription', statusCode: 500 });
    }
  }

  async updateLastSignIn(req: Request, res: Response): Promise<void> {
    try {
      const { clerkId } = req.body;
      if (!clerkId) {
        res.status(400).json({ success: false, error: 'clerkId is required', statusCode: 400 });
        return;
      }

      const updated = await this.convex.mutation(api.customers.updateLastSignIn, { clerkId });
      res.json({ success: true, data: updated, message: 'Last sign-in updated successfully', statusCode: 200 });
    } catch (error) {
      logger.error({ err: error }, 'Error updating last sign-in');
      res.status(500).json({ success: false, error: 'Failed to update last sign-in', statusCode: 500 });
    }
  }

  // ---- Convenience aliases for portal route naming ----
  getAllCustomers = this.getAll.bind(this);
  getCustomerById = this.getById.bind(this);
  createCustomer = this.create.bind(this);
  updateCustomer = this.update.bind(this);
  deleteCustomer = this.remove.bind(this);
}

export const customersController = new CustomersController();
