export function registerTenantAdminAiPromptRoutes(app, deps) {
  const {
    tenantMiddleware,
    requireAuth,
    requireTenantAccessFromParam,
    jsonError,
    getAiPromptBundle,
    saveAiPromptDraft,
    publishAiPrompt,
    getAiPromptHistory,
  } = deps;

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
      const scope =
        String(query.scope || '').trim().toLowerCase() || (query.questionnaireId ? 'questionnaire' : 'tenant');
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
}
