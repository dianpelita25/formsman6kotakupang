export function registerAdminPageRoutes(app, deps) {
  const {
    tenantMiddleware,
    requireAdminPageAccess,
    jsonError,
    servePublicAsset,
    LEGACY_SCHOOL_SLUG,
    findDefaultQuestionnaireByTenantId,
    findQuestionnaireByTenantAndSlug,
  } = deps;
  const noindexHeaders = {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
  const serveAdminPageAsset = (c, internalPath) =>
    servePublicAsset(c, internalPath, {
      responseHeaders: noindexHeaders,
    });

  app.get('/forms/:tenantSlug/admin', tenantMiddleware, (c) =>
    c.redirect(`/forms/${c.req.param('tenantSlug')}/admin/`, 301)
  );

  app.get('/forms/:tenantSlug/admin/', tenantMiddleware, async (c) => {
    const denied = requireAdminPageAccess(c);
    if (denied) return denied;
    return serveAdminPageAsset(c, '/admin/school.html');
  });

  app.get('/forms/:tenantSlug/admin/dashboard', tenantMiddleware, (c) =>
    c.redirect(`/forms/${c.req.param('tenantSlug')}/admin/dashboard/`, 301)
  );

  app.get('/forms/:tenantSlug/admin/dashboard/', tenantMiddleware, async (c) => {
    const denied = requireAdminPageAccess(c);
    if (denied) return denied;
    const tenant = c.get('tenant');
    if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
      return serveAdminPageAsset(c, '/admin/dashboard.html');
    }
    const defaultQuestionnaire = await findDefaultQuestionnaireByTenantId(c.env, tenant.id);
    if (defaultQuestionnaire?.slug) {
      return c.redirect(`/forms/${tenant.slug}/admin/questionnaires/${defaultQuestionnaire.slug}/dashboard/`, 302);
    }
    return serveAdminPageAsset(c, '/admin/dashboard.html');
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
    return serveAdminPageAsset(c, '/admin/questionnaire-builder.html');
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
    return serveAdminPageAsset(c, '/admin/questionnaire-dashboard.html');
  });
}
