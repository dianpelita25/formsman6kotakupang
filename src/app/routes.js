import { Router } from 'express';
import { getFormSchema } from '../modules/form/controller.js';
import { analyzeAiController, getLatestAiController } from '../modules/ai/controller.js';
import {
  exportAnalyticsCsvController,
  getAnalyticsDistributionController,
  getAnalyticsSummaryController,
  getAnalyticsTrendController,
  submitFormController,
} from '../modules/submission/controller.js';

const router = Router();

router.get('/api/form-schema', getFormSchema);
router.post('/api/submit', submitFormController);
router.get('/api/analytics/summary', getAnalyticsSummaryController);
router.get('/api/analytics/distribution', getAnalyticsDistributionController);
router.get('/api/analytics/trend', getAnalyticsTrendController);
router.get('/api/analytics/export.csv', exportAnalyticsCsvController);
router.post('/api/ai/analyze', analyzeAiController);
router.get('/api/ai/latest', getLatestAiController);

export default router;
