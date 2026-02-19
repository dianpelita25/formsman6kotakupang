export function registerPublicRoutes(app, deps) {
  const {
    ensurePlatformSchema,
    requireDbReady,
    tenantMiddleware,
    jsonError,
    servePublicAsset,
    isLegacyAdminAliasEnabled,
    LEGACY_REDIRECT_PREFIX,
    LEGACY_SCHOOL_SLUG,
    listPublicSchools,
    listPublicTenants,
    listPublicQuestionnairesByTenant,
  } = deps;

  app.get('/health', (c) => c.json({ ok: true, runtime: 'cloudflare-worker-hono' }));
  app.get('/health/db', async (c) => {
    try {
      await ensurePlatformSchema(c.env);
      return c.json({ ok: true, runtime: 'cloudflare-worker-hono', db: 'ready' });
    } catch (error) {
      return c.json({ ok: false, db: 'unready', message: error?.message || 'Database belum siap.' }, 503);
    }
  });

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
}
