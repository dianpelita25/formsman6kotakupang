import { bindRuntimeErrorHandlers, normalizeUiError, requestJson, setErrorDebugPanel } from '/forms-static/shared/ux.js';
import { initLegacyDashboard } from '/forms-static/shared/dashboard-legacy/core.js';

function getSchoolSlugFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] || '';
}

function getAdminApiBase() {
  const schoolSlug = getSchoolSlugFromPath();
  if (!schoolSlug) {
    throw new Error('School slug tidak ditemukan di URL dashboard.');
  }
  return `/forms/${schoolSlug}/admin/api`;
}

function initDashboardLinks() {
  const schoolSlug = getSchoolSlugFromPath();
  const backToFormLink = document.getElementById('back-to-form-link');
  if (backToFormLink) {
    backToFormLink.href = `/forms/${schoolSlug}/`;
  }

  const exportCsvLink = document.getElementById('export-csv-link');
  if (exportCsvLink) {
    exportCsvLink.href = `/forms/${schoolSlug}/admin/api/responses/export.csv`;
  }
}

const errorDebugEl = document.getElementById('error-debug');

initLegacyDashboard({
  apiBase: getAdminApiBase(),
  requestJson,
  normalizeError: normalizeUiError,
  onBeforeInit: initDashboardLinks,
  onStatusError: (error) => setErrorDebugPanel(errorDebugEl, error),
  onAiStatusError: (error) => setErrorDebugPanel(errorDebugEl, error),
  onStatusClear: () => {
    if (errorDebugEl) {
      errorDebugEl.textContent = 'Belum ada error.';
    }
  },
  bindRuntimeErrors: bindRuntimeErrorHandlers,
});
