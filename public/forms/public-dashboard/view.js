import { formatDateTime } from './dom.js';
import { renderDistributionTable } from './table.js';

export function showInsufficientState(refs, payload = {}) {
  const privacy = payload?.privacy || {};
  const sampleSize = Number(privacy.sampleSize || 0);
  const minSampleSize = Number(privacy.minSampleSize || 30);

  refs.insufficientPanel.hidden = false;
  refs.contentPanel.hidden = true;
  refs.insufficientMessage.textContent = `Sampel publik saat ini ${sampleSize}. Minimal ${minSampleSize} respons diperlukan sebelum dashboard dipublikasikan.`;
}

export function showDashboardState(refs, charts, summaryPayload, distributionPayload, trendPayload) {
  const summary = summaryPayload?.summary || {};
  const distribution = distributionPayload?.distribution || {};
  const trend = trendPayload?.trend || {};

  refs.insufficientPanel.hidden = true;
  refs.contentPanel.hidden = false;
  refs.metricTotalResponses.textContent = String(Number(summary.totalResponses || 0));
  refs.metricResponsesToday.textContent = String(Number(summary.responsesToday || 0));
  refs.metricAvgScale.textContent = Number(summary.avgScaleOverall || 0).toFixed(2);
  refs.metricLastSubmitted.textContent = formatDateTime(summary.lastSubmittedAt);

  charts.resetCharts();
  charts.renderTrendChart(Array.isArray(trend.points) ? trend.points : []);
  charts.renderCriteriaChart(Array.isArray(summary.criteriaSummary) ? summary.criteriaSummary : []);
  charts.renderScaleChart(Array.isArray(summary.scaleAverages) ? summary.scaleAverages : []);
  renderDistributionTable(refs.distributionTableBody, distribution);
}
