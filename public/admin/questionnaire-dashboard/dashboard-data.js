import { createDashboardAnalyticsLoader } from './dashboard-analytics-loader.js';
import { createDashboardContextRenderer } from './dashboard-context-renderer.js';

export function createDashboardDataController({
  state,
  filterVersionEl,
  scaleQuestionHelpEl,
  contextVersionEl,
  contextTotalQuestionsEl,
  contextQuestionTypesEl,
  contextNoteEl,
  kpiTotalEl,
  kpiTodayEl,
  kpiScaleEl,
  kpiLastEl,
  applyFilterBtn,
  formatNumber,
  formatDateTime,
  formatVersionShort,
  buildCommonQuery,
  baseApiPath,
  api,
  runWithButtonLoading,
  validateDateRange,
  buildScaleAveragesFallback,
  buildQuestionLookup,
  normalizeQuestionCode,
  normalizeQuestionCriterion,
  resolveSegmentDimensions,
  renderSegmentDimensionOptions,
  renderScaleAverageChart,
  renderRadioQuestionOptions,
  renderRadioDistributionChart,
  renderCriteriaSummary,
  renderTrendChart,
  renderAdvancedVizChart,
  updateCsvLink,
  applyVisualCardVisibility,
  loadResponses,
  loadAiLatest,
  setStatus,
  setError,
  presentError,
} = {}) {
  const { renderSummary, renderContextInfo } = createDashboardContextRenderer({
    state,
    contextVersionEl,
    contextTotalQuestionsEl,
    contextQuestionTypesEl,
    contextNoteEl,
    kpiTotalEl,
    kpiTodayEl,
    kpiScaleEl,
    kpiLastEl,
    formatNumber,
    formatDateTime,
    formatVersionShort,
  });

  const { loadSummaryAndCharts } = createDashboardAnalyticsLoader({
    state,
    scaleQuestionHelpEl,
    buildCommonQuery,
    baseApiPath,
    api,
    buildScaleAveragesFallback,
    buildQuestionLookup,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
    resolveSegmentDimensions,
    renderSegmentDimensionOptions,
    renderScaleAverageChart,
    renderRadioQuestionOptions,
    renderRadioDistributionChart,
    renderCriteriaSummary,
    renderTrendChart,
    renderAdvancedVizChart,
    updateCsvLink,
    applyVisualCardVisibility,
    renderSummary,
    renderContextInfo,
  });

  function ensureSelectedVersionExists() {
    const selected = String(filterVersionEl?.value || '').trim();
    if (!selected) return;
    const available = Array.isArray(state.availableVersions) ? state.availableVersions : [];
    const exists = available.some((version) => String(version.id || '').trim() === selected);
    if (exists) return;
    if (filterVersionEl) filterVersionEl.value = '';
    state.selectedVersionId = '';
  }

  async function refreshDashboardData({
    startMessage = 'Memuat data dashboard sesuai filter...',
    successMessage = 'Dashboard berhasil diperbarui.',
    keepPage = false,
  } = {}) {
    ensureSelectedVersionExists();
    if (!validateDateRange()) return false;
    if (!keepPage) state.page = 1;
    try {
      setStatus(startMessage, 'warning');
      await runWithButtonLoading(applyFilterBtn, 'Memproses...', async () => {
        await loadSummaryAndCharts();
        await loadResponses();
        await loadAiLatest();
      });
      setStatus(successMessage, 'success');
      setError(null);
      return true;
    } catch (error) {
      presentError(error, 'Gagal memuat ulang dashboard.');
      return false;
    }
  }

  return {
    ensureSelectedVersionExists,
    loadSummaryAndCharts,
    refreshDashboardData,
    renderContextInfo,
    renderSummary,
  };
}
