import { parseAnalysisToBlocks } from './pdf-parser.js';
import { renderFooterAllPages, renderPdfDocument } from './pdf-renderer.js';

function buildAiMetadataLines(meta, formatScore) {
  const summary = meta?.summary || {};
  const totalResponses = Number(summary?.totalResponses ?? meta?.totalResponses ?? 0);
  const avgQ12 = formatScore(summary?.avgQ12);
  const avgAiAdoption = formatScore(summary?.avgAiAdoption);
  const interestedPct = Number(summary?.interestedPct ?? 0);

  return [
    `Total Responden: ${totalResponses}`,
    `Rata-rata Kepuasan (Q12): ${avgQ12}`,
    `Skor Adopsi AI: ${avgAiAdoption}`,
    `Minat Pelatihan Lanjutan: ${interestedPct.toFixed(2)}%`,
  ];
}

export function createPdfModule(config = {}) {
  const {
    aiDownloadPdfBtn,
    setAiStatus,
    refreshAiPdfButtonState,
    getLatestAnalysisState,
    getActiveAnalysisMode,
    getModeLabel,
    formatDateTime,
    formatScore,
  } = config;

  function buildPdfContext() {
    const latestAnalysisState = getLatestAnalysisState() || {};
    const activeMode = latestAnalysisState.mode || getActiveAnalysisMode();
    const modeLabel = getModeLabel(activeMode);
    const analysisText = (latestAnalysisState.analysis || '').trim();

    return {
      mode: activeMode,
      modeLabel,
      title: `Laporan Analisa AI - ${modeLabel}`,
      subtitle: 'Program AI Teaching Assistant | Dashboard Internal',
      analyzedAt: formatDateTime(latestAnalysisState.createdAt),
      metadataLines: buildAiMetadataLines(latestAnalysisState.meta, formatScore),
      analysisText,
      blocks: parseAnalysisToBlocks(analysisText),
      filename: `analisa-${activeMode}-${new Date().toISOString().slice(0, 10)}.pdf`,
    };
  }

  async function downloadAiPdf() {
    if (!aiDownloadPdfBtn) return;

    const context = buildPdfContext();
    if (!context.analysisText) {
      setAiStatus('Belum ada analisa untuk diunduh.', true);
      refreshAiPdfButtonState();
      return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || typeof jsPDF !== 'function') {
      setAiStatus('Library PDF belum siap.', true);
      return;
    }

    aiDownloadPdfBtn.disabled = true;

    try {
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      renderPdfDocument(pdf, context);
      renderFooterAllPages(pdf);
      pdf.save(context.filename);
      setAiStatus('PDF analisa berhasil diunduh.');
    } catch (error) {
      setAiStatus(error?.message || 'Gagal membuat PDF analisa.', true);
    } finally {
      refreshAiPdfButtonState();
    }
  }

  function init() {
    if (!aiDownloadPdfBtn) return;
    aiDownloadPdfBtn.addEventListener('click', downloadAiPdf);
  }

  return { init };
}
