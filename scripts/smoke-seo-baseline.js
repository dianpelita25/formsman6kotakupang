import 'dotenv/config';
import { launchBrowser, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_SEO_BASELINE_PORT || 8911);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_SEO_BASELINE_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function createAssertions() {
  const failures = [];
  return {
    failures,
    pass(label, detail = '') {
      console.log(`[PASS] ${label}${detail ? ` -> ${detail}` : ''}`);
    },
    fail(label, detail = '') {
      const message = `${label}${detail ? ` -> ${detail}` : ''}`;
      failures.push(message);
      console.error(`[FAIL] ${message}`);
    },
    expect(label, condition, detailOnFail = '') {
      if (condition) {
        this.pass(label);
        return true;
      }
      this.fail(label, detailOnFail);
      return false;
    },
  };
}

async function resolveTargetQuestionnaire(baseUrl) {
  const tenantsRes = await fetch(`${baseUrl}/forms/api/tenants/public`);
  if (!tenantsRes.ok) {
    throw new Error(`Gagal memuat tenant publik: status=${tenantsRes.status}`);
  }
  const tenantsPayload = await tenantsRes.json().catch(() => ({}));
  const tenants = toArray(tenantsPayload?.data);
  if (!tenants.length) {
    throw new Error('Daftar tenant publik kosong.');
  }

  for (const tenant of tenants) {
    const tenantSlug = String(tenant?.slug || '').trim();
    if (!tenantSlug) continue;

    const questionnairesRes = await fetch(`${baseUrl}/forms/${tenantSlug}/api/questionnaires/public`);
    if (!questionnairesRes.ok) continue;
    const questionnairesPayload = await questionnairesRes.json().catch(() => ({}));
    const questionnaires = toArray(questionnairesPayload?.data);
    const questionnaire = questionnaires.find((item) => String(item?.slug || '').trim());
    if (!questionnaire) continue;

    return {
      tenantSlug,
      questionnaireSlug: String(questionnaire.slug || '').trim(),
    };
  }

  throw new Error('Tidak ada tenant dengan kuesioner publik untuk audit SEO baseline.');
}

async function collectHeadMeta(page) {
  return await page.evaluate(() => {
    const title = String(document.title || '').trim();
    const description = String(document.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();
    const robots = String(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '').trim();
    return { title, description, robots };
  });
}

async function auditHtmlMeta(page, url, expectations, assertions) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const status = Number(response?.status?.() || 0);
  assertions.expect(`${expectations.label} status`, status > 0 && status < 400, `status=${status}`);

  const meta = await collectHeadMeta(page);
  assertions.expect(`${expectations.label} title`, Boolean(meta.title), 'title kosong');

  if (expectations.descriptionRequired) {
    assertions.expect(`${expectations.label} description`, Boolean(meta.description), 'meta description kosong');
  }

  if (expectations.robotsPattern) {
    const passed = expectations.robotsPattern.test(meta.robots);
    assertions.expect(
      `${expectations.label} robots`,
      passed,
      `robots="${meta.robots || '<empty>'}"`
    );
  }
}

async function run() {
  const assertions = createAssertions();
  const externalBaseUrl = buildBaseUrl();
  const isExternal = Boolean(externalBaseUrl);

  if (!isExternal) {
    const databaseUrl = String(process.env.DATABASE_URL || '').trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL belum di-set di .env untuk menjalankan smoke SEO baseline lokal.');
    }
  }

  const localServer = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : localServer.baseUrl;
  const target = await resolveTargetQuestionnaire(baseUrl);

  const robotsCandidates = [`${baseUrl}/robots.txt`, `${baseUrl}/forms/robots.txt`];
  let robotsText = '';
  let robotsSource = '';
  let robotsStatus = 0;
  for (const candidate of robotsCandidates) {
    const response = await fetch(candidate);
    const text = await response.text();
    if (response.status === 200 && text.includes('Allow: /forms')) {
      robotsText = text;
      robotsSource = candidate;
      robotsStatus = response.status;
      break;
    }
    if (!robotsSource && response.status === 200) {
      robotsText = text;
      robotsSource = candidate;
      robotsStatus = response.status;
    }
  }
  assertions.expect('robots.txt status', robotsStatus === 200, `status=${robotsStatus}, source=${robotsSource || '<none>'}`);
  assertions.expect('robots.txt allow /forms', robotsText.includes('Allow: /forms'), `source=${robotsSource || '<none>'}`);
  assertions.expect('robots.txt disallow /forms/admin/', robotsText.includes('Disallow: /forms/admin/'), `source=${robotsSource || '<none>'}`);
  assertions.expect('robots.txt disallow /forms/*/admin/', robotsText.includes('Disallow: /forms/*/admin/'), `source=${robotsSource || '<none>'}`);
  assertions.expect(
    'robots.txt disallow public dashboard',
    robotsText.includes('Disallow: /forms/*/*/dashboard/'),
    `source=${robotsSource || '<none>'}`
  );
  assertions.expect(
    'robots.txt sitemap pointer',
    robotsText.includes('/sitemap.xml') || robotsText.includes('/forms/sitemap.xml'),
    `source=${robotsSource || '<none>'}`
  );

  const sitemapCandidates = [`${baseUrl}/sitemap.xml`, `${baseUrl}/forms/sitemap.xml`];
  let sitemapXml = '';
  let sitemapSource = '';
  let sitemapStatus = 0;
  for (const candidate of sitemapCandidates) {
    const response = await fetch(candidate);
    const text = await response.text();
    if (response.status === 200 && /<urlset\b/i.test(text)) {
      sitemapXml = text;
      sitemapSource = candidate;
      sitemapStatus = response.status;
      break;
    }
    if (!sitemapSource && response.status === 200) {
      sitemapXml = text;
      sitemapSource = candidate;
      sitemapStatus = response.status;
    }
  }
  assertions.expect('sitemap.xml status', sitemapStatus === 200, `status=${sitemapStatus}, source=${sitemapSource || '<none>'}`);
  assertions.expect('sitemap.xml urlset', /<urlset\b/i.test(sitemapXml), `tag <urlset> tidak ditemukan, source=${sitemapSource || '<none>'}`);
  assertions.expect('sitemap.xml include /forms', sitemapXml.includes('/forms</loc>') || sitemapXml.includes('/forms/</loc>'));
  assertions.expect('sitemap.xml exclude /forms/admin/', !sitemapXml.includes('/forms/admin/'));
  assertions.expect('sitemap.xml exclude /dashboard/', !sitemapXml.includes('/dashboard/'));

  const adminLoginRes = await fetch(`${baseUrl}/forms/admin/login`);
  assertions.expect(
    'admin login X-Robots-Tag noindex',
    /noindex/i.test(String(adminLoginRes.headers.get('x-robots-tag') || '')),
    `header=${String(adminLoginRes.headers.get('x-robots-tag') || '<empty>')}`
  );

  const publicDashboardRes = await fetch(
    `${baseUrl}/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`
  );
  assertions.expect(
    'public dashboard X-Robots-Tag noindex',
    /noindex/i.test(String(publicDashboardRes.headers.get('x-robots-tag') || '')),
    `header=${String(publicDashboardRes.headers.get('x-robots-tag') || '<empty>')}`
  );

  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  if (isExternal) {
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);
  }

  try {
    await auditHtmlMeta(page, `${baseUrl}/forms`, {
      label: 'portal /forms',
      descriptionRequired: true,
      robotsPattern: /\bindex\b/i,
    }, assertions);

    await auditHtmlMeta(page, `${baseUrl}/forms/${target.tenantSlug}/${target.questionnaireSlug}/`, {
      label: 'public form page',
      descriptionRequired: true,
      robotsPattern: /\bindex\b/i,
    }, assertions);

    await auditHtmlMeta(page, `${baseUrl}/forms/admin/login`, {
      label: 'admin login page',
      descriptionRequired: true,
      robotsPattern: /noindex/i,
    }, assertions);

    await auditHtmlMeta(page, `${baseUrl}/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`, {
      label: 'public dashboard page',
      descriptionRequired: true,
      robotsPattern: /noindex/i,
    }, assertions);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    if (localServer) {
      await localServer.close().catch(() => {});
    }
  }

  if (assertions.failures.length) {
    throw new Error(`Smoke SEO baseline gagal (${assertions.failures.length} temuan).`);
  }

  console.log('PASS: smoke SEO baseline lulus.');
}

run().catch((error) => {
  console.error('FAILED: smoke SEO baseline error.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
