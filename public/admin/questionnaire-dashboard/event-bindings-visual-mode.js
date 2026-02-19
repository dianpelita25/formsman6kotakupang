export function createVisualModeEventBinder({
  state,
  VISUAL_CARD_CONFIG,
  VISUAL_PRESET_CONFIG,
  radioQuestionSelectEl,
  segmentDimensionSelectEl,
  advancedVizTabsContainerEl,
  visualVisibilityInputEls,
  visualLayoutApplyBtnEl,
  visualLayoutPresetEl,
  renderRadioDistributionChart,
  renderAdvancedVizChart,
  countVisibleVisualCards,
  saveVisualCardVisibility,
  setVisualLayoutPresetSelection,
  resolveMatchingVisualPresetId,
  applyVisualCardVisibility,
  applyVisualPreset,
  setStatus,
} = {}) {
  function bindVisualModeEvents() {
    radioQuestionSelectEl?.addEventListener('change', () => {
      state.selectedRadioQuestion = String(radioQuestionSelectEl.value || '').trim();
      renderRadioDistributionChart();
    });

    segmentDimensionSelectEl?.addEventListener('change', () => {
      state.selectedSegmentDimension = String(segmentDimensionSelectEl.value || '').trim();
      if (String(state.advancedVizMode || '').trim() === 'segment') {
        renderAdvancedVizChart();
      }
    });

    advancedVizTabsContainerEl?.addEventListener('click', (event) => {
      const tab = event.target.closest('.dashboard-viz-tab');
      if (!tab) return;
      const mode = String(tab.dataset.vizMode || '').trim();
      if (!mode || mode === state.advancedVizMode) return;
      state.advancedVizMode = mode;
      renderAdvancedVizChart();
    });

    visualVisibilityInputEls.forEach((input) => {
      input.addEventListener('change', () => {
        const key = String(input.dataset.visualCard || '').trim();
        if (!key || !VISUAL_CARD_CONFIG[key]) return;
        const nextVisibility = {
          ...state.visualCardVisibility,
          [key]: Boolean(input.checked),
        };
        if (countVisibleVisualCards(nextVisibility) < 1) {
          input.checked = true;
          setStatus('Minimal 1 panel visual harus tetap ditampilkan.', 'warning');
          return;
        }
        state.visualCardVisibility = nextVisibility;
        saveVisualCardVisibility();
        setVisualLayoutPresetSelection(resolveMatchingVisualPresetId());
        applyVisualCardVisibility();
        setStatus(`Tampilan visual diperbarui (${VISUAL_CARD_CONFIG[key].label}).`, 'success');
      });
    });

    visualLayoutApplyBtnEl?.addEventListener('click', () => {
      const presetId = String(visualLayoutPresetEl?.value || '').trim();
      if (!presetId) {
        setStatus('Pilih preset tampilan dulu.', 'warning');
        return;
      }
      const applied = applyVisualPreset(presetId);
      if (!applied) {
        setStatus('Preset gagal diterapkan. Coba lagi.', 'error');
        return;
      }
      const label = VISUAL_PRESET_CONFIG[presetId]?.label || 'Preset';
      setStatus(`Preset tampilan diterapkan: ${label}.`, 'success');
    });
  }

  return {
    bindVisualModeEvents,
  };
}
