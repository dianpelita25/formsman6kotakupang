export function createStatusErrorHelpers({
  statusEl,
  inlineStatusEl,
  inlineActionsEl,
  errorDebugEl,
  requestJson,
  normalizeUiError,
  setInlineStatus,
  setErrorDebugPanel,
  getAiRuntimeController,
} = {}) {
  function setRetryActionVisibility(visible = false) {
    if (!inlineActionsEl) return;
    inlineActionsEl.hidden = !visible;
  }

  function setStatus(message, kind = 'info', options = {}) {
    const { retry = false } = options || {};
    setInlineStatus(statusEl, message, kind);
    setInlineStatus(inlineStatusEl, message, kind);
    setRetryActionVisibility(Boolean(retry));
  }

  function setError(error = null) {
    if (!error) {
      if (errorDebugEl) errorDebugEl.textContent = 'Belum ada error.';
      return;
    }
    setErrorDebugPanel(errorDebugEl, error);
  }

  function toActionableErrorMessage(normalized = {}) {
    const base = String(normalized.message || 'Terjadi kesalahan.').trim() || 'Terjadi kesalahan.';
    const lowered = base.toLowerCase();
    const status = Number(normalized.status || 0);
    const path = String(normalized.path || '').trim();

    if (lowered.includes('invalid input syntax for type uuid')) {
      return 'Versi data tidak valid. Pilih versi data dari daftar lalu coba lagi.';
    }
    if (status === 0) {
      return `${base} Cek koneksi internet/server lalu klik ulang aksi ini.`;
    }
    if (status === 401) {
      return `${base} Silakan login ulang untuk melanjutkan.`;
    }
    if (status === 403) {
      return `${base} Pastikan akun Anda punya izin untuk aksi ini.`;
    }
    if (status === 404 && path.includes('/analytics/')) {
      return `${base} Coba pilih versi data lain lalu jalankan filter lagi.`;
    }
    if (status === 409) {
      return `${base} Muat ulang data terbaru lalu coba lagi.`;
    }
    if (status >= 500) {
      return `${base} Server sedang sibuk/bermasalah. Coba lagi beberapa saat atau muat ulang halaman.`;
    }

    return base;
  }

  function canRetryFromError(normalized = {}) {
    const status = Number(normalized.status || 0);
    const path = String(normalized.path || '').trim();
    if (status === 0) return true;
    if (status >= 500) return true;
    if (status === 404 && path.includes('/analytics/')) return true;
    if (status === 409) return true;
    return false;
  }

  function presentError(error, fallbackMessage = 'Terjadi kesalahan.') {
    const runtime = typeof getAiRuntimeController === 'function' ? getAiRuntimeController() : null;
    runtime?.stopAiProgressIndicator?.();
    const normalized = normalizeUiError(error, fallbackMessage);
    setStatus(toActionableErrorMessage(normalized), 'error', {
      retry: canRetryFromError(normalized),
    });
    setError(error);
    return normalized;
  }

  function api(path, options, fallbackErrorMessage) {
    return requestJson(path, options).catch((error) => {
      presentError(error, fallbackErrorMessage || 'Terjadi kesalahan.');
      throw error;
    });
  }

  return {
    setStatus,
    setError,
    toActionableErrorMessage,
    canRetryFromError,
    presentError,
    api,
  };
}
