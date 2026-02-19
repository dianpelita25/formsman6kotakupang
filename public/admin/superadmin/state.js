import { LEGACY_SCHOOL_SLUG } from '/forms-static/shared/constants/legacy.js';

export const MODE_LABELS = Object.freeze({
  internal: 'Internal',
  external_pemerintah: 'External Pemerintah',
  external_mitra: 'External Mitra',
  live_guru: 'Live Guru',
});
export { LEGACY_SCHOOL_SLUG };

export function createSuperadminState({ createActivityFeed, activityFeedEl }) {
  return {
    tenantCache: [],
    questionnaireCache: [],
    promptBundleCache: null,
    activeActionMenu: null,
    activeActionTrigger: null,
    pendingToggleAction: null,
    modalLastFocusedElement: null,
    activityFeed: createActivityFeed(activityFeedEl),
  };
}

export function getTenantById(state, tenantId) {
  return state.tenantCache.find((tenant) => tenant.id === tenantId) || null;
}

export function getTenantDefaultQuestionnaireSlug(tenant) {
  return String(tenant?.default_questionnaire_slug || tenant?.defaultQuestionnaireSlug || '').trim();
}
