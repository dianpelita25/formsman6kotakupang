import { registerAdminPageRoutes } from '../routes/admin-page-routes.js';

export function registerAdminPagesDomainRoutes(app, deps) {
  const {
    tenantMiddleware,
    requireAdminPageAccess,
    jsonError,
    servePublicAsset,
    LEGACY_SCHOOL_SLUG,
    findDefaultQuestionnaireByTenantId,
    findQuestionnaireByTenantAndSlug,
  } = deps;

  registerAdminPageRoutes(app, {
    tenantMiddleware,
    requireAdminPageAccess,
    jsonError,
    servePublicAsset,
    LEGACY_SCHOOL_SLUG,
    findDefaultQuestionnaireByTenantId,
    findQuestionnaireByTenantAndSlug,
  });
}
