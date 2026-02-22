export async function runDashboardInit({ state, domRefs, runtime, parseRouteContext } = {}) {
  const route = parseRouteContext();
  state.tenantSlug = route.tenantSlug;
  state.questionnaireSlug = route.questionnaireSlug;

  domRefs.titleEl.textContent = `Dashboard Kuesioner - ${state.questionnaireSlug}`;
  domRefs.subtitleEl.textContent = `Organisasi ${state.tenantSlug} - cakupan per kuesioner`;

  domRefs.backBuilderLink.href = `/forms/${state.tenantSlug}/admin/questionnaires/${state.questionnaireSlug}/builder/`;
  domRefs.openFormLink.href = `/forms/${state.tenantSlug}/${state.questionnaireSlug}/`;

  runtime.initializeVisualCardVisibility();
  runtime.bindEvents();
  runtime.setStatus('Memuat dashboard...', 'warning');

  await runtime.loadVersionOptions();
  await runtime.loadSummaryAndCharts();
  await runtime.loadResponses();
  await runtime.loadAiLatest();

  runtime.setStatus('Dashboard siap dipakai.', 'success');
  runtime.setError(null);
}

export function bindDashboardRuntimeErrors({ bindRuntimeErrorHandlers, runtime } = {}) {
  bindRuntimeErrorHandlers((normalized, originalError) => {
    runtime.setStatus(runtime.toActionableErrorMessage(normalized), 'error', {
      retry: runtime.canRetryFromError(normalized),
    });
    runtime.setError(originalError);
  });
}
