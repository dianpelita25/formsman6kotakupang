import { setErrorDebugPanel } from '/forms-static/shared/ux.js';

export function createFormStatusController(statusMessage, statusDebugWrap, statusDebug) {
  function setDebug(error = null) {
    if (!statusDebugWrap || !statusDebug) return;
    if (!error) {
      statusDebugWrap.style.display = 'none';
      statusDebugWrap.open = false;
      statusDebug.textContent = 'Belum ada error.';
      return;
    }
    statusDebugWrap.style.display = 'block';
    statusDebugWrap.open = true;
    setErrorDebugPanel(statusDebug, error);
  }

  function setStatus(message, type = '', error = null) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`.trim();
    setDebug(error);
  }

  return { setStatus, setDebug };
}
