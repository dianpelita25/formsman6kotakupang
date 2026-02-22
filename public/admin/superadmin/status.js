export function createSuperadminStatusController({
  refs,
  setInlineStatus,
  setErrorDebugPanel,
  activityFeed,
}) {
  function setStatus(message, kind = 'info', error = null) {
    setInlineStatus(refs.statusEl, message, kind);
    if (error) {
      if (refs.errorDebugWrapEl) {
        refs.errorDebugWrapEl.hidden = false;
        refs.errorDebugWrapEl.open = false;
      }
      setErrorDebugPanel(refs.errorDebugEl, error);
      return;
    }
    if (refs.errorDebugEl) {
      refs.errorDebugEl.textContent = 'Belum ada error.';
    }
    if (refs.errorDebugWrapEl) {
      refs.errorDebugWrapEl.hidden = true;
      refs.errorDebugWrapEl.open = false;
    }
  }

  function setPromptStatus(message, kind = 'info') {
    setInlineStatus(refs.promptStatusEl, message, kind);
  }

  function pushActivity(level, action, detail) {
    activityFeed.push(level, action, detail);
  }

  function setButtonLoading(button, loading, loadingLabel = 'Memproses...') {
    if (!button) return;
    if (loading) {
      button.dataset.labelOriginal = button.textContent || '';
      button.textContent = loadingLabel;
      button.disabled = true;
      button.classList.add('is-loading');
      return;
    }
    const original = button.dataset.labelOriginal;
    if (original) {
      button.textContent = original;
    }
    button.disabled = false;
    button.classList.remove('is-loading');
  }

  function setToggleModalLoading(loading) {
    setButtonLoading(refs.toggleModalConfirmBtn, loading);
    if (refs.toggleModalCancelBtn) {
      refs.toggleModalCancelBtn.disabled = loading;
    }
  }

  return {
    setStatus,
    setPromptStatus,
    pushActivity,
    setButtonLoading,
    setToggleModalLoading,
  };
}
