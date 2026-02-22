import { setErrorDebugPanel, setInlineStatus } from '/forms-static/shared/ux.js';

export function createStatusController({ statusElement, errorDebugWrap, errorDebug }) {
  function setStatus(message, kind = 'info', error = null) {
    setInlineStatus(statusElement, message, kind);
    if (!error) {
      if (errorDebugWrap) {
        errorDebugWrap.hidden = true;
        errorDebugWrap.open = false;
      }
      if (errorDebug) {
        errorDebug.textContent = 'Belum ada error.';
      }
      return;
    }

    if (errorDebugWrap) {
      errorDebugWrap.hidden = false;
      errorDebugWrap.open = false;
    }
    setErrorDebugPanel(errorDebug, error);
  }

  return { setStatus };
}
