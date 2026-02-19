import { createAdvancedVizController } from './advanced-viz.js';
import { createMainChartsController } from './charts-main.js';
import { createCriteriaController } from './criteria-ui.js';

export function wireDashboardCharts({
  state,
  domRefs,
  formatNumber,
  truncateText,
  normalizeQuestionCode,
  normalizeQuestionCriterion,
} = {}) {
  const { findQuestionByCode, renderQuestionDetail, renderCriteriaSummary } = createCriteriaController({
    state,
    criteriaSummaryListEl: domRefs.criteriaSummaryListEl,
    criteriaSummaryHelpEl: domRefs.criteriaSummaryHelpEl,
    questionDetailPanelEl: domRefs.questionDetailPanelEl,
    questionDetailCodeEl: domRefs.questionDetailCodeEl,
    questionDetailCriterionEl: domRefs.questionDetailCriterionEl,
    questionDetailLabelEl: domRefs.questionDetailLabelEl,
    formatNumber,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
  });

  const {
    destroyChart,
    renderScaleAverageChart,
    renderRadioQuestionOptions,
    renderRadioDistributionChart,
    renderTrendChart,
  } = createMainChartsController({
    state,
    radioQuestionSelectEl: domRefs.radioQuestionSelectEl,
    radioQuestionHelpEl: domRefs.radioQuestionHelpEl,
    formatNumber,
    truncateText,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
    renderQuestionDetail,
  });

  const advancedVizController = createAdvancedVizController({
    state,
    advancedVizTabButtons: domRefs.advancedVizTabButtons,
    advancedVizInsightsEl: domRefs.advancedVizInsightsEl,
    advancedVizHelpEl: domRefs.advancedVizHelpEl,
    segmentControlsEl: domRefs.segmentControlsEl,
    segmentDimensionSelectEl: domRefs.segmentDimensionSelectEl,
    formatNumber,
    truncateText,
    destroyChart,
  });

  function resolveSegmentDimensions() {
    return advancedVizController ? advancedVizController.resolveSegmentDimensions() : [];
  }

  function renderSegmentDimensionOptions() {
    if (!advancedVizController) return;
    advancedVizController.renderSegmentDimensionOptions();
  }

  function renderAdvancedVizChart() {
    if (!advancedVizController) return;
    advancedVizController.renderAdvancedVizChart();
  }

  return {
    findQuestionByCode,
    renderQuestionDetail,
    renderCriteriaSummary,
    renderScaleAverageChart,
    renderRadioQuestionOptions,
    renderRadioDistributionChart,
    renderTrendChart,
    resolveSegmentDimensions,
    renderSegmentDimensionOptions,
    renderAdvancedVizChart,
  };
}
