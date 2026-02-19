import { findSegmentDimensionById, formatSegmentDimensionOptionLabel, resolveSegmentDimensions } from '../advanced-viz-data.js';

export function createSegmentControls({
  state,
  segmentControlsEl,
  segmentDimensionSelectEl,
  segmentBucketSelectEl,
  segmentCompareBucketsEl,
  segmentFilterChipEl,
} = {}) {
  function setSegmentControlsVisibility(visible = false) {
    if (!segmentControlsEl) return;
    segmentControlsEl.hidden = !visible;
  }

  function resolveSegmentDimensionsForState() {
    return resolveSegmentDimensions(state.segmentSummary);
  }

  function renderSegmentFilterChip() {
    if (!segmentFilterChipEl) return;
    const dimensionId = String(state.activeSegmentFilter?.dimensionId || '').trim();
    const bucket = String(state.activeSegmentFilter?.bucket || '').trim();
    if (!dimensionId || !bucket) {
      segmentFilterChipEl.textContent = 'Filter segment belum aktif.';
      return;
    }
    const dimension = findSegmentDimensionById(state.segmentSummary, dimensionId);
    const dimensionLabel = String(dimension?.label || dimensionId).trim();
    segmentFilterChipEl.textContent = `Filter aktif: ${dimensionLabel} = ${bucket}`;
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
      renderSegmentBucketOptions();
      renderSegmentFilterChip();
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
    renderSegmentBucketOptions();
    renderSegmentFilterChip();
  }

  function renderSegmentBucketOptions() {
    const dimension = getCurrentSegmentDimension();
    const buckets = Array.isArray(dimension?.buckets) ? dimension.buckets : [];
    const bucketLabels = buckets.map((bucket) => String(bucket?.label || '').trim()).filter(Boolean);

    if (segmentBucketSelectEl) {
      segmentBucketSelectEl.innerHTML = '';
      if (!bucketLabels.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Tidak ada bucket';
        segmentBucketSelectEl.append(option);
        segmentBucketSelectEl.disabled = true;
      } else {
        bucketLabels.forEach((label) => {
          const option = document.createElement('option');
          option.value = label;
          option.textContent = label;
          segmentBucketSelectEl.append(option);
        });
        const selected = String(state.selectedSegmentBucket || '').trim();
        state.selectedSegmentBucket = bucketLabels.includes(selected) ? selected : bucketLabels[0];
        segmentBucketSelectEl.disabled = false;
        segmentBucketSelectEl.value = state.selectedSegmentBucket;
      }
    }

    if (segmentCompareBucketsEl) {
      segmentCompareBucketsEl.innerHTML = '';
      const selectedCompareBuckets = Array.isArray(state.selectedSegmentCompareBuckets)
        ? state.selectedSegmentCompareBuckets.filter((label) => bucketLabels.includes(label)).slice(0, 3)
        : [];
      state.selectedSegmentCompareBuckets = selectedCompareBuckets;
      bucketLabels.forEach((label) => {
        const option = document.createElement('option');
        option.value = label;
        option.textContent = label;
        option.selected = selectedCompareBuckets.includes(label);
        segmentCompareBucketsEl.append(option);
      });
      segmentCompareBucketsEl.disabled = bucketLabels.length === 0;
    }
  }

  function getCurrentSegmentDimension() {
    return findSegmentDimensionById(state.segmentSummary, state.selectedSegmentDimension);
  }

  function getSelectedCompareBuckets() {
    if (!segmentCompareBucketsEl) return [];
    return Array.from(segmentCompareBucketsEl.selectedOptions || [])
      .map((option) => String(option.value || '').trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  return {
    setSegmentControlsVisibility,
    renderSegmentDimensionOptions,
    renderSegmentBucketOptions,
    renderSegmentFilterChip,
    resolveSegmentDimensionsForState,
    getCurrentSegmentDimension,
    getSelectedCompareBuckets,
  };
}
