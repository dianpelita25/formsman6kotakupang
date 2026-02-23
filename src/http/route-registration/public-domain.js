import { registerPublicRoutes } from '../routes/public-routes.js';

export function registerPublicDomainRoutes(app, deps) {
  const {
    ensurePlatformSchema,
    requireDbReady,
    tenantMiddleware,
    jsonError,
    servePublicAsset,
    isLegacyAdminAliasEnabled,
    LEGACY_REDIRECT_PREFIX,
    LEGACY_SCHOOL_SLUG,
    listPublicSchools,
    listPublicTenants,
    listPublicQuestionnairesByTenant,
    findDefaultQuestionnaireByTenantId,
  } = deps;

  registerPublicRoutes(app, {
    ensurePlatformSchema,
    requireDbReady,
    tenantMiddleware,
    jsonError,
    servePublicAsset,
    isLegacyAdminAliasEnabled,
    LEGACY_REDIRECT_PREFIX,
    LEGACY_SCHOOL_SLUG,
    listPublicSchools,
    listPublicTenants,
    listPublicQuestionnairesByTenant,
    findDefaultQuestionnaireByTenantId,
  });
}
