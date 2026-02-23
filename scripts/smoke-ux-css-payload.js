import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_CSS_PAYLOAD_PORT || 8910);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_CSS_PAYLOAD_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatKb(bytes) {
  return `${(Number(bytes || 0) / 1024).toFixed(2)} KB`;
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

  throw new Error('Tidak ada tenant dengan kuesioner publik untuk audit CSS payload.');
}

async function collectCssPayload(page, baseOrigin) {
  return await page.evaluate(({ expectedOrigin }) => {
    const byUrl = new Map();

    function append(url, bytes) {
      const safeBytes = Number(bytes || 0);
      if (!Number.isFinite(safeBytes) || safeBytes < 0) return;
      const previous = Number(byUrl.get(url) || 0);
      byUrl.set(url, Math.max(previous, safeBytes));
    }

    const entries = performance.getEntriesByType('resource');
    entries.forEach((entry) => {
      const name = String(entry?.name || '').trim();
      if (!name) return;

      let parsed;
      try {
        parsed = new URL(name);
      } catch {
        return;
      }

      if (parsed.origin !== expectedOrigin) return;
      if (!parsed.pathname.includes('/forms-static/')) return;
      if (!/\.css$/i.test(parsed.pathname)) return;

      const encoded = Number(entry.encodedBodySize || 0);
      const transfer = Number(entry.transferSize || 0);
      const decoded = Number(entry.decodedBodySize || 0);
      append(parsed.pathname + parsed.search, encoded || transfer || decoded || 0);
    });

    const files = Array.from(byUrl.entries())
      .map(([url, bytes]) => ({ url, bytes }))
      .sort((a, b) => b.bytes - a.bytes);

    const totalBytes = files.reduce((sum, item) => sum + Number(item.bytes || 0), 0);

    return {
      totalBytes,
      files,
    };
  }, { expectedOrigin: baseOrigin });
}

function buildRouteDefinitions(target) {
  return [
    {
      label: '/forms',
      path: '/forms',
      maxBytes: 26 * 1024,
      requiresAuth: false,
      readySelector: '.portal-page',
    },
    {
      label: '/forms/admin/',
      path: '/forms/admin/',
      maxBytes: 72 * 1024,
      requiresAuth: true,
      readySelector: '.superadmin-page',
    },
    {
      label: '/forms/:tenantSlug/admin/',
      path: `/forms/${target.tenantSlug}/admin/`,
      maxBytes: 72 * 1024,
      requiresAuth: true,
      readySelector: '.tenant-admin-page',
    },
    {
      label: '/forms/:tenantSlug/:questionnaireSlug/builder/',
      path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`,
      maxBytes: 72 * 1024,
      requiresAuth: true,
      readySelector: '.builder-page',
    },
    {
      label: '/forms/:tenantSlug/:questionnaireSlug/dashboard/ (admin)',
      path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`,
      maxBytes: 72 * 1024,
      requiresAuth: true,
      readySelector: '.questionnaire-dashboard-page',
    },
    {
      label: '/forms/:tenantSlug/:questionnaireSlug/',
      path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
      maxBytes: 32 * 1024,
      requiresAuth: false,
      readySelector: '#feedback-form',
    },
    {
      label: '/forms/:tenantSlug/:questionnaireSlug/dashboard/ (public)',
      path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`,
      maxBytes: 26 * 1024,
      requiresAuth: false,
      readySelector: '.public-dashboard-page',
    },
  ];
}

async function run() {
  const assertions = createAssertions();
  const externalBaseUrl = buildBaseUrl();
  const isExternal = Boolean(externalBaseUrl);

  if (!isExternal) {
    getRequiredEnv('DATABASE_URL');
    getRequiredEnv('SESSION_SECRET');
  }

  const email = getRequiredEnv('SUPERADMIN_EMAIL');
  const password = getRequiredEnv('SUPERADMIN_PASSWORD');

  const localServer = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : localServer.baseUrl;
  const origin = new URL(baseUrl).origin;

  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  if (isExternal) {
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);
  }

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);

    const target = await resolveTargetQuestionnaire(baseUrl);
    const routes = buildRouteDefinitions(target);

    await loginAsSuperadmin(page, {
      baseUrl,
      email,
      password,
    });

    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      if (route.readySelector) {
        await page.waitForSelector(route.readySelector, { timeout: 30000, state: 'attached' }).catch(() => {
          assertions.fail(`${route.label} ready selector`, `selector=${route.readySelector}`);
        });
      }

      const status = Number(response?.status?.() || 0);
      assertions.expect(`${route.label} status`, status > 0 && status < 400, `status=${status}`);

      const payload = await collectCssPayload(page, origin);
      const details = payload.files.map((item) => `${item.url}=${formatKb(item.bytes)}`).join(' | ');

      assertions.expect(
        `${route.label} css payload`,
        Number(payload.totalBytes || 0) <= route.maxBytes,
        `actual=${formatKb(payload.totalBytes)}, limit=${formatKb(route.maxBytes)}, files=${details || '-'}`
      );

      assertions.expect(`${route.label} css file detected`, payload.files.length > 0, 'resource css /forms-static tidak terdeteksi');
    }

    if (assertions.failures.length) {
      throw new Error(`Smoke CSS payload gagal (${assertions.failures.length} temuan).`);
    }

    console.log('PASS: smoke CSS payload lulus semua route.');
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    if (localServer) {
      await localServer.close().catch(() => {});
    }
  }
}

run().catch((error) => {
  console.error('FAILED: smoke CSS payload error.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
