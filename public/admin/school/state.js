import { LEGACY_SCHOOL_SLUG } from '/forms-static/shared/constants/legacy.js';

export { LEGACY_SCHOOL_SLUG };

export function createSchoolAdminState() {
  return {
    tenantSlug: '',
    questionnaireItems: [],
    legacyCompatEnabled: false,
  };
}

export function parseTenantSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] || '';
}
