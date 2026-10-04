import { Router } from 'express';
import { getAlerts } from '../controllers/alert.controller.js';

const alertRouter = Router();

alertRouter.get('/', getAlerts);

export { alertRouter };
