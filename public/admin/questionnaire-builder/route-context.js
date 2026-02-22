import { LEGACY_SCHOOL_SLUG } from '/forms-static/shared/constants/legacy.js';

export { LEGACY_SCHOOL_SLUG };

export function parseBuilderRouteContext(pathname = window.location.pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const formsIndex = parts.indexOf('forms');
  if (formsIndex === -1) throw new Error('Route tidak valid.');

  const tenantSlug = parts[formsIndex + 1];
  const questionnaireSlug = parts[formsIndex + 4];
  if (!tenantSlug || !questionnaireSlug) {
    throw new Error('Slug organisasi atau kuesioner tidak ditemukan di URL.');
  }

  return { tenantSlug, questionnaireSlug };
}

export function buildBuilderBaseApiPath(state) {
  return `/forms/${encodeURIComponent(state.tenantSlug)}/admin/api/questionnaires/${encodeURIComponent(state.questionnaireSlug)}`;
}

export function buildBuilderPublicFormPath(state) {
  return `/forms/${encodeURIComponent(state.tenantSlug)}/${encodeURIComponent(state.questionnaireSlug)}/`;
}

export function buildBuilderDashboardPath(state) {
  return state.tenantSlug === LEGACY_SCHOOL_SLUG
    ? `/forms/${state.tenantSlug}/admin/dashboard/`
    : `/forms/${state.tenantSlug}/admin/questionnaires/${state.questionnaireSlug}/dashboard/`;
}
