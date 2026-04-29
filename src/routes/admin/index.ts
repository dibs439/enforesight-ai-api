import { Router } from 'express';
import clientsRoutes from './clients';
import contentsRoutes from './contents';
import customersRoutes from './customers';
import dashboardRoutes from './dashboard';
import enforcementsRoutes from './enforcements';
import regulatorsRoutes from './regulators';
import usersRoutes from './users';

const router = Router();

router.use('/contents', contentsRoutes);
router.use('/regulators', regulatorsRoutes);
router.use('/enforcements', enforcementsRoutes);
router.use('/clients', clientsRoutes);
router.use('/users', usersRoutes);
router.use('/customers', customersRoutes);
router.use('/dashboard', dashboardRoutes);

// Health check for admin routes (no auth required)
router.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: 'Admin routes are working',
    timestamp: new Date().toISOString(),
    endpoints: {
      contents: '/api/admin/contents',
      regulators: '/api/admin/regulators',
      enforcements: '/api/admin/enforcements',
      clients: '/api/admin/clients',
      users: '/api/admin/users',
      customers: '/api/admin/customers',
      login: '/api/admin/users/login',
      dashboard: '/api/admin/dashboard',
    },
  });
});

export default router;
