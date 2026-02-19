export function registerTenantAdminQuestionnaireRoutes(app, deps) {
  const {
    tenantMiddleware,
    requireAuth,
    requireTenantAccessFromParam,
    jsonError,
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
  } = deps;

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
}
