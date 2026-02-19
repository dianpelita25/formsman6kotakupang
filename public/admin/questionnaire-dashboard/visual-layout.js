import {
  buildVisualOrderStorageKey,
  buildVisualPreferencesStorageKey,
  buildVisualVisibilityStorageKey,
  normalizeVisualCardOrder as normalizeVisualCardOrderHelper,
} from './visual-layout-helpers.js';
import { createDragManager } from './visual-layout/drag-manager.js';
import { createOrderManager } from './visual-layout/order-manager.js';
import { createVisibilityManager } from './visual-layout/visibility-manager.js';
import { createPresetManager } from './visual-layout/preset-manager.js';

export function createVisualLayoutController({
  state,
  visualOrderDragState,
  VISUAL_CARD_CONFIG,
  VISUAL_CARD_KEYS,
  VISUAL_PRESET_CONFIG,
  visualLayoutPresetEl,
  visualVisibilityInputEls,
  visualOrderListEl,
  visualVisibilitySettingsEl,
  renderAdvancedVizChart,
} = {}) {
  function getVisualVisibilityStorageKey() {
    return buildVisualVisibilityStorageKey(state.tenantSlug, state.questionnaireSlug);
  }

  function getVisualOrderStorageKey() {
    return buildVisualOrderStorageKey(state.tenantSlug, state.questionnaireSlug);
  }

  function getVisualPreferencesStorageKey() {
    return buildVisualPreferencesStorageKey(state.tenantSlug, state.questionnaireSlug);
  }

  function normalizeVisualCardOrder(candidateOrder = []) {
    return normalizeVisualCardOrderHelper(candidateOrder, VISUAL_CARD_CONFIG, VISUAL_CARD_KEYS);
  }

  function resizeVisibleCharts() {
    Object.values(state.charts || {}).forEach((chart) => {
      if (!chart || typeof chart.resize !== 'function') return;
      const card = chart.canvas?.closest('.dashboard-chart-card');
      if (card && card.hidden) return;
      chart.resize();
    });
  }

  const dragManager = createDragManager({ visualOrderDragState, visualOrderListEl });

  const visibilityManager = createVisibilityManager({
    state,
    VISUAL_CARD_CONFIG,
    VISUAL_CARD_KEYS,
    normalizeVisualCardOrder,
    visualVisibilityInputEls,
    onAfterVisibilityApplied: () => window.setTimeout(resizeVisibleCharts, 90),
  });

  const orderManager = createOrderManager({
    state,
    VISUAL_CARD_CONFIG,
    normalizeVisualCardOrder,
    visualOrderListEl,
    saveVisualCardOrder: visibilityManager.saveVisualCardOrder,
    onAfterOrderApplied: () => window.setTimeout(resizeVisibleCharts, 100),
  });

  const presetManager = createPresetManager({
    state,
    VISUAL_CARD_KEYS,
    VISUAL_PRESET_CONFIG,
    visualLayoutPresetEl,
    normalizeVisualCardOrder,
    createDefaultVisibility: visibilityManager.createDefaultVisibility,
    createDefaultOrder: visibilityManager.createDefaultOrder,
    countVisibleCards: visibilityManager.countVisibleCards,
    saveVisualCardVisibility: visibilityManager.saveVisualCardVisibility,
    saveVisualCardOrder: visibilityManager.saveVisualCardOrder,
    syncVisualVisibilityInputs: visibilityManager.syncVisualVisibilityInputs,
    renderVisualOrderList: orderManager.renderVisualOrderList,
    applyVisualCardOrder: orderManager.applyVisualCardOrder,
    resetVisualOrderDragState: dragManager.resetVisualOrderDragState,
    applyVisualCardVisibility: visibilityManager.applyVisualCardVisibility,
    renderAdvancedVizChart,
    visualVisibilitySettingsEl,
  });

  function moveVisualCardOrder(key, direction) {
    const moved = orderManager.moveVisualCardOrder(key, direction);
    if (moved) {
      dragManager.resetVisualOrderDragState();
    }
    return moved;
  }

  function initializeVisualCardVisibility() {
    state.visualPreferencesStorageKey = getVisualPreferencesStorageKey();
    state.visualVisibilityStorageKey = getVisualVisibilityStorageKey();
    state.visualOrderStorageKey = getVisualOrderStorageKey();
    state.visualCardVisibility = visibilityManager.loadVisualCardVisibility();
    state.visualCardOrder = visibilityManager.loadVisualCardOrder();

    if (visibilityManager.countVisibleCards(state.visualCardVisibility) < 1) {
      state.visualCardVisibility = visibilityManager.createDefaultVisibility();
      visibilityManager.saveVisualCardVisibility();
    }

    if (visualVisibilitySettingsEl) {
      visualVisibilitySettingsEl.open = visibilityManager.countVisibleCards(state.visualCardVisibility) < VISUAL_CARD_KEYS.length;
    }

    presetManager.setVisualLayoutPresetSelection(presetManager.resolveMatchingVisualPresetId());
    visibilityManager.syncVisualVisibilityInputs();
    orderManager.renderVisualOrderList();
    orderManager.applyVisualCardOrder();
    visibilityManager.applyVisualCardVisibility();
  }

  return {
    createDefaultVisualCardOrder: visibilityManager.createDefaultOrder,
    createDefaultVisualCardVisibility: visibilityManager.createDefaultVisibility,
    countVisibleVisualCards: visibilityManager.countVisibleCards,
    findVisualOrderRowByKey: orderManager.findVisualOrderRowByKey,
    initializeVisualCardVisibility,
    moveVisualCardOrder,
    reorderVisualCardOrder: orderManager.reorderVisualCardOrder,
    renderVisualOrderList: orderManager.renderVisualOrderList,
    resetVisualOrderDragState: dragManager.resetVisualOrderDragState,
    resolveMatchingVisualPresetId: presetManager.resolveMatchingVisualPresetId,
    saveVisualCardOrder: visibilityManager.saveVisualCardOrder,
    saveVisualCardVisibility: visibilityManager.saveVisualCardVisibility,
    setVisualLayoutPresetSelection: presetManager.setVisualLayoutPresetSelection,
    syncVisualVisibilityInputs: visibilityManager.syncVisualVisibilityInputs,
    applyVisualCardOrder: orderManager.applyVisualCardOrder,
    applyVisualCardVisibility: visibilityManager.applyVisualCardVisibility,
    applyVisualPreset: presetManager.applyVisualPreset,
  };
}
