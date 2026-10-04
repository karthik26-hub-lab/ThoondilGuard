import { Router } from 'express';
import { getThreatIntelligence } from '../controllers/threatIntelligence.controller.js';

const threatIntelligenceRouter = Router();

threatIntelligenceRouter.get('/', getThreatIntelligence);

export { threatIntelligenceRouter };
