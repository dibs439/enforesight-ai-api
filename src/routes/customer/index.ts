import { Router } from 'express';
import chatRouter from './chat';
import clientsRouter from './clients';
import contentRouter from './content';
import customerConversationsRoutes from './customerConversations';
import customerProfileRoutes from './customerProfile';
import portalRouter from './portal';

const router = Router();

router.use('/content', contentRouter);
router.use('/clients', clientsRouter);
router.use('/customer/portal', portalRouter);
// More specific path must come before the broader /customer prefix
router.use('/customer/conversations', customerConversationsRoutes);
router.use('/customer', customerProfileRoutes);
// Chat router last — mounted at '/' so it acts as a catch-all within this sub-router
router.use('/', chatRouter);

export default router;
