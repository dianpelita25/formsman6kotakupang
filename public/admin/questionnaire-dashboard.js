import {
  bindRuntimeErrorHandlers,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';

const titleEl = document.getElementById('dashboard-title');
const subtitleEl = document.getElementById('dashboard-subtitle');
const statusEl = document.getElementById('status');
const inlineStatusEl = document.getElementById('dashboard-inline-status');
const errorDebugEl = document.getElementById('error-debug');

const backBuilderLink = document.getElementById('back-builder-link');
const openFormLink = document.getElementById('open-form-link');
const exportCsvLink = document.getElementById('export-csv-link');

const filterFromEl = document.getElementById('filter-from');
const filterToEl = document.getElementById('filter-to');
const filterDaysEl = document.getElementById('filter-days');
const filterVersionEl = document.getElementById('filter-version');
const applyFilterBtn = document.getElementById('apply-filter-btn');
const contextVersionEl = document.getElementById('context-version');
const contextTotalQuestionsEl = document.getElementById('context-total-questions');
const contextQuestionTypesEl = document.getElementById('context-question-types');
const contextNoteEl = document.getElementById('context-note');

const kpiTotalEl = document.getElementById('kpi-total');
const kpiTodayEl = document.getElementById('kpi-today');
const kpiScaleEl = document.getElementById('kpi-scale');
const kpiLastEl = document.getElementById('kpi-last');

const radioQuestionSelectEl = document.getElementById('radio-question-select');
const scaleQuestionHelpEl = document.getElementById('scale-question-help');
const radioQuestionHelpEl = document.getElementById('radio-question-help');
const criteriaSummaryHelpEl = document.getElementById('criteria-summary-help');
const criteriaSummaryListEl = document.getElementById('criteria-summary-list');
const questionDetailPanelEl = document.getElementById('question-detail-panel');
const questionDetailCloseBtnEl = document.getElementById('question-detail-close-btn');
const questionDetailCodeEl = document.getElementById('question-detail-code');
const questionDetailCriterionEl = document.getElementById('question-detail-criterion');
const questionDetailLabelEl = document.getElementById('question-detail-label');
const responsesBodyEl = document.getElementById('responses-body');
const responsesPageInfoEl = document.getElementById('responses-page-info');
const responsesPrevBtn = document.getElementById('responses-prev-btn');
const responsesNextBtn = document.getElementById('responses-next-btn');
const responseSearchEl = document.getElementById('response-search');
const responseSearchBtn = document.getElementById('response-search-btn');

const aiModeEl = document.getElementById('ai-mode');
const aiOutputEl = document.getElementById('ai-output');
const aiLoadBtn = document.getElementById('ai-load-btn');
const aiRunBtn = document.getElementById('ai-run-btn');
const aiPdfBtn = document.getElementById('ai-pdf-btn');

const state = {
  tenantSlug: '',
  questionnaireSlug: '',
  questionnaireVersionId: '',
  page: 1,
  pageSize: 20,
  totalResponses: 0,
  search: '',
  summary: null,
  distribution: null,
  trend: null,
  responses: [],
  latestAi: null,
  criteriaSummary: [],
  questionLookup: new Map(),
  selectedQuestionCode: '',
  radioQuestions: [],
  selectedRadioQuestion: '',
  availableVersions: [],
  selectedVersionId: '',
  questionTypeStats: {
    total: 0,
    scale: 0,
    radio: 0,
    checkbox: 0,
    text: 0,
  },
  charts: {
    scaleAverage: null,
    radioDistribution: null,
    trend: null,
  },
};

function parseRouteContext() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const formsIndex = parts.indexOf('forms');
  if (formsIndex === -1) throw new Error('Route dashboard tidak valid.');
  const tenantSlug = parts[formsIndex + 1];
  const questionnaireSlug = parts[formsIndex + 4];
  if (!tenantSlug || !questionnaireSlug) {
    throw new Error('Tenant atau questionnaire slug tidak ditemukan.');
  }
  return { tenantSlug, questionnaireSlug };
}

function baseApiPath() {
  return `/forms/${encodeURIComponent(state.tenantSlug)}/admin/api/questionnaires/${encodeURIComponent(state.questionnaireSlug)}`;
}

function setStatus(message, kind = 'info') {
  setInlineStatus(statusEl, message, kind);
  setInlineStatus(inlineStatusEl, message, kind);
}

function setError(error = null) {
  if (!error) {
    errorDebugEl.textContent = 'Belum ada error.';
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

function api(path, options, fallbackErrorMessage) {
  return requestJson(path, options).catch((error) => {
    const normalized = normalizeUiError(error, fallbackErrorMessage || 'Terjadi kesalahan.');
    setStatus(toActionableErrorMessage(normalized), 'error');
    setError(error);
    throw error;
  });
}

function validateDateRange() {
  const from = String(filterFromEl.value || '').trim();
  const to = String(filterToEl.value || '').trim();
  if (!from || !to) return true;
  if (new Date(from) <= new Date(to)) return true;
  setStatus('Tanggal "Dari" tidak boleh lebih besar dari "Sampai".', 'error');
  filterFromEl.focus();
  return false;
}

async function runWithButtonLoading(button, loadingText, task, extraButtons = []) {
  const buttons = [button, ...extraButtons].filter(Boolean);
  const previousState = buttons.map((entry) => ({ entry, disabled: entry.disabled, text: entry.textContent }));
  previousState.forEach(({ entry }) => {
    entry.disabled = true;
    entry.classList.add('is-loading');
  });
  if (button) button.textContent = loadingText;
  try {
    return await task();
  } finally {
    previousState.forEach(({ entry, disabled, text }) => {
      entry.classList.remove('is-loading');
      entry.disabled = disabled;
      if (entry === button) {
        entry.textContent = text;
      }
    });
  }
}

function buildCommonQuery({ includeDays = false, includeSearch = false } = {}) {
  const params = new URLSearchParams();
  const from = String(filterFromEl.value || '').trim();
  const to = String(filterToEl.value || '').trim();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const selectedVersion = String(filterVersionEl?.value || '').trim();
  state.selectedVersionId = selectedVersion;
  if (selectedVersion) params.set('questionnaireVersionId', selectedVersion);
  if (includeDays) {
    const days = Number(filterDaysEl.value || 30);
    params.set('days', String(Number.isFinite(days) ? Math.max(7, Math.min(365, Math.floor(days))) : 30));
  }
  if (includeSearch && state.search) {
    params.set('search', state.search);
  }
  return params;
}

function formatNumber(value, fractionDigits = 0) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return fractionDigits > 0 ? '0.00' : '0';
  return number.toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVersionShort(versionId) {
  const text = String(versionId || '').trim();
  if (!text) return '-';
  return text.length <= 12 ? text : `${text.slice(0, 8)}...`;
}

function formatVersionOptionLabel(version) {
  const ver = Number(version.version || 0);
  const status = String(version.status || '').toLowerCase();
  const statusLabel = status === 'published' ? 'publish' : status === 'draft' ? 'draft' : 'arsip';
  const time = formatDateTime(version.publishedAt || version.createdAt);
  return `v${ver} - ${statusLabel} - ${time}`;
}

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

function summarizeObject(objectValue) {
  const value = objectValue && typeof objectValue === 'object' ? objectValue : {};
  const entries = Object.entries(value);
  if (!entries.length) return '-';
  return entries
    .slice(0, 3)
    .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(', ') : item}`)
    .join(' | ');
}

function truncateText(value, maxLength = 72) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizeQuestionCode(question, index = 0) {
  const existing = String(question?.questionCode || '').trim();
  if (existing) return existing;
  const name = String(question?.name || '').trim();
  const match = name.match(/^q0*([1-9]\d*)$/i);
  if (match) return `Q${Number(match[1])}`;
  return `Q${index + 1}`;
}

function normalizeQuestionCriterion(question) {
  const criterion = String(question?.criterion || '').trim();
  return criterion || null;
}

function buildScaleAveragesFallback(questionAverages = {}, allQuestions = []) {
  const scaleQuestions = Array.isArray(allQuestions) ? allQuestions.filter((question) => question.type === 'scale') : [];
  const questionMap = new Map(scaleQuestions.map((question, index) => [question.name, { ...question, _index: index }]));
  return Object.entries(questionAverages || {}).map(([name, average], index) => {
    const mapped = questionMap.get(name) || null;
    return {
      name,
      label: mapped?.label || name,
      questionCode: normalizeQuestionCode(mapped || { name }, mapped?._index ?? index),
      criterion: normalizeQuestionCriterion(mapped),
      average: Number(average || 0),
      totalAnswered: Number(mapped?.totalAnswered || 0),
    };
  });
}

function buildQuestionLookup(allQuestions = []) {
  const lookup = new Map();
  allQuestions.forEach((question, index) => {
    const normalized = {
      ...question,
      questionCode: normalizeQuestionCode(question, index),
      criterion: normalizeQuestionCriterion(question),
    };
    lookup.set(normalized.name, normalized);
    lookup.set(normalized.questionCode.toUpperCase(), normalized);
  });
  return lookup;
}

function findQuestionByCode(questionCode) {
  const key = String(questionCode || '').trim().toUpperCase();
  if (!key) return null;
  return state.questionLookup.get(key) || null;
}

function syncCriteriaChipStates() {
  const activeCode = String(state.selectedQuestionCode || '').trim().toUpperCase();
  const chips = criteriaSummaryListEl?.querySelectorAll('.criteria-question-chip') || [];
  chips.forEach((chip) => {
    const code = String(chip.dataset.questionCode || '').trim().toUpperCase();
    const isActive = Boolean(activeCode) && code === activeCode;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderQuestionDetail(question) {
  if (!questionDetailPanelEl || !questionDetailCodeEl || !questionDetailCriterionEl || !questionDetailLabelEl) return;
  if (!question) {
    state.selectedQuestionCode = '';
    questionDetailPanelEl.hidden = true;
    questionDetailCodeEl.textContent = '-';
    questionDetailCriterionEl.textContent = '-';
    questionDetailLabelEl.textContent = '-';
    syncCriteriaChipStates();
    return;
  }

  const questionCode = normalizeQuestionCode(question);
  state.selectedQuestionCode = String(questionCode || '').trim().toUpperCase();
  const criterion = normalizeQuestionCriterion(question);
  questionDetailCodeEl.textContent = questionCode;
  questionDetailCriterionEl.textContent = criterion ? `Kriteria ${criterion}` : 'Tanpa Kriteria';
  questionDetailLabelEl.textContent = String(question.label || '-');
  questionDetailPanelEl.hidden = false;
  syncCriteriaChipStates();
}

function renderCriteriaSummary() {
  if (!criteriaSummaryListEl || !criteriaSummaryHelpEl) return;
  const summary = Array.isArray(state.criteriaSummary) ? state.criteriaSummary : [];
  criteriaSummaryListEl.innerHTML = '';

  const totalQuestionsWithCriterion = Number(state.distribution?.totalQuestionsWithCriterion || 0);
  if (!summary.length) {
    criteriaSummaryHelpEl.textContent = 'Belum ada data kriteria untuk filter ini.';
    renderQuestionDetail(null);
    return;
  }

  const onlyUncategorized = summary.length === 1 && String(summary[0].criterion || '').trim() === 'Tanpa Kriteria';
  if (onlyUncategorized && totalQuestionsWithCriterion === 0) {
    criteriaSummaryHelpEl.textContent =
      'Semua soal masih tanpa kriteria. Disarankan isi kriteria di Builder agar analisis lebih presisi. Klik chip Qx untuk lihat detail soal.';
  } else {
    criteriaSummaryHelpEl.textContent = `${summary.length} kelompok kriteria terdeteksi. Klik chip Qx untuk melihat detail soal lengkap.`;
  }

  summary.forEach((item) => {
    const criterion = String(item.criterion || 'Tanpa Kriteria').trim() || 'Tanpa Kriteria';
    const totalQuestions = Number(item.totalQuestions || 0);
    const totalScaleQuestions = Number(item.totalScaleQuestions || 0);
    const avgScale = Number(item.avgScale || 0);
    const questionCodes = Array.isArray(item.questionCodes) ? item.questionCodes : [];

    const card = document.createElement('article');
    card.className = 'criteria-summary-item';

    const title = document.createElement('h4');
    title.textContent = criterion === 'Tanpa Kriteria' ? criterion : `Kriteria ${criterion}`;

    const infoQuestions = document.createElement('p');
    infoQuestions.textContent = `Jumlah soal: ${formatNumber(totalQuestions)} | Soal skala: ${formatNumber(totalScaleQuestions)}`;

    const infoScale = document.createElement('p');
    infoScale.textContent = `Rata-rata skala: ${formatNumber(avgScale, 2)}`;

    const chips = document.createElement('div');
    chips.className = 'criteria-question-chips';
    questionCodes.forEach((questionCode) => {
      const question = findQuestionByCode(questionCode);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'criteria-question-chip';
      chip.dataset.questionCode = String(questionCode);
      chip.textContent = String(questionCode);
      chip.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-label', `Tampilkan detail ${String(questionCode)}`);
      chip.title = question?.label || String(questionCode);
      chips.append(chip);
    });

    card.append(title, infoQuestions, infoScale, chips);
    criteriaSummaryListEl.append(card);
  });

  if (state.selectedQuestionCode) {
    const selectedQuestion = findQuestionByCode(state.selectedQuestionCode);
    if (selectedQuestion) {
      renderQuestionDetail(selectedQuestion);
      return;
    }
  }
  renderQuestionDetail(null);
}

function destroyChart(chartKey) {
  if (state.charts[chartKey]) {
    state.charts[chartKey].destroy();
    state.charts[chartKey] = null;
  }
}

function renderScaleAverageChart(scaleAverages = []) {
  destroyChart('scaleAverage');
  const canvas = document.getElementById('scale-average-chart');
  if (!canvas) return;

  const normalizedItems = Array.isArray(scaleAverages) ? scaleAverages : [];
  const labels = normalizedItems.map((item, index) => normalizeQuestionCode(item, index));
  const values = normalizedItems.map((item) => Number(item.average || 0));
  if (!labels.length) {
    state.charts.scaleAverage = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Belum ada data'],
        datasets: [{ label: 'Skor', data: [0], backgroundColor: 'rgba(64,153,255,0.55)' }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
    return;
  }

  state.charts.scaleAverage = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Rata-rata',
          data: values,
          borderRadius: 8,
          backgroundColor: 'rgba(47, 198, 229, 0.65)',
          borderColor: 'rgba(47, 198, 229, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const first = Array.isArray(items) && items.length ? items[0] : null;
              if (!first) return '-';
              const detail = normalizedItems[first.dataIndex];
              if (!detail) return '-';
              const code = normalizeQuestionCode(detail, first.dataIndex);
              return `${code} - ${detail.label || detail.name || '-'}`;
            },
            label: (item) => `Rata-rata: ${formatNumber(item.parsed?.y || 0, 2)}`,
            afterLabel: (item) => {
              const detail = normalizedItems[item.dataIndex];
              const criterion = normalizeQuestionCriterion(detail);
              return criterion ? `Kriteria: ${criterion}` : 'Kriteria: Tanpa Kriteria';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
        },
      },
    },
  });
}

function renderRadioQuestionOptions() {
  const options = state.radioQuestions;
  radioQuestionSelectEl.innerHTML = '';
  if (!options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Tidak ada pertanyaan pilihan';
    radioQuestionSelectEl.append(option);
    radioQuestionSelectEl.disabled = true;
    state.selectedRadioQuestion = '';
    radioQuestionHelpEl.textContent = 'Hanya pertanyaan tipe "Pilihan" atau "Pilihan Ganda" yang bisa dianalisis di panel ini.';
    renderQuestionDetail(null);
    return;
  }

  radioQuestionSelectEl.disabled = false;
  options.forEach((question, index) => {
    const questionCode = normalizeQuestionCode(question, index);
    const option = document.createElement('option');
    option.value = question.name;
    option.textContent =
      question.type === 'checkbox'
        ? `${questionCode} - ${truncateText(question.label, 58)} (Pilihan Ganda)`
        : `${questionCode} - ${truncateText(question.label, 58)}`;
    option.title = question.label || question.name;
    radioQuestionSelectEl.append(option);
  });

  if (!state.selectedRadioQuestion || !options.some((item) => item.name === state.selectedRadioQuestion)) {
    state.selectedRadioQuestion = options[0].name;
  }
  radioQuestionSelectEl.value = state.selectedRadioQuestion;
  radioQuestionHelpEl.textContent = `${options.length} pertanyaan tipe Pilihan/Pilihan Ganda tersedia. Label dipersingkat menjadi Qx.`;
}

function renderRadioDistributionChart() {
  destroyChart('radioDistribution');
  const canvas = document.getElementById('radio-distribution-chart');
  if (!canvas) return;

  const question = state.radioQuestions.find((item) => item.name === state.selectedRadioQuestion);
  if (!question) {
    state.charts.radioDistribution = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Belum ada data'],
        datasets: [{ data: [1], backgroundColor: ['rgba(106,164,255,0.45)'] }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
    renderQuestionDetail(null);
    return;
  }

  renderQuestionDetail(question);

  const labels = (question.counts || []).map((entry) => entry.label);
  const values = (question.counts || []).map((entry) => Number(entry.total || 0));
  state.charts.radioDistribution = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            '#3ba6ff',
            '#31d5ff',
            '#6f7dff',
            '#8f6dff',
            '#3ce6b4',
            '#ff7b9d',
            '#ffb347',
          ],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function renderTrendChart(points = []) {
  destroyChart('trend');
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;

  const labels = points.map((entry) => entry.day);
  const values = points.map((entry) => Number(entry.total || 0));

  state.charts.trend = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total respons',
          data: values,
          borderColor: '#33d9ff',
          backgroundColor: 'rgba(51, 217, 255, 0.18)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function renderSummary() {
  const summary = state.summary || {};
  kpiTotalEl.textContent = formatNumber(summary.totalResponses || 0);
  kpiTodayEl.textContent = formatNumber(summary.responsesToday || 0);
  kpiScaleEl.textContent = formatNumber(summary.avgScaleOverall || 0, 2);
  kpiLastEl.textContent = formatDateTime(summary.lastSubmittedAt);
}

function renderContextInfo() {
  const stats = state.questionTypeStats;
  const versionId = String(state.questionnaireVersionId || '').trim();
  const selected = state.availableVersions.find((entry) => entry.id === versionId);
  contextVersionEl.textContent = selected ? `v${selected.version} (${selected.status})` : formatVersionShort(versionId);
  contextVersionEl.title = versionId || 'Belum ada versi publish';
  contextTotalQuestionsEl.textContent = String(stats.total || 0);
  contextQuestionTypesEl.textContent = `${stats.scale} / ${stats.radio} / ${stats.checkbox} / ${stats.text}`;

  const totalResponses = Number(state.summary?.totalResponses || 0);
  if (!versionId) {
    contextNoteEl.textContent = 'Belum ada versi publish aktif. Publish kuesioner dulu agar dashboard bisa membaca data.';
    return;
  }

  if (totalResponses === 0) {
    contextNoteEl.textContent =
      'Belum ada respons pada versi aktif ini. Jika Anda baru publish versi baru, data versi sebelumnya tidak otomatis digabung.';
    return;
  }

  contextNoteEl.textContent = `Dashboard ini membaca data spesifik untuk versi aktif (${formatVersionShort(versionId)}).`;
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

async function loadSummaryAndCharts() {
  const [summaryPayload, distributionPayload, trendPayload] = await Promise.all([
    api(
      `${baseApiPath()}/analytics/summary${buildCommonQuery().toString() ? `?${buildCommonQuery().toString()}` : ''}`,
      undefined,
      'Gagal memuat summary analytics.'
    ),
    api(
      `${baseApiPath()}/analytics/distribution${buildCommonQuery().toString() ? `?${buildCommonQuery().toString()}` : ''}`,
      undefined,
      'Gagal memuat distribusi analytics.'
    ),
    api(
      `${baseApiPath()}/analytics/trend?${buildCommonQuery({ includeDays: true }).toString()}`,
      undefined,
      'Gagal memuat trend analytics.'
    ),
  ]);

  state.summary = summaryPayload.data;
  state.distribution = distributionPayload.data;
  state.trend = trendPayload.data;
  state.questionnaireVersionId = summaryPayload.data?.questionnaireVersionId || state.questionnaireVersionId;

  const allQuestions = Array.isArray(distributionPayload.data?.questions) ? distributionPayload.data.questions : [];
  const normalizedQuestions = allQuestions.map((question, index) => ({
    ...question,
    questionCode: normalizeQuestionCode(question, index),
    criterion: normalizeQuestionCriterion(question),
  }));
  state.questionLookup = buildQuestionLookup(normalizedQuestions);

  const scaleQuestions = normalizedQuestions.filter((question) => question.type === 'scale');
  const radioQuestions = normalizedQuestions.filter((question) => question.type === 'radio');
  const checkboxQuestions = normalizedQuestions.filter((question) => question.type === 'checkbox');
  state.radioQuestions = [...radioQuestions, ...checkboxQuestions];
  const textQuestions = normalizedQuestions.filter((question) => question.type === 'text');

  const scaleAveragesFromSummary = Array.isArray(summaryPayload.data?.scaleAverages)
    ? summaryPayload.data.scaleAverages
    : [];
  const scaleAveragesFromDistribution = Array.isArray(distributionPayload.data?.scaleAverages)
    ? distributionPayload.data.scaleAverages
    : [];
  const scaleAverages =
    scaleAveragesFromSummary.length > 0
      ? scaleAveragesFromSummary
      : scaleAveragesFromDistribution.length > 0
        ? scaleAveragesFromDistribution
        : buildScaleAveragesFallback(summaryPayload.data?.questionAverages || {}, normalizedQuestions);

  state.criteriaSummary = Array.isArray(distributionPayload.data?.criteriaSummary)
    ? distributionPayload.data.criteriaSummary
    : Array.isArray(summaryPayload.data?.criteriaSummary)
      ? summaryPayload.data.criteriaSummary
      : [];

  renderSummary();
  renderScaleAverageChart(scaleAverages);
  state.questionTypeStats = {
    total: normalizedQuestions.length,
    scale: scaleQuestions.length,
    radio: radioQuestions.length,
    checkbox: checkboxQuestions.length,
    text: textQuestions.length,
  };

  scaleQuestionHelpEl.textContent = `${state.questionTypeStats.scale} pertanyaan tipe Skala dianalisis dengan label ringkas Qx.`;
  renderRadioQuestionOptions();
  renderRadioDistributionChart();
  renderCriteriaSummary();
  renderTrendChart(trendPayload.data?.points || []);
  renderContextInfo();
  updateCsvLink();
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

function getActiveMode() {
  return String(aiModeEl.value || 'internal').trim();
}

const AI_MODE_LABELS = Object.freeze({
  internal: 'Internal',
  external_pemerintah: 'External Pemerintah',
  external_mitra: 'External Mitra',
  live_guru: 'Live Guru',
});

function getModeLabel(mode) {
  return AI_MODE_LABELS[String(mode || '').trim()] || String(mode || 'Internal').trim();
}

function setAiOutput(message) {
  aiOutputEl.textContent = message || 'Belum ada analisis.';
}

async function loadAiLatest() {
  const params = new URLSearchParams();
  params.set('mode', getActiveMode());
  if (state.questionnaireVersionId) params.set('questionnaireVersionId', state.questionnaireVersionId);
  const from = String(filterFromEl.value || '').trim();
  const to = String(filterToEl.value || '').trim();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const payload = await api(`${baseApiPath()}/ai/latest?${params.toString()}`, undefined, 'Gagal memuat analisis AI.');
  state.latestAi = payload.data || null;
  setAiOutput(payload.data?.analysis || 'Belum ada analisis untuk mode ini.');
  aiPdfBtn.disabled = !String(payload.data?.analysis || '').trim();
}

async function runAiAnalysis() {
  await runWithButtonLoading(aiRunBtn, 'Menganalisis...', async () => {
    aiPdfBtn.disabled = true;
    setAiOutput('Sedang memproses analisis AI...');
    setStatus('Sedang memproses analisis AI...', 'warning');
    const payload = await api(
      `${baseApiPath()}/ai/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: getActiveMode(),
          questionnaireVersionId: state.questionnaireVersionId || undefined,
          from: String(filterFromEl.value || '').trim() || undefined,
          to: String(filterToEl.value || '').trim() || undefined,
        }),
      },
      'Gagal menjalankan analisis AI.'
    );
    state.latestAi = payload.data || null;
    setAiOutput(payload.data?.analysis || 'Analisis kosong.');
    aiPdfBtn.disabled = !String(payload.data?.analysis || '').trim();
    setStatus('Analisis AI selesai diproses.', 'success');
    setError(null);
  }, [aiLoadBtn]);
}

function sanitizeMarkdownInline(value) {
  return String(value ?? '')
    .replaceAll('**', '')
    .replaceAll('__', '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function parseTableRow(row) {
  let cleaned = String(row ?? '').trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((cell) => sanitizeMarkdownInline(cell));
}

function isMarkdownTableSeparator(row) {
  const compact = String(row ?? '').replace(/\s/g, '');
  return /^[|:-]+$/.test(compact) && compact.includes('-');
}

function isBulletListLine(line) {
  return /^(?:[-*]|\u2022)\s+/.test(String(line ?? '').trim());
}

function extractMarkdownTable(lines, startIndex) {
  const headerLine = lines[startIndex]?.trim() || '';
  const separatorLine = lines[startIndex + 1]?.trim() || '';
  if (!headerLine.includes('|') || !isMarkdownTableSeparator(separatorLine)) return null;

  const header = parseTableRow(headerLine);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const tableLine = String(lines[index] || '').trim();
    if (!tableLine || !tableLine.includes('|')) break;
    if (isMarkdownTableSeparator(tableLine)) {
      index += 1;
      continue;
    }
    rows.push(parseTableRow(tableLine));
    index += 1;
  }

  return {
    block: { type: 'table', header, rows },
    nextIndex: index - 1,
  };
}

function isNumericLike(value) {
  const compact = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?%?$/.test(compact);
}

function detectHeadingBlock(line, nextLine) {
  const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
  if (markdownHeading) {
    const hashCount = markdownHeading[1].length;
    const level = hashCount === 1 ? 1 : hashCount === 2 ? 2 : 3;
    return { level, text: sanitizeMarkdownInline(markdownHeading[2]) };
  }

  if (/^\d+\.\d+\s+/.test(line)) {
    return { level: 3, text: sanitizeMarkdownInline(line) };
  }

  if (/^[A-Z]\.\s+/.test(line)) {
    return { level: 2, text: sanitizeMarkdownInline(line) };
  }

  if (/^\d+[.)]\s+/.test(line) && !/^\d+[.)]\s+/.test(nextLine)) {
    return { level: 1, text: sanitizeMarkdownInline(line) };
  }

  if (line.endsWith(':') && line.length <= 120) {
    return { level: 3, text: sanitizeMarkdownInline(line.slice(0, -1)) };
  }

  return null;
}

function parseAnalysisToBlocks(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const blocks = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraph = sanitizeMarkdownInline(paragraphBuffer.join(' '));
    if (paragraph) blocks.push({ type: 'paragraph', text: paragraph });
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const nextLine = String(lines[index + 1] || '').trim();
    const tableExtraction = extractMarkdownTable(lines, index);
    if (tableExtraction) {
      flushParagraph();
      blocks.push(tableExtraction.block);
      index = tableExtraction.nextIndex;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushParagraph();
      continue;
    }

    const headingBlock = detectHeadingBlock(line, nextLine);
    if (headingBlock) {
      flushParagraph();
      blocks.push({ type: 'heading', level: headingBlock.level, text: headingBlock.text });
      continue;
    }

    if (isBulletListLine(line)) {
      flushParagraph();
      const items = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = String(lines[listIndex] || '').trim();
        if (!isBulletListLine(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^(?:[-*]|\u2022)\s+/, '')));
        listIndex += 1;
      }
      blocks.push({ type: 'bullet-list', items });
      index = listIndex - 1;
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = String(lines[listIndex] || '').trim();
        if (!/^\d+[.)]\s+/.test(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^\d+[.)]\s+/, '')));
        listIndex += 1;
      }
      blocks.push({ type: 'numbered-list', items });
      index = listIndex - 1;
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}

function resolveVersionLabel() {
  const selectedVersionId = String(state.selectedVersionId || state.questionnaireVersionId || '').trim();
  if (!selectedVersionId) return 'Versi publish aktif';
  const selectedVersion = (state.availableVersions || []).find((item) => item.id === selectedVersionId);
  if (!selectedVersion) return formatVersionShort(selectedVersionId);
  return `v${selectedVersion.version} (${selectedVersion.status})`;
}

function formatDateRangeLabel() {
  const from = String(filterFromEl.value || '').trim();
  const to = String(filterToEl.value || '').trim();
  if (!from && !to) return 'Semua data (tanpa filter tanggal)';
  if (from && to) return `${from} s.d. ${to}`;
  if (from) return `Mulai ${from}`;
  return `Sampai ${to}`;
}

function buildAiMetadataLines() {
  return [
    `Organisasi: ${state.tenantSlug}`,
    `Kuesioner: ${state.questionnaireSlug}`,
    `Versi Data: ${resolveVersionLabel()}`,
    `Rentang Data: ${formatDateRangeLabel()}`,
  ];
}

function buildPdfContext() {
  const mode = getActiveMode();
  const modeLabel = getModeLabel(mode);
  const analysisText = String(state.latestAi?.analysis || '').trim();
  const selectedQuestion = (state.radioQuestions || []).find((question) => question.name === state.selectedRadioQuestion);
  const selectedQuestionTitle = selectedQuestion
    ? `${normalizeQuestionCode(selectedQuestion)} - ${selectedQuestion.label || selectedQuestion.name || '-'}`
    : 'Belum ada pertanyaan pilihan yang dipilih';

  const distributionRows = (selectedQuestion?.counts || []).map((entry) => [entry.label, formatNumber(entry.total || 0)]);
  const summaryRows = [
    ['Total Respons', formatNumber(state.summary?.totalResponses || 0)],
    ['Respons Hari Ini', formatNumber(state.summary?.responsesToday || 0)],
    ['Rata-rata Skala', formatNumber(state.summary?.avgScaleOverall || 0, 2)],
    ['Submit Terakhir', formatDateTime(state.summary?.lastSubmittedAt)],
    ['Total Pertanyaan', formatNumber(state.questionTypeStats?.total || 0)],
    ['Pertanyaan Skala', formatNumber(state.questionTypeStats?.scale || 0)],
    ['Pertanyaan Pilihan Tunggal', formatNumber(state.questionTypeStats?.radio || 0)],
    ['Pertanyaan Pilihan Ganda', formatNumber(state.questionTypeStats?.checkbox || 0)],
    ['Pertanyaan Teks', formatNumber(state.questionTypeStats?.text || 0)],
  ];

  return {
    title: `Laporan Analisis AI - ${modeLabel}`,
    subtitle: 'AITI Forms | Dashboard Kuesioner',
    modeLabel,
    analyzedAt: formatDateTime(state.latestAi?.createdAt) || '-',
    metadataLines: buildAiMetadataLines(),
    analysisText,
    blocks: parseAnalysisToBlocks(analysisText),
    summaryRows,
    distributionTitle: selectedQuestionTitle,
    distributionRows,
    filename: `laporan-analisis-${state.tenantSlug}-${state.questionnaireSlug}-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}

const PDF_LAYOUT = Object.freeze({
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 20,
  footerTopOffset: 10,
  footerTextOffset: 5.2,
  listIndent: 7,
  listMarkerGap: 2,
  font: Object.freeze({
    title: 17,
    section: 12.5,
    headingLevel2: 11.5,
    headingLevel3: 11,
    body: 10.5,
    footer: 8.5,
    table: 9.2,
  }),
  lineHeight: Object.freeze({
    body: 5.6,
    metadata: 5.4,
    heading: 6,
    list: 5.4,
  }),
  gap: Object.freeze({
    afterParagraph: 2,
    afterList: 2,
    afterTable: 5,
    afterTableImmediate: 1,
    beforeSectionTitle: 6,
    afterSectionTitle: 2,
    beforeSubheading: 3,
    afterSubheading: 1.5,
    tableToHeadingExtra: 1,
  }),
  table: Object.freeze({
    cellPadding: 1.9,
  }),
});

function renderFooterAllPages(doc) {
  const { marginLeft, marginRight, footerTopOffset, footerTextOffset, font } = PDF_LAYOUT;
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerTopY = pageHeight - footerTopOffset;
  const footerTextY = pageHeight - footerTextOffset;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 227, 238);
    doc.line(marginLeft, footerTopY, pageWidth - marginRight, footerTopY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.footer);
    doc.setTextColor(100, 116, 139);
    doc.text('AITI FORMS', marginLeft, footerTextY);
    doc.text(`Halaman ${page}/${pageCount}`, pageWidth - marginRight, footerTextY, { align: 'right' });
  }
}

function renderPdfDocument(doc, context) {
  const { marginLeft, marginRight, marginTop, marginBottom, font, lineHeight, gap, listIndent, listMarkerGap } = PDF_LAYOUT;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;
  let sectionNumber = 1;

  const ensureSpace = (required = lineHeight.body) => {
    if (y + required <= pageHeight - marginBottom) return;
    doc.addPage();
    y = marginTop;
  };

  const drawWrappedText = (text, options = {}) => {
    const {
      style = 'normal',
      size = PDF_LAYOUT.font.body,
      color = [15, 23, 42],
      lineHeight = PDF_LAYOUT.lineHeight.body,
      x = marginLeft,
      maxWidth = contentWidth,
    } = options;

    const safeText = sanitizeMarkdownInline(text);
    if (!safeText) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(safeText, maxWidth);
    wrapped.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    });
  };

  const drawSectionTitle = (text) => {
    ensureSpace(gap.beforeSectionTitle + lineHeight.heading + gap.afterSectionTitle);
    y += gap.beforeSectionTitle;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(font.section);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sectionNumber}. ${text}`, marginLeft, y);
    sectionNumber += 1;
    y += lineHeight.heading + gap.afterSectionTitle;
  };

  const drawHangingList = (items, ordered = false) => {
    if (!items.length) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.body);
    doc.setTextColor(15, 23, 42);

    const markerX = marginLeft;
    const markerWidth = ordered
      ? Math.max(...items.map((_, index) => doc.getTextWidth(`${index + 1}.`)))
      : doc.getTextWidth('-');
    const contentX = marginLeft + Math.max(listIndent, markerWidth + listMarkerGap);
    const availableWidth = pageWidth - marginRight - contentX;

    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const safeItem = sanitizeMarkdownInline(item);
      if (!safeItem) return;
      const wrapped = doc.splitTextToSize(safeItem, availableWidth);
      wrapped.forEach((line, lineIndex) => {
        ensureSpace(lineHeight.list);
        if (lineIndex === 0) doc.text(marker, markerX, y);
        doc.text(line, contentX, y);
        y += lineHeight.list;
      });
    });
  };

  const getHeadingStyle = (level) => {
    if (level === 1) return { size: font.section, lineHeight: lineHeight.heading };
    if (level === 2) return { size: font.headingLevel2, lineHeight: lineHeight.heading };
    return { size: font.headingLevel3, lineHeight: lineHeight.heading };
  };

  const applyBlockGap = (previousBlock, nextType) => {
    if (!previousBlock) return;
    if (previousBlock.type === 'table') {
      y += gap.afterTable;
      if (nextType === 'heading') y += gap.tableToHeadingExtra;
      return;
    }
    if (previousBlock.type === 'paragraph') {
      y += gap.afterParagraph;
      if (nextType === 'heading') y += gap.beforeSubheading;
      return;
    }
    if (previousBlock.type === 'bullet-list' || previousBlock.type === 'numbered-list') {
      y += gap.afterList;
      if (nextType === 'heading') y += gap.beforeSubheading;
      return;
    }
    if (previousBlock.type === 'heading') {
      if (nextType === 'heading') {
        y += gap.beforeSubheading;
        return;
      }
      y += previousBlock.level === 1 ? gap.afterSectionTitle : gap.afterSubheading;
    }
  };

  const drawSimpleTable = (heading, rows) => {
    drawSectionTitle(heading);
    if (!rows.length) {
      drawWrappedText('Belum ada data.', { size: font.body, lineHeight: lineHeight.body });
      return;
    }

    if (typeof doc.autoTable !== 'function') {
      rows.forEach(([label, value]) => drawWrappedText(`${label}: ${value}`, { size: font.body, lineHeight: lineHeight.body }));
      return;
    }

    ensureSpace(16);
    doc.autoTable({
      startY: y,
      margin: { left: marginLeft, right: marginRight },
      head: [['Metrik', 'Nilai']],
      body: rows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: font.table,
        cellPadding: PDF_LAYOUT.table.cellPadding,
        lineColor: [214, 224, 238],
        lineWidth: 0.2,
        textColor: [15, 23, 42],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [237, 242, 248],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'right' },
      },
    });
    y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + gap.afterTableImmediate : y + 24;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font.title);
  doc.setTextColor(15, 23, 42);
  doc.text(context.title, marginLeft, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(font.body);
  doc.setTextColor(71, 85, 105);
  doc.text(context.subtitle, marginLeft, y);
  y += 6;

  doc.setDrawColor(210, 220, 234);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  drawSectionTitle('Informasi Dokumen');
  drawWrappedText(`Mode Analisis: ${context.modeLabel}`, { style: 'bold', size: font.body, lineHeight: lineHeight.metadata });
  drawWrappedText(`Tanggal Analisis: ${context.analyzedAt}`, { size: font.body, lineHeight: lineHeight.metadata });
  context.metadataLines.forEach((line) => {
    drawWrappedText(`- ${line}`, { size: font.body, lineHeight: lineHeight.metadata });
  });

  drawSimpleTable('Ringkasan KPI', context.summaryRows);

  if (context.distributionRows.length) {
    drawSectionTitle(`Distribusi Pilihan (${context.distributionTitle})`);
    if (typeof doc.autoTable === 'function') {
      ensureSpace(16);
      doc.autoTable({
        startY: y,
        margin: { left: marginLeft, right: marginRight },
        head: [['Pilihan', 'Jumlah']],
        body: context.distributionRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: font.table,
          cellPadding: PDF_LAYOUT.table.cellPadding,
          lineColor: [214, 224, 238],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [237, 242, 248],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
        },
        columnStyles: {
          1: { halign: 'right' },
        },
      });
      y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + gap.afterTableImmediate : y + 24;
    } else {
      context.distributionRows.forEach(([label, total]) => {
        drawWrappedText(`${label}: ${total}`, { size: font.body, lineHeight: lineHeight.body });
      });
    }
  }

  drawSectionTitle('Hasil Analisis AI');
  if (!context.blocks.length) {
    drawWrappedText('Data analisis belum tersedia.', { size: font.body, lineHeight: lineHeight.body });
    return;
  }

  let previousBlock = null;
  context.blocks.forEach((block) => {
    applyBlockGap(previousBlock, block.type);

    if (block.type === 'heading') {
      const headingLevel = Number(block.level) || 3;
      const headingStyle = getHeadingStyle(headingLevel);
      drawWrappedText(block.text, {
        style: 'bold',
        size: headingStyle.size,
        color: [30, 41, 59],
        lineHeight: headingStyle.lineHeight,
      });
      previousBlock = { type: 'heading', level: headingLevel };
      return;
    }

    if (block.type === 'paragraph') {
      drawWrappedText(block.text, { size: font.body, lineHeight: lineHeight.body });
      previousBlock = { type: 'paragraph' };
      return;
    }

    if (block.type === 'bullet-list') {
      drawHangingList(block.items, false);
      previousBlock = { type: 'bullet-list' };
      return;
    }

    if (block.type === 'numbered-list') {
      drawHangingList(block.items, true);
      previousBlock = { type: 'numbered-list' };
      return;
    }

    if (block.type === 'table') {
      const header = (block.header || []).map((cell) => sanitizeMarkdownInline(cell));
      const rows = (block.rows || [])
        .map((row) => row.map((cell) => sanitizeMarkdownInline(cell)))
        .filter((row) => row.some((cell) => cell));

      if (!header.length || !rows.length || typeof doc.autoTable !== 'function') {
        if (rows.length) {
          rows.forEach((row) => drawWrappedText(row.join(' | '), { size: font.body, lineHeight: lineHeight.body }));
        }
        previousBlock = { type: 'table' };
        return;
      }

      const columnCount = header.length;
      const normalizedRows = rows.map((row) => {
        const cloned = [...row];
        while (cloned.length < columnCount) cloned.push('');
        return cloned.slice(0, columnCount);
      });
      const columnStyles = {};
      for (let col = 0; col < columnCount; col += 1) {
        const allNumeric = normalizedRows.every((row) => !row[col] || isNumericLike(row[col]));
        if (allNumeric) columnStyles[col] = { halign: 'right' };
      }

      ensureSpace(16);
      doc.autoTable({
        startY: y,
        margin: { left: marginLeft, right: marginRight },
        head: [header],
        body: normalizedRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: font.table,
          cellPadding: PDF_LAYOUT.table.cellPadding,
          lineColor: [214, 224, 238],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [237, 242, 248],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [250, 252, 255] },
        columnStyles,
      });
      y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + gap.afterTableImmediate : y + 24;
      previousBlock = { type: 'table' };
    }
  });
}

async function downloadAiPdf() {
  const analysisText = String(state.latestAi?.analysis || '').trim();
  if (!analysisText) {
    setStatus('Belum ada analisis untuk diunduh.', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF || typeof jsPDF !== 'function') {
    setStatus('Library PDF tidak tersedia.', 'error');
    return;
  }

  try {
    await runWithButtonLoading(
      aiPdfBtn,
      'Membuat PDF...',
      async () => {
        const context = buildPdfContext();
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        renderPdfDocument(doc, context);
        renderFooterAllPages(doc);
        doc.save(context.filename);
      },
      [aiLoadBtn, aiRunBtn]
    );

    setStatus('PDF analisis berhasil diunduh.', 'success');
    setError(null);
  } catch (error) {
    const normalized = normalizeUiError(error, 'Gagal membuat PDF analisis.');
    setStatus(normalized.message, 'error');
    setError(error);
  }
}

function bindEvents() {
  applyFilterBtn.addEventListener('click', async () => {
    if (!validateDateRange()) return;
    try {
      state.page = 1;
      setStatus('Memuat data dashboard sesuai filter...', 'warning');
      await runWithButtonLoading(applyFilterBtn, 'Memproses...', async () => {
        await loadSummaryAndCharts();
        await loadResponses();
        await loadAiLatest();
      });
      setStatus('Dashboard berhasil diperbarui.', 'success');
      setError(null);
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal menerapkan filter dashboard.');
      setStatus(normalized.message, 'error');
      setError(error);
    }
  });

  responseSearchBtn.addEventListener('click', async () => {
    if (!validateDateRange()) return;
    state.page = 1;
    state.search = String(responseSearchEl.value || '').trim();
    await runWithButtonLoading(responseSearchBtn, 'Mencari...', async () => {
      await loadResponses();
      setStatus(`Pencarian selesai. Menampilkan hasil untuk "${state.search || 'semua'}".`, 'success');
      setError(null);
    });
  });

  responsesPrevBtn.addEventListener('click', async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    await runWithButtonLoading(responsesPrevBtn, 'Memuat...', async () => {
      await loadResponses();
      setStatus('Halaman respons diperbarui.', 'success');
      setError(null);
    }, [responsesNextBtn]);
  });

  responsesNextBtn.addEventListener('click', async () => {
    const totalPages = Math.max(1, Math.ceil((state.totalResponses || 0) / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    await runWithButtonLoading(responsesNextBtn, 'Memuat...', async () => {
      await loadResponses();
      setStatus('Halaman respons diperbarui.', 'success');
      setError(null);
    }, [responsesPrevBtn]);
  });

  radioQuestionSelectEl.addEventListener('change', () => {
    state.selectedRadioQuestion = String(radioQuestionSelectEl.value || '').trim();
    renderRadioDistributionChart();
  });

  criteriaSummaryListEl?.addEventListener('click', (event) => {
    const chip = event.target.closest('.criteria-question-chip');
    if (!chip) return;
    const questionCode = String(chip.dataset.questionCode || '').trim();
    if (!questionCode) return;
    const normalizedCode = questionCode.toUpperCase();
    if (state.selectedQuestionCode === normalizedCode) {
      renderQuestionDetail(null);
      return;
    }
    const question = findQuestionByCode(questionCode);
    if (!question) return;
    renderQuestionDetail(question);
  });

  questionDetailCloseBtnEl?.addEventListener('click', () => {
    renderQuestionDetail(null);
  });

  aiLoadBtn.addEventListener('click', async () => {
    await runWithButtonLoading(aiLoadBtn, 'Memuat...', async () => {
      await loadAiLatest();
      setStatus('Analisis AI terbaru dimuat.', 'success');
      setError(null);
    }, [aiRunBtn]);
  });

  aiRunBtn.addEventListener('click', async () => {
    await runAiAnalysis();
  });

  aiModeEl.addEventListener('change', () => {
    aiPdfBtn.disabled = true;
    setAiOutput('Pilih "Muat Terakhir" atau "Jalankan Analisis" untuk mode ini.');
  });

  filterVersionEl.addEventListener('change', async () => {
    if (!validateDateRange()) return;
    state.page = 1;
    setStatus('Versi data diubah. Memuat ulang dashboard...', 'warning');
    await runWithButtonLoading(applyFilterBtn, 'Memproses...', async () => {
      await loadSummaryAndCharts();
      await loadResponses();
      await loadAiLatest();
    });
    setStatus('Dashboard berhasil diperbarui untuk versi terpilih.', 'success');
    setError(null);
  });

  aiPdfBtn.addEventListener('click', downloadAiPdf);
}

async function init() {
  const route = parseRouteContext();
  state.tenantSlug = route.tenantSlug;
  state.questionnaireSlug = route.questionnaireSlug;

  titleEl.textContent = `Dashboard Kuesioner - ${state.questionnaireSlug}`;
  subtitleEl.textContent = `Organisasi ${state.tenantSlug} - scope per kuesioner`;

  backBuilderLink.href = `/forms/${state.tenantSlug}/admin/questionnaires/${state.questionnaireSlug}/builder/`;
  openFormLink.href = `/forms/${state.tenantSlug}/${state.questionnaireSlug}/`;

  bindEvents();
  setStatus('Memuat dashboard...', 'warning');
  await loadVersionOptions();
  await loadSummaryAndCharts();
  await loadResponses();
  await loadAiLatest();
  setStatus('Dashboard siap dipakai.', 'success');
  setError(null);
}

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error');
  setError(originalError);
});

init().catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat dashboard questionnaire.');
  setStatus(normalized.message, 'error');
  setError(error);
});
