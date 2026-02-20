import { LEGACY_SCHOOL_SLUG } from '/forms-static/shared/constants/legacy.js';
import { initThemeRuntime, mountTopNavThemeToggle } from '/forms-static/shared/theme/theme-runtime.js';

const AUTH_STATE_GUEST = 'guest';
const AUTH_STATE_AUTHENTICATED = 'authenticated';
const NAV_MOBILE_MAX_WIDTH = 960;

function safeDecode(segment) {
  try {
    return decodeURIComponent(String(segment || '').trim());
  } catch {
    return String(segment || '').trim();
  }
}

function normalizeAuthState(state) {
  return String(state || '').trim() === AUTH_STATE_AUTHENTICATED ? AUTH_STATE_AUTHENTICATED : AUTH_STATE_GUEST;
}

function resolveFormsContext(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean)
    .map(safeDecode);

  if (parts[0] !== 'forms') {
    return { tenantSlug: '', questionnaireSlug: '' };
  }

  const tenantSlug = String(parts[1] || '').trim();
  if (!tenantSlug || ['admin', 'api', 'forms-static', 'static'].includes(tenantSlug)) {
    return { tenantSlug: '', questionnaireSlug: '' };
  }

  let questionnaireSlug = '';
  const third = String(parts[2] || '').trim();
  if (third === 'admin') {
    if (parts[3] === 'questionnaires' && parts[4]) {
      questionnaireSlug = String(parts[4]).trim();
    }
  } else if (third && !['api', 'forms-static', 'static'].includes(third)) {
    questionnaireSlug = third;
  }

  return { tenantSlug, questionnaireSlug };
}

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle('is-hidden', Boolean(hidden));
}

function ensureDrawerId(navRoot, index = 0) {
  const toggle = navRoot.querySelector('.global-nav__menu-toggle');
  const drawer = navRoot.querySelector('.global-nav__drawer');
  if (!toggle || !drawer) return;

  if (!drawer.id) {
    drawer.id = `global-nav-drawer-${index + 1}`;
  }
  toggle.setAttribute('aria-controls', drawer.id);
  if (!toggle.hasAttribute('aria-expanded')) {
    toggle.setAttribute('aria-expanded', 'false');
  }
}

function createLink(href, text, classNames = '') {
  const link = document.createElement('a');
  link.href = href;
  link.className = `global-nav__link ${classNames}`.trim();
  link.textContent = text;
  return link;
}

function createLogoutButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'global-nav__logout is-hidden';
  button.textContent = 'Logout';
  return button;
}

function createThemeSlot() {
  const slot = document.createElement('span');
  slot.className = 'global-nav__theme-slot';
  slot.setAttribute('data-theme-toggle', '');
  return slot;
}

function ensureNavStructure() {
  const navRoots = Array.from(document.querySelectorAll('.global-nav'));

  navRoots.forEach((navRoot, index) => {
    navRoot.dataset.authState = normalizeAuthState(navRoot.dataset.authState);
    navRoot.dataset.navOpen = String(navRoot.dataset.navOpen || 'false').trim() === 'true' ? 'true' : 'false';

    const inner = navRoot.querySelector('.global-nav__inner');
    if (!inner) return;

    const hasStructuredGroups = Boolean(inner.querySelector('.global-nav__group'));
    if (!hasStructuredGroups) {
      const brand = inner.querySelector('.global-nav__brand') || createLink('/forms', 'AITI Forms Portal', 'global-nav__brand');

      const formLink = inner.querySelector('[data-nav-link="form"]') || createLink('#', 'Form Publik', 'is-hidden');
      formLink.setAttribute('data-nav-link', 'form');
      formLink.classList.add('is-hidden');

      const panelLink = inner.querySelector('[data-nav-link="panel"]') || createLink('#', 'Panel Organisasi', 'is-hidden');
      panelLink.setAttribute('data-nav-link', 'panel');
      panelLink.classList.add('is-hidden');

      const dashboardLink = inner.querySelector('[data-nav-link="dashboard"]') || createLink('#', 'Dashboard', 'is-hidden');
      dashboardLink.setAttribute('data-nav-link', 'dashboard');
      dashboardLink.classList.add('is-hidden');

      const loginLink =
        inner.querySelector('.global-nav__link--login') ||
        Array.from(inner.querySelectorAll('.global-nav__link')).find((el) => String(el.getAttribute('href') || '').trim() === '/forms/admin/login') ||
        createLink('/forms/admin/login', 'Admin Login', 'global-nav__link--login');
      loginLink.classList.add('global-nav__link--login');

      const superadminLink =
        inner.querySelector('.global-nav__link--superadmin') ||
        Array.from(inner.querySelectorAll('.global-nav__link')).find((el) => String(el.getAttribute('href') || '').trim() === '/forms/admin/') ||
        createLink('/forms/admin/', 'Superadmin', 'global-nav__link--superadmin');
      superadminLink.classList.add('global-nav__link--superadmin');

      const themeSlot =
        inner.querySelector('.global-nav__theme-slot') ||
        inner.querySelector('[data-theme-toggle]') ||
        createThemeSlot();
      themeSlot.classList.add('global-nav__theme-slot');
      themeSlot.setAttribute('data-theme-toggle', '');

      const logoutButton = inner.querySelector('.global-nav__logout') || createLogoutButton();
      logoutButton.classList.add('global-nav__logout', 'is-hidden');

      const primaryGroup = document.createElement('div');
      primaryGroup.className = 'global-nav__group global-nav__group--primary';
      primaryGroup.append(brand);

      const contextGroup = document.createElement('div');
      contextGroup.className = 'global-nav__group global-nav__group--context is-hidden';
      contextGroup.append(formLink, panelLink, dashboardLink);

      const utilityGroup = document.createElement('div');
      utilityGroup.className = 'global-nav__group global-nav__group--utility';
      utilityGroup.append(loginLink, superadminLink, themeSlot, logoutButton);

      const drawer = document.createElement('div');
      drawer.className = 'global-nav__drawer';
      drawer.append(contextGroup, utilityGroup);

      const menuToggle = document.createElement('button');
      menuToggle.className = 'global-nav__menu-toggle';
      menuToggle.type = 'button';
      menuToggle.textContent = 'Menu';
      menuToggle.setAttribute('aria-label', 'Buka menu navigasi');
      menuToggle.setAttribute('aria-expanded', 'false');

      inner.replaceChildren(primaryGroup, menuToggle, drawer);
    }

    const utilityGroup = inner.querySelector('.global-nav__group--utility');
    if (utilityGroup) {
      let loginLink = utilityGroup.querySelector('.global-nav__link--login');
      if (!loginLink) {
        loginLink =
          Array.from(utilityGroup.querySelectorAll('.global-nav__link')).find(
            (el) => String(el.getAttribute('href') || '').trim() === '/forms/admin/login'
          ) || createLink('/forms/admin/login', 'Admin Login', 'global-nav__link--login');
        loginLink.classList.add('global-nav__link--login');
        utilityGroup.prepend(loginLink);
      }

      let superadminLink = utilityGroup.querySelector('.global-nav__link--superadmin');
      if (!superadminLink) {
        superadminLink =
          Array.from(utilityGroup.querySelectorAll('.global-nav__link')).find((el) => String(el.getAttribute('href') || '').trim() === '/forms/admin/') ||
          createLink('/forms/admin/', 'Superadmin', 'global-nav__link--superadmin');
        superadminLink.classList.add('global-nav__link--superadmin');
        loginLink.insertAdjacentElement('afterend', superadminLink);
      }

      let themeSlot = utilityGroup.querySelector('.global-nav__theme-slot');
      if (!themeSlot) {
        themeSlot = createThemeSlot();
        superadminLink.insertAdjacentElement('afterend', themeSlot);
      }

      let logoutButton = utilityGroup.querySelector('.global-nav__logout');
      if (!logoutButton) {
        logoutButton = createLogoutButton();
        utilityGroup.append(logoutButton);
      }
      logoutButton.classList.add('is-hidden');
    }

    ensureDrawerId(navRoot, index);
  });
}

async function resolveQuestionnaireLinks(tenantSlug, preferredQuestionnaireSlug = '') {
  if (!tenantSlug) {
    return {
      publicLink: '',
      dashboardLink: '',
    };
  }

  const preferred = String(preferredQuestionnaireSlug || '').trim();
  if (tenantSlug === LEGACY_SCHOOL_SLUG) {
    return {
      publicLink: `/forms/${tenantSlug}/`,
      dashboardLink: `/forms/${tenantSlug}/admin/dashboard/`,
    };
  }

  if (preferred) {
    return {
      publicLink: `/forms/${tenantSlug}/${preferred}/`,
      dashboardLink: `/forms/${tenantSlug}/admin/questionnaires/${preferred}/dashboard/`,
    };
  }

  try {
    const response = await fetch(`/forms/${tenantSlug}/api/questionnaires/public`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        publicLink: `/forms/${tenantSlug}/`,
        dashboardLink: `/forms/${tenantSlug}/admin/`,
      };
    }
    const list = Array.isArray(payload.data) ? payload.data : [];
    if (!list.length) {
      return {
        publicLink: `/forms/${tenantSlug}/`,
        dashboardLink: `/forms/${tenantSlug}/admin/`,
      };
    }
    const first = list.find((item) => item.isDefault) || list[0];
    if (!first?.slug) {
      return {
        publicLink: `/forms/${tenantSlug}/`,
        dashboardLink: `/forms/${tenantSlug}/admin/`,
      };
    }
    return {
      publicLink: `/forms/${tenantSlug}/${first.slug}/`,
      dashboardLink: `/forms/${tenantSlug}/admin/questionnaires/${first.slug}/dashboard/`,
    };
  } catch {
    return {
      publicLink: `/forms/${tenantSlug}/`,
      dashboardLink: `/forms/${tenantSlug}/admin/`,
    };
  }
}

async function updateContextLinks() {
  const context = resolveFormsContext(window.location.pathname);
  const tenantSlug = context.tenantSlug;
  const navRoots = Array.from(document.querySelectorAll('.global-nav'));

  if (!navRoots.length) return;

  let links = {
    publicLink: '',
    dashboardLink: '',
  };

  if (tenantSlug) {
    links = await resolveQuestionnaireLinks(tenantSlug, context.questionnaireSlug);
  }

  navRoots.forEach((navRoot) => {
    const formLink = navRoot.querySelector('[data-nav-link="form"]');
    const panelLink = navRoot.querySelector('[data-nav-link="panel"]');
    const dashboardLink = navRoot.querySelector('[data-nav-link="dashboard"]');
    const contextGroup = navRoot.querySelector('.global-nav__group--context');

    const contextualLinks = [formLink, panelLink, dashboardLink].filter(Boolean);
    contextualLinks.forEach((element) => {
      if (!tenantSlug) {
        setHidden(element, true);
        return;
      }
      setHidden(element, false);
    });

    if (tenantSlug) {
      if (panelLink) panelLink.href = `/forms/${tenantSlug}/admin/`;
      if (dashboardLink) dashboardLink.href = links.dashboardLink || `/forms/${tenantSlug}/admin/`;
      if (formLink) formLink.href = links.publicLink || `/forms/${tenantSlug}/`;
    }

    if (contextGroup) {
      const hasVisibleContext = contextualLinks.some((element) => !element.classList.contains('is-hidden'));
      setHidden(contextGroup, !hasVisibleContext);
    }
  });
}

async function resolveAuthState() {
  try {
    const response = await fetch('/forms/admin/api/me', {
      credentials: 'include',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!response.ok) return AUTH_STATE_GUEST;
    return AUTH_STATE_AUTHENTICATED;
  } catch {
    return AUTH_STATE_GUEST;
  }
}

function applyAuthState(authState) {
  const normalized = normalizeAuthState(authState);
  const navRoots = Array.from(document.querySelectorAll('.global-nav'));

  navRoots.forEach((navRoot) => {
    navRoot.dataset.authState = normalized;
    const loginLink = navRoot.querySelector('.global-nav__link--login');
    const logoutButtons = Array.from(navRoot.querySelectorAll('.global-nav__logout'));

    const showLogout = normalized === AUTH_STATE_AUTHENTICATED;
    setHidden(loginLink, showLogout);
    logoutButtons.forEach((button) => setHidden(button, !showLogout));
  });
}

async function logoutFromTopNav() {
  try {
    await fetch('/forms/admin/api/logout', {
      method: 'POST',
    });
  } catch {
    // ignore
  } finally {
    window.location.href = '/forms/admin/login';
  }
}

function bindLogoutButtons() {
  const buttons = document.querySelectorAll('.global-nav__logout');
  buttons.forEach((button) => {
    if (button.dataset.navLogoutBound === 'true') return;
    button.dataset.navLogoutBound = 'true';
    button.addEventListener('click', logoutFromTopNav);
  });
}

function setNavOpen(navRoot, open) {
  const next = open ? 'true' : 'false';
  navRoot.dataset.navOpen = next;
  const toggle = navRoot.querySelector('.global-nav__menu-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

function bindNavDrawers() {
  const navRoots = Array.from(document.querySelectorAll('.global-nav'));

  navRoots.forEach((navRoot) => {
    if (navRoot.dataset.navDrawerBound === 'true') return;

    const toggle = navRoot.querySelector('.global-nav__menu-toggle');
    const drawer = navRoot.querySelector('.global-nav__drawer');
    if (!toggle || !drawer) return;

    navRoot.dataset.navDrawerBound = 'true';

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const currentlyOpen = navRoot.dataset.navOpen === 'true';
      setNavOpen(navRoot, !currentlyOpen);
    });

    drawer.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('a, button') : null;
      if (!target) return;
      if (window.innerWidth > NAV_MOBILE_MAX_WIDTH) return;
      setNavOpen(navRoot, false);
    });

    document.addEventListener('click', (event) => {
      if (navRoot.dataset.navOpen !== 'true') return;
      const target = event.target;
      if (target instanceof Node && navRoot.contains(target)) return;
      setNavOpen(navRoot, false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (navRoot.dataset.navOpen !== 'true') return;
      setNavOpen(navRoot, false);
      toggle.focus();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > NAV_MOBILE_MAX_WIDTH && navRoot.dataset.navOpen === 'true') {
        setNavOpen(navRoot, false);
      }
    });
  });
}

async function initTopNav() {
  ensureNavStructure();
  bindNavDrawers();

  initThemeRuntime();
  mountTopNavThemeToggle();

  const [authState] = await Promise.all([resolveAuthState(), updateContextLinks()]);
  applyAuthState(authState);
  bindLogoutButtons();
}

initTopNav();
