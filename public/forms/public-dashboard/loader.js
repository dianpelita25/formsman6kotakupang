import { requestJson } from '/forms-static/shared/ux.js';
import { buildDashboardBasePath, parseDashboardContext } from './dom.js';

export async function loadDashboard(refs, setStatus, showInsufficientState, showDashboardState) {
  const context = parseDashboardContext(window.location.pathname);
  if (!context.tenantSlug || !context.questionnaireSlug) {
    setStatus('URL dashboard publik tidak valid.', 'error');
    return;
  }

  const basePath = buildDashboardBasePath(context);
  refs.openFormLink.href = `${basePath}/`;
  setStatus('Memuat dashboard publik...');

  const [summaryResponse, distributionResponse, trendResponse] = await Promise.all([
    requestJson(`${basePath}/api/dashboard/summary`),
    requestJson(`${basePath}/api/dashboard/distribution`),
    requestJson(`${basePath}/api/dashboard/trend`),
  ]);

  const summaryPayload = summaryResponse?.data || {};
  const distributionPayload = distributionResponse?.data || {};
  const trendPayload = trendResponse?.data || {};
  const questionnaire = summaryPayload.questionnaire || distributionPayload.questionnaire || trendPayload.questionnaire || {};
  const privacy = summaryPayload.privacy || distributionPayload.privacy || trendPayload.privacy || {};
  const isInsufficient =
    summaryPayload.status === 'insufficient_sample' ||
    distributionPayload.status === 'insufficient_sample' ||
    trendPayload.status === 'insufficient_sample';

  const title = String(questionnaire?.name || '').trim();
  refs.dashboardTitle.textContent = title ? `Dashboard Publik - ${title}` : 'Dashboard Publik';
  refs.dashboardSubtitle.textContent = `Agregat saja | sampel minimum=${Number(privacy.minSampleSize || 10)} | bucket minimum=${Number(
    privacy.minBucketSize || 10
  )}`;

  if (isInsufficient) {
    showInsufficientState(refs, summaryPayload);
    setStatus('Data belum cukup untuk publikasi dashboard.', 'warning');
    return;
  }

  showDashboardState(summaryPayload, distributionPayload, trendPayload);
  setStatus('Dashboard publik berhasil dimuat.', 'success');
}
