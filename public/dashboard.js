import { initLegacyDashboard } from '/forms-static/shared/dashboard-legacy/core.js';

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload?.message || `Request gagal (${response.status}).`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

initLegacyDashboard({
  apiBase: './api',
  requestJson,
});
