import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_CONTRAST_NAV_PORT || 8905);
const MIN_CONTRAST_RATIO = 4.5;

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_CONTRAST_NAV_BASE_URL || '').trim();
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

  throw new Error('Tidak ada tenant dengan questionnaire publik untuk smoke contrast/nav.');
}

async function createLightModeContext(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('aiti_theme_preference_v1', 'light');
    } catch {
      // ignore
    }
  });
  return context;
}

async function evaluateUiRules(page, options) {
  return await page.evaluate((input) => {
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
      if (alpha <= 0) {
        return { r: 255, g: 255, b: 255, a: 1 };
      }
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
        a: alpha,
      };
    }

    function resolveBackgroundColor(element) {
      if (!element) {
        return { r: 255, g: 255, b: 255, a: 1 };
      }
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
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    const issues = [];

    if (input.checkThemeLight) {
      const explicitTheme = String(document.documentElement.getAttribute('data-theme') || '').trim();
      if (explicitTheme !== 'light') {
        issues.push(`theme bukan light (data-theme=${explicitTheme || '<empty>'})`);
      }
    }

    if (input.checkOverflow) {
      const de = document.documentElement;
      const body = document.body;
      const docOverflow = de.scrollWidth > de.clientWidth;
      const bodyOverflow = body.scrollWidth > body.clientWidth;
      if (docOverflow || bodyOverflow) {
        issues.push(`overflow doc=${de.scrollWidth}/${de.clientWidth}, body=${body.scrollWidth}/${body.clientWidth}`);
      }
    }

    if (input.checkDesktopNav) {
      const nav = document.querySelector('.global-nav');
      const navInner = document.querySelector('.global-nav__inner');
      if (!nav || !navInner) {
        issues.push('global nav tidak ditemukan');
      } else {
        const rows = new Set(
          Array.from(navInner.children)
            .filter((node) => isVisible(node))
            .map((node) => Math.round(node.getBoundingClientRect().top))
        );
        if (rows.size > 1) {
          issues.push(`desktop nav multi-row (${rows.size} baris)`);
        }

        const login = nav.querySelector('.global-nav__link--login');
        const logout = nav.querySelector('.global-nav__logout');
        if (isVisible(login) && isVisible(logout)) {
          issues.push('link Login dan Logout terlihat bersamaan');
        }
      }
    }

    const selectors = Array.isArray(input.contrastSelectors) ? input.contrastSelectors : [];
    selectors.forEach((entry) => {
      const selector = String(entry?.selector || '').trim();
      if (!selector) return;
      const label = String(entry?.label || selector);
      const minRatio = Number(entry?.minRatio) || 4.5;
      const element = document.querySelector(selector);
      if (!element) {
        issues.push(`selector kontras tidak ditemukan: ${label}`);
        return;
      }
      const style = getComputedStyle(element);
      const textColor = parseColor(style.color);
      if (!textColor) {
        issues.push(`warna teks tidak bisa diparse: ${label}`);
        return;
      }
      const bgColor = resolveBackgroundColor(element);
      const ratio = contrastRatio(textColor, bgColor);
      if (ratio < minRatio) {
        issues.push(`kontras rendah ${label} (${ratio.toFixed(2)} < ${minRatio})`);
      }
    });

    return {
      issues,
    };
  }, options);
}

async function openRoute(page, baseUrl, route, assertions) {
  const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const status = Number(response?.status?.() || 0);
  assertions.expect(`${route.name} status`, status > 0 && status < 400, `status=${status}`);

  if (route.beforeCheck) {
    await route.beforeCheck(page);
  }

  const report = await evaluateUiRules(page, {
    checkThemeLight: Boolean(route.checkThemeLight),
    checkOverflow: Boolean(route.checkOverflow),
    checkDesktopNav: Boolean(route.checkDesktopNav),
    contrastSelectors: route.contrastSelectors || [],
  });

  assertions.expect(`${route.name} ui rules`, report.issues.length === 0, report.issues.join(' | '));
}

async function checkMobileDrawer(page, baseUrl, path, assertions) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const status = Number(response?.status?.() || 0);
  assertions.expect('mobile drawer route status', status > 0 && status < 400, `status=${status}`);

  const toggle = page.locator('.global-nav__menu-toggle').first();
  const exists = (await page.locator('.global-nav__menu-toggle').count()) > 0;
  assertions.expect('mobile menu toggle exists', exists, 'selector .global-nav__menu-toggle tidak ditemukan');
  if (!exists) return;

  const visible = await toggle.isVisible().catch(() => false);
  assertions.expect('mobile menu toggle visible', visible, 'toggle tidak terlihat di mobile');
  if (!visible) return;

  const initial = await page.evaluate(() => {
    const nav = document.querySelector('.global-nav');
    const drawer = document.querySelector('.global-nav__drawer');
    const toggle = document.querySelector('.global-nav__menu-toggle');
    const de = document.documentElement;
    const body = document.body;
    const style = drawer ? getComputedStyle(drawer).display : 'none';
    return {
      navOpen: nav?.dataset?.navOpen || '',
      ariaExpanded: toggle?.getAttribute('aria-expanded') || '',
      drawerDisplay: style,
      docOverflow: de.scrollWidth > de.clientWidth,
      bodyOverflow: body.scrollWidth > body.clientWidth,
      docSize: `${de.scrollWidth}/${de.clientWidth}`,
      bodySize: `${body.scrollWidth}/${body.clientWidth}`,
    };
  });

  assertions.expect('mobile drawer initial closed', initial.navOpen !== 'true' && initial.ariaExpanded !== 'true', `navOpen=${initial.navOpen}, aria=${initial.ariaExpanded}`);
  assertions.expect(
    'mobile no overflow',
    !initial.docOverflow && !initial.bodyOverflow,
    `doc=${initial.docSize}, body=${initial.bodySize}`
  );

  await toggle.click();
  await page.waitForTimeout(150);

  const opened = await page.evaluate(() => {
    const nav = document.querySelector('.global-nav');
    const drawer = document.querySelector('.global-nav__drawer');
    const toggle = document.querySelector('.global-nav__menu-toggle');
    return {
      navOpen: nav?.dataset?.navOpen || '',
      ariaExpanded: toggle?.getAttribute('aria-expanded') || '',
      drawerDisplay: drawer ? getComputedStyle(drawer).display : 'none',
    };
  });

  assertions.expect(
    'mobile drawer opens',
    opened.navOpen === 'true' && opened.ariaExpanded === 'true' && opened.drawerDisplay !== 'none',
    `navOpen=${opened.navOpen}, aria=${opened.ariaExpanded}, display=${opened.drawerDisplay}`
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  const afterEsc = await page.evaluate(() => {
    const nav = document.querySelector('.global-nav');
    const drawer = document.querySelector('.global-nav__drawer');
    const toggle = document.querySelector('.global-nav__menu-toggle');
    return {
      navOpen: nav?.dataset?.navOpen || '',
      ariaExpanded: toggle?.getAttribute('aria-expanded') || '',
      drawerDisplay: drawer ? getComputedStyle(drawer).display : 'none',
    };
  });

  assertions.expect(
    'mobile drawer closes on Esc',
    afterEsc.navOpen !== 'true' && afterEsc.ariaExpanded !== 'true' && afterEsc.drawerDisplay === 'none',
    `navOpen=${afterEsc.navOpen}, aria=${afterEsc.ariaExpanded}, display=${afterEsc.drawerDisplay}`
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

  const email = getRequiredEnv('SUPERADMIN_EMAIL');
  const password = getRequiredEnv('SUPERADMIN_PASSWORD');

  const localServer = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : localServer.baseUrl;
  const browser = await launchBrowser();

  const desktopContext = await createLightModeContext(browser, { width: 1366, height: 900 });
  const desktopPage = await desktopContext.newPage();

  const mobileContext = await createLightModeContext(browser, { width: 390, height: 844 });
  const mobilePage = await mobileContext.newPage();

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);

    const target = await resolveTargetQuestionnaire(baseUrl);

    const publicDesktopRoutes = [
      {
        name: 'desktop portal',
        path: '/forms',
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: true,
      },
      {
        name: 'desktop admin login',
        path: '/forms/admin/login',
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: true,
      },
      {
        name: 'desktop public form contrast',
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: false,
        contrastSelectors: [
          { selector: '.greeting-block h2', label: 'greeting heading', minRatio: MIN_CONTRAST_RATIO },
          { selector: '.greeting-block p', label: 'greeting paragraph', minRatio: MIN_CONTRAST_RATIO },
        ],
      },
    ];

    for (const route of publicDesktopRoutes) {
      await openRoute(desktopPage, baseUrl, route, assertions);
    }

    await loginAsSuperadmin(desktopPage, { baseUrl, email, password });
    assertions.pass('desktop login', 'superadmin authenticated');

    const adminDesktopRoutes = [
      {
        name: 'desktop superadmin',
        path: '/forms/admin/',
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: true,
      },
      {
        name: 'desktop tenant admin',
        path: `/forms/${target.tenantSlug}/admin/`,
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: true,
      },
      {
        name: 'desktop builder contrast',
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`,
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: true,
        beforeCheck: async (page) => {
          const previewStep = page.locator('[data-step-target="pratinjau"]').first();
          if ((await previewStep.count()) > 0) {
            await previewStep.click();
            await page.waitForTimeout(250);
          }
        },
        contrastSelectors: [
          { selector: '#preview-title', label: 'builder preview title', minRatio: MIN_CONTRAST_RATIO },
          { selector: '#preview-greeting-title', label: 'builder preview greeting title', minRatio: MIN_CONTRAST_RATIO },
          { selector: '#preview-greeting-text', label: 'builder preview greeting text', minRatio: MIN_CONTRAST_RATIO },
        ],
      },
      {
        name: 'desktop modern dashboard',
        path: `/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`,
        checkThemeLight: true,
        checkOverflow: true,
        checkDesktopNav: true,
      },
    ];

    for (const route of adminDesktopRoutes) {
      await openRoute(desktopPage, baseUrl, route, assertions);
    }

    await checkMobileDrawer(mobilePage, baseUrl, '/forms', assertions);

    const mobileRoutes = [
      {
        name: 'mobile admin login',
        path: '/forms/admin/login',
        checkThemeLight: true,
        checkOverflow: true,
      },
      {
        name: 'mobile public form',
        path: `/forms/${target.tenantSlug}/${target.questionnaireSlug}/`,
        checkThemeLight: true,
        checkOverflow: true,
      },
    ];

    for (const route of mobileRoutes) {
      await openRoute(mobilePage, baseUrl, route, assertions);
    }

    if (assertions.failures.length) {
      throw new Error(`smoke-ux-contrast-nav gagal (${assertions.failures.length} issue).`);
    }

    console.log('[PASS] smoke-ux-contrast-nav selesai tanpa pelanggaran kontras/nav residual rules.');
  } finally {
    await desktopContext.close();
    await mobileContext.close();
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-contrast-nav');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
