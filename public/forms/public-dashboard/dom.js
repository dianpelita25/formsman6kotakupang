export const refs = {
  dashboardTitle: document.getElementById('dashboard-title'),
  dashboardSubtitle: document.getElementById('dashboard-subtitle'),
  dashboardStatus: document.getElementById('dashboard-status'),
  errorDebugWrap: document.getElementById('dashboard-error-debug-wrap'),
  errorDebug: document.getElementById('dashboard-error-debug'),
  openFormLink: document.getElementById('open-form-link'),
  insufficientPanel: document.getElementById('insufficient-panel'),
  insufficientMessage: document.getElementById('insufficient-message'),
  contentPanel: document.getElementById('content-panel'),
  metricTotalResponses: document.getElementById('metric-total-responses'),
  metricResponsesToday: document.getElementById('metric-responses-today'),
  metricAvgScale: document.getElementById('metric-avg-scale'),
  metricLastSubmitted: document.getElementById('metric-last-submitted'),
  distributionTableBody: document.getElementById('distribution-table-body'),
};

export function parseDashboardContext(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);

  if (parts.length < 4 || parts[0] !== 'forms' || parts[3] !== 'dashboard') {
    return { tenantSlug: '', questionnaireSlug: '' };
  }

  const tenantSlug = String(parts[1] || '').trim();
  const questionnaireSlug = String(parts[2] || '').trim();
  return { tenantSlug, questionnaireSlug };
}

export function buildDashboardBasePath(context) {
  return `/forms/${context.tenantSlug}/${context.questionnaireSlug}`;
}

export function formatDateTime(value) {
  const parsed = new Date(String(value || '').trim());
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
