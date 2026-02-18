import { Hono } from 'hono';
import { ensurePlatformSchema, LEGACY_REDIRECT_PREFIX, LEGACY_SCHOOL_SLUG } from './lib/db/bootstrap.js';
import {
  attachAuth,
  requireAuth,
  requireSchoolAccessFromParam,
  requireSuperadmin,
  requireTenantAccessFromParam,
} from './modules/auth/middleware.js';
import { canAccessSchool, hasSuperadmin, hasTenantAccess, loginWithEmailPassword, logout } from './modules/auth/service.js';
import { getAnalyticsDistribution, getAnalyticsSummary, getAnalyticsTrend } from './modules/analytics/service.js';
import {
  analyzeSchoolAi,
  analyzeTenantQuestionnaireAi,
  getLatestSchoolAi,
  getLatestTenantQuestionnaireAi,
  normalizeAiMode,
} from './modules/ai/service.js';
import { getAiPromptBundle, getAiPromptHistory, publishAiPrompt, saveAiPromptDraft } from './modules/ai-prompts/service.js';
import { getDraftFormSchema, getPublishedFormSchema, publishDraft, updateDraftFormSchema } from './modules/forms/service.js';
import { monitorAdminOrigin, requireJsonMutationPayload } from './lib/http/request-guards.js';
import {
  createTenantQuestionnaire,
  ensureTenantQuestionnaireInitialized,
  exportTenantQuestionnaireResponsesCsv,
  getTenantQuestionnaireAnalyticsDistribution,
  getTenantQuestionnaireAnalyticsSummary,
  getTenantQuestionnaireAnalyticsTrend,
  getTenantQuestionnaireResponses,
  getPublishedQuestionnaireSchemaBySlug,
  getTenantQuestionnaireDraft,
  getTenantQuestionnaireVersions,
  listPublicQuestionnairesByTenant,
  listTenantQuestionnaires,
  patchQuestionnaire,
  publishTenantQuestionnaireDraft,
  submitQuestionnaireResponse,
  updateTenantQuestionnaireDraft,
} from './modules/questionnaires/service.js';
import { findDefaultQuestionnaireByTenantId, findQuestionnaireByTenantAndSlug } from './modules/questionnaires/repository.js';
import {
  createTenantAdminAccount,
  createNewTenant,
  listAllTenants,
  listPublicTenants,
  patchTenantById,
  resolveTenantBySlug,
} from './modules/tenants/service.js';
import {
  createNewSchool,
  createSchoolAdminAccount,
  listAllSchools,
  listPublicSchools,
  patchSchool,
  resolveSchoolBySlug,
} from './modules/schools/service.js';
import { getResponses, getResponsesCsv, submitResponse } from './modules/submissions/service.js';

const app = new Hono();

function resolveRequestId(c) {
  return String(c.get('requestId') || '').trim() || 'unknown';
}

function jsonError(c, status, message, extra = {}) {
  return c.json(
    {
      message,
      requestId: resolveRequestId(c),
      ...extra,
    },
    status
  );
}

async function servePublicAsset(c, internalPath) {
  const assets = c.env.ASSETS;
  if (!assets?.fetch) {
    return jsonError(c, 500, 'Assets binding belum terpasang.');
  }
  let target = new URL(internalPath, c.req.url);
  let response = await assets.fetch(new Request(target.toString(), c.req.raw));

  for (let index = 0; index < 5; index += 1) {
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    const location = response.headers.get('location');
    if (!location) {
      return response;
    }
    target = new URL(location, target);
    response = await assets.fetch(new Request(target.toString(), c.req.raw));
  }

  return response;
}

async function schoolMiddleware(c, next) {
  const slug = c.req.param('schoolSlug');
  const school = await resolveSchoolBySlug(c.env, slug, { onlyActive: false });
  if (!school) {
    return jsonError(c, 404, 'Sekolah tidak ditemukan.');
  }
  c.set('school', school);
  await next();
}

async function tenantMiddleware(c, next) {
  const slug = c.req.param('tenantSlug');
  const tenant = await resolveTenantBySlug(c.env, slug, { onlyActive: false });
  if (!tenant) {
    return jsonError(c, 404, 'Organisasi tidak ditemukan.');
  }
  c.set('tenant', tenant);
  await next();
}

async function requireDbReady(c, next) {
  try {
    await ensurePlatformSchema(c.env);
    await next();
  } catch (error) {
    return jsonError(c, 503, error?.message || 'Database belum siap.');
  }
}

function parseBooleanFlag(input, fallback = false) {
  if (typeof input !== 'string') return fallback;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function isLegacyAdminAliasEnabled(env) {
  const appEnv = String(env?.APP_ENV || 'local').trim().toLowerCase();
  const defaultValue = appEnv !== 'production';
  return parseBooleanFlag(env?.ENABLE_LEGACY_ADMIN_ALIAS, defaultValue);
}

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

app.get('/health', (c) => c.json({ ok: true, runtime: 'cloudflare-worker-hono' }));
app.get('/health/db', async (c) => {
  try {
    await ensurePlatformSchema(c.env);
    return c.json({ ok: true, runtime: 'cloudflare-worker-hono', db: 'ready' });
  } catch (error) {
    return c.json({ ok: false, db: 'unready', message: error?.message || 'Database belum siap.' }, 503);
  }
});

app.use('/forms/admin/api/*', requireDbReady, attachAuth, monitorAdminOrigin, requireJsonMutationPayload);
app.use('/forms/:schoolSlug/api/*', requireDbReady);
app.use('/forms/:schoolSlug/admin/api/*', requireDbReady, attachAuth, monitorAdminOrigin, requireJsonMutationPayload);
app.use('/forms/:schoolSlug/admin/*', requireDbReady, attachAuth);
app.use('/forms/:schoolSlug/admin', requireDbReady, attachAuth);
app.use('/forms/:schoolSlug/admin/', requireDbReady, attachAuth);
app.use('/forms/:tenantSlug/:questionnaireSlug/api/*', requireDbReady);
app.use('/forms/:tenantSlug/admin/api/questionnaires/*', requireDbReady, attachAuth, monitorAdminOrigin, requireJsonMutationPayload);
app.use('/forms/:tenantSlug/admin/api/questionnaires', requireDbReady, attachAuth, monitorAdminOrigin, requireJsonMutationPayload);
app.use('/forms/:tenantSlug/admin/api/ai-prompts/*', requireDbReady, attachAuth, monitorAdminOrigin, requireJsonMutationPayload);
app.use('/forms/:tenantSlug/admin/api/ai-prompts', requireDbReady, attachAuth, monitorAdminOrigin, requireJsonMutationPayload);

app.get(LEGACY_REDIRECT_PREFIX, (c) => c.redirect(`/forms/${LEGACY_SCHOOL_SLUG}`, 301));
app.get(`${LEGACY_REDIRECT_PREFIX}/*`, (c) => {
  const rest = c.req.path.slice(LEGACY_REDIRECT_PREFIX.length);
  return c.redirect(`/forms/${LEGACY_SCHOOL_SLUG}${rest}`, 301);
});

app.get('/forms-static/*', async (c) => {
  const prefix = '/forms-static/';
  const requestPath = c.req.path;
  const relativePath = requestPath.startsWith(prefix) ? requestPath.slice(prefix.length) : '';
  if (!relativePath) {
    return jsonError(c, 404, 'Asset tidak ditemukan.');
  }
  return servePublicAsset(c, `/${relativePath}`);
});

app.get('/forms/admin/login', (c) => servePublicAsset(c, '/admin/login.html'));
app.get('/forms/admin/login/', (c) => servePublicAsset(c, '/admin/login.html'));
app.get('/forms/admin/select-school', (c) => servePublicAsset(c, '/admin/select-school.html'));
app.get('/forms/admin/select-school/', (c) => servePublicAsset(c, '/admin/select-school.html'));

app.get('/forms/admin', (c) => c.redirect('/forms/admin/', 301));
app.get('/forms/admin/', (c) => servePublicAsset(c, '/admin/superadmin.html'));
app.get('/admin', (c) => {
  if (!isLegacyAdminAliasEnabled(c.env)) return jsonError(c, 404, 'Not found');
  return c.redirect('/forms/admin/login', 301);
});
app.get('/admin/', (c) => {
  if (!isLegacyAdminAliasEnabled(c.env)) return jsonError(c, 404, 'Not found');
  return c.redirect('/forms/admin/login', 301);
});
app.get('/admin/login', (c) => {
  if (!isLegacyAdminAliasEnabled(c.env)) return jsonError(c, 404, 'Not found');
  return c.redirect('/forms/admin/login', 301);
});
app.get('/admin/superadmin', (c) => {
  if (!isLegacyAdminAliasEnabled(c.env)) return jsonError(c, 404, 'Not found');
  return c.redirect('/forms/admin/', 301);
});
app.get('/forms', (c) => servePublicAsset(c, '/forms/portal.html'));
app.get('/forms/', (c) => servePublicAsset(c, '/forms/portal.html'));

app.get('/forms/api/schools/public', requireDbReady, async (c) => {
  const schools = await listPublicSchools(c.env);
  return c.json({ data: schools });
});

app.get('/forms/api/tenants/public', requireDbReady, async (c) => {
  const tenants = await listPublicTenants(c.env);
  return c.json({ data: tenants });
});

app.get('/forms/:tenantSlug/api/questionnaires/public', requireDbReady, tenantMiddleware, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant.is_active) {
    return jsonError(c, 404, 'Organisasi belum aktif.');
  }
  const questionnaires = await listPublicQuestionnairesByTenant(c.env, tenant.id);
  return c.json({ data: questionnaires });
});

app.post('/forms/admin/api/login', async (c) => {
  const result = await loginWithEmailPassword(c);
  if (!result.ok) {
    return jsonError(c, result.status, result.message);
  }
  return c.json({
    message: 'Login berhasil.',
    user: result.user,
    memberships: result.memberships,
    tenantMemberships: result.tenantMemberships || [],
  });
});

app.post('/forms/admin/api/logout', requireAuth(), async (c) => {
  await logout(c);
  return c.json({ message: 'Logout berhasil.' });
});

app.get('/forms/admin/api/me', requireAuth(), async (c) => {
  const auth = c.get('auth');
  const tenantMemberships = Array.isArray(auth.tenantMemberships) ? auth.tenantMemberships : [];
  const superadmin = hasSuperadmin(auth.memberships) || tenantMemberships.some((membership) => membership.role === 'superadmin');
  return c.json({
    user: {
      id: auth.userId,
      email: auth.email,
      isSuperadmin: superadmin,
    },
    memberships: auth.memberships,
    tenantMemberships,
  });
});

app.get('/forms/admin/api/schools', requireAuth(), requireSuperadmin(), async (c) => {
  const schools = await listAllSchools(c.env);
  return c.json({ data: schools });
});

app.post('/forms/admin/api/schools', requireAuth(), requireSuperadmin(), async (c) => {
  const auth = c.get('auth');
  const payload = await c.req.json().catch(() => null);
  const result = await createNewSchool(c.env, payload, auth.userId);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.patch('/forms/admin/api/schools/:schoolId', requireAuth(), requireSuperadmin(), async (c) => {
  const schoolId = c.req.param('schoolId');
  const payload = await c.req.json().catch(() => null);
  const result = await patchSchool(c.env, schoolId, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.post('/forms/admin/api/schools/:schoolId/admins', requireAuth(), requireSuperadmin(), async (c) => {
  const schoolId = c.req.param('schoolId');
  const payload = await c.req.json().catch(() => null);
  const result = await createSchoolAdminAccount(c.env, schoolId, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.get('/forms/admin/api/tenants', requireAuth(), requireSuperadmin(), async (c) => {
  const tenants = await listAllTenants(c.env);
  return c.json({ data: tenants });
});

app.post('/forms/admin/api/tenants', requireAuth(), requireSuperadmin(), async (c) => {
  const auth = c.get('auth');
  const payload = await c.req.json().catch(() => null);
  const result = await createNewTenant(c.env, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  await ensureTenantQuestionnaireInitialized(c.env, result.data.id, auth.userId);
  return c.json({ data: result.data }, result.status);
});

app.patch('/forms/admin/api/tenants/:tenantId', requireAuth(), requireSuperadmin(), async (c) => {
  const tenantId = c.req.param('tenantId');
  const payload = await c.req.json().catch(() => null);
  const result = await patchTenantById(c.env, tenantId, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.post('/forms/admin/api/tenants/:tenantId/admins', requireAuth(), requireSuperadmin(), async (c) => {
  const tenantId = c.req.param('tenantId');
  const payload = await c.req.json().catch(() => null);
  const result = await createTenantAdminAccount(c.env, tenantId, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.get('/forms/admin/api/ai-prompts', requireAuth(), requireSuperadmin(), async (c) => {
  const result = await getAiPromptBundle(c.env, c.req.query());
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.put('/forms/admin/api/ai-prompts/draft', requireAuth(), requireSuperadmin(), async (c) => {
  const auth = c.get('auth');
  const payload = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return jsonError(c, 400, 'Payload tidak valid.');
  }

  const result = await saveAiPromptDraft(c.env, auth.userId, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.post('/forms/admin/api/ai-prompts/publish', requireAuth(), requireSuperadmin(), async (c) => {
  const auth = c.get('auth');
  const payload = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return jsonError(c, 400, 'Payload tidak valid.');
  }

  const result = await publishAiPrompt(c.env, auth.userId, payload);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.get('/forms/admin/api/ai-prompts/history', requireAuth(), requireSuperadmin(), async (c) => {
  const result = await getAiPromptHistory(c.env, c.req.query());
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({ data: result.data }, result.status);
});

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const data = await listTenantQuestionnaires(c.env, tenant.id);
    return c.json({ data });
  }
);

app.post(
  '/forms/:tenantSlug/admin/api/questionnaires',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam('tenantSlug', ['tenant_admin']),
  async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    const payload = await c.req.json().catch(() => null);
    const result = await createTenantQuestionnaire(c.env, tenant.id, auth.userId, payload);
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.patch(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireId',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam('tenantSlug', ['tenant_admin']),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireId = c.req.param('questionnaireId');
    const payload = await c.req.json().catch(() => null);
    const result = await patchQuestionnaire(c.env, tenant.id, questionnaireId, payload);
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/versions',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnaireVersions(c.env, tenant.id, questionnaireSlug);
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/draft',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnaireDraft(c.env, tenant.id, questionnaireSlug, auth.userId);
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.put(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/draft',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam('tenantSlug', ['tenant_admin']),
  async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const payload = await c.req.json().catch(() => null);
    const result = await updateTenantQuestionnaireDraft(c.env, tenant.id, questionnaireSlug, auth.userId, payload);
    if (!result.ok) {
      return c.json(
        {
          message: result.message,
          errors: result.errors,
          requestId: resolveRequestId(c),
        },
        result.status || 400
      );
    }
    return c.json({ data: result.data }, result.status);
  }
);

app.post(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/publish',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam('tenantSlug', ['tenant_admin']),
  async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await publishTenantQuestionnaireDraft(c.env, tenant.id, questionnaireSlug, auth.userId);
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/responses',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnaireResponses(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/responses/export.csv',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await exportTenantQuestionnaireResponsesCsv(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);

    const filename = `responses-${tenant.slug}-${questionnaireSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.body(result.data.csv, 200);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/analytics/summary',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnaireAnalyticsSummary(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/analytics/distribution',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnaireAnalyticsDistribution(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/analytics/trend',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnaireAnalyticsTrend(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.post(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/ai/analyze',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const payload = await c.req.json().catch(() => ({}));
    const mode = normalizeAiMode(payload?.mode);
    if (!mode) return jsonError(c, 400, 'Mode analisa AI tidak valid.');
    try {
      const data = await analyzeTenantQuestionnaireAi(c.env, {
        tenant,
        questionnaireSlug,
        mode,
        questionnaireVersionId: payload?.questionnaireVersionId || null,
        filters: {
          from: payload?.from,
          to: payload?.to,
        },
      });
      return c.json({ data }, 200);
    } catch (error) {
      return jsonError(c, 500, error?.message || 'Gagal menganalisa data questionnaire.');
    }
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/ai/latest',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const questionnaireSlug = c.req.param('questionnaireSlug');
    const mode = normalizeAiMode(c.req.query('mode'));
    if (!mode) return jsonError(c, 400, 'Mode analisa AI tidak valid.');

    const questionnaire = await findQuestionnaireByTenantAndSlug(c.env, tenant.id, questionnaireSlug);
    if (!questionnaire) {
      return jsonError(c, 404, 'Questionnaire tidak ditemukan.');
    }

    try {
      const data = await getLatestTenantQuestionnaireAi(c.env, {
        tenant,
        questionnaireId: questionnaire.id,
        mode,
        questionnaireVersionId: c.req.query('questionnaireVersionId') || null,
        from: c.req.query('from') || null,
        to: c.req.query('to') || null,
      });
      return c.json({ data }, 200);
    } catch (error) {
      return jsonError(c, 500, error?.message || 'Gagal mengambil analisa questionnaire.');
    }
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/ai-prompts',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const query = c.req.query();
    const result = await getAiPromptBundle(c.env, {
      ...query,
      tenantId: tenant.id,
      scope: query.scope || (query.questionnaireId ? 'questionnaire' : 'tenant'),
    });
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.put(
  '/forms/:tenantSlug/admin/api/ai-prompts/draft',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam('tenantSlug', ['tenant_admin']),
  async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return jsonError(c, 400, 'Payload tidak valid.');
    }

    if (String(payload.scope || '').trim().toLowerCase() === 'global') {
      return jsonError(c, 403, 'Tenant admin tidak boleh mengubah scope global.');
    }

    const result = await saveAiPromptDraft(c.env, auth.userId, {
      ...payload,
      tenantId: tenant.id,
      schoolId: tenant.id,
    });
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.post(
  '/forms/:tenantSlug/admin/api/ai-prompts/publish',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam('tenantSlug', ['tenant_admin']),
  async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return jsonError(c, 400, 'Payload tidak valid.');
    }

    if (String(payload.scope || '').trim().toLowerCase() === 'global') {
      return jsonError(c, 403, 'Tenant admin tidak boleh publish scope global.');
    }

    const result = await publishAiPrompt(c.env, auth.userId, {
      ...payload,
      tenantId: tenant.id,
      schoolId: tenant.id,
    });
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:tenantSlug/admin/api/ai-prompts/history',
  tenantMiddleware,
  requireAuth(),
  requireTenantAccessFromParam(),
  async (c) => {
    const tenant = c.get('tenant');
    const query = c.req.query();
    const scope = String(query.scope || '').trim().toLowerCase() || (query.questionnaireId ? 'questionnaire' : 'tenant');
    if (scope === 'global') {
      return jsonError(c, 403, 'Tenant admin tidak boleh melihat history scope global.');
    }

    const result = await getAiPromptHistory(c.env, {
      ...query,
      tenantId: tenant.id,
      schoolId: tenant.id,
      scope,
    });
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get('/forms/:schoolSlug', requireDbReady, schoolMiddleware, (c) => c.redirect(`/forms/${c.req.param('schoolSlug')}/`, 301));
app.get('/forms/:schoolSlug/', requireDbReady, schoolMiddleware, async (c) => {
  const school = c.get('school');
  if (!school.is_active) {
    return jsonError(c, 404, 'Form sekolah belum aktif.');
  }
  return servePublicAsset(c, '/forms/index.html');
});

app.get('/forms/:tenantSlug/admin', tenantMiddleware, (c) => c.redirect(`/forms/${c.req.param('tenantSlug')}/admin/`, 301));

app.get('/forms/:tenantSlug/admin/', tenantMiddleware, async (c) => {
  const denied = requireAdminPageAccess(c);
  if (denied) return denied;
  return servePublicAsset(c, '/admin/school.html');
});

app.get('/forms/:tenantSlug/admin/dashboard', tenantMiddleware, (c) =>
  c.redirect(`/forms/${c.req.param('tenantSlug')}/admin/dashboard/`, 301)
);

app.get('/forms/:tenantSlug/admin/dashboard/', tenantMiddleware, async (c) => {
  const denied = requireAdminPageAccess(c);
  if (denied) return denied;
  const tenant = c.get('tenant');
  if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
    return servePublicAsset(c, '/admin/dashboard.html');
  }
  const defaultQuestionnaire = await findDefaultQuestionnaireByTenantId(c.env, tenant.id);
  if (defaultQuestionnaire?.slug) {
    return c.redirect(`/forms/${tenant.slug}/admin/questionnaires/${defaultQuestionnaire.slug}/dashboard/`, 302);
  }
  return servePublicAsset(c, '/admin/dashboard.html');
});

app.get('/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/builder', tenantMiddleware, (c) =>
  c.redirect(
    `/forms/${c.req.param('tenantSlug')}/admin/questionnaires/${c.req.param('questionnaireSlug')}/builder/`,
    301
  )
);

app.get('/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/builder/', tenantMiddleware, async (c) => {
  const denied = requireAdminPageAccess(c);
  if (denied) return denied;
  const tenant = c.get('tenant');
  const questionnaireSlug = c.req.param('questionnaireSlug');
  const questionnaire = await findQuestionnaireByTenantAndSlug(c.env, tenant.id, questionnaireSlug);
  if (!questionnaire) {
    return jsonError(c, 404, 'Questionnaire tidak ditemukan.');
  }
  return servePublicAsset(c, '/admin/questionnaire-builder.html');
});

app.get('/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/dashboard', tenantMiddleware, (c) =>
  c.redirect(
    `/forms/${c.req.param('tenantSlug')}/admin/questionnaires/${c.req.param('questionnaireSlug')}/dashboard/`,
    301
  )
);

app.get('/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/dashboard/', tenantMiddleware, async (c) => {
  const denied = requireAdminPageAccess(c);
  if (denied) return denied;
  const tenant = c.get('tenant');
  if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
    return c.redirect(`/forms/${tenant.slug}/admin/dashboard/`, 302);
  }
  const questionnaireSlug = c.req.param('questionnaireSlug');
  const questionnaire = await findQuestionnaireByTenantAndSlug(c.env, tenant.id, questionnaireSlug);
  if (!questionnaire) {
    return jsonError(c, 404, 'Questionnaire tidak ditemukan.');
  }
  return servePublicAsset(c, '/admin/questionnaire-dashboard.html');
});

function requireAdminPageAccess(c) {
  const auth = c.get('auth');
  if (!auth) {
    const redirect = encodeURIComponent(c.req.path);
    return c.redirect(`/forms/admin/login?redirect=${redirect}`, 302);
  }

  const school = c.get('school');
  if (school && canAccessSchool(auth.memberships, school.id)) {
    return null;
  }

  const tenant = c.get('tenant');
  if (tenant) {
    if (hasSuperadmin(auth.memberships)) {
      return null;
    }

    const tenantMemberships = Array.isArray(auth.tenantMemberships) ? auth.tenantMemberships : [];
    if (hasTenantAccess(tenantMemberships, tenant.id, ['tenant_admin', 'analyst'])) {
      return null;
    }

    const tenantType = String(tenant.tenant_type || tenant.tenantType || '')
      .trim()
      .toLowerCase();
    if (tenantType === 'school' && canAccessSchool(auth.memberships, tenant.id)) {
      return null;
    }
  }

  return jsonError(c, 403, 'Forbidden');
}

app.get('/forms/:schoolSlug/api/form-schema', schoolMiddleware, async (c) => {
  const school = c.get('school');
  if (!school.is_active) {
    return jsonError(c, 404, 'Form sekolah belum aktif.');
  }

  const defaultQuestionnaire = await findDefaultQuestionnaireByTenantId(c.env, school.id);
  if (defaultQuestionnaire?.slug) {
    const v2Schema = await getPublishedQuestionnaireSchemaBySlug(c.env, school.id, defaultQuestionnaire.slug);
    if (v2Schema.ok) {
      return c.json({
        meta: v2Schema.data.meta,
        fields: v2Schema.data.fields,
        version: v2Schema.data.version,
        questionnaire: {
          id: v2Schema.data.questionnaire.id,
          slug: v2Schema.data.questionnaire.slug,
          name: v2Schema.data.questionnaire.name,
          tenantId: v2Schema.data.questionnaire.tenantId,
        },
      });
    }
  }

  const form = await getPublishedFormSchema(c.env, school.id);
  if (!form) return jsonError(c, 404, 'Form aktif belum tersedia.');
  return c.json({
    meta: form.meta,
    fields: form.fields,
    version: form.version,
  });
});

app.post('/forms/:schoolSlug/api/submit', schoolMiddleware, async (c) => {
  const school = c.get('school');
  if (!school.is_active) {
    return jsonError(c, 404, 'Form sekolah belum aktif.');
  }
  const payload = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return jsonError(c, 400, 'Payload tidak valid.');
  }

  const result = await submitResponse(c.env, school.id, payload);
  if (!result.ok) {
    return c.json(
      {
        message: result.message,
        errors: result.errors,
        requestId: resolveRequestId(c),
      },
      result.status
    );
  }

  return c.json(
    {
      message: 'Terima kasih, feedback berhasil dikirim.',
      data: result.data,
    },
    result.status
  );
});

app.get('/forms/:tenantSlug/:questionnaireSlug', requireDbReady, tenantMiddleware, (c) =>
  c.redirect(`/forms/${c.req.param('tenantSlug')}/${c.req.param('questionnaireSlug')}/`, 301)
);

app.get('/forms/:tenantSlug/:questionnaireSlug/', requireDbReady, tenantMiddleware, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant.is_active) {
    return jsonError(c, 404, 'Form organisasi belum aktif.');
  }

  const questionnaireSlug = c.req.param('questionnaireSlug');
  const schema = await getPublishedQuestionnaireSchemaBySlug(c.env, tenant.id, questionnaireSlug);
  if (!schema.ok) {
    return jsonError(c, schema.status, schema.message);
  }

  return servePublicAsset(c, '/forms/index.html');
});

app.get('/forms/:tenantSlug/:questionnaireSlug/api/schema', requireDbReady, tenantMiddleware, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant.is_active) {
    return jsonError(c, 404, 'Form organisasi belum aktif.');
  }
  const questionnaireSlug = c.req.param('questionnaireSlug');
  const result = await getPublishedQuestionnaireSchemaBySlug(c.env, tenant.id, questionnaireSlug);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({
    meta: result.data.meta,
    fields: result.data.fields,
    version: result.data.version,
    questionnaire: {
      id: result.data.questionnaire.id,
      slug: result.data.questionnaire.slug,
      name: result.data.questionnaire.name,
      tenantId: result.data.questionnaire.tenantId,
    },
  });
});

app.get('/forms/:tenantSlug/:questionnaireSlug/api/form-schema', requireDbReady, tenantMiddleware, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant.is_active) {
    return jsonError(c, 404, 'Form organisasi belum aktif.');
  }
  const questionnaireSlug = c.req.param('questionnaireSlug');
  const result = await getPublishedQuestionnaireSchemaBySlug(c.env, tenant.id, questionnaireSlug);
  if (!result.ok) return jsonError(c, result.status, result.message);
  return c.json({
    meta: result.data.meta,
    fields: result.data.fields,
    version: result.data.version,
    questionnaire: {
      id: result.data.questionnaire.id,
      slug: result.data.questionnaire.slug,
      name: result.data.questionnaire.name,
      tenantId: result.data.questionnaire.tenantId,
    },
  });
});

app.post('/forms/:tenantSlug/:questionnaireSlug/api/submit', requireDbReady, tenantMiddleware, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant.is_active) {
    return jsonError(c, 404, 'Form organisasi belum aktif.');
  }

  const questionnaireSlug = c.req.param('questionnaireSlug');
  const payload = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return jsonError(c, 400, 'Payload tidak valid.');
  }

  const result = await submitQuestionnaireResponse(c.env, tenant.id, questionnaireSlug, payload);
  if (!result.ok) {
    return c.json(
      {
        message: result.message,
        errors: result.errors,
        requestId: resolveRequestId(c),
      },
      result.status
    );
  }

  return c.json(
    {
      message: 'Terima kasih, feedback berhasil dikirim.',
      data: result.data,
    },
    result.status
  );
});

app.get(
  '/forms/:schoolSlug/admin/api/form/draft',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const auth = c.get('auth');
    const school = c.get('school');
    const draft = await getDraftFormSchema(c.env, school.id, auth.userId);
    if (!draft) return jsonError(c, 404, 'Draft form tidak ditemukan.');
    return c.json({ data: draft });
  }
);

app.put(
  '/forms/:schoolSlug/admin/api/form/draft',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const auth = c.get('auth');
    const school = c.get('school');
    const payload = await c.req.json().catch(() => null);
    const result = await updateDraftFormSchema(c.env, school.id, auth.userId, payload);
    if (!result.ok) {
      return c.json(
        {
          message: result.message,
          errors: result.errors,
          requestId: resolveRequestId(c),
        },
        result.status || 400
      );
    }
    return c.json({ data: result.data }, result.status);
  }
);

app.post(
  '/forms/:schoolSlug/admin/api/form/publish',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const auth = c.get('auth');
    const school = c.get('school');
    const result = await publishDraft(c.env, school.id, auth.userId);
    if (!result.ok) return jsonError(c, result.status, result.message);
    return c.json({ data: result.data }, result.status);
  }
);

app.get(
  '/forms/:schoolSlug/admin/api/responses',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const data = await getResponses(c.env, school.id, c.req.query());
    return c.json({ data });
  }
);

app.get(
  '/forms/:schoolSlug/admin/api/responses/export.csv',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const csv = await getResponsesCsv(c.env, school.id);
    const filename = `responses-${school.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.body(csv, 200);
  }
);

app.get(
  '/forms/:schoolSlug/admin/api/analytics/summary',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const data = await getAnalyticsSummary(c.env, school.id);
    return c.json({ data });
  }
);

app.get(
  '/forms/:schoolSlug/admin/api/analytics/distribution',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const data = await getAnalyticsDistribution(c.env, school.id);
    return c.json({ data });
  }
);

app.get(
  '/forms/:schoolSlug/admin/api/analytics/trend',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const data = await getAnalyticsTrend(c.env, school.id, c.req.query('days'));
    return c.json({ data });
  }
);

app.post(
  '/forms/:schoolSlug/admin/api/ai/analyze',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const payload = await c.req.json().catch(() => ({}));
    const mode = normalizeAiMode(payload?.mode);
    if (!mode) return jsonError(c, 400, 'Mode analisa AI tidak valid.');
    try {
      const data = await analyzeSchoolAi(c.env, { school, mode });
      return c.json(data);
    } catch (error) {
      return jsonError(c, 500, error?.message || 'Gagal menganalisa data.');
    }
  }
);

app.get(
  '/forms/:schoolSlug/admin/api/ai/latest',
  schoolMiddleware,
  requireAuth(),
  requireSchoolAccessFromParam(),
  async (c) => {
    const school = c.get('school');
    const mode = normalizeAiMode(c.req.query('mode'));
    if (!mode) return jsonError(c, 400, 'Mode analisa AI tidak valid.');
    try {
      const data = await getLatestSchoolAi(c.env, { school, mode });
      return c.json(data);
    } catch (error) {
      return jsonError(c, 500, error?.message || 'Gagal mengambil analisa.');
    }
  }
);

app.notFound((c) => c.json({ message: 'Not found', requestId: resolveRequestId(c) }, 404));

export default app;
