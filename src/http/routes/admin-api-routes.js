export function registerAdminApiRoutes(app, deps) {
  const {
    requireAuth,
    requireSuperadmin,
    jsonError,
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
  } = deps;

  app.post('/forms/admin/api/login', async (c) => {
    const payload = await c.req.json().catch(() => null);
    const result = await loginWithEmailPassword(c.env, payload);
    if (!result.ok) {
      return jsonError(c, result.status, result.message);
    }
    setCookie(c, SESSION_COOKIE_NAME, result.sessionToken, buildSessionCookieOptions(c.req.url));
    return c.json({
      message: 'Login berhasil.',
      user: result.user,
      memberships: result.memberships,
      tenantMemberships: result.tenantMemberships || [],
    });
  });

  app.post('/forms/admin/api/logout', requireAuth(), async (c) => {
    const cookieValue = getCookie(c, SESSION_COOKIE_NAME);
    await logout(c.env, cookieValue);
    const cookieOptions = buildSessionCookieOptions(c.req.url);
    deleteCookie(c, SESSION_COOKIE_NAME, {
      path: '/',
      secure: cookieOptions.secure,
      sameSite: 'Lax',
    });
    return c.json({ message: 'Logout berhasil.' });
  });

  app.get('/forms/admin/api/me', requireAuth(), async (c) => {
    const auth = c.get('auth');
    const tenantMemberships = Array.isArray(auth.tenantMemberships) ? auth.tenantMemberships : [];
    const superadmin =
      hasSuperadmin(auth.memberships) || tenantMemberships.some((membership) => membership.role === 'superadmin');
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
    if (String(result.data?.tenant_type || '').trim().toLowerCase() === 'school') {
      await ensureLegacySchoolFormVersions(c.env, result.data.id, null);
    }
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
}
