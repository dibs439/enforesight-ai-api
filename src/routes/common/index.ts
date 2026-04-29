import { Router } from 'express';
import countriesRouter from './countries';
import currenciesRouter from './currencies';
import enforcementActionTypesRouter from './enforcementActionTypes';
import fieldsRouter from './fields';
import regulatorsRouter from './regulators';
import sectorsRouter from './sectors';
import violationTypesRouter from './violationTypes';

const router = Router();

router.use('/countries', countriesRouter);
router.use('/currencies', currenciesRouter);
router.use('/enforcement-action-types', enforcementActionTypesRouter);
router.use('/fields', fieldsRouter);
router.use('/regulators', regulatorsRouter);
router.use('/sectors', sectorsRouter);
router.use('/violation-types', violationTypesRouter);

export default router;
