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
    getPublishedFormSchema,
    submitResponse,
    submitQuestionnaireResponse,
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
    getPublishedFormSchema,
    submitResponse,
    submitQuestionnaireResponse,
  });
}
