export function createResponsesEventBinder({
  state,
  applyFilterBtn,
  retryBtnEl,
  responseSearchBtn,
  responseSearchEl,
  responsesPrevBtn,
  responsesNextBtn,
  filterVersionEl,
  runWithButtonLoading,
  validateDateRange,
  refreshDashboardData,
  loadResponses,
  presentError,
  setStatus,
  setError,
} = {}) {
  function bindResponsesEvents() {
    applyFilterBtn?.addEventListener('click', async () => {
      await refreshDashboardData({
        startMessage: 'Memuat data dashboard sesuai filter...',
        successMessage: 'Dashboard berhasil diperbarui.',
      });
    });

    retryBtnEl?.addEventListener('click', async () => {
      await refreshDashboardData({
        startMessage: 'Mencoba ulang koneksi dashboard...',
        successMessage: 'Dashboard berhasil dipulihkan.',
        keepPage: true,
      });
    });

    responseSearchBtn?.addEventListener('click', async () => {
      if (!validateDateRange()) return;
      state.page = 1;
      state.search = String(responseSearchEl?.value || '').trim();
      try {
        await runWithButtonLoading(responseSearchBtn, 'Mencari...', async () => {
          await loadResponses();
          setStatus(`Pencarian selesai. Menampilkan hasil untuk "${state.search || 'semua'}".`, 'success');
          setError(null);
        });
      } catch (error) {
        presentError(error, 'Gagal mencari respons.');
      }
    });

    responsesPrevBtn?.addEventListener('click', async () => {
      if (state.page <= 1) return;
      state.page -= 1;
      try {
        await runWithButtonLoading(
          responsesPrevBtn,
          'Memuat...',
          async () => {
            await loadResponses();
            setStatus('Halaman respons diperbarui.', 'success');
            setError(null);
          },
          [responsesNextBtn]
        );
      } catch (error) {
        presentError(error, 'Gagal memuat halaman respons.');
      }
    });

    responsesNextBtn?.addEventListener('click', async () => {
      const totalPages = Math.max(1, Math.ceil((state.totalResponses || 0) / state.pageSize));
      if (state.page >= totalPages) return;
      state.page += 1;
      try {
        await runWithButtonLoading(
          responsesNextBtn,
          'Memuat...',
          async () => {
            await loadResponses();
            setStatus('Halaman respons diperbarui.', 'success');
            setError(null);
          },
          [responsesPrevBtn]
        );
      } catch (error) {
        presentError(error, 'Gagal memuat halaman respons.');
      }
    });

    filterVersionEl?.addEventListener('change', async () => {
      await refreshDashboardData({
        startMessage: 'Versi data diubah. Memuat ulang dashboard...',
        successMessage: 'Dashboard berhasil diperbarui untuk versi terpilih.',
      });
    });
  }

  return {
    bindResponsesEvents,
  };
}
