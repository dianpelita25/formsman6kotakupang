import { createChartsModule } from './charts.js';
import { createAiModule } from './ai.js';
import { createPdfModule } from './pdf.js';

function defaultNormalizeError(error, fallback = 'Terjadi kesalahan.') {
  const message = String(error?.message || '').trim() || fallback;
  const status = Number(error?.status || 0);
  return {
    message,
    status: Number.isFinite(status) ? status : 0,
  };
}

function formatScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function collectDashboardDom() {
  return {
    kpiTotal: document.getElementById('kpi-total'),
    kpiQ12: document.getElementById('kpi-q12'),
    kpiInterest: document.getElementById('kpi-interest'),
    kpiAi: document.getElementById('kpi-ai'),
    q10Breakdown: document.getElementById('q10-breakdown'),
    aiRunBtn: document.getElementById('ai-run'),
    aiOutput: document.getElementById('ai-output'),
    aiStatus: document.getElementById('ai-status'),
    aiDownloadPdfBtn: document.getElementById('ai-download-pdf'),
    aiSubtitle: document.getElementById('ai-subtitle'),
    aiGroupInternalBtn: document.getElementById('ai-group-internal'),
    aiGroupExternalBtn: document.getElementById('ai-group-external'),
    aiGroupLiveBtn: document.getElementById('ai-group-live'),
    aiExternalLabel: document.getElementById('ai-external-label'),
    aiExternalAudienceSelect: document.getElementById('ai-external-audience'),
    adoptionScore: document.getElementById('adoption-score'),
    adoptionLabel: document.getElementById('adoption-label'),
    adoptionGauge: document.getElementById('adoption-gauge'),
    adoptionRadar: document.getElementById('adoptionRadar'),
    adoptionQ7: document.getElementById('adoption-q7'),
    adoptionQ8: document.getElementById('adoption-q8'),
    adoptionQ9: document.getElementById('adoption-q9'),
    adoptionQ11: document.getElementById('adoption-q11'),
    adoptionBarQ7: document.getElementById('adoption-bar-q7'),
    adoptionBarQ8: document.getElementById('adoption-bar-q8'),
    adoptionBarQ9: document.getElementById('adoption-bar-q9'),
    adoptionBarQ11: document.getElementById('adoption-bar-q11'),
  };
}

export function initLegacyDashboard(config = {}) {
  const {
    apiBase = './api',
    requestJson = null,
    normalizeError = defaultNormalizeError,
    onStatusError = null,
    onAiStatusError = null,
    onStatusClear = null,
    bindRuntimeErrors = null,
    onBeforeInit = null,
  } = config;

  if (typeof requestJson !== 'function') {
    throw new Error('requestJson wajib disediakan untuk initLegacyDashboard.');
  }

  if (typeof onBeforeInit === 'function') {
    onBeforeInit();
  }

  const statusEl = document.getElementById('status');
  const errorDebugEl = document.getElementById('error-debug');
  const dom = collectDashboardDom();

  function setStatus(message, isError = false, error = null) {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status${isError ? ' error' : ''}`;
    }
    if (error) {
      if (typeof onStatusError === 'function') {
        onStatusError(error, errorDebugEl);
      }
      return;
    }
    if (typeof onStatusClear === 'function') {
      onStatusClear(errorDebugEl);
    } else if (errorDebugEl) {
      errorDebugEl.textContent = 'Belum ada error.';
    }
  }

  function setAiStatus(message, isError = false, error = null) {
    if (dom.aiStatus) {
      dom.aiStatus.textContent = message;
      dom.aiStatus.className = `status${isError ? ' error' : ''}`;
    }
    if (error) {
      const handler = typeof onAiStatusError === 'function' ? onAiStatusError : onStatusError;
      if (typeof handler === 'function') {
        handler(error, errorDebugEl);
      }
    }
  }

  const chartsModule = createChartsModule({
    apiBase,
    requestJson,
    normalizeError,
    setStatus,
    formatScore,
    dom,
  });

  const aiModule = createAiModule({
    apiBase,
    requestJson,
    normalizeError,
    setAiStatus,
    formatDateTime,
    dom,
  });

  const pdfModule = createPdfModule({
    aiDownloadPdfBtn: dom.aiDownloadPdfBtn,
    setAiStatus,
    refreshAiPdfButtonState: aiModule.refreshAiPdfButtonState,
    getLatestAnalysisState: aiModule.getLatestAnalysisState,
    getActiveAnalysisMode: aiModule.getActiveAnalysisMode,
    getModeLabel: aiModule.getModeLabel,
    formatDateTime,
    formatScore,
  });

  chartsModule.loadDashboard();
  aiModule.init();
  pdfModule.init();

  if (typeof bindRuntimeErrors === 'function') {
    bindRuntimeErrors((normalized, originalError) => {
      setStatus(normalized?.message || 'Terjadi error runtime di UI.', true, originalError);
    });
  }
}
