import { setErrorDebugPanel, setInlineStatus } from '/forms-static/shared/ux.js';

export function createStatusController(statusEl, errorDebugEl, errorDebugWrapEl) {
  function setStatus(message, kind = 'info', error = null) {
    setInlineStatus(statusEl, message, kind);
    if (error) {
      if (errorDebugWrapEl) {
        errorDebugWrapEl.hidden = false;
        errorDebugWrapEl.open = false;
      }
      setErrorDebugPanel(errorDebugEl, error);
      return;
    }
    if (errorDebugEl) {
      errorDebugEl.textContent = 'Belum ada error.';
    }
    if (errorDebugWrapEl) {
      errorDebugWrapEl.hidden = true;
      errorDebugWrapEl.open = false;
    }
  }

  return { setStatus };
}
