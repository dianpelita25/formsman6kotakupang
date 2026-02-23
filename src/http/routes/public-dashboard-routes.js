export function registerPublicDashboardRoutes(app, deps) {
  const {
    requireDbReady,
    tenantMiddleware,
    jsonError,
    servePublicAsset,
    getPublishedQuestionnaireSchemaBySlug,
    getTenantQuestionnairePublicDashboardSummary,
    getTenantQuestionnairePublicDashboardDistribution,
    getTenantQuestionnairePublicDashboardTrend,
  } = deps;
  const noindexHeaders = {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };

  function jsonPublicDashboardResponse(c, result) {
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return c.json({ data: result.data }, result.status);
  }

  app.get('/forms/:tenantSlug/:questionnaireSlug/dashboard', requireDbReady, tenantMiddleware, (c) =>
    c.redirect(`/forms/${c.req.param('tenantSlug')}/${c.req.param('questionnaireSlug')}/dashboard/`, 301)
  );

  app.get('/forms/:tenantSlug/:questionnaireSlug/dashboard/', requireDbReady, tenantMiddleware, async (c) => {
    const tenant = c.get('tenant');
    if (!tenant.is_active) {
      return jsonError(c, 404, 'Form organisasi belum aktif.');
    }

    const questionnaireSlug = c.req.param('questionnaireSlug');
    const schema = await getPublishedQuestionnaireSchemaBySlug(c.env, tenant.id, questionnaireSlug);
    if (!schema.ok) {
      return jsonError(c, schema.status, schema.message);
    }

    return servePublicAsset(c, '/forms/public-dashboard.html', {
      responseHeaders: noindexHeaders,
    });
  });

  app.get('/forms/:tenantSlug/:questionnaireSlug/api/dashboard/summary', requireDbReady, tenantMiddleware, async (c) => {
    const tenant = c.get('tenant');
    if (!tenant.is_active) {
      return jsonError(c, 404, 'Form organisasi belum aktif.');
    }

    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnairePublicDashboardSummary(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);
    return jsonPublicDashboardResponse(c, result);
  });

  app.get(
    '/forms/:tenantSlug/:questionnaireSlug/api/dashboard/distribution',
    requireDbReady,
    tenantMiddleware,
    async (c) => {
      const tenant = c.get('tenant');
      if (!tenant.is_active) {
        return jsonError(c, 404, 'Form organisasi belum aktif.');
      }

      const questionnaireSlug = c.req.param('questionnaireSlug');
      const result = await getTenantQuestionnairePublicDashboardDistribution(c.env, tenant.id, questionnaireSlug, c.req.query());
      if (!result.ok) return jsonError(c, result.status, result.message);
      return jsonPublicDashboardResponse(c, result);
    }
  );

  app.get('/forms/:tenantSlug/:questionnaireSlug/api/dashboard/trend', requireDbReady, tenantMiddleware, async (c) => {
    const tenant = c.get('tenant');
    if (!tenant.is_active) {
      return jsonError(c, 404, 'Form organisasi belum aktif.');
    }

    const questionnaireSlug = c.req.param('questionnaireSlug');
    const result = await getTenantQuestionnairePublicDashboardTrend(c.env, tenant.id, questionnaireSlug, c.req.query());
    if (!result.ok) return jsonError(c, result.status, result.message);
    return jsonPublicDashboardResponse(c, result);
  });
}
