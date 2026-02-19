import { findSegmentDimensionById, formatSegmentDimensionOptionLabel, resolveSegmentDimensions } from '../advanced-viz-data.js';

export function createSegmentControls({ state, segmentControlsEl, segmentDimensionSelectEl } = {}) {
  function setSegmentControlsVisibility(visible = false) {
    if (!segmentControlsEl) return;
    segmentControlsEl.hidden = !visible;
  }

  function resolveSegmentDimensionsForState() {
    return resolveSegmentDimensions(state.segmentSummary);
  }

  function renderSegmentDimensionOptions() {
    if (!segmentDimensionSelectEl) return;
    const dimensions = resolveSegmentDimensionsForState();
    segmentDimensionSelectEl.innerHTML = '';

    if (!dimensions.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Tidak ada dimensi segmentasi';
      segmentDimensionSelectEl.append(option);
      segmentDimensionSelectEl.disabled = true;
      state.selectedSegmentDimension = '';
      return;
    }

    dimensions.forEach((dimension) => {
      const option = document.createElement('option');
      option.value = dimension.id;
      option.textContent = formatSegmentDimensionOptionLabel(dimension);
      segmentDimensionSelectEl.append(option);
    });
    if (!state.selectedSegmentDimension || !dimensions.some((dimension) => dimension.id === state.selectedSegmentDimension)) {
      state.selectedSegmentDimension = dimensions[0].id;
    }
    segmentDimensionSelectEl.disabled = false;
    segmentDimensionSelectEl.value = state.selectedSegmentDimension;
  }

  function getCurrentSegmentDimension() {
    return findSegmentDimensionById(state.segmentSummary, state.selectedSegmentDimension);
  }

  return {
    setSegmentControlsVisibility,
    renderSegmentDimensionOptions,
    resolveSegmentDimensionsForState,
    getCurrentSegmentDimension,
  };
}
