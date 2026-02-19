import { LEGACY_SCHOOL_SLUG } from '/forms-static/shared/constants/legacy.js';

function safeDecode(segment) {
  try {
    return decodeURIComponent(String(segment || '').trim());
  } catch {
    return String(segment || '').trim();
  }
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
  const formLink = document.querySelector('[data-nav-link="form"]');
  const panelLink = document.querySelector('[data-nav-link="panel"]');
  const dashboardLink = document.querySelector('[data-nav-link="dashboard"]');

  const contextualLinks = [formLink, panelLink, dashboardLink].filter(Boolean);
  contextualLinks.forEach((element) => {
    if (!tenantSlug) {
      element.classList.add('is-hidden');
      return;
    }
    element.classList.remove('is-hidden');
  });

  if (tenantSlug) {
    if (panelLink) panelLink.href = `/forms/${tenantSlug}/admin/`;
    const links = await resolveQuestionnaireLinks(tenantSlug, context.questionnaireSlug);
    if (dashboardLink) dashboardLink.href = links.dashboardLink || `/forms/${tenantSlug}/admin/`;
    if (formLink) formLink.href = links.publicLink || `/forms/${tenantSlug}/`;
  }
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
    button.addEventListener('click', logoutFromTopNav);
  });
}

updateContextLinks();
bindLogoutButtons();
