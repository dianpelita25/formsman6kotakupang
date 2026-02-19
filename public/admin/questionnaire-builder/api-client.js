export function createBuilderApiClient({
  requestJson,
  normalizeUiError,
  setStatus,
  setError,
  pushActivity,
}) {
  function api(path, options, actionLabel) {
    return requestJson(path, options).catch((error) => {
      const normalized = normalizeUiError(error, 'Terjadi kesalahan.');
      setStatus(normalized.message, 'error');
      setError(error);
      pushActivity('error', actionLabel, `${normalized.method} ${normalized.path} (${normalized.status})`);
      throw error;
    });
  }

  return {
    api,
    requestJson,
  };
}
