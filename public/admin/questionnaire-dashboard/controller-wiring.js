import { createDashboardEventBinder } from './event-bindings.js';
import { buildDashboardEventBinderOptions } from './controller-wiring-events.js';
import { createDashboardAppHelpers } from './dashboard-utils.js';
import { createVisualLayoutController } from './visual-layout.js';
import { wireDashboardAi } from './controller-wiring-ai.js';
import { wireDashboardCharts } from './controller-wiring-charts.js';
import { wireDashboardData } from './controller-wiring-data.js';

export function wireDashboardControllers({
  state,
  domRefs,
  visualOrderDragState,
  VISUAL_CARD_CONFIG,
  VISUAL_CARD_KEYS,
  VISUAL_PRESET_CONFIG,
  requestJson,
  normalizeUiError,
  setInlineStatus,
  setErrorDebugPanel,
  baseApiPath,
} = {}) {
  let aiRuntimeController = null;

  const {
    setStatus,
    setError,
    toActionableErrorMessage,
    canRetryFromError,
    presentError,
    api,
    validateDateRange,
    runWithButtonLoading,
    buildCommonQuery,
    formatNumber,
    formatDateTime,
    formatVersionShort,
    loadVersionOptions,
    truncateText,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
    buildScaleAveragesFallback,
    buildQuestionLookup,
  } = createDashboardAppHelpers({
    state,
    statusEl: domRefs.statusEl,
    inlineStatusEl: domRefs.inlineStatusEl,
    inlineActionsEl: domRefs.inlineActionsEl,
    errorDebugEl: domRefs.errorDebugEl,
    filterFromEl: domRefs.filterFromEl,
    filterToEl: domRefs.filterToEl,
    filterDaysEl: domRefs.filterDaysEl,
    filterVersionEl: domRefs.filterVersionEl,
    requestJson,
    normalizeUiError,
    setInlineStatus,
    setErrorDebugPanel,
    getAiRuntimeController: () => aiRuntimeController,
    baseApiPath,
  });

  const chartApi = wireDashboardCharts({
    state,
    domRefs,
    formatNumber,
    truncateText,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
  });

  const {
    createDefaultVisualCardOrder,
    createDefaultVisualCardVisibility,
    countVisibleVisualCards,
    findVisualOrderRowByKey,
    initializeVisualCardVisibility,
    moveVisualCardOrder,
    reorderVisualCardOrder,
    renderVisualOrderList,
    resetVisualOrderDragState,
    resolveMatchingVisualPresetId,
    saveVisualCardOrder,
    saveVisualCardVisibility,
    setVisualLayoutPresetSelection,
    syncVisualVisibilityInputs,
    applyVisualCardOrder,
    applyVisualCardVisibility,
    applyVisualPreset,
  } = createVisualLayoutController({
    state,
    visualOrderDragState,
    VISUAL_CARD_CONFIG,
    VISUAL_CARD_KEYS,
    VISUAL_PRESET_CONFIG,
    visualLayoutPresetEl: domRefs.visualLayoutPresetEl,
    visualVisibilityInputEls: domRefs.visualVisibilityInputEls,
    visualOrderListEl: domRefs.visualOrderListEl,
    visualVisibilitySettingsEl: domRefs.visualVisibilitySettingsEl,
    renderAdvancedVizChart: chartApi.renderAdvancedVizChart,
  });

  const aiApi = wireDashboardAi({
    state,
    domRefs,
    baseApiPath,
    api,
    runWithButtonLoading,
    setStatus,
    setError,
    normalizeUiError,
    formatNumber,
    formatDateTime,
    formatVersionShort,
    normalizeQuestionCode,
  });
  aiRuntimeController = aiApi.aiRuntimeController;

  const dataApi = wireDashboardData({
    state,
    domRefs,
    baseApiPath,
    api,
    runWithButtonLoading,
    validateDateRange,
    buildScaleAveragesFallback,
    buildQuestionLookup,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
    buildCommonQuery,
    formatNumber,
    formatDateTime,
    formatVersionShort,
    setStatus,
    setError,
    presentError,
    applyVisualCardVisibility,
    chartApi,
    aiApi,
  });
  state.onSegmentBucketClick = async (dimensionId, bucketLabel) => {
    await dataApi.applySegmentDrilldown(dimensionId, bucketLabel);
  };

  const { bindEvents } = createDashboardEventBinder(
    buildDashboardEventBinderOptions({
      state,
      domRefs,
      visualOrderDragState,
      VISUAL_CARD_CONFIG,
      VISUAL_PRESET_CONFIG,
      runWithButtonLoading,
      validateDateRange,
      dataApi,
      presentError,
      setStatus,
      setError,
      chartApi,
      countVisibleVisualCards,
      saveVisualCardVisibility,
      setVisualLayoutPresetSelection,
      resolveMatchingVisualPresetId,
      applyVisualCardVisibility,
      applyVisualPreset,
      moveVisualCardOrder,
      findVisualOrderRowByKey,
      resetVisualOrderDragState,
      reorderVisualCardOrder,
      createDefaultVisualCardVisibility,
      createDefaultVisualCardOrder,
      saveVisualCardOrder,
      syncVisualVisibilityInputs,
      renderVisualOrderList,
      applyVisualCardOrder,
      aiApi,
    })
  );

  return {
    initializeVisualCardVisibility,
    bindEvents,
    loadVersionOptions,
    loadSummaryAndCharts: dataApi.loadSummaryAndCharts,
    loadResponses: dataApi.loadResponses,
    loadAiLatest: aiApi.loadAiLatest,
    setStatus,
    setError,
    toActionableErrorMessage,
    canRetryFromError,
    presentError,
  };
}
