const THEME_STORAGE_KEY = 'aiti_theme_preference_v1';
const THEME_EVENT_NAME = 'aiti-theme-change';
const THEME_SCOPE = 'modern';

let runtimeInitialized = false;

function normalizeThemePreference(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'dark' || normalized === 'light') return normalized;
  return '';
}

function isThemeEnabledForPage() {
  const root = document.documentElement;
  return String(root?.dataset?.themeScope || '').trim() === THEME_SCOPE;
}

function getSystemTheme() {
  if (typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredThemePreference() {
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return '';
  }
}

function persistThemePreference(preference) {
  const normalized = normalizeThemePreference(preference);
  try {
    if (!normalized) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors (private mode / quota / blocked)
  }
}

function resolveActiveTheme(preference = '') {
  const normalized = normalizeThemePreference(preference);
  return normalized || getSystemTheme();
}

function emitThemeChange(preference = '') {
  const detail = {
    theme: resolveActiveTheme(preference),
    preference: normalizeThemePreference(preference),
  };
  window.dispatchEvent(
    new CustomEvent(THEME_EVENT_NAME, {
      detail,
    })
  );
}

export function applyThemePreference(preference = '', { persist = true, emit = true } = {}) {
  const normalized = normalizeThemePreference(preference);
  if (!isThemeEnabledForPage()) {
    return {
      theme: 'dark',
      preference: '',
    };
  }

  if (persist) {
    persistThemePreference(normalized);
  }

  const root = document.documentElement;
  if (normalized) {
    root.setAttribute('data-theme', normalized);
  } else {
    root.removeAttribute('data-theme');
  }

  if (emit) {
    emitThemeChange(normalized);
  }

  return {
    theme: resolveActiveTheme(normalized),
    preference: normalized,
  };
}

export function getActiveTheme() {
  if (!isThemeEnabledForPage()) return 'dark';
  const rootValue = normalizeThemePreference(document.documentElement.getAttribute('data-theme'));
  if (rootValue) return rootValue;
  const stored = getStoredThemePreference();
  return resolveActiveTheme(stored);
}

function bindSystemThemeListener() {
  if (runtimeInitialized || typeof window.matchMedia !== 'function') return;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  const onSystemThemeChange = () => {
    if (getStoredThemePreference()) return;
    applyThemePreference('', { persist: false, emit: true });
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onSystemThemeChange);
    runtimeInitialized = true;
    return;
  }
  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(onSystemThemeChange);
    runtimeInitialized = true;
  }
}

export function initThemeRuntime() {
  if (!isThemeEnabledForPage()) {
    return {
      theme: 'dark',
      preference: '',
    };
  }

  bindSystemThemeListener();
  const storedPreference = getStoredThemePreference();
  return applyThemePreference(storedPreference, { persist: false, emit: false });
}

function formatThemeLabel(theme) {
  return theme === 'light' ? 'Tema: Terang' : 'Tema: Gelap';
}

function formatThemeAriaLabel(theme) {
  return theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang';
}

function syncToggleButton(button) {
  const activeTheme = getActiveTheme();
  button.textContent = formatThemeLabel(activeTheme);
  button.setAttribute('aria-label', formatThemeAriaLabel(activeTheme));
}

function createThemeToggleButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'global-nav__theme-toggle';
  button.dataset.themeToggleButton = 'true';
  return button;
}

function bindToggleButton(button) {
  if (!button || button.dataset.themeToggleBound === 'true') return;
  button.dataset.themeToggleBound = 'true';
  button.addEventListener('click', () => {
    const activeTheme = getActiveTheme();
    const nextTheme = activeTheme === 'light' ? 'dark' : 'light';
    applyThemePreference(nextTheme, { persist: true, emit: true });
  });
  window.addEventListener(THEME_EVENT_NAME, () => syncToggleButton(button));
  syncToggleButton(button);
}

export function mountThemeToggleSlots(selector = '[data-theme-toggle]') {
  if (!isThemeEnabledForPage()) return 0;
  const mounts = Array.from(document.querySelectorAll(selector));
  mounts.forEach((mount) => {
    let button = mount.querySelector('[data-theme-toggle-button="true"]');
    if (!button) {
      button = createThemeToggleButton();
      mount.append(button);
    }
    bindToggleButton(button);
  });
  return mounts.length;
}

export function mountTopNavThemeToggle() {
  return mountThemeToggleSlots('[data-theme-toggle]');
}

export { THEME_EVENT_NAME, THEME_STORAGE_KEY };
