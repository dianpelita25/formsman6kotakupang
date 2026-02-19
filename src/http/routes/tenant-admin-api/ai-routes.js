export function registerTenantAdminAiRoutes(app, deps) {
  const {
    tenantMiddleware,
    requireAuth,
    requireTenantAccessFromParam,
    jsonError,
    normalizeAiMode,
    analyzeTenantQuestionnaireAi,
    findQuestionnaireByTenantAndSlug,
    getLatestTenantQuestionnaireAi,
  } = deps;

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
}
