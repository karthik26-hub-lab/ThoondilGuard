import { Router } from 'express';
import {
  getCampaignThreatIntelligenceController,
  listCampaignThreatIntelligenceController,
} from '../controllers/campaignThreatIntelligence.controller.js';
import { internalThreatIntelligenceAuth } from '../middleware/internalThreatIntelligenceAuth.js';
import { env } from '../config/env.js';

export function createInternalThreatIntelligenceRouter(token = env.internalThreatIntelligenceToken): Router {
  const router = Router();
  router.use(internalThreatIntelligenceAuth(token));
  router.get('/', listCampaignThreatIntelligenceController);
  router.get('/:campaignId', getCampaignThreatIntelligenceController);
  return router;
}

export const internalThreatIntelligenceRouter = createInternalThreatIntelligenceRouter();
