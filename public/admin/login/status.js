import { setErrorDebugPanel, setInlineStatus } from '/forms-static/shared/ux.js';

export function createStatusController(statusEl, errorDebugEl) {
  function setStatus(message, kind = 'info', error = null) {
    setInlineStatus(statusEl, message, kind);
    if (error) {
      setErrorDebugPanel(errorDebugEl, error);
    } else if (errorDebugEl) {
      errorDebugEl.textContent = 'Belum ada error.';
    }
  }

  return { setStatus };
}
