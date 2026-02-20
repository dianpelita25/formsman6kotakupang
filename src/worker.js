import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { registerHttpRoutes } from './http/route-registration.js';
import {
  createRequireAdminPageAccess,
  createRequireDbReady,
  createSchoolMiddleware,
  createTenantMiddleware,
  isLegacyAdminAliasEnabled,
  jsonError,
  resolveRequestId,
  servePublicAsset,
} from './http/runtime-helpers.js';
import { ensurePlatformSchema, LEGACY_REDIRECT_PREFIX, LEGACY_SCHOOL_SLUG } from './lib/db/bootstrap.js';
import { enforceAdminOrigin, monitorAdminOrigin, requireJsonMutationPayload } from './lib/http/request-guards.js';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from './lib/http/session-cookie.js';
import { getAnalyticsDistribution, getAnalyticsSummary, getAnalyticsTrend } from './modules/analytics/service.js';
import {
  analyzeSchoolAi,
  analyzeTenantQuestionnaireAi,
  getLatestSchoolAi,
  getLatestTenantQuestionnaireAi,
  normalizeAiMode,
} from './modules/ai/service.js';
import { getAiPromptBundle, getAiPromptHistory, publishAiPrompt, saveAiPromptDraft } from './modules/ai-prompts/service.js';
import {
  attachAuth,
  requireAuth,
  requireSchoolAccessFromParam,
  requireSuperadmin,
  requireTenantAccessFromParam,
} from './modules/auth/middleware.js';
import { canAccessSchool, hasSuperadmin, hasTenantAccess, loginWithEmailPassword, logout } from './modules/auth/service.js';
import {
  ensureLegacySchoolFormVersions,
  getDraftFormSchema,
  getPublishedFormSchema,
  publishDraft,
  updateDraftFormSchema,
} from './modules/forms/service.js';
import { findDefaultQuestionnaireByTenantId, findQuestionnaireByTenantAndSlug } from './modules/questionnaires/query-service.js';
import {
  createTenantQuestionnaire,
  ensureTenantQuestionnaireInitialized,
  exportTenantQuestionnaireResponsesCsv,
  getPublishedQuestionnaireSchemaBySlug,
  getTenantQuestionnaireAnalyticsDistribution,
  getTenantQuestionnaireAnalyticsSegmentCompare,
  getTenantQuestionnaireAnalyticsSummary,
  getTenantQuestionnaireAnalyticsTrend,
  getTenantQuestionnaireDraft,
  getTenantQuestionnaireResponses,
  getTenantQuestionnaireVersions,
  listPublicQuestionnairesByTenant,
  listTenantQuestionnaires,
  patchQuestionnaire,
  publishTenantQuestionnaireDraft,
  submitQuestionnaireResponse,
  updateTenantQuestionnaireDraft,
} from './modules/questionnaires/service.js';
import {
  createNewSchool,
  createSchoolAdminAccount,
  listAllSchools,
  listPublicSchools,
  patchSchool,
  resolveSchoolBySlug,
} from './modules/schools/service.js';
import { getResponses, getResponsesCsv, submitResponse } from './modules/submissions/service.js';
import {
  createTenantAdminAccount,
  createNewTenant,
  listAllTenants,
  listPublicTenants,
  patchTenantById,
  resolveTenantBySlug,
} from './modules/tenants/service.js';

const app = new Hono();

const schoolMiddleware = createSchoolMiddleware({ resolveSchoolBySlug });
const tenantMiddleware = createTenantMiddleware({ resolveTenantBySlug });
const requireDbReady = createRequireDbReady({ ensurePlatformSchema });
const requireAdminPageAccess = createRequireAdminPageAccess({
  canAccessSchool,
  hasSuperadmin,
  hasTenantAccess,
});

app.use('*', async (c, next) => {
  const requestId =
    c.req.header('x-request-id') ||
    c.req.header('cf-ray') ||
    (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  c.set('requestId', requestId);
  await next();

  if (c.res) {
    try {
      c.res.headers.set('x-request-id', requestId);
    } catch {
      c.res = new Response(c.res.body, c.res);
      c.res.headers.set('x-request-id', requestId);
    }
  }
});

app.onError((error, c) => {
  return jsonError(c, 500, error?.message || 'Terjadi kesalahan internal server.');
});

app.use('/forms/admin/api/*', requireDbReady, attachAuth, monitorAdminOrigin, enforceAdminOrigin, requireJsonMutationPayload);
app.use('/forms/:schoolSlug/api/*', requireDbReady);
app.use(
  '/forms/:schoolSlug/admin/api/*',
  requireDbReady,
  attachAuth,
  monitorAdminOrigin,
  enforceAdminOrigin,
  requireJsonMutationPayload
);
app.use('/forms/:schoolSlug/admin/*', requireDbReady, attachAuth);
app.use('/forms/:schoolSlug/admin', requireDbReady, attachAuth);
app.use('/forms/:schoolSlug/admin/', requireDbReady, attachAuth);
app.use('/forms/:tenantSlug/:questionnaireSlug/api/*', requireDbReady);
app.use(
  '/forms/:tenantSlug/admin/api/questionnaires/*',
  requireDbReady,
  attachAuth,
  monitorAdminOrigin,
  enforceAdminOrigin,
  requireJsonMutationPayload
);
app.use(
  '/forms/:tenantSlug/admin/api/questionnaires',
  requireDbReady,
  attachAuth,
  monitorAdminOrigin,
  enforceAdminOrigin,
  requireJsonMutationPayload
);
app.use(
  '/forms/:tenantSlug/admin/api/ai-prompts/*',
  requireDbReady,
  attachAuth,
  monitorAdminOrigin,
  enforceAdminOrigin,
  requireJsonMutationPayload
);
app.use(
  '/forms/:tenantSlug/admin/api/ai-prompts',
  requireDbReady,
  attachAuth,
  monitorAdminOrigin,
  enforceAdminOrigin,
  requireJsonMutationPayload
);

registerHttpRoutes(app, {
  ensurePlatformSchema,
  requireDbReady,
  tenantMiddleware,
  schoolMiddleware,
  jsonError,
  servePublicAsset,
  isLegacyAdminAliasEnabled,
  LEGACY_REDIRECT_PREFIX,
  LEGACY_SCHOOL_SLUG,
  listPublicSchools,
  listPublicTenants,
  listPublicQuestionnairesByTenant,
  requireAuth,
  requireSuperadmin,
  loginWithEmailPassword,
  logout,
  getCookie,
  setCookie,
  deleteCookie,
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  hasSuperadmin,
  listAllSchools,
  createNewSchool,
  patchSchool,
  createSchoolAdminAccount,
  listAllTenants,
  createNewTenant,
  patchTenantById,
  createTenantAdminAccount,
  ensureLegacySchoolFormVersions,
  ensureTenantQuestionnaireInitialized,
  getAiPromptBundle,
  saveAiPromptDraft,
  publishAiPrompt,
  getAiPromptHistory,
  requireTenantAccessFromParam,
  resolveRequestId,
  listTenantQuestionnaires,
  createTenantQuestionnaire,
  patchQuestionnaire,
  getTenantQuestionnaireVersions,
  getTenantQuestionnaireDraft,
  updateTenantQuestionnaireDraft,
  publishTenantQuestionnaireDraft,
  getTenantQuestionnaireResponses,
  exportTenantQuestionnaireResponsesCsv,
  getTenantQuestionnaireAnalyticsSummary,
  getTenantQuestionnaireAnalyticsDistribution,
  getTenantQuestionnaireAnalyticsSegmentCompare,
  getTenantQuestionnaireAnalyticsTrend,
  normalizeAiMode,
  analyzeTenantQuestionnaireAi,
  findQuestionnaireByTenantAndSlug,
  getLatestTenantQuestionnaireAi,
  requireAdminPageAccess,
  findDefaultQuestionnaireByTenantId,
  getPublishedQuestionnaireSchemaBySlug,
  getPublishedFormSchema,
  submitResponse,
  submitQuestionnaireResponse,
  requireSchoolAccessFromParam,
  getDraftFormSchema,
  updateDraftFormSchema,
  publishDraft,
  getResponses,
  getResponsesCsv,
  getAnalyticsSummary,
  getAnalyticsDistribution,
  getAnalyticsTrend,
  analyzeSchoolAi,
  getLatestSchoolAi,
});

app.notFound((c) => c.json({ message: 'Not found', requestId: resolveRequestId(c) }, 404));

export default app;
