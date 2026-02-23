export const INTERNAL_SERVER_ERROR_MESSAGE = 'Terjadi kesalahan internal server.';
export const DB_UNREADY_ERROR_MESSAGE = 'Database belum siap.';

export function buildSafeErrorExtra(code = '') {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return {};
  return { code: normalizedCode };
}

export function logServerError(scope, requestId, error) {
  const tag = String(scope || 'server-error').trim() || 'server-error';
  const rid = String(requestId || 'unknown').trim() || 'unknown';
  const details = error?.stack || error?.message || error;
  console.error(`[${tag}] requestId=${rid}`, details);
}
