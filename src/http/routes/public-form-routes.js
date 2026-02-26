import { registerPublicDashboardRoutes } from './public-dashboard-routes.js';
import { appendSetCookieHeader, captureOpenDeviceBestEffort } from './public-form-open-tracking.js';
export function registerPublicFormRoutes(app, deps) {
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
  const captureOpenDevice = async (c, { tenantId = '', questionnaireId = '' } = {}) =>
    captureOpenDeviceBestEffort(c, {
      tenantId,
      questionnaireId,
      captureFormOpenBestEffort,
      getCookie,
      buildOpenTrackingCookieOptions,
      deviceCookieName: DEVICE_COOKIE_NAME,
    });
  const respondWithQuestionnaireSchema = async (c) => {
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
  };
  app.get('/forms/:schoolSlug', requireDbReady, schoolMiddleware, (c) =>
    c.redirect(`/forms/${c.req.param('schoolSlug')}/`, 301)
  );
  app.get('/forms/:schoolSlug/', requireDbReady, schoolMiddleware, async (c) => {
    const school = c.get('school');
    if (!school.is_active) {
      return jsonError(c, 404, 'Form sekolah belum aktif.');
    }
    let trackingResult = { setCookieHeader: '' };
    try {
      const defaultQuestionnaire = await findDefaultQuestionnaireByTenantId(c.env, school.id);
      if (defaultQuestionnaire?.id) {
        trackingResult = await captureOpenDevice(c, {
          tenantId: school.id,
          questionnaireId: defaultQuestionnaire.id,
        });
      }
    } catch (error) {
      console.warn(
        `[OPEN_TRACKING_WARNING] gagal resolve default questionnaire tenantId=${school.id}: ${String(
          error?.message || error
        )}`
      );
    }
    const response = await servePublicAsset(c, '/forms/index.html');
    return appendSetCookieHeader(response, trackingResult.setCookieHeader);
  });
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
    const trackingResult = await captureOpenDevice(c, {
      tenantId: tenant.id,
      questionnaireId: schema.data?.questionnaire?.id || '',
    });
    const response = await servePublicAsset(c, '/forms/index.html');
    return appendSetCookieHeader(response, trackingResult.setCookieHeader);
  });
  app.get('/forms/:tenantSlug/:questionnaireSlug/api/schema', requireDbReady, tenantMiddleware, respondWithQuestionnaireSchema);
  app.get(
    '/forms/:tenantSlug/:questionnaireSlug/api/form-schema',
    requireDbReady,
    tenantMiddleware,
    respondWithQuestionnaireSchema
  );
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
  registerPublicDashboardRoutes(app, {
    requireDbReady,
    tenantMiddleware,
    jsonError,
    servePublicAsset,
    getPublishedQuestionnaireSchemaBySlug,
    getTenantQuestionnairePublicDashboardSummary,
    getTenantQuestionnairePublicDashboardDistribution,
    getTenantQuestionnairePublicDashboardTrend,
  });
}
