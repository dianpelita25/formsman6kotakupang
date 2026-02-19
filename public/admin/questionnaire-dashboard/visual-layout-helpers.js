export function createDefaultVisualCardVisibility(visualCardKeys = []) {
  return visualCardKeys.reduce((accumulator, key) => {
    accumulator[key] = true;
    return accumulator;
  }, {});
}

export function createDefaultVisualCardOrder(visualCardKeys = []) {
  return [...visualCardKeys];
}

export function buildVisualVisibilityStorageKey(tenantSlug = '', questionnaireSlug = '') {
  const tenant = String(tenantSlug || '').trim().toLowerCase();
  const questionnaire = String(questionnaireSlug || '').trim().toLowerCase();
  return `aiti:dashboard:visual-visibility:${tenant}:${questionnaire}`;
}

export function buildVisualOrderStorageKey(tenantSlug = '', questionnaireSlug = '') {
  const tenant = String(tenantSlug || '').trim().toLowerCase();
  const questionnaire = String(questionnaireSlug || '').trim().toLowerCase();
  return `aiti:dashboard:visual-order:${tenant}:${questionnaire}`;
}

export function buildVisualPreferencesStorageKey(tenantSlug = '', questionnaireSlug = '') {
  const tenant = String(tenantSlug || '').trim().toLowerCase();
  const questionnaire = String(questionnaireSlug || '').trim().toLowerCase();
  return `dashboard_visual_prefs_v2:${tenant}:${questionnaire}`;
}

export function normalizeVisualCardOrder(candidateOrder = [], visualCardConfig = {}, visualCardKeys = []) {
  const source = Array.isArray(candidateOrder) ? candidateOrder : [];
  const normalized = [];
  source.forEach((key) => {
    const value = String(key || '').trim();
    if (!visualCardConfig[value]) return;
    if (normalized.includes(value)) return;
    normalized.push(value);
  });
  visualCardKeys.forEach((key) => {
    if (normalized.includes(key)) return;
    normalized.push(key);
  });
  return normalized;
}

export function countVisibleVisualCards(visibility = {}, visualCardKeys = []) {
  return visualCardKeys.reduce((total, key) => total + (visibility[key] ? 1 : 0), 0);
}
