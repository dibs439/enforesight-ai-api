import { Request, Response, Router } from 'express';
import adminRoutes from './admin';
import webhookRoutes from './admin/webhook';
import commonRoutes from './common';
import customerRoutes from './customer';

const router = Router();

// ============================================
// ROOT / STATUS ROUTES
// ============================================

/**
 * @openapi
 * /api:
 *   get:
 *     tags: [Health]
 *     summary: API root — lists available endpoints
 *     security: []
 *     responses:
 *       200:
 *         description: API info and endpoint directory
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Enforesight API',
    version: '1.0.0',
    portals: {
      customer: 'Customer Portal API',
      admin: 'Admin Panel API',
    },
    endpoints: {
      // Health
      health: '/health',
      status: '/api/v1/status',
      // Common / Reference Data
      countries: '/api/v1/countries',
      currencies: '/api/v1/currencies',
      sectors: '/api/v1/sectors',
      violationTypes: '/api/v1/violation-types',
      enforcementActionTypes: '/api/v1/enforcement-action-types',
      fields: '/api/v1/fields',
      regulators: '/api/v1/regulators',
      // Customer
      customerContent: '/api/v1/content',
      customerClients: '/api/v1/clients',
      customerPortal: '/api/v1/customer/portal',
      chat: '/api/v1/chat',
      aiChat: '/api/v1/ai',
      // Webhooks
      clerkWebhook: '/api/v1/webhook/clerk',
      // Admin Panel (JWT protected)
      adminLogin: '/api/v1/admin/users/login',
      adminUsers: '/api/v1/admin/users',
      adminCustomers: '/api/v1/admin/customers',
      adminClients: '/api/v1/admin/clients',
      adminContents: '/api/v1/admin/contents',
      adminEnforcements: '/api/v1/admin/enforcements',
      adminRegulators: '/api/v1/admin/regulators',
      adminDashboard: '/api/v1/admin/dashboard',
    },
  });
});

router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SHARED/COMMON ROUTES
// (countries, currencies, sectors, violation-types,
//  enforcement-action-types, fields, regulators)
// ============================================
router.use('/', commonRoutes);

// ============================================
// CUSTOMER ROUTES
// (content, clients, ai-chat, chat, customer/portal)
// ============================================
router.use('/', customerRoutes);

// ============================================
// WEBHOOK ROUTES
// ============================================
router.use('/webhook', webhookRoutes);

// ============================================
// ADMIN PANEL ROUTES (JWT Protected)
// (users, customers, clients, contents, enforcements, regulators, dashboard)
// ============================================
router.use('/admin', adminRoutes);

export default router;
