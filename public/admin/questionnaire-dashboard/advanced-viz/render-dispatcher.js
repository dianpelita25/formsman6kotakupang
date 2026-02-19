import { buildCriteriaVizRows, buildLikertTotals, buildPeriodComparison, buildWeeklyPattern } from '../advanced-viz-data.js';
import { renderCriteriaMode } from '../advanced-viz-modes/criteria.js';
import { renderLikertMode } from '../advanced-viz-modes/likert.js';
import { renderPeriodMode } from '../advanced-viz-modes/period.js';
import { renderSegmentMode } from '../advanced-viz-modes/segment.js';
import { renderWeeklyMode } from '../advanced-viz-modes/weekly.js';

export function createAdvancedVizRenderDispatcher({
  state,
  formatNumber,
  truncateText,
  destroyChart,
  advancedVizHelpEl,
  ui,
  segmentControls,
} = {}) {
  function renderAdvancedVizChart() {
    destroyChart('advancedViz');
    const canvas = document.getElementById('advanced-viz-chart');
    if (!canvas) return;

    const mode = String(state.advancedVizMode || 'criteria').trim();
    ui.setAdvancedVizTabs(mode);
    segmentControls.setSegmentControlsVisibility(mode === 'segment');

    if (mode === 'criteria') {
      const rows = buildCriteriaVizRows(state.criteriaSummary);
      const rendered = renderCriteriaMode({
        state,
        canvas,
        rows,
        truncateText,
        formatNumber,
        advancedVizHelpEl,
        renderAdvancedVizInsights: ui.renderAdvancedVizInsights,
      });
      if (!rendered) {
        ui.renderEmptyAdvancedVizChart(canvas, 'Belum ada data kriteria untuk divisualkan pada filter ini.');
      }
      return;
    }

    if (mode === 'likert') {
      const likert = buildLikertTotals(state.distribution?.questions);
      const rendered = renderLikertMode({
        state,
        canvas,
        likert,
        formatNumber,
        advancedVizHelpEl,
        renderAdvancedVizInsights: ui.renderAdvancedVizInsights,
      });
      if (!rendered) {
        ui.renderEmptyAdvancedVizChart(canvas, 'Belum ada jawaban skala (1-5) untuk filter ini.');
      }
      return;
    }

    if (mode === 'period') {
      const comparison = buildPeriodComparison(state.trend?.points || []);
      const rendered = renderPeriodMode({
        state,
        canvas,
        comparison,
        formatNumber,
        advancedVizHelpEl,
        renderAdvancedVizInsights: ui.renderAdvancedVizInsights,
      });
      if (!rendered) {
        ui.renderEmptyAdvancedVizChart(canvas, 'Perbandingan periode membutuhkan minimal 2 hari data pada rentang tren aktif.');
      }
      return;
    }

    if (mode === 'segment') {
      segmentControls.renderSegmentDimensionOptions();
      segmentControls.renderSegmentBucketOptions();
      const dimension = segmentControls.getCurrentSegmentDimension();
      if (!dimension) {
        ui.renderEmptyAdvancedVizChart(canvas, 'Belum ada dimensi segmentasi untuk filter ini.');
        return;
      }

      const buckets = Array.isArray(dimension.buckets) ? dimension.buckets : [];
      if (!buckets.length) {
        ui.renderEmptyAdvancedVizChart(canvas, 'Dimensi segmentasi belum punya data bucket.');
        return;
      }

      const rendered = renderSegmentMode({
        state,
        canvas,
        dimension,
        truncateText,
        formatNumber,
        advancedVizHelpEl,
        renderAdvancedVizInsights: ui.renderAdvancedVizInsights,
        onBucketClick: ({ dimensionId, bucketLabel }) => {
          if (typeof state.onSegmentBucketClick !== 'function') return;
          state.onSegmentBucketClick(dimensionId, bucketLabel);
        },
      });
      if (!rendered) {
        ui.renderEmptyAdvancedVizChart(canvas, 'Dimensi segmentasi belum punya data bucket.');
      }
      return;
    }

    const weekly = buildWeeklyPattern(state.trend?.points || []);
    const rendered = renderWeeklyMode({
      state,
      canvas,
      weekly,
      formatNumber,
      advancedVizHelpEl,
      renderAdvancedVizInsights: ui.renderAdvancedVizInsights,
    });
    if (!rendered) {
      ui.renderEmptyAdvancedVizChart(canvas, 'Belum ada respons harian untuk membentuk pola mingguan.');
    }
  }

  return {
    renderAdvancedVizChart,
  };
}
