import { parseAnalysisToBlocks } from './ai-markdown.js';
import { renderFooterAllPages, renderPdfDocument } from './ai-pdf-renderer.js';

export function createAiPdfHandlers({
  state,
  filterFromEl,
  filterToEl,
  aiPdfBtn,
  aiLoadBtn,
  aiRunBtn,
  getActiveMode,
  getModeLabel,
  formatNumber,
  formatDateTime,
  formatVersionShort,
  normalizeQuestionCode,
  runWithButtonLoading,
  setStatus,
  setError,
  normalizeUiError,
} = {}) {
  function resolveVersionLabel() {
    const selectedVersionId = String(state.selectedVersionId || state.questionnaireVersionId || '').trim();
    if (!selectedVersionId) return 'Versi publish aktif';
    const selectedVersion = (state.availableVersions || []).find((item) => item.id === selectedVersionId);
    if (!selectedVersion) return formatVersionShort(selectedVersionId);
    return `v${selectedVersion.version} (${selectedVersion.status})`;
  }

  function formatDateRangeLabel() {
    const from = String(filterFromEl.value || '').trim();
    const to = String(filterToEl.value || '').trim();
    if (!from && !to) return 'Semua data (tanpa filter tanggal)';
    if (from && to) return `${from} s.d. ${to}`;
    if (from) return `Mulai ${from}`;
    return `Sampai ${to}`;
  }

  function buildAiMetadataLines() {
    return [
      `Organisasi: ${state.tenantSlug}`,
      `Kuesioner: ${state.questionnaireSlug}`,
      `Versi Data: ${resolveVersionLabel()}`,
      `Rentang Data: ${formatDateRangeLabel()}`,
    ];
  }

  function buildPdfContext() {
    const mode = getActiveMode();
    const modeLabel = getModeLabel(mode);
    const analysisText = String(state.latestAi?.analysis || '').trim();
    const selectedQuestion = (state.radioQuestions || []).find((question) => question.name === state.selectedRadioQuestion);
    const selectedQuestionTitle = selectedQuestion
      ? `${normalizeQuestionCode(selectedQuestion)} - ${selectedQuestion.label || selectedQuestion.name || '-'}`
      : 'Belum ada pertanyaan pilihan yang dipilih';

    const distributionRows = (selectedQuestion?.counts || []).map((entry) => [entry.label, formatNumber(entry.total || 0)]);
    const summaryRows = [
      ['Total Respons', formatNumber(state.summary?.totalResponses || 0)],
      ['Respons Hari Ini', formatNumber(state.summary?.responsesToday || 0)],
      ['Rata-rata Skala', formatNumber(state.summary?.avgScaleOverall || 0, 2)],
      ['Submit Terakhir', formatDateTime(state.summary?.lastSubmittedAt)],
      ['Total Pertanyaan', formatNumber(state.questionTypeStats?.total || 0)],
      ['Pertanyaan Skala', formatNumber(state.questionTypeStats?.scale || 0)],
      ['Pertanyaan Pilihan Tunggal', formatNumber(state.questionTypeStats?.radio || 0)],
      ['Pertanyaan Pilihan Ganda', formatNumber(state.questionTypeStats?.checkbox || 0)],
      ['Pertanyaan Teks', formatNumber(state.questionTypeStats?.text || 0)],
    ];

    return {
      title: `Laporan Analisis AI - ${modeLabel}`,
      subtitle: 'AITI Forms | Dashboard Kuesioner',
      modeLabel,
      analyzedAt: formatDateTime(state.latestAi?.createdAt) || '-',
      metadataLines: buildAiMetadataLines(),
      analysisText,
      blocks: parseAnalysisToBlocks(analysisText),
      summaryRows,
      distributionTitle: selectedQuestionTitle,
      distributionRows,
      filename: `laporan-analisis-${state.tenantSlug}-${state.questionnaireSlug}-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`,
    };
  }

  async function downloadAiPdf() {
    const analysisText = String(state.latestAi?.analysis || '').trim();
    if (!analysisText) {
      setStatus('Belum ada analisis untuk diunduh.', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || typeof jsPDF !== 'function') {
      setStatus('Library PDF tidak tersedia.', 'error');
      return;
    }

    try {
      await runWithButtonLoading(
        aiPdfBtn,
        'Membuat PDF...',
        async () => {
          const context = buildPdfContext();
          const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
          renderPdfDocument(doc, context);
          renderFooterAllPages(doc);
          doc.save(context.filename);
        },
        [aiLoadBtn, aiRunBtn]
      );

      setStatus('PDF analisis berhasil diunduh.', 'success');
      setError(null);
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal membuat PDF analisis.');
      setStatus(normalized.message, 'error');
      setError(error);
    }
  }

  return {
    downloadAiPdf,
  };
}
