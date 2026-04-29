import express, { Router } from 'express';
import { CustomersController } from '../../controllers/customers.controller';
import { WebhookController } from '../../controllers/webhook.controller';

const router = Router();

// Initialize controllers
const webhookController = new WebhookController();
const customersController = new CustomersController();

// Webhook routes (no auth required, but verified by Clerk signatures)
// Note: These endpoints use raw body parsing for webhook verification
router.post(
  '/webhooks/clerk',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // Convert raw buffer to string for webhook verification
    req.body = JSON.parse(req.body.toString());
    return webhookController.handleClerkWebhook(req, res);
  }
);

// Customer API routes
router.get(
  '/customers',
  customersController.getAllCustomers.bind(customersController)
);
router.get(
  '/customers/:id',
  customersController.getCustomerById.bind(customersController)
);
router.get(
  '/customers/clerk/:clerkId',
  customersController.getCustomerByClerkId.bind(customersController)
);
router.get(
  '/customers/email/:email',
  customersController.getCustomerByEmail.bind(customersController)
);
router.post(
  '/customers',
  customersController.createCustomer.bind(customersController)
);
router.put(
  '/customers/:id',
  customersController.updateCustomer.bind(customersController)
);
router.patch(
  '/customers/:id/subscription',
  customersController.updateSubscription.bind(customersController)
);
router.patch(
  '/customers/sign-in',
  customersController.updateLastSignIn.bind(customersController)
);
router.delete(
  '/customers/:id',
  customersController.deleteCustomer.bind(customersController)
);

export { router as customerPortalRoutes };
