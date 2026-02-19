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
    renderSegmentDimensionOptions: segmentControls.renderSegmentDimensionOptions,
    resolveSegmentDimensions: segmentControls.resolveSegmentDimensionsForState,
  };
}
