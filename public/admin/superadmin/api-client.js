export function createSuperadminApiClient({
  requestJson,
  normalizeUiError,
  setStatus,
  pushActivity,
}) {
  async function api(path, options, actionLabel) {
    try {
      return await requestJson(path, options);
    } catch (error) {
      const normalized = normalizeUiError(error);
      setStatus(normalized.message, 'error', error);
      pushActivity(
        'error',
        actionLabel || 'Request gagal',
        `${normalized.method} ${normalized.path} (status ${normalized.status})`
      );
      throw error;
    }
  }

  return {
    api,
    requestJson,
  };
}
