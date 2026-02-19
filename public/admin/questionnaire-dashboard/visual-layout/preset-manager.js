export function createPresetManager({
  state,
  VISUAL_CARD_KEYS,
  VISUAL_PRESET_CONFIG,
  visualLayoutPresetEl,
  normalizeVisualCardOrder,
  createDefaultVisibility,
  createDefaultOrder,
  countVisibleCards,
  saveVisualCardVisibility,
  saveVisualCardOrder,
  syncVisualVisibilityInputs,
  renderVisualOrderList,
  applyVisualCardOrder,
  resetVisualOrderDragState,
  applyVisualCardVisibility,
  renderAdvancedVizChart,
  visualVisibilitySettingsEl,
} = {}) {
  function setVisualLayoutPresetSelection(value = '') {
    if (!visualLayoutPresetEl) return;
    visualLayoutPresetEl.value = String(value || '').trim();
  }

  function resolveMatchingVisualPresetId() {
    const currentVisibility = state.visualCardVisibility || {};
    const currentOrder = normalizeVisualCardOrder(state.visualCardOrder || []);
    const currentMode = String(state.advancedVizMode || '').trim();
    const presetEntries = Object.entries(VISUAL_PRESET_CONFIG);
    for (const [presetId, preset] of presetEntries) {
      const presetVisibility = { ...createDefaultVisibility(), ...(preset.visibility || {}) };
      const sameVisibility = VISUAL_CARD_KEYS.every((key) => Boolean(currentVisibility[key]) === Boolean(presetVisibility[key]));
      if (!sameVisibility) continue;
      const presetOrder = normalizeVisualCardOrder(preset.order || createDefaultOrder());
      const sameOrder = presetOrder.every((key, index) => currentOrder[index] === key);
      if (!sameOrder) continue;
      if (preset.advancedVizMode && String(preset.advancedVizMode).trim() !== currentMode) continue;
      return presetId;
    }
    return '';
  }

  function applyVisualPreset(presetId) {
    const normalizedPresetId = String(presetId || '').trim();
    const preset = VISUAL_PRESET_CONFIG[normalizedPresetId];
    if (!preset) return false;

    const nextVisibility = { ...createDefaultVisibility(), ...(preset.visibility || {}) };
    if (countVisibleCards(nextVisibility) < 1) return false;

    state.visualCardVisibility = nextVisibility;
    state.visualCardOrder = normalizeVisualCardOrder(preset.order || createDefaultOrder());
    if (preset.advancedVizMode) {
      state.advancedVizMode = String(preset.advancedVizMode).trim();
    }

    saveVisualCardVisibility();
    saveVisualCardOrder();
    syncVisualVisibilityInputs();
    renderVisualOrderList();
    applyVisualCardOrder();
    resetVisualOrderDragState();
    applyVisualCardVisibility();
    renderAdvancedVizChart();
    setVisualLayoutPresetSelection(normalizedPresetId);
    if (visualVisibilitySettingsEl) visualVisibilitySettingsEl.open = false;
    return true;
  }

  return {
    setVisualLayoutPresetSelection,
    resolveMatchingVisualPresetId,
    applyVisualPreset,
  };
}
