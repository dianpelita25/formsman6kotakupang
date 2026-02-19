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
  updateCsvLink,
  applyVisualCardVisibility,
  renderSummary,
  renderContextInfo,
} = {}) {
  async function loadSummaryAndCharts() {
    state.segmentCompareResult = null;
    const baseQuery = buildCommonQuery().toString();
    const [summaryPayload, distributionPayload, trendPayload] = await Promise.all([
      api(
        `${baseApiPath()}/analytics/summary${baseQuery ? `?${baseQuery}` : ''}`,
        undefined,
        'Gagal memuat summary analytics.'
      ),
      api(
        `${baseApiPath()}/analytics/distribution${baseQuery ? `?${baseQuery}` : ''}`,
        undefined,
        'Gagal memuat distribusi analytics.'
      ),
      api(
        `${baseApiPath()}/analytics/trend?${buildCommonQuery({ includeDays: true }).toString()}`,
        undefined,
        'Gagal memuat trend analytics.'
      ),
    ]);

    state.summary = summaryPayload.data;
    state.distribution = distributionPayload.data;
    state.trend = trendPayload.data;
    state.dataQuality = summaryPayload.data?.dataQuality || distributionPayload.data?.dataQuality || null;
    state.questionnaireVersionId = summaryPayload.data?.questionnaireVersionId || state.questionnaireVersionId;

    const allQuestions = Array.isArray(distributionPayload.data?.questions) ? distributionPayload.data.questions : [];
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

    const scaleAveragesFromSummary = Array.isArray(summaryPayload.data?.scaleAverages) ? summaryPayload.data.scaleAverages : [];
    const scaleAveragesFromDistribution = Array.isArray(distributionPayload.data?.scaleAverages)
      ? distributionPayload.data.scaleAverages
      : [];
    const scaleAverages =
      scaleAveragesFromSummary.length > 0
        ? scaleAveragesFromSummary
        : scaleAveragesFromDistribution.length > 0
          ? scaleAveragesFromDistribution
          : buildScaleAveragesFallback(summaryPayload.data?.questionAverages || {}, normalizedQuestions);

    state.criteriaSummary = Array.isArray(distributionPayload.data?.criteriaSummary)
      ? distributionPayload.data.criteriaSummary
      : Array.isArray(summaryPayload.data?.criteriaSummary)
        ? summaryPayload.data.criteriaSummary
        : [];
    state.segmentSummary =
      distributionPayload.data?.segmentSummary && typeof distributionPayload.data.segmentSummary === 'object'
        ? distributionPayload.data.segmentSummary
        : summaryPayload.data?.segmentSummary && typeof summaryPayload.data.segmentSummary === 'object'
          ? summaryPayload.data.segmentSummary
          : { totalDimensions: 0, dimensions: [] };
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
    renderScaleAverageChart(scaleAverages);
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
    renderTrendChart(trendPayload.data?.points || []);
    renderAdvancedVizChart();
    renderContextInfo();
    updateCsvLink();
    applyVisualCardVisibility();
  }

  return {
    loadSummaryAndCharts,
  };
}
