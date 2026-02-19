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
    responsesBodyEl.innerHTML = '';
    if (!state.responses.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3" class="small">Belum ada respons untuk filter ini.</td>';
      responsesBodyEl.append(row);
    } else {
      state.responses.forEach((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
        <td>${formatDateTime(item.submittedAt)}</td>
        <td>${summarizeObject(item.respondent)}</td>
        <td>${summarizeObject(item.answers)}</td>
      `;
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
