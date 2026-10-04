import { adminRouter } from './admin.routes.js';
import { portalRouter } from './portal.routes.js';
import { analysisRouter } from './analysis.routes.js';
import { Router } from 'express';
import { alertRouter } from './alert.routes.js';
import { healthRouter } from './health.routes.js';
import { threatIntelligenceRouter } from './threatIntelligence.routes.js';
import { internalThreatIntelligenceRouter } from './internalThreatIntelligence.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/analyze', analysisRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/', portalRouter);
apiRouter.use('/alerts', alertRouter);
apiRouter.use('/threat-intelligence', threatIntelligenceRouter);
apiRouter.use('/internal/threat-intelligence/campaigns', internalThreatIntelligenceRouter);

export { apiRouter };
