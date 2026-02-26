import { buildDashboardAnalyticsCapabilities, resolvePreferredAdvancedVizMode } from './analytics-capabilities.js';
import { applyAnalysisViewFromCapabilities, syncAnalysisViewUi } from './analysis-tabs.js';

export function createDashboardAnalyticsLoader({
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
} = {}) {
  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeOpenDeviceSummary(payload, fallbackSubmitted = 0) {
    const raw = payload && typeof payload === 'object' ? payload : {};
    return {
      uniqueOpenDevices: Math.max(0, toNumber(raw.uniqueOpenDevices)),
      totalOpens: Math.max(0, toNumber(raw.totalOpens)),
      submitted: Math.max(0, toNumber(raw.submitted, fallbackSubmitted)),
    };
  }

  async function loadOpenDeviceSummaryBestEffort(fallbackSubmitted = 0) {
    const summaryPath = `${baseApiPath()}/open-devices/summary`;
    try {
      const response = await fetch(summaryPath, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        return normalizeOpenDeviceSummary({ submitted: fallbackSubmitted }, fallbackSubmitted);
      }
      const payload = await response.json().catch(() => null);
      return normalizeOpenDeviceSummary(payload?.data, fallbackSubmitted);
    } catch (error) {
      console.warn(`[OPEN_TRACKING_WARNING] gagal memuat open-device summary: ${String(error?.message || error)}`);
      return normalizeOpenDeviceSummary({ submitted: fallbackSubmitted }, fallbackSubmitted);
    }
  }

  async function loadSummaryAndCharts() {
    state.segmentCompareResult = null;
    state.schoolBenchmarkResult = null;
    const snapshotQuery = buildCommonQuery({ includeDays: true }).toString();
    const snapshotPayload = await api(
      `${baseApiPath()}/analytics/snapshot${snapshotQuery ? `?${snapshotQuery}` : ''}`,
      undefined,
      'Gagal memuat snapshot analytics.'
    );
    const snapshotData = snapshotPayload?.data && typeof snapshotPayload.data === 'object' ? snapshotPayload.data : {};
    const summaryData = snapshotData.summary && typeof snapshotData.summary === 'object' ? snapshotData.summary : {};
    const distributionData =
      snapshotData.distribution && typeof snapshotData.distribution === 'object' ? snapshotData.distribution : {};
    const trendData = snapshotData.trend && typeof snapshotData.trend === 'object' ? snapshotData.trend : {};

    state.summary = summaryData;
    state.openDeviceSummary = await loadOpenDeviceSummaryBestEffort(Number(summaryData?.totalResponses || 0));
    state.distribution = distributionData;
    state.trend = trendData;
    state.benchmarkSummary =
      snapshotData?.benchmarkSummary && typeof snapshotData.benchmarkSummary === 'object'
        ? snapshotData.benchmarkSummary
        : null;
    state.dataQuality = summaryData?.dataQuality || distributionData?.dataQuality || null;
    state.questionnaireVersionId = snapshotData?.questionnaireVersionId || state.questionnaireVersionId;

    const allQuestions = Array.isArray(distributionData?.questions) ? distributionData.questions : [];
    const normalizedQuestions = allQuestions.map((question, index) => ({
      ...question,
      questionCode: normalizeQuestionCode(question, index),
      criterion: normalizeQuestionCriterion(question),
    }));
    state.questionLookup = buildQuestionLookup(normalizedQuestions);

    const scaleQuestions = normalizedQuestions.filter((question) => question.type === 'scale');
    const radioQuestions = normalizedQuestions.filter((question) => question.type === 'radio');
    const checkboxQuestions = normalizedQuestions.filter((question) => question.type === 'checkbox');
    state.radioQuestions = [...radioQuestions, ...checkboxQuestions];
    const textQuestions = normalizedQuestions.filter((question) => question.type === 'text');

    const scaleAveragesFromSummary = Array.isArray(summaryData?.scaleAverages) ? summaryData.scaleAverages : [];
    const scaleAveragesFromDistribution = Array.isArray(distributionData?.scaleAverages)
      ? distributionData.scaleAverages
      : [];
    const scaleAverages =
      scaleAveragesFromSummary.length > 0
        ? scaleAveragesFromSummary
        : scaleAveragesFromDistribution.length > 0
          ? scaleAveragesFromDistribution
          : buildScaleAveragesFallback(summaryData?.questionAverages || {}, normalizedQuestions);
    state.scaleAverages = scaleAverages;

    state.criteriaSummary = Array.isArray(distributionData?.criteriaSummary)
      ? distributionData.criteriaSummary
      : Array.isArray(summaryData?.criteriaSummary)
        ? summaryData.criteriaSummary
        : [];
    state.segmentSummary =
      distributionData?.segmentSummary && typeof distributionData.segmentSummary === 'object'
        ? distributionData.segmentSummary
        : summaryData?.segmentSummary && typeof summaryData.segmentSummary === 'object'
          ? summaryData.segmentSummary
          : { totalDimensions: 0, dimensions: [] };
    const capabilities = buildDashboardAnalyticsCapabilities({
      questions: normalizedQuestions,
      totalQuestionsWithCriterion:
        distributionData?.totalQuestionsWithCriterion ?? summaryData?.totalQuestionsWithCriterion,
      trendPoints: trendData?.points || [],
      segmentSummary: state.segmentSummary,
      benchmarkSummary: state.benchmarkSummary,
    });
    state.analyticsCapabilities = capabilities;
    state.visualCardAvailability = capabilities.visualCardAvailability;
    state.advancedVizModeAvailability = capabilities.advancedVizModeAvailability;
    const analysisViewState = applyAnalysisViewFromCapabilities(state, capabilities);
    state.advancedVizMode = resolvePreferredAdvancedVizMode(state.advancedVizMode, capabilities);
    if (analysisViewState.analysisView === 'trend' && state.advancedVizModeAvailability?.period !== false) {
      state.advancedVizMode = 'period';
    }
    applyAdvancedVizModeAvailability(state.advancedVizModeAvailability);
    syncAnalysisViewUi(state);

    const availableSegmentDimensions = resolveSegmentDimensions();
    if (
      !state.selectedSegmentDimension ||
      !availableSegmentDimensions.some((dimension) => dimension.id === state.selectedSegmentDimension)
    ) {
      state.selectedSegmentDimension = availableSegmentDimensions[0]?.id || '';
      state.selectedSegmentBucket = '';
      state.selectedSegmentCompareBuckets = [];
    }
    renderSegmentDimensionOptions();
    renderSegmentBucketOptions();
    renderSegmentFilterChip();

    renderSummary();
    renderScaleAverageChart(state.scaleAverages);
    state.questionTypeStats = {
      total: normalizedQuestions.length,
      scale: scaleQuestions.length,
      radio: radioQuestions.length,
      checkbox: checkboxQuestions.length,
      text: textQuestions.length,
    };

    if (scaleQuestionHelpEl) {
      scaleQuestionHelpEl.textContent = `${state.questionTypeStats.scale} pertanyaan tipe Skala dianalisis dengan label ringkas Qx.`;
    }
    renderRadioQuestionOptions();
    renderRadioDistributionChart();
    renderCriteriaSummary();
    renderTrendChart(capabilities.trendRelevant ? trendData?.points || [] : []);
    renderAdvancedVizChart();
    renderContextInfo();
    updateCsvLink();
    syncVisualVisibilityInputs();
    applyVisualCardVisibility();
  }

  return {
    loadSummaryAndCharts,
  };
}
