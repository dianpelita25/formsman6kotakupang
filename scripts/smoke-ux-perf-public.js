import 'dotenv/config';
import { getRequiredEnv, launchBrowser, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_PERF_PUBLIC_PORT || 8906);
const SETTLE_THRESHOLD_MS = Number(process.env.SMOKE_UX_PERF_PUBLIC_SETTLE_MAX_MS || 420);
const FRAME_GAP_THRESHOLD_MS = 50;
const MAX_LONG_FRAME_GAPS = Number(process.env.SMOKE_UX_PERF_PUBLIC_MAX_LONG_GAPS || 2);
const SAMPLE_COUNT = Math.max(3, Number(process.env.SMOKE_UX_PERF_PUBLIC_SAMPLES || 5));
const MAX_SETTLE_WAIT_MS = 2000;

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_PERF_PUBLIC_BASE_URL || '').trim();
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

function median(values = []) {
  const list = toArray(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!list.length) return NaN;
  const middle = Math.floor(list.length / 2);
  if (list.length % 2 !== 0) return list[middle];
  return (list[middle - 1] + list[middle]) / 2;
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

  throw new Error('Tidak ada tenant dengan questionnaire publik untuk perf smoke.');
}

async function capturePerfSamples(page, sampleCount) {
  return await page.evaluate(
    async ({ sampleCountValue, frameGapThresholdMs, maxSettleWaitMs }) => {
      const toggle = document.querySelector('[data-theme-toggle-button="true"]');
      if (!toggle) {
        return {
          ok: false,
          reason: 'Theme toggle button tidak ditemukan.',
          samples: [],
        };
      }

      function activeTheme() {
        const explicit = String(document.documentElement.getAttribute('data-theme') || '').trim();
        if (explicit) return explicit;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }

      const samples = [];
      for (let index = 0; index < sampleCountValue; index += 1) {
        const startTheme = activeTheme();
        const longGaps = [];

        let frameHandle = 0;
        let tracking = true;
        let previousFrame = performance.now();
        const trackFrame = (timestamp) => {
          const gap = timestamp - previousFrame;
          if (gap > frameGapThresholdMs) {
            longGaps.push(Number(gap.toFixed(2)));
          }
          previousFrame = timestamp;
          if (tracking) {
            frameHandle = requestAnimationFrame(trackFrame);
          }
        };
        frameHandle = requestAnimationFrame(trackFrame);

        const startedAt = performance.now();
        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

        let changedTheme = false;
        let settled = false;
        while (performance.now() - startedAt <= maxSettleWaitMs) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve()));
          const switching = String(document.documentElement.getAttribute('data-theme-switching') || '').trim() === 'true';
          if (activeTheme() !== startTheme) {
            changedTheme = true;
          }
          if (changedTheme && !switching) {
            settled = true;
            break;
          }
        }

        const settleMs = Number((performance.now() - startedAt).toFixed(2));
        tracking = false;
        cancelAnimationFrame(frameHandle);
        await new Promise((resolve) => window.setTimeout(resolve, 80));

        samples.push({
          settleMs,
          changedTheme,
          settled,
          longGapCount: longGaps.length,
          longGaps,
        });
      }

      return {
        ok: true,
        reason: '',
        samples,
      };
    },
    {
      sampleCountValue: sampleCount,
      frameGapThresholdMs: FRAME_GAP_THRESHOLD_MS,
      maxSettleWaitMs: MAX_SETTLE_WAIT_MS,
    }
  );
}

async function auditRoute(page, baseUrl, route, assertions) {
  const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const status = Number(response?.status?.() || 0);
  assertions.expect(`${route.name} status`, status > 0 && status < 400, `status=${status}`);
  if (route.readySelector) {
    await page.waitForSelector(route.readySelector, { timeout: 30000, state: 'attached' }).catch(() => {
      assertions.fail(`${route.name} ready selector`, `selector=${route.readySelector}`);
    });
  }

  const exists = (await page.locator('[data-theme-toggle-button="true"]').count()) > 0;
  assertions.expect(`${route.name} theme toggle exists`, exists, 'selector [data-theme-toggle-button="true"] tidak ditemukan');
  if (!exists) return;

  const report = await capturePerfSamples(page, SAMPLE_COUNT);
  assertions.expect(`${route.name} perf sampling`, report.ok, report.reason || 'sampling gagal');
  if (!report.ok) return;

  const validSamples = report.samples.filter((sample) => sample.changedTheme && sample.settled);
  assertions.expect(
    `${route.name} samples settled`,
    validSamples.length === report.samples.length,
    `settled=${validSamples.length}/${report.samples.length}`
  );
  if (!validSamples.length) return;

  const settleMedian = Number(median(validSamples.map((sample) => sample.settleMs)).toFixed(2));
  const maxLongGapCount = Math.max(...validSamples.map((sample) => Number(sample.longGapCount || 0)));
  const perSample = validSamples.map((sample) => `${sample.settleMs}ms/${sample.longGapCount}`).join(', ');

  assertions.expect(
    `${route.name} median settle <= ${SETTLE_THRESHOLD_MS}ms`,
    settleMedian <= SETTLE_THRESHOLD_MS,
    `median=${settleMedian}ms, samples=${perSample}`
  );
  assertions.expect(
    `${route.name} frame-gap >${FRAME_GAP_THRESHOLD_MS}ms <= ${MAX_LONG_FRAME_GAPS}`,
    maxLongGapCount <= MAX_LONG_FRAME_GAPS,
    `maxLongGapCount=${maxLongGapCount}, samples=${perSample}`
  );
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
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);
    const target = await resolveTargetQuestionnaire(baseUrl);

    const routes = [
      { name: 'portal', path: '/forms' },
      { name: 'admin login', path: '/forms/admin/login' },
      {
        name: 'public form',
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
        readySelector: '#feedback-form',
      },
      {
        name: 'public dashboard',
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`,
        readySelector: '.public-dashboard-page',
      },
    ];

    for (const route of routes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    if (assertions.failures.length) {
      throw new Error(`smoke-ux-perf-public gagal (${assertions.failures.length} issue).`);
    }

    console.log('[PASS] smoke-ux-perf-public selesai (threshold settle/frame-gap terpenuhi).');
  } finally {
    await context.close();
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-perf-public');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
