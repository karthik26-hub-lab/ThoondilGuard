import { Router } from 'express';
import { getDatabaseHealth, getHealth } from '../controllers/health.controller.js';

const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/db', getDatabaseHealth);

export { healthRouter };
