import {
  countVisibleVisualCards,
  createDefaultVisualCardOrder,
  createDefaultVisualCardVisibility,
} from '../visual-layout-helpers.js';
import {
  loadVisualCardOrder as loadVisualCardOrderFromStorage,
  loadVisualCardVisibility as loadVisualCardVisibilityFromStorage,
  saveLocalStorageJson,
  saveVisualPreferences,
} from '../visual-layout-storage.js';

export function createVisibilityManager({
  state,
  VISUAL_CARD_CONFIG,
  VISUAL_CARD_KEYS,
  normalizeVisualCardOrder,
  visualVisibilityInputEls,
  onAfterVisibilityApplied,
} = {}) {
  function createDefaultVisibility() {
    return createDefaultVisualCardVisibility(VISUAL_CARD_KEYS);
  }

  function createDefaultOrder() {
    return createDefaultVisualCardOrder(VISUAL_CARD_KEYS);
  }

  function loadVisualCardVisibility() {
    const defaults = createDefaultVisibility();
    return loadVisualCardVisibilityFromStorage(state.visualVisibilityStorageKey, VISUAL_CARD_KEYS, defaults, {
      preferencesKey: state.visualPreferencesStorageKey,
    });
  }

  function loadVisualCardOrder() {
    const defaults = createDefaultOrder();
    return loadVisualCardOrderFromStorage(state.visualOrderStorageKey, defaults, normalizeVisualCardOrder, {
      preferencesKey: state.visualPreferencesStorageKey,
    });
  }

  function saveCombinedPreferences() {
    saveVisualPreferences(state.visualPreferencesStorageKey, state.visualCardVisibility || {}, state.visualCardOrder || []);
  }

  function saveVisualCardVisibility() {
    saveLocalStorageJson(state.visualVisibilityStorageKey, state.visualCardVisibility || {});
    saveCombinedPreferences();
  }

  function saveVisualCardOrder() {
    saveLocalStorageJson(state.visualOrderStorageKey, state.visualCardOrder || []);
    saveCombinedPreferences();
  }

  function countVisibleCards(visibility = {}) {
    return countVisibleVisualCards(visibility, VISUAL_CARD_KEYS);
  }

  function syncVisualVisibilityInputs() {
    visualVisibilityInputEls.forEach((input) => {
      const key = String(input.dataset.visualCard || '').trim();
      if (!key || !VISUAL_CARD_CONFIG[key]) return;
      input.checked = Boolean(state.visualCardVisibility[key]);
    });
  }

  function applyVisualCardVisibility() {
    VISUAL_CARD_KEYS.forEach((key) => {
      const config = VISUAL_CARD_CONFIG[key];
      const card = document.getElementById(config.cardId);
      if (!card) return;
      card.hidden = !Boolean(state.visualCardVisibility[key]);
    });
    onAfterVisibilityApplied?.();
  }

  return {
    createDefaultVisibility,
    createDefaultOrder,
    loadVisualCardVisibility,
    loadVisualCardOrder,
    saveVisualCardVisibility,
    saveVisualCardOrder,
    countVisibleCards,
    syncVisualVisibilityInputs,
    applyVisualCardVisibility,
  };
}
