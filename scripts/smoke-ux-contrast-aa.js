import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_CONTRAST_AA_PORT || 8909);
const DEFAULT_MIN_RATIO = Number(process.env.SMOKE_UX_CONTRAST_AA_MIN_RATIO || 4.5);

const NAV_RULES = [
  { selector: '.global-nav__link', label: 'global nav link', minRatio: 4.5, minCount: 1 },
  { selector: '.global-nav__theme-toggle', label: 'global nav theme toggle', minRatio: 4.5, minCount: 1 },
];

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_CONTRAST_AA_BASE_URL || '').trim();
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

  throw new Error('Tidak ada tenant dengan kuesioner publik untuk audit kontras.');
}

async function createLightModeContext(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('aiti_theme_preference_v1', 'light');
    } catch {
      // ignore storage errors in private mode
    }
  });
  return context;
}

async function openMobileDrawerIfNeeded(page) {
  const menuToggle = page.locator('.global-nav__menu-toggle').first();
  if ((await menuToggle.count()) === 0) return;
  const visible = await menuToggle.isVisible().catch(() => false);
  if (!visible) return;
  const expanded = String((await menuToggle.getAttribute('aria-expanded')) || '').trim();
  if (expanded === 'true') return;
  await menuToggle.click();
  await page.waitForTimeout(160);
}

async function evaluateContrastRules(page, rules, requireLightTheme = true) {
  return await page.evaluate(
    ({ inputRules, defaultMinRatio, requireLightThemeValue }) => {
      function parseColor(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/^rgba?\(([^)]+)\)$/i);
        if (!match) return null;
        const parts = match[1]
          .split(',')
          .map((part) => Number.parseFloat(part.trim()))
          .filter((part) => Number.isFinite(part));
        if (parts.length < 3) return null;
        return {
          r: Math.max(0, Math.min(255, parts[0])),
          g: Math.max(0, Math.min(255, parts[1])),
          b: Math.max(0, Math.min(255, parts[2])),
          a: parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1,
        };
      }

      function blend(top, bottom) {
        const alpha = top.a + bottom.a * (1 - top.a);
        if (alpha <= 0) return { r: 255, g: 255, b: 255, a: 1 };
        return {
          r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
          g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
          b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
          a: alpha,
        };
      }

      function resolveBackgroundColor(element) {
        if (!element) return { r: 255, g: 255, b: 255, a: 1 };
        const computed = getComputedStyle(element);
        const own = parseColor(computed.backgroundColor);
        if (!own || own.a <= 0) {
          return resolveBackgroundColor(element.parentElement);
        }
        if (own.a >= 0.995) {
          return { ...own, a: 1 };
        }
        return blend(own, resolveBackgroundColor(element.parentElement));
      }

      function relativeLuminance(color) {
        const normalize = (value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        };
        const r = normalize(color.r);
        const g = normalize(color.g);
        const b = normalize(color.b);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      function contrastRatio(foreground, background) {
        const fg = relativeLuminance(foreground);
        const bg = relativeLuminance(background);
        const lighter = Math.max(fg, bg);
        const darker = Math.min(fg, bg);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function isVisible(element) {
        if (!element) return false;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      const issues = [];
      const selectorCounts = {};
      const currentTheme = String(document.documentElement.getAttribute('data-theme') || '').trim();
      if (requireLightThemeValue && currentTheme !== 'light') {
        issues.push(`theme bukan light (data-theme=${currentTheme || '<empty>'})`);
      }

      const rules = Array.isArray(inputRules) ? inputRules : [];
      for (const rule of rules) {
        const selector = String(rule?.selector || '').trim();
        if (!selector) continue;
        const minRatio = Number(rule?.minRatio || defaultMinRatio || 4.5);
        const minCount = Math.max(0, Number(rule?.minCount || 1));
        const optional = Boolean(rule?.optional);
        const label = String(rule?.label || selector).trim();
        const nodes = Array.from(document.querySelectorAll(selector)).filter((element) => isVisible(element));
        selectorCounts[selector] = nodes.length;

        if (nodes.length < minCount) {
          if (!optional) {
            issues.push(`selector kurang elemen: ${label} (found=${nodes.length}, min=${minCount})`);
          }
          continue;
        }

        nodes.forEach((node, index) => {
          const style = getComputedStyle(node);
          const fg = parseColor(style.color);
          if (!fg) {
            issues.push(`warna teks tidak bisa diparse: ${label}#${index + 1}`);
            return;
          }
          const bg = resolveBackgroundColor(node);
          const ratio = contrastRatio(fg, bg);
          if (ratio < minRatio) {
            const text = String(node.textContent || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 48);
            issues.push(
              `kontras rendah ${label}#${index + 1} (${ratio.toFixed(2)} < ${minRatio.toFixed(1)}) text="${text || '-'}"`
            );
          }
        });
      }

      return {
        issues,
        selectorCounts,
      };
    },
    { inputRules: rules, defaultMinRatio: DEFAULT_MIN_RATIO, requireLightThemeValue: requireLightTheme }
  );
}

async function auditRoute(page, baseUrl, route, assertions) {
  const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const status = Number(response?.status?.() || 0);
  assertions.expect(`${route.name} status`, status > 0 && status < 400, `status=${status}`);

  if (route.readySelector) {
    await page.waitForSelector(route.readySelector, { timeout: 30000, state: 'attached' }).catch(() => {
      assertions.fail(`${route.name} ready selector`, `selector=${route.readySelector}`);
    });
  }

  if (route.openMobileDrawer) {
    await openMobileDrawerIfNeeded(page);
  }

  if (route.requireAnySelectors && route.requireAnySelectors.length) {
    await page
      .waitForFunction(
        (selectors) => {
          function isVisible(element) {
            if (!element) return false;
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          return selectors.some((selector) => {
            const elements = Array.from(document.querySelectorAll(selector));
            return elements.some((element) => isVisible(element));
          });
        },
        route.requireAnySelectors,
        { timeout: Number(route.requireAnyWaitMs || 30000) }
      )
      .catch(() => {
        // Biarkan assertion di bawah yang mengeluarkan error terstruktur.
      });
  }

  const report = await evaluateContrastRules(page, route.rules || [], route.requireLightTheme !== false);
  assertions.expect(`${route.name} contrast rules`, report.issues.length === 0, report.issues.join(' | '));

  if (route.requireAnySelectors && route.requireAnySelectors.length) {
    const found = route.requireAnySelectors.reduce((total, selector) => total + Number(report.selectorCounts?.[selector] || 0), 0);
    assertions.expect(
      `${route.name} selector group exists`,
      found > 0,
      `tidak ada elemen terlihat dari group: ${route.requireAnySelectors.join(', ')}`
    );
  }
}

function createRouteConfig(target, modeLabel) {
  const mobile = modeLabel === 'mobile';
  return {
    publicRoutes: [
      {
        name: `${modeLabel} portal`,
        path: '/forms',
        rules: [...NAV_RULES, { selector: '.portal-page .school-meta', label: 'portal school meta', minRatio: 4.5, minCount: 1 }],
        openMobileDrawer: mobile,
      },
      {
        name: `${modeLabel} admin login`,
        path: '/forms/admin/login',
        rules: [...NAV_RULES],
        openMobileDrawer: mobile,
      },
      {
        name: `${modeLabel} public dashboard`,
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`,
        readySelector: '#dashboard-title',
        rules: [
          ...NAV_RULES,
          {
            selector: '.public-dashboard-page .metric-card p',
            label: 'public dashboard metric text',
            minRatio: 4.5,
            minCount: 1,
            optional: true,
          },
          {
            selector: '.public-dashboard-page .distribution-table td',
            label: 'public dashboard distribution table',
            minRatio: 4.5,
            minCount: 1,
            optional: true,
          },
          {
            selector: '.public-dashboard-page .insufficient-panel p',
            label: 'public dashboard insufficient panel',
            minRatio: 4.5,
            minCount: 1,
            optional: true,
          },
        ],
        requireAnySelectors: ['.public-dashboard-page .distribution-table td', '.public-dashboard-page .insufficient-panel p'],
        openMobileDrawer: mobile,
      },
    ],
    adminRoutes: [
      {
        name: `${modeLabel} superadmin`,
        path: '/forms/admin/',
        readySelector: '#status',
        rules: [
          ...NAV_RULES,
          { selector: '.superadmin-page .status-badge.is-active', label: 'status badge active', minRatio: 4.5, minCount: 1 },
          { selector: '.superadmin-page .status-badge.is-inactive', label: 'status badge inactive', minRatio: 4.5, minCount: 1 },
        ],
        openMobileDrawer: mobile,
      },
      {
        name: `${modeLabel} questionnaire dashboard`,
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`,
        readySelector: '#advanced-viz-chart',
        rules: [
          ...NAV_RULES,
          { selector: '.questionnaire-dashboard-page .dashboard-kpi-card p', label: 'dashboard KPI subtitle', minRatio: 4.5, minCount: 1 },
          {
            selector: '.questionnaire-dashboard-page .advanced-viz-insight-card p',
            label: 'advanced viz insight text',
            minRatio: 4.5,
            minCount: 1,
            optional: true,
          },
          {
            selector: '.questionnaire-dashboard-page .criteria-summary-item p',
            label: 'criteria summary text',
            minRatio: 4.5,
            minCount: 1,
            optional: true,
          },
        ],
        openMobileDrawer: mobile,
      },
      {
        name: `${modeLabel} legacy dashboard`,
        path: '/forms/sman6-kotakupang/admin/dashboard/',
        readySelector: '#kpi-q12',
        rules: [],
        requireLightTheme: false,
        openMobileDrawer: mobile,
      },
    ],
  };
}

async function runAuditSuite({ browser, baseUrl, target, email, password, modeLabel, viewport }) {
  const assertions = createAssertions();
  const context = await createLightModeContext(browser, viewport);
  const page = await context.newPage();

  try {
    assertions.pass(`${modeLabel} mode`, `${baseUrl}`);
    const routes = createRouteConfig(target, modeLabel);

    for (const route of routes.publicRoutes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    await loginAsSuperadmin(page, { baseUrl, email, password });
    for (const route of routes.adminRoutes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    if (assertions.failures.length) {
      throw new Error(`smoke-ux-contrast-aa ${modeLabel} gagal (${assertions.failures.length} issue).`);
    }

    console.log(`[PASS] smoke-ux-contrast-aa ${modeLabel} selesai.`);
  } finally {
    await context.close();
  }
}

async function run() {
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

  try {
    const target = await resolveTargetQuestionnaire(baseUrl);

    await runAuditSuite({
      browser,
      baseUrl,
      target,
      email,
      password,
      modeLabel: 'desktop',
      viewport: { width: 1366, height: 900 },
    });

    await runAuditSuite({
      browser,
      baseUrl,
      target,
      email,
      password,
      modeLabel: 'mobile',
      viewport: { width: 390, height: 844 },
    });

    console.log('[PASS] smoke-ux-contrast-aa selesai (selector kritikal light mode lulus AA).');
  } finally {
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-contrast-aa');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
