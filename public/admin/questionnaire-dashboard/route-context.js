export function parseDashboardRouteContext(pathname = window.location.pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  const formsIndex = parts.indexOf('forms');
  if (formsIndex === -1) {
    throw new Error('Route dashboard tidak valid.');
  }

  const tenantSlug = parts[formsIndex + 1];
  const questionnaireSlug = parts[formsIndex + 4];
  if (!tenantSlug || !questionnaireSlug) {
    throw new Error('Slug organisasi atau kuesioner tidak ditemukan.');
  }
  return { tenantSlug, questionnaireSlug };
}

export function createDashboardBaseApiPathResolver(state) {
  return function baseApiPath() {
    return `/forms/${encodeURIComponent(state.tenantSlug)}/admin/api/questionnaires/${encodeURIComponent(state.questionnaireSlug)}`;
  };
}
