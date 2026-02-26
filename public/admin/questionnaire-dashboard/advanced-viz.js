import { createAdvancedVizUi } from './advanced-viz/ui.js';
import { createSegmentControls } from './advanced-viz/segment-controls.js';
import { createAdvancedVizRenderDispatcher } from './advanced-viz/render-dispatcher.js';

export function createAdvancedVizController({
  state,
  advancedVizTabButtons,
  advancedVizInsightsEl,
  advancedVizHelpEl,
  segmentControlsEl,
  segmentDimensionSelectEl,
  segmentBucketSelectEl,
  segmentCompareBucketsEl,
  segmentFilterChipEl,
  formatNumber,
  truncateText,
  destroyChart,
} = {}) {
  const ui = createAdvancedVizUi({
    state,
    advancedVizTabButtons,
    advancedVizInsightsEl,
    advancedVizHelpEl,
  });

  const segmentControls = createSegmentControls({
    state,
    segmentControlsEl,
    segmentDimensionSelectEl,
    segmentBucketSelectEl,
    segmentCompareBucketsEl,
    segmentFilterChipEl,
  });

  const dispatcher = createAdvancedVizRenderDispatcher({
    state,
    formatNumber,
    truncateText,
    destroyChart,
    advancedVizHelpEl,
    ui,
    segmentControls,
  });

  return {
    renderAdvancedVizChart: dispatcher.renderAdvancedVizChart,
    applyAdvancedVizModeAvailability: ui.applyModeAvailability,
    renderSegmentDimensionOptions: segmentControls.renderSegmentDimensionOptions,
    renderSegmentBucketOptions: segmentControls.renderSegmentBucketOptions,
    renderSegmentFilterChip: segmentControls.renderSegmentFilterChip,
    getSelectedCompareBuckets: segmentControls.getSelectedCompareBuckets,
    resolveSegmentDimensions: segmentControls.resolveSegmentDimensionsForState,
  };
}
