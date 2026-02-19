export function registerTenantAdminAnalyticsRoutes(app, deps) {
  const {
    tenantMiddleware,
    requireAuth,
    requireTenantAccessFromParam,
    jsonError,
    getTenantQuestionnaireAnalyticsSummary,
    getTenantQuestionnaireAnalyticsDistribution,
    getTenantQuestionnaireAnalyticsTrend,
  } = deps;

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
}
