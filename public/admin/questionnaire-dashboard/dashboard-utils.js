import { createStatusErrorHelpers } from './dashboard-utils/status-error.js';
import { createQueryBuilderHelpers } from './dashboard-utils/query-builder.js';
import { formatDateTime, formatNumber, formatVersionShort, truncateText } from './dashboard-utils/formatters.js';
import { createVersionHelpers } from './dashboard-utils/version-options.js';
import {
  normalizeQuestionCode,
  normalizeQuestionCriterion,
  buildScaleAveragesFallback,
  buildQuestionLookup,
} from './dashboard-utils/question-normalizer.js';

export function createDashboardAppHelpers({
  state,
  statusEl,
  inlineStatusEl,
  inlineActionsEl,
  errorDebugEl,
  errorDebugWrapEl,
  filterFromEl,
  filterToEl,
  filterDaysEl,
  filterVersionEl,
  requestJson,
  normalizeUiError,
  setInlineStatus,
  setErrorDebugPanel,
  getAiRuntimeController,
  baseApiPath,
} = {}) {
  const statusHelpers = createStatusErrorHelpers({
    statusEl,
    inlineStatusEl,
    inlineActionsEl,
    errorDebugEl,
    errorDebugWrapEl,
    requestJson,
    normalizeUiError,
    setInlineStatus,
    setErrorDebugPanel,
    getAiRuntimeController,
  });

  const queryHelpers = createQueryBuilderHelpers({
    state,
    filterFromEl,
    filterToEl,
    filterDaysEl,
    filterVersionEl,
  });

  const versionHelpers = createVersionHelpers({
    state,
    filterVersionEl,
    api: statusHelpers.api,
    baseApiPath,
  });

  async function runWithButtonLoading(button, loadingText, task, extraButtons = []) {
    const buttons = [button, ...extraButtons].filter(Boolean);
    const previousState = buttons.map((entry) => ({ entry, disabled: entry.disabled, text: entry.textContent }));
    previousState.forEach(({ entry }) => {
      entry.disabled = true;
      entry.classList.add('is-loading');
    });
    if (button) button.textContent = loadingText;
    try {
      return await task();
    } finally {
      previousState.forEach(({ entry, disabled, text }) => {
        entry.classList.remove('is-loading');
        entry.disabled = disabled;
        if (entry === button) {
          entry.textContent = text;
        }
      });
    }
  }

  function validateDateRange() {
    const ok = queryHelpers.validateDateRange();
    if (!ok) {
      statusHelpers.setStatus('Tanggal "Dari" tidak boleh lebih besar dari "Sampai".', 'error');
      filterFromEl?.focus();
    }
    return ok;
  }

  return {
    setStatus: statusHelpers.setStatus,
    setError: statusHelpers.setError,
    toActionableErrorMessage: statusHelpers.toActionableErrorMessage,
    canRetryFromError: statusHelpers.canRetryFromError,
    presentError: statusHelpers.presentError,
    api: statusHelpers.api,
    validateDateRange,
    runWithButtonLoading,
    buildCommonQuery: queryHelpers.buildCommonQuery,
    formatNumber,
    formatDateTime,
    formatVersionShort,
    loadVersionOptions: versionHelpers.loadVersionOptions,
    truncateText,
    normalizeQuestionCode,
    normalizeQuestionCriterion,
    buildScaleAveragesFallback,
    buildQuestionLookup,
  };
}
