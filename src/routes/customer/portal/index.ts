import express from 'express';
import legalRoutes from './legal';
import enforcementRoutes from './enforcement';

const router = express.Router();

// Mount legal document routes
router.use('/', legalRoutes);

// Mount enforcement routes
router.use('/enforcement', enforcementRoutes);

export default router;
