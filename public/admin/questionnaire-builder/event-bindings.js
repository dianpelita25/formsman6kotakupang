export function bindBuilderEvents({
  refs,
  state,
  normalizeUiError,
  setStatus,
  setError,
  pushActivity,
  syncMetaFromInputs,
  renderPreview,
  syncAdvancedJson,
  setComposerQuestionTypeVisibility,
  addQuestionFromComposer,
  questionListController,
  loadDraft,
  saveDraft,
  publishDraft,
  runWithButtonLoading,
  applyJsonAdvanced,
}) {
  refs.stepButtons.forEach((button) => {
    button.addEventListener('click', () => {
      questionListController.openStep(button.dataset.stepTarget);
    });
  });

  refs.metaTitleEl.addEventListener('input', () => {
    syncMetaFromInputs();
    renderPreview();
    syncAdvancedJson();
  });
  refs.metaGreetingTitleEl.addEventListener('input', () => {
    syncMetaFromInputs();
    renderPreview();
    syncAdvancedJson();
  });
  refs.metaGreetingTextEl.addEventListener('input', () => {
    syncMetaFromInputs();
    renderPreview();
    syncAdvancedJson();
  });

  refs.newQuestionTypeEl.addEventListener('change', setComposerQuestionTypeVisibility);
  refs.addQuestionBtn.addEventListener('click', () => {
    try {
      addQuestionFromComposer();
      setStatus('Pertanyaan baru ditambahkan.', 'success');
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal menambah pertanyaan.');
      if (String(normalized.message || '').toLowerCase().includes('minimal 2 opsi')) {
        refs.newQuestionOptionsEl.focus();
      }
      setStatus(normalized.message, 'error');
      setError(error);
      pushActivity('error', 'Tambah pertanyaan', normalized.message);
    }
  });

  refs.questionListEl.addEventListener('click', questionListController.handleQuestionListInteraction);
  refs.questionListEl.addEventListener('input', questionListController.handleQuestionListInteraction);
  refs.questionListEl.addEventListener('change', questionListController.handleQuestionListInteraction);

  refs.reloadDraftBtn.addEventListener('click', async () => {
    if (state.isPublishing) return;
    await runWithButtonLoading(refs.reloadDraftBtn, 'Memuat...', async () => {
      await loadDraft();
      setStatus('Draf dimuat ulang.', 'success');
    });
  });

  refs.saveDraftBtn.addEventListener('click', async () => {
    if (state.isPublishing) return;
    await runWithButtonLoading(refs.saveDraftBtn, 'Menyimpan...', async () => {
      await saveDraft();
    });
  });

  refs.publishBtn.addEventListener('click', async () => {
    await publishDraft();
  });

  refs.syncAdvancedBtn.addEventListener('click', () => {
    syncAdvancedJson();
    setStatus('JSON lanjutan disinkronkan dari builder visual.', 'success');
  });

  refs.applyAdvancedBtn.addEventListener('click', () => {
    applyJsonAdvanced();
  });
}
