export function createSchoolBenchmarkLoader({
  state,
  api,
  baseApiPath,
  buildCommonQuery,
  setStatus,
  presentError,
} = {}) {
  return async function loadSchoolBenchmark({ silent = false, force = false } = {}) {
    const hasBenchmark = Boolean(state.analyticsCapabilities?.hasBenchmark);
    if (!hasBenchmark) {
      state.schoolBenchmarkResult = null;
      if (!silent) {
        setStatus('Benchmark sekolah membutuhkan minimal 2 sekolah pada kuesioner yang sama.', 'warning');
      }
      return null;
    }

    if (state.schoolBenchmarkResult && !force) {
      return state.schoolBenchmarkResult;
    }

    try {
      const query = buildCommonQuery().toString();
      const payload = await api(
        `${baseApiPath()}/analytics/school-benchmark${query ? `?${query}` : ''}`,
        undefined,
        'Gagal memuat benchmark antar sekolah.'
      );
      state.schoolBenchmarkResult = payload?.data && typeof payload.data === 'object' ? payload.data : null;
      if (!silent) {
        setStatus('Benchmark antar sekolah berhasil dimuat.', 'success');
      }
      return state.schoolBenchmarkResult;
    } catch (error) {
      state.schoolBenchmarkResult = null;
      if (!silent) {
        presentError(error, 'Gagal memuat benchmark antar sekolah.');
      }
      return null;
    }
  };
}
