import { DB_UNREADY_ERROR_MESSAGE, logServerError } from '../../lib/http/error-response.js';

const NOINDEX_ROBOTS_HEADER = 'noindex, nofollow, noarchive';
const ASSET_CACHE_SHORT = 'public, max-age=300, stale-while-revalidate=60';
const ASSET_CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemapXml(origin, entries) {
  const normalizedOrigin = String(origin || '').replace(/\/+$/, '');
  const rows = entries
    .map((entry) => {
      const loc = `${normalizedOrigin}${entry.path}`;
      return [
        '  <url>',
        `    <loc>${xmlEscape(loc)}</loc>`,
        `    <changefreq>${xmlEscape(entry.changefreq || 'weekly')}</changefreq>`,
        `    <priority>${xmlEscape(entry.priority || '0.7')}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', rows, '</urlset>'].join('\n');
}

function buildRobotsText(origin, sitemapPath) {
  const safeOrigin = String(origin || '').replace(/\/+$/, '');
  const safeSitemapPath = String(sitemapPath || '/sitemap.xml').startsWith('/')
    ? String(sitemapPath || '/sitemap.xml')
    : `/${String(sitemapPath || 'sitemap.xml')}`;
  const lines = [
    'User-agent: *',
    'Allow: /forms',
    'Disallow: /forms/admin/',
    'Disallow: /forms/*/admin/',
    'Disallow: /forms/*/*/dashboard/',
    '',
    `Sitemap: ${safeOrigin}${safeSitemapPath}`,
  ];
  return lines.join('\n');
}

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
    findDefaultQuestionnaireByTenantId,
  } = deps;

  const serveAdminPageAsset = (c, internalPath) =>
    servePublicAsset(c, internalPath, {
      responseHeaders: {
        'X-Robots-Tag': NOINDEX_ROBOTS_HEADER,
      },
    });

  app.get('/health', (c) => c.json({ ok: true, runtime: 'cloudflare-worker-hono' }));
  app.get('/health/db', async (c) => {
    try {
      await ensurePlatformSchema(c.env);
      return c.json({ ok: true, runtime: 'cloudflare-worker-hono', db: 'ready' });
    } catch (error) {
      logServerError('health-db', c.get('requestId'), error);
      return c.json({ ok: false, db: 'unready', message: DB_UNREADY_ERROR_MESSAGE, code: 'DB_UNREADY' }, 503);
    }
  });

  app.get(LEGACY_REDIRECT_PREFIX, (c) => c.redirect(`/forms/${LEGACY_SCHOOL_SLUG}`, 301));
  app.get(`${LEGACY_REDIRECT_PREFIX}/*`, (c) => {
    const rest = c.req.path.slice(LEGACY_REDIRECT_PREFIX.length);
    return c.redirect(`/forms/${LEGACY_SCHOOL_SLUG}${rest}`, 301);
  });

  const respondRobots = (c, sitemapPath = '/sitemap.xml') => {
    const origin = new URL(c.req.url).origin;
    return new Response(buildRobotsText(origin, sitemapPath), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': ASSET_CACHE_SHORT,
      },
    });
  };

  const respondSitemap = async (c) => {
    const origin = new URL(c.req.url).origin;
    const tenants = await listPublicTenants(c.env);
    const sitemapEntries = new Map();

    sitemapEntries.set('/forms', {
      path: '/forms',
      changefreq: 'daily',
      priority: '0.9',
    });

    for (const tenant of tenants) {
      const tenantId = String(tenant?.id || '').trim();
      const tenantSlug = String(tenant?.slug || '').trim();
      if (!tenantId || !tenantSlug) continue;

      let questionnaireSlug = '';
      const defaultQuestionnaire = await findDefaultQuestionnaireByTenantId(c.env, tenantId);
      questionnaireSlug = String(defaultQuestionnaire?.slug || '').trim();

      if (!questionnaireSlug) {
        const questionnaires = await listPublicQuestionnairesByTenant(c.env, tenantId);
        const fallback = questionnaires.find((item) => item.isDefault) || questionnaires[0];
        questionnaireSlug = String(fallback?.slug || '').trim();
      }

      if (!questionnaireSlug) continue;

      const path = `/forms/${tenantSlug}/${questionnaireSlug}/`;
      sitemapEntries.set(path, {
        path,
        changefreq: 'daily',
        priority: '0.8',
      });
    }

    const xml = buildSitemapXml(origin, Array.from(sitemapEntries.values()));
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
      },
    });
  };

  app.get('/robots.txt', (c) => respondRobots(c, '/sitemap.xml'));
  app.get('/forms/robots.txt', (c) => respondRobots(c, '/forms/sitemap.xml'));
  app.get('/sitemap.xml', requireDbReady, respondSitemap);
  app.get('/forms/sitemap.xml', requireDbReady, respondSitemap);

  app.get('/forms-static/*', async (c) => {
    const prefix = '/forms-static/';
    const requestPath = c.req.path;
    const relativePath = requestPath.startsWith(prefix) ? requestPath.slice(prefix.length) : '';
    if (!relativePath) {
      return jsonError(c, 404, 'Asset tidak ditemukan.');
    }
    const versionTag = String(c.req.query('v') || '').trim();
    const cacheControl = versionTag
      ? ASSET_CACHE_IMMUTABLE
      : ASSET_CACHE_SHORT;
    return servePublicAsset(c, `/${relativePath}`, {
      responseHeaders: {
        'Cache-Control': cacheControl,
      },
    });
  });

  app.get('/forms/admin/login', (c) => serveAdminPageAsset(c, '/admin/login.html'));
  app.get('/forms/admin/login/', (c) => serveAdminPageAsset(c, '/admin/login.html'));
  app.get('/forms/admin/select-school', (c) => serveAdminPageAsset(c, '/admin/select-school.html'));
  app.get('/forms/admin/select-school/', (c) => serveAdminPageAsset(c, '/admin/select-school.html'));

  app.get('/forms/admin', (c) => c.redirect('/forms/admin/', 301));
  app.get('/forms/admin/', (c) => serveAdminPageAsset(c, '/admin/superadmin.html'));
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
