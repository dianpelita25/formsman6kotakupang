export function createQueryBuilderHelpers({ state, filterFromEl, filterToEl, filterDaysEl, filterVersionEl } = {}) {
  function validateDateRange() {
    const from = String(filterFromEl?.value || '').trim();
    const to = String(filterToEl?.value || '').trim();
    if (!from || !to) return true;
    return new Date(from) <= new Date(to);
  }

  function buildCommonQuery({ includeDays = false, includeSearch = false } = {}) {
    const params = new URLSearchParams();
    const from = String(filterFromEl?.value || '').trim();
    const to = String(filterToEl?.value || '').trim();
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const selectedVersion = String(filterVersionEl?.value || '').trim();
    state.selectedVersionId = selectedVersion;
    if (selectedVersion) params.set('questionnaireVersionId', selectedVersion);

    if (includeDays) {
      const days = Number(filterDaysEl?.value || 30);
      params.set('days', String(Number.isFinite(days) ? Math.max(7, Math.min(365, Math.floor(days))) : 30));
    }

    if (includeSearch && state.search) {
      params.set('search', state.search);
    }

    const segmentDimensionId = String(state.activeSegmentFilter?.dimensionId || '').trim();
    const segmentBucket = String(state.activeSegmentFilter?.bucket || '').trim();
    if (segmentDimensionId && segmentBucket) {
      params.set('segmentDimensionId', segmentDimensionId);
      params.set('segmentBucket', segmentBucket);
    }

    return params;
  }

  return {
    validateDateRange,
    buildCommonQuery,
  };
}
