import 'dotenv/config';
import { getRequiredEnv, launchBrowser, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_PUBLIC_DASHBOARD_PORT || 8907);
const FORBIDDEN_KEYS = new Set(['respondent', 'answers', 'payload', 'samples']);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_PUBLIC_DASHBOARD_BASE_URL || '').trim();
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

  throw new Error('Tidak ada tenant dengan questionnaire publik untuk dashboard smoke.');
}

function collectForbiddenPaths(payload, forbiddenKeys, currentPath = 'data', collector = []) {
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => collectForbiddenPaths(item, forbiddenKeys, `${currentPath}[${index}]`, collector));
    return collector;
  }

  if (!payload || typeof payload !== 'object') {
    return collector;
  }

  Object.entries(payload).forEach(([key, value]) => {
    const nextPath = `${currentPath}.${key}`;
    if (forbiddenKeys.has(String(key || '').trim().toLowerCase())) {
      collector.push(nextPath);
    }
    collectForbiddenPaths(value, forbiddenKeys, nextPath, collector);
  });
  return collector;
}

async function auditApi(baseUrl, target, assertions) {
  const basePath = `${baseUrl}/forms/${target.tenantSlug}/${target.questionnaireSlug}/api/dashboard`;
  const endpoints = ['summary', 'distribution', 'trend'];

  for (const endpoint of endpoints) {
    const response = await fetch(`${basePath}/${endpoint}`);
    assertions.expect(`api ${endpoint} status`, response.ok, `status=${response.status}`);
    if (!response.ok) continue;

    const payload = await response.json().catch(() => ({}));
    const data = payload?.data || {};
    const status = String(data?.status || '').trim();
    assertions.expect(`api ${endpoint} has status`, status === 'ok' || status === 'insufficient_sample', `status=${status || '-'}`);

    const forbiddenHits = collectForbiddenPaths(data, FORBIDDEN_KEYS);
    assertions.expect(
      `api ${endpoint} no forbidden fields`,
      forbiddenHits.length === 0,
      forbiddenHits.length ? forbiddenHits.join(', ') : ''
    );

    const privacy = data?.privacy || {};
    assertions.expect(
      `api ${endpoint} privacy lock`,
      Number(privacy.minSampleSize || 0) === 30 && Number(privacy.minBucketSize || 0) === 10,
      `minSample=${privacy.minSampleSize}, minBucket=${privacy.minBucketSize}`
    );
  }
}

async function auditUi(baseUrl, target, viewport, label, assertions) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    const route = `/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`;
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const status = Number(response?.status?.() || 0);
    assertions.expect(`${label} dashboard status`, status > 0 && status < 400, `status=${status}`);

    await page.waitForSelector('#dashboard-title', { timeout: 30000, state: 'attached' }).catch(() => {
      assertions.fail(`${label} dashboard title`, 'selector #dashboard-title tidak ditemukan');
    });

    const report = await page.evaluate(() => {
      const de = document.documentElement;
      const body = document.body;
      const toggle = document.querySelector('[data-theme-toggle-button="true"]');
      return {
        hasToggle: Boolean(toggle),
        overflowDoc: de.scrollWidth > de.clientWidth,
        overflowBody: body.scrollWidth > body.clientWidth,
        docSize: `${de.scrollWidth}/${de.clientWidth}`,
        bodySize: `${body.scrollWidth}/${body.clientWidth}`,
      };
    });

    assertions.expect(`${label} has theme toggle`, report.hasToggle, 'toggle tidak ditemukan');
    assertions.expect(`${label} no overflow`, !report.overflowDoc && !report.overflowBody, `doc=${report.docSize}, body=${report.bodySize}`);

    if (report.hasToggle) {
      const themeToggle = page.locator('[data-theme-toggle-button="true"]').first();
      let toggleVisible = await themeToggle.isVisible().catch(() => false);
      if (!toggleVisible) {
        const menuToggle = page.locator('.global-nav__menu-toggle').first();
        if ((await menuToggle.count()) > 0 && (await menuToggle.isVisible().catch(() => false))) {
          await menuToggle.click();
          await page.waitForTimeout(120);
          toggleVisible = await themeToggle.isVisible().catch(() => false);
        }
      }
      assertions.expect(`${label} theme toggle visible`, toggleVisible, 'theme toggle tidak terlihat');
      if (!toggleVisible) return;

      const before = await page.evaluate(() => String(document.documentElement.getAttribute('data-theme') || '').trim());
      await themeToggle.click();
      await page.waitForTimeout(280);
      const after = await page.evaluate(() => String(document.documentElement.getAttribute('data-theme') || '').trim());
      assertions.expect(`${label} theme toggles`, before !== after, `before=${before || '-'}, after=${after || '-'}`);
    }
  } finally {
    await context.close();
    await browser.close();
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

  const localServer = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : localServer.baseUrl;

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);
    const target = await resolveTargetQuestionnaire(baseUrl);

    await auditApi(baseUrl, target, assertions);
    await auditUi(baseUrl, target, { width: 1366, height: 900 }, 'desktop', assertions);
    await auditUi(baseUrl, target, { width: 390, height: 844 }, 'mobile', assertions);

    if (assertions.failures.length) {
      throw new Error(`smoke-public-dashboard gagal (${assertions.failures.length} issue).`);
    }

    console.log('[PASS] smoke-public-dashboard selesai (API privacy + UI public dashboard).');
  } finally {
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-public-dashboard');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
