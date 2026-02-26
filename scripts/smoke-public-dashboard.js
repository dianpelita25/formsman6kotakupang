import 'dotenv/config';
import { getRequiredEnv, launchBrowser, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_PUBLIC_DASHBOARD_PORT || 8907);
const FORBIDDEN_KEYS = new Set(['respondent', 'answers', 'payload', 'samples']);
const LAYOUT_SAMPLE_COUNT = 10;
const LAYOUT_SAMPLE_INTERVAL_MS = 250;
const LAYOUT_STABLE_WINDOW = 5;
const LAYOUT_MAX_SCROLL_RANGE = 24;
const LAYOUT_MAX_CANVAS_RANGE = 12;
const LAYOUT_MAX_CANVAS_HEIGHT = 420;

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

function rangeOf(values = []) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return 0;
  return Math.max(...numeric) - Math.min(...numeric);
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

  let fallbackTarget = null;

  for (const tenant of tenants) {
    const tenantSlug = String(tenant?.slug || '').trim();
    if (!tenantSlug) continue;
    const questionnairesRes = await fetch(`${baseUrl}/forms/${tenantSlug}/api/questionnaires/public`);
    if (!questionnairesRes.ok) continue;
    const questionnairesPayload = await questionnairesRes.json().catch(() => ({}));
    const questionnaires = toArray(questionnairesPayload?.data);
    const questionnaireCandidates = questionnaires
      .map((item) => String(item?.slug || '').trim())
      .filter(Boolean);
    for (const questionnaireSlug of questionnaireCandidates) {
      if (!fallbackTarget) {
        fallbackTarget = { tenantSlug, questionnaireSlug };
      }
      const summaryRes = await fetch(`${baseUrl}/forms/${tenantSlug}/${questionnaireSlug}/api/dashboard/summary`).catch(() => null);
      if (!summaryRes?.ok) continue;
      const summaryPayload = await summaryRes.json().catch(() => ({}));
      const status = String(summaryPayload?.data?.status || '').trim();
      if (status === 'ok') {
        return { tenantSlug, questionnaireSlug };
      }
    }
  }

  if (fallbackTarget) {
    return fallbackTarget;
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
      Number(privacy.minSampleSize || 0) === 10 && Number(privacy.minBucketSize || 0) === 10,
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

    const layoutSamples = [];
    for (let index = 0; index < LAYOUT_SAMPLE_COUNT; index += 1) {
      const sample = await page.evaluate(() => {
        const de = document.documentElement;
        const contentPanel = document.getElementById('content-panel');
        const criteriaChart = document.getElementById('criteria-chart');
        const scaleChart = document.getElementById('scale-chart');
        return {
          contentVisible: contentPanel ? !contentPanel.hidden : false,
          scrollHeight: Number(de?.scrollHeight || 0),
          criteriaHeight: Number(criteriaChart?.clientHeight || 0),
          scaleHeight: Number(scaleChart?.clientHeight || 0),
        };
      });
      layoutSamples.push(sample);
      await page.waitForTimeout(LAYOUT_SAMPLE_INTERVAL_MS);
    }

    const stableWindow = layoutSamples.slice(-LAYOUT_STABLE_WINDOW);
    const hasVisibleCharts = stableWindow.some(
      (sample) => sample.contentVisible && (sample.criteriaHeight > 0 || sample.scaleHeight > 0)
    );

    if (!hasVisibleCharts) {
      assertions.pass(`${label} layout stability skipped`, 'chart tidak aktif (insufficient sample atau panel tersembunyi)');
    } else {
      const scrollRange = rangeOf(stableWindow.map((sample) => sample.scrollHeight));
      const criteriaRange = rangeOf(stableWindow.map((sample) => sample.criteriaHeight));
      const scaleRange = rangeOf(stableWindow.map((sample) => sample.scaleHeight));
      const maxCriteriaHeight = Math.max(...stableWindow.map((sample) => sample.criteriaHeight));
      const maxScaleHeight = Math.max(...stableWindow.map((sample) => sample.scaleHeight));

      assertions.expect(
        `${label} layout scroll stable`,
        scrollRange <= LAYOUT_MAX_SCROLL_RANGE,
        `range=${scrollRange}px, max=${LAYOUT_MAX_SCROLL_RANGE}px`
      );
      assertions.expect(
        `${label} criteria chart stable`,
        criteriaRange <= LAYOUT_MAX_CANVAS_RANGE,
        `range=${criteriaRange}px, max=${LAYOUT_MAX_CANVAS_RANGE}px`
      );
      assertions.expect(
        `${label} scale chart stable`,
        scaleRange <= LAYOUT_MAX_CANVAS_RANGE,
        `range=${scaleRange}px, max=${LAYOUT_MAX_CANVAS_RANGE}px`
      );
      assertions.expect(
        `${label} criteria chart bounded`,
        maxCriteriaHeight <= LAYOUT_MAX_CANVAS_HEIGHT,
        `height=${maxCriteriaHeight}px, max=${LAYOUT_MAX_CANVAS_HEIGHT}px`
      );
      assertions.expect(
        `${label} scale chart bounded`,
        maxScaleHeight <= LAYOUT_MAX_CANVAS_HEIGHT,
        `height=${maxScaleHeight}px, max=${LAYOUT_MAX_CANVAS_HEIGHT}px`
      );
    }

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
