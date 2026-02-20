import {
  bindRuntimeErrorHandlers,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';
import { bindDashboardRuntimeErrors, runDashboardInit } from './bootstrap-init.js';
import { wireDashboardControllers } from './controller-wiring.js';
import { createDashboardDomRefs } from './dom-refs.js';
import { createDashboardBaseApiPathResolver, parseDashboardRouteContext } from './route-context.js';
import { createDashboardState } from './dashboard-state.js';
const domRefs = createDashboardDomRefs();
const { state, visualOrderDragState, VISUAL_CARD_CONFIG, VISUAL_CARD_KEYS, VISUAL_PRESET_CONFIG } =
  createDashboardState();
const baseApiPath = createDashboardBaseApiPathResolver(state);

const runtime = wireDashboardControllers({
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
});

window.addEventListener('aiti-theme-change', () => {
  runtime.rerenderChartsForTheme?.();
});

bindDashboardRuntimeErrors({
  bindRuntimeErrorHandlers,
  runtime,
});

runDashboardInit({
  state,
  domRefs,
  runtime,
  parseRouteContext: parseDashboardRouteContext,
}).catch((error) => {
  runtime.presentError(error, 'Gagal memuat dashboard questionnaire.');
});
