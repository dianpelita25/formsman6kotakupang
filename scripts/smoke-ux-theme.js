import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_THEME_PORT || 8904);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_THEME_BASE_URL || '').trim();
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
    if (questionnaire) {
      return {
        tenantSlug,
        questionnaireSlug: String(questionnaire.slug || '').trim(),
      };
    }
  }

  throw new Error('Tidak ada tenant dengan questionnaire publik untuk theme smoke.');
}

async function getThemeSnapshot(page) {
  return await page.evaluate(() => {
    const explicit = String(document.documentElement.getAttribute('data-theme') || '').trim();
    const active = explicit || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const stored = String(window.localStorage.getItem('aiti_theme_preference_v1') || '').trim();
    const overflow = {
      doc: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      body: document.body.scrollWidth <= document.body.clientWidth,
      docSW: document.documentElement.scrollWidth,
      docCW: document.documentElement.clientWidth,
      bodySW: document.body.scrollWidth,
      bodyCW: document.body.clientWidth,
    };
    return { explicit, active, stored, overflow };
  });
}

async function ensureThemeToggle(page, routeName, assertions) {
  const toggle = page.locator('[data-theme-toggle-button="true"]').first();
  const exists = (await page.locator('[data-theme-toggle-button="true"]').count()) > 0;
  assertions.expect(`${routeName} theme toggle exists`, exists, 'button [data-theme-toggle-button="true"] tidak ditemukan');
  if (!exists) return;

  const visible = await toggle.isVisible().catch(() => false);
  assertions.expect(`${routeName} theme toggle visible`, visible, 'toggle tidak terlihat');
  if (!visible) return;

  const before = await getThemeSnapshot(page);
  await toggle.click();
  await page.waitForTimeout(240);
  const after = await getThemeSnapshot(page);
  assertions.expect(`${routeName} toggle changes theme`, before.active !== after.active, `before=${before.active}, after=${after.active}`);
  assertions.expect(
    `${routeName} toggle persists localStorage`,
    after.stored === after.active,
    `stored=${after.stored}, active=${after.active}`
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const afterReload = await getThemeSnapshot(page);
  assertions.expect(
    `${routeName} reload keeps theme`,
    afterReload.active === after.active,
    `after=${after.active}, reload=${afterReload.active}`
  );
  assertions.expect(
    `${routeName} no overflow`,
    afterReload.overflow.doc && afterReload.overflow.body,
    `doc=${afterReload.overflow.docSW}/${afterReload.overflow.docCW}, body=${afterReload.overflow.bodySW}/${afterReload.overflow.bodyCW}`
  );
}

async function auditRoute(page, baseUrl, route, assertions) {
  const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const status = Number(response?.status?.() || 0);
  assertions.expect(`${route.name} status`, status > 0 && status < 400, `status=${status}`);
  if (route.readySelector) {
    await page.waitForSelector(route.readySelector, { timeout: 30000, state: 'attached' }).catch(() => {
      assertions.fail(`${route.name} ready selector`, `selector=${route.readySelector}`);
    });
  }

  await ensureThemeToggle(page, route.name, assertions);

  if (route.checkChartCanvases) {
    const chartReport = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('#scale-average-chart, #radio-distribution-chart, #trend-chart, #advanced-viz-chart'));
      return {
        total: canvases.length,
        visible: canvases.filter((canvas) => {
          const rect = canvas.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).length,
        hasChartJs: Boolean(window.Chart),
      };
    });
    assertions.expect(`${route.name} chartjs loaded`, chartReport.hasChartJs, 'window.Chart tidak tersedia');
    assertions.expect(`${route.name} chart canvases present`, chartReport.total >= 4, `total=${chartReport.total}`);
    assertions.expect(`${route.name} chart canvases visible`, chartReport.visible >= 4, `visible=${chartReport.visible}`);
  }
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
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);
    const target = await resolveTargetQuestionnaire(baseUrl);

    const publicRoutes = [
      { name: 'portal', path: '/forms' },
      { name: 'admin login', path: '/forms/admin/login' },
      {
        name: 'public form',
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
        readySelector: '#feedback-form',
      },
    ];
    for (const route of publicRoutes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    await loginAsSuperadmin(page, { baseUrl, email, password });
    const adminRoutes = [
      { name: 'superadmin', path: '/forms/admin/', readySelector: '#status' },
      { name: 'tenant admin', path: `/forms/${target.tenantSlug}/admin/`, readySelector: '#status' },
      {
        name: 'questionnaire builder',
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`,
        readySelector: '#question-list',
      },
      {
        name: 'questionnaire dashboard',
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`,
        readySelector: '#advanced-viz-chart',
        checkChartCanvases: true,
      },
    ];
    for (const route of adminRoutes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    if (assertions.failures.length) {
      throw new Error(`smoke-ux-theme gagal (${assertions.failures.length} issue).`);
    }

    console.log('[PASS] smoke-ux-theme selesai tanpa pelanggaran tema/UX utama.');
  } finally {
    await context.close();
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-theme');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
