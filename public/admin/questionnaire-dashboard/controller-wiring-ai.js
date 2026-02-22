import { createAiPdfHandlers } from './ai-pdf.js';
import { createAiRuntimeController } from './ai-runtime.js';

export function wireDashboardAi({
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
} = {}) {
  const aiRuntimeController = createAiRuntimeController({
    state,
    aiModeEl: domRefs.aiModeEl,
    aiOutputSummaryEl: domRefs.aiOutputSummaryEl,
    aiOutputDetailsEl: domRefs.aiOutputDetailsEl,
    aiOutputEl: domRefs.aiOutputEl,
    aiLoadBtn: domRefs.aiLoadBtn,
    aiRunBtn: domRefs.aiRunBtn,
    aiPdfBtn: domRefs.aiPdfBtn,
    aiProgressEl: domRefs.aiProgressEl,
    aiProgressTitleEl: domRefs.aiProgressTitleEl,
    aiProgressElapsedEl: domRefs.aiProgressElapsedEl,
    aiProgressNoteEl: domRefs.aiProgressNoteEl,
    filterFromEl: domRefs.filterFromEl,
    filterToEl: domRefs.filterToEl,
    baseApiPath,
    api,
    runWithButtonLoading,
    setStatus,
    setError,
  });

  const { getActiveMode, getModeLabel, setAiOutput, stopAiProgressIndicator, loadAiLatest, runAiAnalysis } =
    aiRuntimeController;

  const { downloadAiPdf } = createAiPdfHandlers({
    state,
    filterFromEl: domRefs.filterFromEl,
    filterToEl: domRefs.filterToEl,
    aiPdfBtn: domRefs.aiPdfBtn,
    aiLoadBtn: domRefs.aiLoadBtn,
    aiRunBtn: domRefs.aiRunBtn,
    getActiveMode,
    getModeLabel,
    formatNumber,
    formatDateTime,
    formatVersionShort,
    normalizeQuestionCode,
    runWithButtonLoading,
    setStatus,
    setError,
    normalizeUiError,
  });

  return {
    aiRuntimeController,
    loadAiLatest,
    runAiAnalysis,
    stopAiProgressIndicator,
    setAiOutput,
    downloadAiPdf,
  };
}
