import { createAdoptionRenderer } from './charts/adoption.js';
import { loadDashboardPayload } from './charts/loader.js';
import { buildAvgChart, buildQ10Chart, renderQ10Breakdown } from './charts/summary.js';

export function createChartsModule(config = {}) {
  const { apiBase, requestJson, normalizeError, setStatus, formatScore, dom } = config;
  const { kpiTotal, kpiQ12, kpiInterest, kpiAi, q10Breakdown } = dom;

  const adoptionRenderer = createAdoptionRenderer({ dom, formatScore });

  async function loadDashboard() {
    setStatus('Memuat analytics...');

    try {
      const { summary, distribution } = await loadDashboardPayload({ apiBase, requestJson });

      if (kpiTotal) kpiTotal.textContent = summary.totalResponses;
      if (kpiQ12) kpiQ12.textContent = formatScore(summary.avgQ12);
      if (kpiInterest) kpiInterest.textContent = `${summary.interestedPct.toFixed(2)}%`;
      if (kpiAi) kpiAi.textContent = formatScore(summary.avgAiAdoption);

      buildAvgChart(distribution.questionAverages);
      buildQ10Chart(distribution.q10Distribution);
      renderQ10Breakdown(q10Breakdown, distribution.q10Distribution, summary.totalResponses);
      adoptionRenderer.renderAdoptionIndex(distribution.questionAverages);

      if (!summary.totalResponses) {
        setStatus('Belum ada data submission. Silakan kirim 1 feedback dari form untuk melihat visual.', false);
        return;
      }

      setStatus('Analytics berhasil dimuat.');
    } catch (error) {
      const normalized = normalizeError(error, 'Gagal memuat dashboard analytics.');
      setStatus(normalized.message, true, error);
    }
  }

  return {
    loadDashboard,
  };
}
