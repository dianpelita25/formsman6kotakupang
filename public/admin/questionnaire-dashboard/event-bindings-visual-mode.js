export function createVisualModeEventBinder({
  state,
  VISUAL_CARD_CONFIG,
  VISUAL_PRESET_CONFIG,
  radioQuestionSelectEl,
  segmentDimensionSelectEl,
  segmentBucketSelectEl,
  segmentCompareBucketsEl,
  segmentCompareBtn,
  segmentApplyFilterBtn,
  segmentClearFilterBtn,
  advancedVizTabsContainerEl,
  refreshDashboardData,
  applySegmentDrilldown,
  clearSegmentDrilldown,
  runSegmentCompare,
  validateDateRange,
  visualVisibilityInputEls,
  visualLayoutApplyBtnEl,
  visualLayoutPresetEl,
  renderRadioDistributionChart,
  renderAdvancedVizChart,
  renderSegmentBucketOptions,
  renderSegmentFilterChip,
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
      state.segmentCompareResult = null;
      renderSegmentBucketOptions();
      renderSegmentFilterChip();
      if (String(state.advancedVizMode || '').trim() === 'segment') {
        renderAdvancedVizChart();
      }
    });

    segmentBucketSelectEl?.addEventListener('change', () => {
      state.selectedSegmentBucket = String(segmentBucketSelectEl.value || '').trim();
    });

    segmentCompareBucketsEl?.addEventListener('change', () => {
      state.selectedSegmentCompareBuckets = Array.from(segmentCompareBucketsEl.selectedOptions || [])
        .map((option) => String(option.value || '').trim())
        .filter(Boolean)
        .slice(0, 3);
    });

    segmentApplyFilterBtn?.addEventListener('click', async () => {
      if (!validateDateRange()) return;
      const dimensionId = String(state.selectedSegmentDimension || '').trim();
      const bucket = String(state.selectedSegmentBucket || segmentBucketSelectEl?.value || '').trim();
      if (!dimensionId || !bucket) {
        setStatus('Pilih dimensi dan bucket segmentasi dulu.', 'warning');
        return;
      }
      const ok = await applySegmentDrilldown(dimensionId, bucket);
      if (ok && String(state.advancedVizMode || '').trim() === 'segment') {
        renderAdvancedVizChart();
      }
    });

    segmentClearFilterBtn?.addEventListener('click', async () => {
      if (!validateDateRange()) return;
      const ok = await clearSegmentDrilldown();
      if (ok && String(state.advancedVizMode || '').trim() === 'segment') {
        renderAdvancedVizChart();
      }
    });

    segmentCompareBtn?.addEventListener('click', async () => {
      if (!validateDateRange()) return;
      await runSegmentCompare();
    });

    advancedVizTabsContainerEl?.addEventListener('click', (event) => {
      const tab = event.target.closest('.dashboard-viz-tab');
      if (!tab) return;
      const mode = String(tab.dataset.vizMode || '').trim();
      if (!mode || mode === state.advancedVizMode) return;
      state.advancedVizMode = mode;
      renderAdvancedVizChart();
      if (mode !== 'segment') {
        return;
      }
      renderSegmentBucketOptions();
      renderSegmentFilterChip();
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
