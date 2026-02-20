import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_MOBILE_PORT || 8902);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function createAssertions() {
  const failures = [];

  function pass(label, detail = '') {
    console.log(`[PASS] ${label}${detail ? ` -> ${detail}` : ''}`);
  }

  function fail(label, detail = '') {
    const message = `${label}${detail ? ` -> ${detail}` : ''}`;
    failures.push(message);
    console.error(`[FAIL] ${message}`);
  }

  function expect(label, condition, detailOnFail = '') {
    if (condition) {
      pass(label);
      return true;
    }
    fail(label, detailOnFail);
    return false;
  }

  return {
    failures,
    pass,
    fail,
    expect,
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

  throw new Error('Tidak ada tenant dengan questionnaire publik untuk UX smoke.');
}

async function auditRoute(page, baseUrl, route, assertions) {
  const {
    name,
    path,
    checkOverflow = false,
    checkLegacyTapTargets = false,
    checkBuilderTapTargets = false,
    checkCheckboxProxyTargets = false,
    debugWrapId = '',
    debugPreId = '',
  } = route;

  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const status = Number(response?.status?.() || 0);
  assertions.expect(`${name} status`, status > 0 && status < 400, `status=${status}`);

  const report = await page.evaluate((input) => {
    const result = {
      url: window.location.href,
      overflow: {
        doc: false,
        body: false,
        docSW: 0,
        docCW: 0,
        bodySW: 0,
        bodyCW: 0,
      },
      issues: [],
    };

    const de = document.documentElement;
    const body = document.body;
    result.overflow = {
      doc: de.scrollWidth > de.clientWidth,
      body: body.scrollWidth > body.clientWidth,
      docSW: de.scrollWidth,
      docCW: de.clientWidth,
      bodySW: body.scrollWidth,
      bodyCW: body.clientWidth,
    };

    if (input.checkOverflow && (result.overflow.doc || result.overflow.body)) {
      result.issues.push(
        `overflow detected (doc=${String(result.overflow.doc)}, body=${String(result.overflow.body)}, doc=${result.overflow.docSW}/${result.overflow.docCW}, body=${result.overflow.bodySW}/${result.overflow.bodyCW})`
      );
    }

    if (input.checkLegacyTapTargets) {
      const targets = Array.from(document.querySelectorAll('.btn, .btn.ghost, .ai-segment, .ai-external-select select')).filter(
        (el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
        }
      );
      const small = targets
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter((entry) => entry.w < 44 || entry.h < 44);
      if (small.length) {
        result.issues.push(`legacy tap target <44 ditemukan (${small.map((entry) => `${entry.tag}:${entry.text || '-'} ${entry.w}x${entry.h}`).join(', ')})`);
      }
    }

    if (input.checkBuilderTapTargets) {
      const steps = Array.from(document.querySelectorAll('.builder-step'));
      const small = steps
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: (el.innerText || '').trim().slice(0, 30),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter((entry) => entry.w < 44 || entry.h < 44);
      if (small.length) {
        result.issues.push(`builder step tap target <44 ditemukan (${small.map((entry) => `${entry.text} ${entry.w}x${entry.h}`).join(', ')})`);
      }
    }

    if (input.checkCheckboxProxyTargets) {
      const controls = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      const unresolved = controls
        .map((el) => {
          const r = el.getBoundingClientRect();
          let proxy = el.closest('label, .radio-option, .scale-option, .dashboard-visibility-grid label');
          if (!proxy) proxy = el.parentElement;
          const proxyRect = proxy ? proxy.getBoundingClientRect() : null;
          const inputTooSmall = r.width < 44 || r.height < 44;
          const proxyLargeEnough = proxyRect ? proxyRect.width >= 44 && proxyRect.height >= 44 : false;
          return {
            inputTooSmall,
            proxyLargeEnough,
            inputW: Math.round(r.width),
            inputH: Math.round(r.height),
            proxyW: proxyRect ? Math.round(proxyRect.width) : 0,
            proxyH: proxyRect ? Math.round(proxyRect.height) : 0,
          };
        })
        .filter((entry) => entry.inputTooSmall && !entry.proxyLargeEnough);

      if (unresolved.length) {
        result.issues.push(`checkbox/radio tanpa tap proxy >=44 ditemukan (${unresolved.length} item)`);
      }
    }

    if (input.debugWrapId) {
      const wrap = document.getElementById(input.debugWrapId);
      if (!wrap) {
        result.issues.push(`debug wrap id=${input.debugWrapId} tidak ditemukan`);
      } else if (!wrap.hidden) {
        result.issues.push(`debug wrap id=${input.debugWrapId} harus hidden secara default`);
      }
    }

    if (input.debugPreId) {
      const pre = document.getElementById(input.debugPreId);
      if (!pre) {
        result.issues.push(`debug pre id=${input.debugPreId} tidak ditemukan`);
      }
    }

    return result;
  }, {
    checkOverflow,
    checkLegacyTapTargets,
    checkBuilderTapTargets,
    checkCheckboxProxyTargets,
    debugWrapId,
    debugPreId,
  });

  assertions.expect(`${name} no UX issues`, report.issues.length === 0, report.issues.join(' | '));
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);

    const target = await resolveTargetQuestionnaire(baseUrl);
    const routesBeforeLogin = [
      {
        name: 'portal',
        path: '/forms',
        checkOverflow: true,
        debugWrapId: 'portal-error-debug-wrap',
        debugPreId: 'portal-error-debug',
      },
      {
        name: 'admin-login',
        path: '/forms/admin/login',
        checkOverflow: true,
        debugWrapId: 'error-debug-wrap',
        debugPreId: 'error-debug',
      },
    ];

    for (const route of routesBeforeLogin) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    await loginAsSuperadmin(page, { baseUrl, email, password });
    assertions.pass('login', 'superadmin authenticated');

    const routesAfterLogin = [
      {
        name: 'superadmin',
        path: '/forms/admin/',
        checkOverflow: true,
        debugWrapId: 'error-debug-wrap',
        debugPreId: 'error-debug',
      },
      {
        name: 'tenant-admin',
        path: `/forms/${target.tenantSlug}/admin/`,
        checkOverflow: true,
        debugWrapId: 'error-debug-wrap',
        debugPreId: 'error-debug',
      },
      {
        name: 'builder',
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`,
        checkOverflow: true,
        checkBuilderTapTargets: true,
        debugWrapId: 'error-debug-wrap',
        debugPreId: 'error-debug',
      },
      {
        name: 'modern-dashboard',
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`,
        checkOverflow: true,
        checkCheckboxProxyTargets: true,
        debugWrapId: 'error-debug-wrap',
        debugPreId: 'error-debug',
      },
      {
        name: 'legacy-dashboard',
        path: '/forms/sman6-kotakupang/admin/dashboard/',
        checkOverflow: true,
        checkLegacyTapTargets: true,
        debugWrapId: 'error-debug-wrap',
        debugPreId: 'error-debug',
      },
      {
        name: 'public-form',
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
        checkOverflow: true,
        checkCheckboxProxyTargets: true,
        debugWrapId: 'status-debug-wrap',
        debugPreId: 'status-debug',
      },
    ];

    for (const route of routesAfterLogin) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    if (assertions.failures.length) {
      throw new Error(`UX mobile smoke gagal (${assertions.failures.length} issue).`);
    }

    console.log('[PASS] smoke-ux-mobile selesai tanpa pelanggaran UX residual rules.');
  } finally {
    await context.close();
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-mobile');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
