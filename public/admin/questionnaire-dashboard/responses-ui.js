import { appendCell, clearChildren } from '/forms-static/shared/safe-dom.js';

export function createResponsesController({
  state,
  responsesBodyEl,
  responsesPageInfoEl,
  responsesPrevBtn,
  responsesNextBtn,
  exportCsvLink,
  formatDateTime,
  formatNumber,
  buildCommonQuery,
  baseApiPath,
  api,
} = {}) {
  function summarizeObject(objectValue) {
    const value = objectValue && typeof objectValue === 'object' ? objectValue : {};
    const entries = Object.entries(value);
    if (!entries.length) return '-';
    return entries
      .slice(0, 3)
      .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(', ') : item}`)
      .join(' | ');
  }

  function renderResponsesTable() {
    clearChildren(responsesBodyEl);
    if (!state.responses.length) {
      const row = document.createElement('tr');
      const cell = appendCell(row, 'Belum ada respons untuk filter ini.');
      cell.colSpan = 3;
      cell.className = 'small';
      responsesBodyEl.append(row);
    } else {
      state.responses.forEach((item) => {
        const row = document.createElement('tr');
        appendCell(row, formatDateTime(item.submittedAt));
        appendCell(row, summarizeObject(item.respondent));
        appendCell(row, summarizeObject(item.answers));
        responsesBodyEl.append(row);
      });
    }

    const totalPages = Math.max(1, Math.ceil((state.totalResponses || 0) / state.pageSize));
    responsesPageInfoEl.textContent = `Halaman ${state.page} dari ${totalPages} - Total ${formatNumber(state.totalResponses || 0)} respons`;
    responsesPrevBtn.disabled = state.page <= 1;
    responsesNextBtn.disabled = state.page >= totalPages;
  }

  function updateCsvLink() {
    const params = buildCommonQuery();
    exportCsvLink.href = `${baseApiPath()}/responses/export.csv${params.toString() ? `?${params.toString()}` : ''}`;
  }

  async function loadResponses() {
    const params = buildCommonQuery({ includeSearch: true });
    params.set('page', String(state.page));
    params.set('pageSize', String(state.pageSize));
    const payload = await api(`${baseApiPath()}/responses?${params.toString()}`, undefined, 'Gagal memuat daftar respons.');
    state.responses = Array.isArray(payload.data?.items) ? payload.data.items : [];
    state.totalResponses = Number(payload.data?.total || 0);
    state.page = Number(payload.data?.filters?.page || state.page);
    state.pageSize = Number(payload.data?.filters?.pageSize || state.pageSize);
    renderResponsesTable();
  }

  return {
    loadResponses,
    updateCsvLink,
  };
}
