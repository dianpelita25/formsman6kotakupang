function readLocalStorageJson(storageKey = '') {
  const normalizedKey = String(storageKey || '').trim();
  if (!normalizedKey) return null;
  try {
    const raw = window.localStorage.getItem(normalizedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadVisualCardVisibility(storageKey = '', visualCardKeys = [], defaults = {}, options = {}) {
  const preferencesKey = String(options?.preferencesKey || '').trim();
  const preferences = readLocalStorageJson(preferencesKey);
  if (preferences?.visibility && typeof preferences.visibility === 'object') {
    return visualCardKeys.reduce((accumulator, key) => {
      const value = preferences.visibility[key];
      accumulator[key] = typeof value === 'boolean' ? value : true;
      return accumulator;
    }, {});
  }

  const normalizedKey = String(storageKey || '').trim();
  if (!normalizedKey) return defaults;
  try {
    const raw = window.localStorage.getItem(normalizedKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return visualCardKeys.reduce((accumulator, key) => {
      const value = parsed[key];
      accumulator[key] = typeof value === 'boolean' ? value : true;
      return accumulator;
    }, {});
  } catch {
    return defaults;
  }
}

export function loadVisualCardOrder(storageKey = '', defaults = [], normalizeVisualCardOrder = (value) => value, options = {}) {
  const preferencesKey = String(options?.preferencesKey || '').trim();
  const preferences = readLocalStorageJson(preferencesKey);
  if (Array.isArray(preferences?.order)) {
    return normalizeVisualCardOrder(preferences.order);
  }

  const normalizedKey = String(storageKey || '').trim();
  if (!normalizedKey) return defaults;
  try {
    const raw = window.localStorage.getItem(normalizedKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return normalizeVisualCardOrder(parsed);
  } catch {
    return defaults;
  }
}

export function saveLocalStorageJson(storageKey = '', value = null) {
  const normalizedKey = String(storageKey || '').trim();
  if (!normalizedKey) return;
  try {
    window.localStorage.setItem(normalizedKey, JSON.stringify(value));
  } catch {
    // ignore write error (private mode / blocked storage)
  }
}

export function saveVisualPreferences(storageKey = '', visibility = {}, order = []) {
  const normalizedKey = String(storageKey || '').trim();
  if (!normalizedKey) return;
  saveLocalStorageJson(normalizedKey, {
    version: 2,
    visibility: visibility && typeof visibility === 'object' ? visibility : {},
    order: Array.isArray(order) ? order : [],
  });
}
