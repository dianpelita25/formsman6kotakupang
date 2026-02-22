import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_LANGUAGE_ID_PORT || 8908);

const FORBIDDEN_PATTERNS = [
  { label: 'Admin Login', regex: /\bAdmin Login\b/i },
  { label: 'Logout', regex: /\bLogout\b/i },
  { label: 'Superadmin', regex: /\bSuperadmin\b/i },
  { label: 'Questionnaire Manager', regex: /\bQuestionnaire Manager\b/i },
  { label: 'Prompt AI Manager', regex: /\bPrompt AI Manager\b/i },
  { label: 'Scope', regex: /\bScope\b/i },
  { label: 'tenant override', regex: /\btenant override\b/i },
  { label: 'questionnaire override', regex: /\bquestionnaire override\b/i },
  { label: 'Draft Template', regex: /\bDraft Template\b/i },
  { label: 'Publish', regex: /\bPublish\b/i },
  { label: 'Published', regex: /\bPublished\b/i },
  { label: 'Reset ke Published', regex: /\bReset ke Published\b/i },
  { label: 'Refresh', regex: /\bRefresh\b/i },
  { label: 'Effective Prompt (Aktif Digunakan)', regex: /Effective Prompt\s*\(Aktif Digunakan\)/i },
  { label: 'Total Questionnaire', regex: /Total Questionnaire/i },
  { label: '[default]', regex: /\[default\]/i },
  { label: 'Aggregate only', regex: /Aggregate only/i },
  { label: 'minSample', regex: /\bminSample\b/i },
  { label: 'minBucket', regex: /\bminBucket\b/i },
];

const ORG_TYPE_OPTIONS_EXPECTED = ['Sekolah', 'Pemerintah', 'Usaha', 'Kelas', 'Komunitas', 'Event', 'Lainnya'];
const PROMPT_SCOPE_OPTIONS_EXPECTED = ['Global', 'Override Organisasi', 'Override Kuesioner'];

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_LANGUAGE_ID_BASE_URL || '').trim();
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

  throw new Error('Tidak ada tenant dengan kuesioner publik untuk audit bahasa.');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function collectUiText(page) {
  return await page.evaluate(() => {
    const selectors = ['h1', 'h2', 'h3', 'label', 'button', 'a', 'th', 'summary', 'p', '.status-badge'];
    const excludedSelectors = [
      '#activity-feed',
      '#tenants-body',
      '#questionnaire-list-body',
      '#responses-body',
      '#prompt-history-body',
      '#school-grid',
      '#error-debug',
      '#portal-error-debug',
      '#status-debug',
      '#ai-output',
      '#prompt-effective',
      '#status',
      '#prompt-status',
      '#dashboard-status',
      '#dashboard-inline-status',
    ];

    const excludedRoots = excludedSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

    function isHidden(element) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return true;
      }
      const rect = element.getBoundingClientRect();
      return rect.width <= 0 || rect.height <= 0;
    }

    function isExcluded(element) {
      return excludedRoots.some((root) => root === element || root.contains(element));
    }

    const fragments = [];
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (isExcluded(node)) continue;
        if (isHidden(node)) continue;
        const value = String(node.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!value) continue;
        fragments.push(value);
      }
    }

    const optionFragments = [];
    const selects = Array.from(document.querySelectorAll('select'));
    for (const select of selects) {
      if (isExcluded(select)) continue;
      if (isHidden(select)) continue;
      const options = Array.from(select.options || []);
      for (const option of options) {
        const value = String(option.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!value) continue;
        optionFragments.push(value);
      }
    }

    return {
      text: fragments.join('\n'),
      options: optionFragments,
    };
  });
}

function findForbiddenMatches(text) {
  const normalized = normalizeText(text);
  const hits = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    hits.push(`${pattern.label}="${String(match[0] || '').trim()}"`);
  }
  return hits;
}

async function openMobileDrawerIfNeeded(page) {
  const menuToggle = page.locator('.global-nav__menu-toggle').first();
  if ((await menuToggle.count()) === 0) return;
  const visible = await menuToggle.isVisible().catch(() => false);
  if (!visible) return;
  const expanded = String((await menuToggle.getAttribute('aria-expanded')) || '').trim();
  if (expanded === 'true') return;
  await menuToggle.click();
  await page.waitForTimeout(180);
}

async function assertSelectOptions(page, selector, expected, assertions, routeName) {
  const result = await page.evaluate(
    ({ selectorValue }) => {
      const select = document.querySelector(selectorValue);
      if (!select) return { found: false, options: [] };
      const options = Array.from(select.querySelectorAll('option')).map((option) =>
        String(option.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
      );
      return { found: true, options };
    },
    { selectorValue: selector }
  );

  assertions.expect(`${routeName} ${selector} exists`, result.found, 'select tidak ditemukan');
  if (!result.found) return;

  const missing = expected.filter((label) => !result.options.includes(label));
  assertions.expect(
    `${routeName} ${selector} opsi Indonesia`,
    missing.length === 0,
    `missing=${missing.join(', ')}, actual=${result.options.join(' | ')}`
  );
}

async function auditRoute(page, baseUrl, route, assertions) {
  const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const status = Number(response?.status?.() || 0);
  assertions.expect(`${route.name} status`, status > 0 && status < 400, `status=${status}`);

  if (route.openMobileDrawer) {
    await openMobileDrawerIfNeeded(page);
  }

  if (route.readySelector) {
    await page.waitForSelector(route.readySelector, { timeout: 30000, state: 'attached' }).catch(() => {
      assertions.fail(`${route.name} ready selector`, `selector=${route.readySelector}`);
    });
  }

  const report = await collectUiText(page);
  const matches = findForbiddenMatches(`${report.text}\n${toArray(report.options).join('\n')}`);
  assertions.expect(`${route.name} no forbidden EN labels`, matches.length === 0, matches.join(' | '));

  if (route.validateOrgTypeOptions) {
    await assertSelectOptions(page, '#tenant-type', ORG_TYPE_OPTIONS_EXPECTED, assertions, route.name);
  }
  if (route.validatePromptScopeOptions) {
    await assertSelectOptions(page, '#prompt-scope', PROMPT_SCOPE_OPTIONS_EXPECTED, assertions, route.name);
  }
}

async function runAuditSuite({ browser, baseUrl, target, email, password, viewport, modeLabel }) {
  const assertions = createAssertions();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    assertions.pass(`${modeLabel} mode`, `${baseUrl}`);

    const publicRoutes = [
      { name: `${modeLabel} portal`, path: '/forms', openMobileDrawer: modeLabel === 'mobile' },
      { name: `${modeLabel} admin login`, path: '/forms/admin/login', openMobileDrawer: modeLabel === 'mobile' },
      {
        name: `${modeLabel} public form`,
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
        readySelector: '#feedback-form',
        openMobileDrawer: modeLabel === 'mobile',
      },
      {
        name: `${modeLabel} public dashboard`,
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/dashboard/`,
        readySelector: '#dashboard-title',
        openMobileDrawer: modeLabel === 'mobile',
      },
    ];

    for (const route of publicRoutes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    await loginAsSuperadmin(page, { baseUrl, email, password });

    const adminRoutes = [
      {
        name: `${modeLabel} superadmin`,
        path: '/forms/admin/',
        readySelector: '#status',
        openMobileDrawer: modeLabel === 'mobile',
        validateOrgTypeOptions: true,
        validatePromptScopeOptions: true,
      },
      {
        name: `${modeLabel} tenant admin`,
        path: `/forms/${target.tenantSlug}/admin/`,
        readySelector: '#status',
        openMobileDrawer: modeLabel === 'mobile',
      },
      {
        name: `${modeLabel} questionnaire builder`,
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`,
        readySelector: '#question-list',
        openMobileDrawer: modeLabel === 'mobile',
      },
      {
        name: `${modeLabel} questionnaire dashboard`,
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`,
        readySelector: '#advanced-viz-chart',
        openMobileDrawer: modeLabel === 'mobile',
      },
      {
        name: `${modeLabel} legacy dashboard`,
        path: '/forms/sman6-kotakupang/admin/dashboard/',
        readySelector: '#kpi-q12',
        openMobileDrawer: modeLabel === 'mobile',
      },
    ];

    for (const route of adminRoutes) {
      await auditRoute(page, baseUrl, route, assertions);
    }

    if (assertions.failures.length) {
      throw new Error(`smoke-ux-language-id ${modeLabel} gagal (${assertions.failures.length} issue).`);
    }
    console.log(`[PASS] smoke-ux-language-id ${modeLabel} selesai.`);
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
      viewport: { width: 1366, height: 900 },
      modeLabel: 'desktop',
    });

    await runAuditSuite({
      browser,
      baseUrl,
      target,
      email,
      password,
      viewport: { width: 390, height: 844 },
      modeLabel: 'mobile',
    });

    console.log('[PASS] smoke-ux-language-id selesai tanpa campuran label Inggris terlarang.');
  } finally {
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-language-id');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
