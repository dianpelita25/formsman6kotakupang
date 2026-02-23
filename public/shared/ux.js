const STATUS_MESSAGE_BY_CODE = Object.freeze({
  0: 'Tidak dapat terhubung ke server.',
  400: 'Permintaan tidak valid. Periksa input lalu coba lagi.',
  401: 'Sesi login tidak valid. Silakan login ulang.',
  403: 'Akses ditolak untuk aksi ini.',
  404: 'Data atau endpoint tidak ditemukan.',
  409: 'Data bentrok dengan data yang sudah ada.',
  422: 'Input belum memenuhi validasi.',
  429: 'Terlalu banyak request. Coba lagi sebentar.',
  500: 'Terjadi gangguan internal server.',
  502: 'Gateway server bermasalah.',
  503: 'Layanan sementara tidak tersedia.',
  504: 'Server timeout. Coba beberapa saat lagi.',
});

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function defaultMessageForStatus(status) {
  const normalized = Number(status) || 0;
  return STATUS_MESSAGE_BY_CODE[normalized] || 'Terjadi kesalahan yang tidak terduga.';
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = Number(options.status || 0);
    this.path = safeText(options.path);
    this.method = safeText(options.method || 'GET');
    this.code = safeText(options.code);
    this.requestId = safeText(options.requestId);
    this.details = Array.isArray(options.details) ? options.details : [];
    this.payload = options.payload || null;
  }
}

function extractDetails(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.errors)) {
    return payload.errors
      .map((entry) => {
        if (typeof entry === 'string') return safeText(entry);
        if (entry && typeof entry === 'object') {
          const field = safeText(entry.field);
          const message = safeText(entry.message || entry.error || entry.reason);
          if (field && message) return `${field}: ${message}`;
          return message || field;
        }
        return '';
      })
      .filter(Boolean);
  }
  return [];
}

export async function requestJson(path, options = {}) {
  const method = safeText(options.method || 'GET').toUpperCase();
  try {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const status = Number(response.status || 0);
      const message = safeText(payload?.message) || defaultMessageForStatus(status);
      const requestId =
        safeText(response.headers.get('x-request-id')) ||
        safeText(response.headers.get('cf-ray'));

      throw new ApiError(message, {
        status,
        path,
        method,
        code: payload?.code,
        requestId,
        details: extractDetails(payload),
        payload,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(defaultMessageForStatus(0), {
      status: 0,
      path,
      method,
      details: [safeText(error?.message)],
    });
  }
}

export function normalizeUiError(error, fallback = 'Terjadi kesalahan.') {
  if (error instanceof ApiError) {
    return {
      message: error.message || fallback,
      status: error.status || 0,
      method: error.method || '-',
      path: error.path || '-',
      code: error.code || '-',
      requestId: error.requestId || '-',
      details: error.details || [],
    };
  }

  return {
    message: safeText(error?.message, fallback),
    status: 0,
    method: '-',
    path: '-',
    code: '-',
    requestId: '-',
    details: [],
  };
}

export function setInlineStatus(element, message, kind = 'info') {
  if (!element) return;
  element.textContent = safeText(message);
  const normalizedKind = ['success', 'error', 'warning'].includes(kind) ? kind : 'info';
  element.className = `status ${normalizedKind === 'info' ? '' : normalizedKind}`.trim();
}

export function setErrorDebugPanel(element, error) {
  if (!element) return;
  const info = normalizeUiError(error);
  element.textContent = [
    `message: ${info.message}`,
    `status: ${info.status || '-'}`,
    `method: ${info.method}`,
    `path: ${info.path}`,
    `code: ${info.code}`,
    `requestId: ${info.requestId}`,
    info.details.length ? `details: ${info.details.join(' | ')}` : 'details: -',
  ].join('\n');
}

export function createActivityFeed(listElement, maxItems = 30) {
  const entries = [];

  function render() {
    if (!listElement) return;
    listElement.innerHTML = '';

    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'activity-item activity-item--empty';
      empty.textContent = 'Belum ada aktivitas.';
      listElement.append(empty);
      return;
    }

    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = `activity-item activity-item--${entry.level}`;
      const time = document.createElement('span');
      time.className = 'activity-time';
      time.textContent = entry.time;

      const action = document.createElement('span');
      action.className = 'activity-action';
      action.textContent = entry.action;

      const detail = document.createElement('span');
      detail.className = 'activity-detail';
      detail.textContent = entry.detail;

      li.append(time, action, detail);
      listElement.append(li);
    });
  }

  function push(level, action, detail = '') {
    const normalizedLevel = ['success', 'error', 'warning'].includes(level) ? level : 'info';
    entries.unshift({
      level: normalizedLevel,
      action: safeText(action, '-'),
      detail: safeText(detail, '-'),
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
    if (entries.length > maxItems) {
      entries.length = maxItems;
    }
    render();
  }

  render();
  return { push, render, clear: () => { entries.length = 0; render(); } };
}

export function bindRuntimeErrorHandlers(onError) {
  if (typeof onError !== 'function') return () => {};

  const handleError = (error, fallback = 'Terjadi error di UI.') => {
    const normalized = normalizeUiError(error, fallback);
    onError(normalized, error);
  };

  const onWindowError = (event) => {
    handleError(event?.error || event?.message || event, 'Terjadi error runtime di browser.');
  };

  const onUnhandledRejection = (event) => {
    handleError(event?.reason || event, 'Terjadi error async yang tidak tertangani.');
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
