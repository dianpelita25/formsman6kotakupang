import { registerPublicFormRoutes } from '../routes/public-form-routes.js';

export function registerPublicFormDomainRoutes(app, deps) {
  const {
    requireDbReady,
    schoolMiddleware,
    tenantMiddleware,
    jsonError,
    resolveRequestId,
    servePublicAsset,
    findDefaultQuestionnaireByTenantId,
    getPublishedQuestionnaireSchemaBySlug,
    getTenantQuestionnairePublicDashboardSummary,
    getTenantQuestionnairePublicDashboardDistribution,
    getTenantQuestionnairePublicDashboardTrend,
    getPublishedFormSchema,
    submitResponse,
    submitQuestionnaireResponse,
    captureFormOpenBestEffort,
    getCookie,
    buildOpenTrackingCookieOptions,
    DEVICE_COOKIE_NAME,
  } = deps;

  registerPublicFormRoutes(app, {
    requireDbReady,
    schoolMiddleware,
    tenantMiddleware,
    jsonError,
    resolveRequestId,
    servePublicAsset,
    findDefaultQuestionnaireByTenantId,
    getPublishedQuestionnaireSchemaBySlug,
    getTenantQuestionnairePublicDashboardSummary,
    getTenantQuestionnairePublicDashboardDistribution,
    getTenantQuestionnairePublicDashboardTrend,
    getPublishedFormSchema,
    submitResponse,
    submitQuestionnaireResponse,
    captureFormOpenBestEffort,
    getCookie,
    buildOpenTrackingCookieOptions,
    DEVICE_COOKIE_NAME,
  });
}
