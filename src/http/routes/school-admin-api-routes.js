import { buildSafeErrorExtra, INTERNAL_SERVER_ERROR_MESSAGE, logServerError } from '../../lib/http/error-response.js';

export function registerSchoolAdminApiRoutes(app, deps) {
  const {
    schoolMiddleware,
    requireAuth,
    requireSchoolAccessFromParam,
    jsonError,
    resolveRequestId,
    getDraftFormSchema,
    updateDraftFormSchema,
    publishDraft,
    getResponses,
    getResponsesCsv,
    getAnalyticsSummary,
    getAnalyticsDistribution,
    getAnalyticsTrend,
    normalizeAiMode,
    analyzeSchoolAi,
    getLatestSchoolAi,
  } = deps;

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
        logServerError('school-ai-analyze', c.get('requestId'), error);
        return jsonError(c, 500, INTERNAL_SERVER_ERROR_MESSAGE, buildSafeErrorExtra('AI_ANALYZE_ERROR'));
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
        logServerError('school-ai-latest', c.get('requestId'), error);
        return jsonError(c, 500, INTERNAL_SERVER_ERROR_MESSAGE, buildSafeErrorExtra('AI_FETCH_ERROR'));
      }
    }
  );
}
