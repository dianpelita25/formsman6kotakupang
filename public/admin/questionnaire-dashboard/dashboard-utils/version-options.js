import { formatDateTime } from './formatters.js';

function formatVersionOptionLabel(version) {
  const ver = Number(version.version || 0);
  const status = String(version.status || '').toLowerCase();
  const statusLabel = status === 'published' ? 'publish' : status === 'draft' ? 'draft' : 'arsip';
  const time = formatDateTime(version.publishedAt || version.createdAt);
  return `v${ver} - ${statusLabel} - ${time}`;
}

export function createVersionHelpers({ state, filterVersionEl, api, baseApiPath } = {}) {
  function renderVersionFilterOptions() {
    if (!filterVersionEl) return;
    const versions = Array.isArray(state.availableVersions) ? state.availableVersions : [];
    const previousValue = state.selectedVersionId || filterVersionEl.value || '';
    filterVersionEl.innerHTML = '';

    const activeOption = document.createElement('option');
    activeOption.value = '';
    activeOption.textContent = 'Versi Publish Aktif';
    filterVersionEl.append(activeOption);

    versions.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = formatVersionOptionLabel(version);
      if (version.status === 'published') option.textContent += ' [aktif]';
      filterVersionEl.append(option);
    });

    if (previousValue && versions.some((entry) => entry.id === previousValue)) {
      filterVersionEl.value = previousValue;
    } else {
      filterVersionEl.value = '';
    }
    state.selectedVersionId = filterVersionEl.value;
  }

  async function loadVersionOptions() {
    const payload = await api(`${baseApiPath()}/versions`, undefined, 'Gagal memuat daftar versi kuesioner.');
    state.availableVersions = Array.isArray(payload?.data?.versions) ? payload.data.versions : [];
    renderVersionFilterOptions();
  }

  return {
    loadVersionOptions,
    renderVersionFilterOptions,
  };
}
