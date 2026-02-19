import { registerSchoolAdminApiRoutes } from '../routes/school-admin-api-routes.js';

export function registerSchoolAdminDomainRoutes(app, deps) {
  const {
    schoolMiddleware,
    requireAuth,
    requireSchoolAccessFromParam,
    jsonError,
    resolveRequestId,
    getDraftFormSchema,
    updateDraftFormSchema,
    publishDraft,
    getResponses,
    getResponsesCsv,
    getAnalyticsSummary,
    getAnalyticsDistribution,
    getAnalyticsTrend,
    normalizeAiMode,
    analyzeSchoolAi,
    getLatestSchoolAi,
  } = deps;

  registerSchoolAdminApiRoutes(app, {
    schoolMiddleware,
    requireAuth,
    requireSchoolAccessFromParam,
    jsonError,
    resolveRequestId,
    getDraftFormSchema,
    updateDraftFormSchema,
    publishDraft,
    getResponses,
    getResponsesCsv,
    getAnalyticsSummary,
    getAnalyticsDistribution,
    getAnalyticsTrend,
    normalizeAiMode,
    analyzeSchoolAi,
    getLatestSchoolAi,
  });
}
