import { formatDateTime } from './dom.js';
import { renderDistributionTable } from './table.js';

function isTrendRelevant(points = []) {
  const activeDays = (Array.isArray(points) ? points : []).filter((point) => Number(point?.total || 0) > 0).length;
  return activeDays >= 2;
}

export function showInsufficientState(refs, payload = {}) {
  const privacy = payload?.privacy || {};
  const sampleSize = Number(privacy.sampleSize || 0);
  const minSampleSize = Number(privacy.minSampleSize || 10);

  refs.insufficientPanel.hidden = false;
  refs.contentPanel.hidden = true;
  refs.insufficientMessage.textContent = `Sampel publik saat ini ${sampleSize}. Minimal ${minSampleSize} respons diperlukan sebelum dashboard dipublikasikan.`;
}

export function showDashboardState(refs, charts, summaryPayload, distributionPayload, trendPayload) {
  const summary = summaryPayload?.summary || {};
  const distribution = distributionPayload?.distribution || {};
  const trend = trendPayload?.trend || {};
  const trendPoints = Array.isArray(trend.points) ? trend.points : [];
  const trendVisible = isTrendRelevant(trendPoints);

  refs.insufficientPanel.hidden = true;
  refs.contentPanel.hidden = false;
  refs.metricTotalResponses.textContent = String(Number(summary.totalResponses || 0));
  refs.metricResponsesToday.textContent = String(Number(summary.responsesToday || 0));
  refs.metricAvgScale.textContent = Number(summary.avgScaleOverall || 0).toFixed(2);
  refs.metricLastSubmitted.textContent = formatDateTime(summary.lastSubmittedAt);

  charts.resetCharts();
  if (refs.trendCard) refs.trendCard.hidden = !trendVisible;
  if (trendVisible) {
    charts.renderTrendChart(trendPoints);
  }
  charts.renderCriteriaChart(Array.isArray(summary.criteriaSummary) ? summary.criteriaSummary : []);
  charts.renderScaleChart(Array.isArray(summary.scaleAverages) ? summary.scaleAverages : []);
  renderDistributionTable(refs.distributionTableBody, distribution);
}
