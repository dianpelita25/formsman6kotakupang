import { createDashboardAnalyticsLoader } from './dashboard-analytics-loader.js';
import { createDashboardContextRenderer } from './dashboard-context-renderer.js';
import { resolveDashboardTotalsIntegrity } from './data-integrity.js';
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
  renderSegmentBucketOptions,
  renderSegmentFilterChip,
  getSelectedCompareBuckets,
  renderScaleAverageChart,
  renderRadioQuestionOptions,
  renderRadioDistributionChart,
  renderCriteriaSummary,
  renderTrendChart,
  renderAdvancedVizChart,
  applyAdvancedVizModeAvailability,
  updateCsvLink,
  syncVisualVisibilityInputs,
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
    renderSegmentBucketOptions,
    renderSegmentFilterChip,
    renderScaleAverageChart,
    renderRadioQuestionOptions,
    renderRadioDistributionChart,
    renderCriteriaSummary,
    renderTrendChart,
    renderAdvancedVizChart,
    applyAdvancedVizModeAvailability,
    updateCsvLink,
    syncVisualVisibilityInputs,
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
      const integrity = resolveDashboardTotalsIntegrity(state);
      const integrityMessage = integrity.ok
        ? ''
        : `Peringatan integritas data: Summary=${integrity.summaryTotal}, Distribution=${integrity.distributionTotal}, Responses=${integrity.responsesTotal}.`;
      setStatus(integrityMessage || successMessage, integrityMessage ? 'warning' : 'success');
      setError(null);
      return true;
    } catch (error) {
      presentError(error, 'Gagal memuat ulang dashboard.');
      return false;
    }
  }
  async function applySegmentDrilldown(dimensionId, bucketLabel) {
    const nextDimensionId = String(dimensionId || '').trim();
    const nextBucket = String(bucketLabel || '').trim();
    if (!nextDimensionId || !nextBucket) return false;

    state.selectedSegmentDimension = nextDimensionId;
    state.selectedSegmentBucket = nextBucket;
    state.activeSegmentFilter = {
      dimensionId: nextDimensionId,
      bucket: nextBucket,
    };
    state.segmentCompareResult = null;

    const refreshed = await refreshDashboardData({
      startMessage: 'Menerapkan filter segment...',
      successMessage: `Filter segment aktif: ${nextBucket}.`,
    });
    if (refreshed) {
      renderSegmentFilterChip();
    }
    return refreshed;
  }

  async function clearSegmentDrilldown() {
    const hadFilter = String(state.activeSegmentFilter?.dimensionId || '').trim() && String(state.activeSegmentFilter?.bucket || '').trim();
    state.activeSegmentFilter = { dimensionId: '', bucket: '' };
    state.segmentCompareResult = null;

    if (!hadFilter) {
      renderSegmentFilterChip();
      return true;
    }

    const refreshed = await refreshDashboardData({
      startMessage: 'Membersihkan filter segment...',
      successMessage: 'Filter segment dibersihkan.',
    });
    if (refreshed) {
      renderSegmentFilterChip();
    }
    return refreshed;
  }

  async function runSegmentCompare() {
    const segmentDimensionId = String(state.selectedSegmentDimension || '').trim();
    if (!segmentDimensionId) {
      setStatus('Pilih dimensi segmentasi dulu.', 'warning');
      return null;
    }

    const compareBuckets = Array.isArray(getSelectedCompareBuckets?.()) ? getSelectedCompareBuckets() : [];
    state.selectedSegmentCompareBuckets = compareBuckets;
    const params = buildCommonQuery();
    params.set('segmentDimensionId', segmentDimensionId);
    if (compareBuckets.length) {
      params.set(
        'segmentBuckets',
        compareBuckets
          .slice(0, 3)
          .map((bucket) => encodeURIComponent(bucket))
          .join(',')
      );
    }
    const payload = await api(
      `${baseApiPath()}/analytics/segment-compare?${params.toString()}`,
      undefined,
      'Gagal memuat perbandingan segment.'
    );
    state.segmentCompareResult = {
      dimensionId: segmentDimensionId,
      buckets: Array.isArray(payload.data?.buckets) ? payload.data.buckets : [],
      metric: payload.data?.metric || '',
    };
    renderSegmentBucketOptions();
    renderAdvancedVizChart();
    setStatus('Perbandingan segment berhasil dimuat.', 'success');
    return state.segmentCompareResult;
  }

  return {
    ensureSelectedVersionExists,
    loadSummaryAndCharts,
    refreshDashboardData,
    applySegmentDrilldown,
    clearSegmentDrilldown,
    runSegmentCompare,
    renderContextInfo,
    renderSummary,
  };
}
