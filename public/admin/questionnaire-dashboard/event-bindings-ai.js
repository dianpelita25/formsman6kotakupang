export function createAiEventBinder({
  aiLoadBtn,
  aiRunBtn,
  aiModeEl,
  aiPdfBtn,
  runWithButtonLoading,
  loadAiLatest,
  runAiAnalysis,
  presentError,
  setStatus,
  setError,
  stopAiProgressIndicator,
  setAiOutput,
  downloadAiPdf,
} = {}) {
  function bindAiEvents() {
    aiLoadBtn?.addEventListener('click', async () => {
      try {
        await runWithButtonLoading(
          aiLoadBtn,
          'Memuat...',
          async () => {
            await loadAiLatest();
            setStatus('Analisis AI terbaru dimuat.', 'success');
            setError(null);
          },
          [aiRunBtn]
        );
      } catch (error) {
        presentError(error, 'Gagal memuat analisis AI terbaru.');
      }
    });

    aiRunBtn?.addEventListener('click', async () => {
      try {
        await runAiAnalysis();
      } catch (error) {
        presentError(error, 'Gagal menjalankan analisis AI.');
      }
    });

    aiModeEl?.addEventListener('change', () => {
      stopAiProgressIndicator();
      if (aiPdfBtn) aiPdfBtn.disabled = true;
      setAiOutput('Mode diganti. Klik "Muat Terakhir" atau "Jalankan Analisis" untuk mode ini.');
    });

    aiPdfBtn?.addEventListener('click', downloadAiPdf);
  }

  return {
    bindAiEvents,
  };
}
