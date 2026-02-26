function escapeSelectorName(name) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(name);
  return String(name || '').replace(/["\\]/g, '\\$&');
}

function isFieldAnswered(field, form) {
  const fieldName = String((field && field.name) || '').trim();
  if (!fieldName) return false;
  const selectorName = escapeSelectorName(fieldName);

  if (field.type === 'checkbox') {
    return form.querySelectorAll(`input[type="checkbox"][name="${selectorName}"]:checked`).length > 0;
  }

  if (field.type === 'radio' || field.type === 'scale') {
    return Boolean(form.querySelector(`input[type="radio"][name="${selectorName}"]:checked`));
  }

  if (field.type === 'text') {
    const input = form.querySelector(`[name="${selectorName}"]`);
    return Boolean(String((input && input.value) || '').trim());
  }

  return false;
}

export function createFormViewState({
  feedbackForm,
  submitBtn,
  mobileSubmitBtn,
  formProgress,
  mobileSubmitProgress,
  formLoadingNote,
  submitIdleLabel = 'Kirim',
  loadingLabel = 'Memuat...',
} = {}) {
  function updateProgress({ schemaReady, activeFields } = {}) {
    if (!schemaReady) {
      if (formProgress) formProgress.textContent = 'Memuat pertanyaan...';
      if (mobileSubmitProgress) mobileSubmitProgress.textContent = 'Memuat...';
      return;
    }

    const fields = Array.isArray(activeFields) ? activeFields : [];
    const total = fields.length;
    if (total <= 0) {
      if (formProgress) formProgress.textContent = 'Belum ada pertanyaan aktif.';
      if (mobileSubmitProgress) mobileSubmitProgress.textContent = 'Belum ada pertanyaan';
      return;
    }

    const answered = fields.reduce((count, field) => {
      return count + (isFieldAnswered(field, feedbackForm) ? 1 : 0);
    }, 0);

    const progressLabel = `${answered}/${total} pertanyaan terisi`;
    if (formProgress) formProgress.textContent = progressLabel;
    if (mobileSubmitProgress) mobileSubmitProgress.textContent = `${answered}/${total} terisi`;
  }

  function setLoadingNote(message, visible) {
    if (!formLoadingNote) return;
    formLoadingNote.textContent = String(message || '');
    formLoadingNote.hidden = !visible;
  }

  function syncSubmitControls({ schemaReady, activeFields, submitting } = {}) {
    const hasFields = Array.isArray(activeFields) && activeFields.length > 0;
    const readyToSubmit = Boolean(schemaReady) && hasFields && !submitting;
    const buttonLabel = submitting ? 'Mengirim...' : schemaReady ? submitIdleLabel : loadingLabel;

    if (submitBtn) {
      submitBtn.disabled = !readyToSubmit;
      submitBtn.textContent = buttonLabel;
    }

    if (mobileSubmitBtn) {
      mobileSubmitBtn.disabled = !readyToSubmit;
      mobileSubmitBtn.textContent = buttonLabel;
    }
  }

  return {
    updateProgress,
    setLoadingNote,
    syncSubmitControls,
  };
}
