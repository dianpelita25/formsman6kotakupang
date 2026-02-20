import { normalizeUiError, requestJson } from '/forms-static/shared/ux.js';
import { LEGACY_SCHOOL_SLUG } from './state.js';

export function questionnaireBuilderLink(state, questionnaireSlug) {
  return `/forms/${state.tenantSlug}/admin/questionnaires/${questionnaireSlug}/builder/`;
}

export function questionnaireDashboardLink(state, questionnaireSlug) {
  if (state.tenantSlug === LEGACY_SCHOOL_SLUG) {
    return `/forms/${state.tenantSlug}/admin/dashboard/`;
  }
  return `/forms/${state.tenantSlug}/admin/questionnaires/${questionnaireSlug}/dashboard/`;
}

export function questionnairePublicLink(state, questionnaireSlug) {
  if (state.tenantSlug === LEGACY_SCHOOL_SLUG) {
    return `/forms/${state.tenantSlug}/`;
  }
  return `/forms/${state.tenantSlug}/${questionnaireSlug}/`;
}

export function createSchoolAdminApi({ state, setStatus, setError, pushActivity } = {}) {
  function basePath() {
    return `/forms/${encodeURIComponent(state.tenantSlug)}/admin/api`;
  }

  function api(path, options, actionLabel) {
    return requestJson(path, options).catch((error) => {
      const normalized = normalizeUiError(error, 'Terjadi kesalahan.');
      setStatus(normalized.message, 'error');
      setError(error);
      pushActivity('error', actionLabel, normalized.message);
      throw error;
    });
  }

  return {
    basePath,
    api,
  };
}
