export function createBuilderPublishService({
  state,
  refs,
  baseApiPath,
  publicFormPath,
  setStatus,
  pushActivity,
  api,
  saveDraft,
  loadDraft,
  refreshResponseFlag,
  detectBreakingChanges,
}) {
  function formatPublishTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function hidePublishResult() {
    refs.publishResultEl.hidden = true;
    refs.publishResultTitleEl.textContent = 'Publikasi berhasil.';
    refs.publishResultMessageEl.textContent = '';
  }

  function setPublishProcessing(isBusy) {
    state.isPublishing = Boolean(isBusy);
    if (refs.publishBtn) {
      refs.publishBtn.disabled = state.isPublishing;
      refs.publishBtn.classList.toggle('is-loading', state.isPublishing);
      refs.publishBtn.textContent = state.isPublishing ? 'Mempublikasikan...' : 'Publikasikan';
    }
    if (refs.saveDraftBtn) refs.saveDraftBtn.disabled = state.isPublishing;
    if (refs.reloadDraftBtn) refs.reloadDraftBtn.disabled = state.isPublishing;
    if (refs.addQuestionBtn) refs.addQuestionBtn.disabled = state.isPublishing;
  }

  function showPublishResult(published = {}) {
    const version = published?.version ? `v${published.version}` : 'versi terbaru';
    const publishedAt = formatPublishTime(published?.publishedAt);
    refs.publishResultTitleEl.textContent = `Publikasi ${version} berhasil.`;
    refs.publishResultMessageEl.textContent = `Kuesioner sudah live dengan ${state.fields.length} pertanyaan. Dipublikasikan pada ${publishedAt}. Pilih tombol di bawah untuk lanjut.`;
    refs.publishResultFormLinkEl.href = publicFormPath();
    refs.publishResultDashboardLinkEl.href = refs.openDashboardLink.href;
    refs.publishResultEl.hidden = false;
  }

  async function publishDraft() {
    if (state.isPublishing) return;
    hidePublishResult();
    await refreshResponseFlag().catch(() => {
      state.hasResponses = false;
    });

    const { removed, typeChanged } = detectBreakingChanges();
    if (state.hasResponses && (removed.length || typeChanged.length)) {
      const warnings = [];
      if (removed.length) warnings.push(`Pertanyaan dihapus: ${removed.join(', ')}`);
      if (typeChanged.length) warnings.push(`Tipe diubah: ${typeChanged.join(', ')}`);

      refs.publishWarningEl.hidden = false;
      refs.publishWarningEl.innerHTML = `
        <strong>Peringatan perubahan berisiko</strong>
        <p>Kuesioner ini sudah memiliki respons. Publikasikan akan membuat versi baru. Pastikan perubahan ini memang final.</p>
        <ul>${warnings.map((item) => `<li>${item}</li>`).join('')}</ul>
      `;

      const confirmed = window.confirm(
        'Kuesioner sudah memiliki respons. Perubahan breaking terdeteksi dan akan dipublikasikan sebagai versi baru. Lanjutkan?'
      );
      if (!confirmed) {
        setStatus('Publikasi dibatalkan.', 'warning');
        pushActivity('warning', 'Publikasi dibatalkan', 'Pengguna membatalkan setelah peringatan perubahan berisiko');
        return;
      }
    } else {
      refs.publishWarningEl.hidden = true;
      refs.publishWarningEl.innerHTML = '';
    }

    setPublishProcessing(true);
    setStatus('Sedang menyimpan perubahan dan mempublikasikan. Mohon tunggu...', 'warning');
    pushActivity('warning', 'Publikasikan kuesioner', 'Sedang memproses publikasi...');

    try {
      await saveDraft({ silentStatus: true, silentActivity: true });
      const payload = await api(
        `${baseApiPath()}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        'Publikasikan kuesioner'
      );
      const published = payload?.data?.published || {};
      const versionInfo = published?.version ? `v${published.version}` : state.questionnaireSlug;
      pushActivity('success', 'Publikasikan kuesioner', `${state.questionnaireSlug} (${versionInfo})`);
      setStatus('Publikasi berhasil. Gunakan tombol "Buka Form Publik" atau "Buka Dashboard" untuk lanjut.', 'success');
      showPublishResult(published);
      await loadDraft();
    } finally {
      setPublishProcessing(false);
    }
  }

  return {
    hidePublishResult,
    setPublishProcessing,
    publishDraft,
  };
}
