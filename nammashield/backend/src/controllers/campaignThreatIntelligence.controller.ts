import type { RequestHandler } from 'express';
import { getCampaignThreatIntelligence, listCampaignThreatIntelligence } from '../services/campaignThreatIntelligence.service.js';

export const listCampaignThreatIntelligenceController: RequestHandler = async (request, response, next) => {
  try {
    const data = await listCampaignThreatIntelligence(request.query);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCampaignThreatIntelligenceController: RequestHandler<{ campaignId: string }> = async (request, response, next) => {
  try {
    const data = await getCampaignThreatIntelligence(request.params.campaignId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
