import { bindRuntimeErrorHandlers, normalizeUiError } from '/forms-static/shared/ux.js';
import { createChartRenderer } from './public-dashboard/charts.js';
import { refs } from './public-dashboard/dom.js';
import { loadDashboard } from './public-dashboard/loader.js';
import { createStatusController } from './public-dashboard/status.js';
import { showDashboardState, showInsufficientState } from './public-dashboard/view.js';

const charts = createChartRenderer();
const { setStatus } = createStatusController({
  statusElement: refs.dashboardStatus,
  errorDebugWrap: refs.errorDebugWrap,
  errorDebug: refs.errorDebug,
});

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

loadDashboard(
  refs,
  setStatus,
  showInsufficientState,
  (summaryPayload, distributionPayload, trendPayload) =>
    showDashboardState(refs, charts, summaryPayload, distributionPayload, trendPayload)
).catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat dashboard publik.');
  setStatus(normalized.message, 'error', error);
});
