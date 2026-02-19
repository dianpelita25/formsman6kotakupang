export function loadVisualCardVisibility(storageKey = '', visualCardKeys = [], defaults = {}) {
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

export function loadVisualCardOrder(storageKey = '', defaults = [], normalizeVisualCardOrder = (value) => value) {
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
