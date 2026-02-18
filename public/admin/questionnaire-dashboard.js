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
const inlineActionsEl = document.getElementById('dashboard-inline-actions');
const retryBtnEl = document.getElementById('dashboard-retry-btn');
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
const advancedVizHelpEl = document.getElementById('advanced-viz-help');
const advancedVizInsightsEl = document.getElementById('advanced-viz-insights');
const advancedVizTabsContainerEl = document.querySelector('.dashboard-viz-tabs');
const advancedVizTabButtons = Array.from(document.querySelectorAll('.dashboard-viz-tab'));
const visualVisibilitySettingsEl = document.getElementById('visual-visibility-settings');
const visualVisibilityResetBtnEl = document.getElementById('visual-visibility-reset-btn');
const visualVisibilityInputEls = Array.from(document.querySelectorAll('input[data-visual-card]'));
const visualLayoutPresetEl = document.getElementById('visual-layout-preset');
const visualLayoutApplyBtnEl = document.getElementById('visual-layout-apply-btn');
const visualOrderListEl = document.getElementById('visual-order-list');
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
const aiProgressEl = document.getElementById('ai-progress');
const aiProgressTitleEl = document.getElementById('ai-progress-title');
const aiProgressElapsedEl = document.getElementById('ai-progress-elapsed');
const aiProgressNoteEl = document.getElementById('ai-progress-note');

const aiProgressState = {
  startedAt: 0,
  timerId: null,
};

const VISUAL_CARD_CONFIG = Object.freeze({
  scaleAverage: Object.freeze({
    cardId: 'card-scale-average',
    label: 'Rata-rata Pertanyaan Skala',
  }),
  radioDistribution: Object.freeze({
    cardId: 'card-radio-distribution',
    label: 'Pertanyaan Pilihan',
  }),
  trend: Object.freeze({
    cardId: 'card-trend',
    label: 'Tren Respons Harian',
  }),
  criteriaSummary: Object.freeze({
    cardId: 'card-criteria-summary',
    label: 'Analisis per Kriteria',
  }),
  advancedViz: Object.freeze({
    cardId: 'card-advanced-viz',
    label: 'Visual Lanjutan',
  }),
});

const VISUAL_CARD_KEYS = Object.keys(VISUAL_CARD_CONFIG);

const VISUAL_PRESET_CONFIG = Object.freeze({
  full: Object.freeze({
    label: 'Lengkap',
    visibility: Object.freeze({
      scaleAverage: true,
      radioDistribution: true,
      trend: true,
      criteriaSummary: true,
      advancedViz: true,
    }),
    order: Object.freeze(['scaleAverage', 'radioDistribution', 'trend', 'criteriaSummary', 'advancedViz']),
    advancedVizMode: 'criteria',
  }),
  compact: Object.freeze({
    label: 'Ringkas',
    visibility: Object.freeze({
      scaleAverage: true,
      radioDistribution: false,
      trend: false,
      criteriaSummary: true,
      advancedViz: true,
    }),
    order: Object.freeze(['advancedViz', 'criteriaSummary', 'scaleAverage', 'radioDistribution', 'trend']),
    advancedVizMode: 'criteria',
  }),
  monitoring: Object.freeze({
    label: 'Monitoring Tren',
    visibility: Object.freeze({
      scaleAverage: false,
      radioDistribution: false,
      trend: true,
      criteriaSummary: true,
      advancedViz: true,
    }),
    order: Object.freeze(['trend', 'advancedViz', 'criteriaSummary', 'scaleAverage', 'radioDistribution']),
    advancedVizMode: 'period',
  }),
});

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
  advancedVizMode: 'criteria',
  visualCardVisibility: {},
  visualVisibilityStorageKey: '',
  visualOrderStorageKey: '',
  visualCardOrder: [],
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
    advancedViz: null,
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

function createDefaultVisualCardVisibility() {
  return VISUAL_CARD_KEYS.reduce((accumulator, key) => {
    accumulator[key] = true;
    return accumulator;
  }, {});
}

function createDefaultVisualCardOrder() {
  return [...VISUAL_CARD_KEYS];
}

function getVisualVisibilityStorageKey() {
  const tenant = String(state.tenantSlug || '').trim().toLowerCase();
  const questionnaire = String(state.questionnaireSlug || '').trim().toLowerCase();
  return `aiti:dashboard:visual-visibility:${tenant}:${questionnaire}`;
}

function getVisualOrderStorageKey() {
  const tenant = String(state.tenantSlug || '').trim().toLowerCase();
  const questionnaire = String(state.questionnaireSlug || '').trim().toLowerCase();
  return `aiti:dashboard:visual-order:${tenant}:${questionnaire}`;
}

function normalizeVisualCardOrder(candidateOrder = []) {
  const source = Array.isArray(candidateOrder) ? candidateOrder : [];
  const normalized = [];
  source.forEach((key) => {
    const value = String(key || '').trim();
    if (!VISUAL_CARD_CONFIG[value]) return;
    if (normalized.includes(value)) return;
    normalized.push(value);
  });
  VISUAL_CARD_KEYS.forEach((key) => {
    if (normalized.includes(key)) return;
    normalized.push(key);
  });
  return normalized;
}

function loadVisualCardVisibility() {
  const defaults = createDefaultVisualCardVisibility();
  const storageKey = String(state.visualVisibilityStorageKey || '').trim();
  if (!storageKey) return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return VISUAL_CARD_KEYS.reduce((accumulator, key) => {
      const value = parsed[key];
      accumulator[key] = typeof value === 'boolean' ? value : true;
      return accumulator;
    }, {});
  } catch {
    return defaults;
  }
}

function loadVisualCardOrder() {
  const defaults = createDefaultVisualCardOrder();
  const storageKey = String(state.visualOrderStorageKey || '').trim();
  if (!storageKey) return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return normalizeVisualCardOrder(parsed);
  } catch {
    return defaults;
  }
}

function saveVisualCardVisibility() {
  const storageKey = String(state.visualVisibilityStorageKey || '').trim();
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state.visualCardVisibility || {}));
  } catch {
    // ignore write error (private mode / blocked storage)
  }
}

function saveVisualCardOrder() {
  const storageKey = String(state.visualOrderStorageKey || '').trim();
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state.visualCardOrder || []));
  } catch {
    // ignore write error (private mode / blocked storage)
  }
}

function countVisibleVisualCards(visibility = {}) {
  return VISUAL_CARD_KEYS.reduce((total, key) => total + (visibility[key] ? 1 : 0), 0);
}

function setVisualLayoutPresetSelection(value = '') {
  if (!visualLayoutPresetEl) return;
  visualLayoutPresetEl.value = String(value || '').trim();
}

function resolveMatchingVisualPresetId() {
  const currentVisibility = state.visualCardVisibility || {};
  const currentOrder = normalizeVisualCardOrder(state.visualCardOrder || []);
  const currentMode = String(state.advancedVizMode || '').trim();
  const presetEntries = Object.entries(VISUAL_PRESET_CONFIG);
  for (const [presetId, preset] of presetEntries) {
    const presetVisibility = { ...createDefaultVisualCardVisibility(), ...(preset.visibility || {}) };
    const sameVisibility = VISUAL_CARD_KEYS.every((key) => Boolean(currentVisibility[key]) === Boolean(presetVisibility[key]));
    if (!sameVisibility) continue;
    const presetOrder = normalizeVisualCardOrder(preset.order || createDefaultVisualCardOrder());
    const sameOrder = presetOrder.every((key, index) => currentOrder[index] === key);
    if (!sameOrder) continue;
    if (preset.advancedVizMode && String(preset.advancedVizMode).trim() !== currentMode) continue;
    return presetId;
  }
  return '';
}

function syncVisualVisibilityInputs() {
  visualVisibilityInputEls.forEach((input) => {
    const key = String(input.dataset.visualCard || '').trim();
    if (!key || !VISUAL_CARD_CONFIG[key]) return;
    input.checked = Boolean(state.visualCardVisibility[key]);
  });
}

function resizeVisibleCharts() {
  Object.values(state.charts || {}).forEach((chart) => {
    if (!chart || typeof chart.resize !== 'function') return;
    const card = chart.canvas?.closest('.dashboard-chart-card');
    if (card && card.hidden) return;
    chart.resize();
  });
}

function applyVisualCardOrder() {
  const grid = document.querySelector('.dashboard-chart-grid');
  if (!grid) return;
  const order = normalizeVisualCardOrder(state.visualCardOrder);
  state.visualCardOrder = order;
  order.forEach((key) => {
    const config = VISUAL_CARD_CONFIG[key];
    if (!config) return;
    const card = document.getElementById(config.cardId);
    if (!card) return;
    grid.append(card);
  });
  window.setTimeout(resizeVisibleCharts, 100);
}

function renderVisualOrderList() {
  if (!visualOrderListEl) return;
  const order = normalizeVisualCardOrder(state.visualCardOrder);
  state.visualCardOrder = order;
  visualOrderListEl.innerHTML = '';
  order.forEach((key, index) => {
    const config = VISUAL_CARD_CONFIG[key];
    if (!config) return;
    const row = document.createElement('div');
    row.className = 'dashboard-visual-order-item';

    const label = document.createElement('p');
    label.textContent = `${index + 1}. ${config.label}`;

    const actions = document.createElement('div');
    actions.className = 'dashboard-visual-order-item__actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'ghost';
    upBtn.dataset.orderKey = key;
    upBtn.dataset.orderMove = 'up';
    upBtn.textContent = 'Naik';
    upBtn.disabled = index === 0;

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'ghost';
    downBtn.dataset.orderKey = key;
    downBtn.dataset.orderMove = 'down';
    downBtn.textContent = 'Turun';
    downBtn.disabled = index === order.length - 1;

    actions.append(upBtn, downBtn);
    row.append(label, actions);
    visualOrderListEl.append(row);
  });
}

function applyVisualCardVisibility() {
  VISUAL_CARD_KEYS.forEach((key) => {
    const config = VISUAL_CARD_CONFIG[key];
    const card = document.getElementById(config.cardId);
    if (!card) return;
    card.hidden = !Boolean(state.visualCardVisibility[key]);
  });
  window.setTimeout(resizeVisibleCharts, 90);
}

function moveVisualCardOrder(key, direction) {
  const targetKey = String(key || '').trim();
  if (!targetKey || !VISUAL_CARD_CONFIG[targetKey]) return false;
  const order = normalizeVisualCardOrder(state.visualCardOrder);
  const currentIndex = order.indexOf(targetKey);
  if (currentIndex < 0) return false;
  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= order.length) return false;
  [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
  state.visualCardOrder = order;
  saveVisualCardOrder();
  applyVisualCardOrder();
  renderVisualOrderList();
  return true;
}

function applyVisualPreset(presetId) {
  const normalizedPresetId = String(presetId || '').trim();
  const preset = VISUAL_PRESET_CONFIG[normalizedPresetId];
  if (!preset) return false;

  const nextVisibility = { ...createDefaultVisualCardVisibility(), ...(preset.visibility || {}) };
  if (countVisibleVisualCards(nextVisibility) < 1) return false;
  state.visualCardVisibility = nextVisibility;
  state.visualCardOrder = normalizeVisualCardOrder(preset.order || createDefaultVisualCardOrder());
  if (preset.advancedVizMode) {
    state.advancedVizMode = String(preset.advancedVizMode).trim();
  }

  saveVisualCardVisibility();
  saveVisualCardOrder();
  syncVisualVisibilityInputs();
  renderVisualOrderList();
  applyVisualCardOrder();
  applyVisualCardVisibility();
  renderAdvancedVizChart();
  setVisualLayoutPresetSelection(normalizedPresetId);
  if (visualVisibilitySettingsEl) visualVisibilitySettingsEl.open = false;
  return true;
}

function initializeVisualCardVisibility() {
  state.visualVisibilityStorageKey = getVisualVisibilityStorageKey();
  state.visualOrderStorageKey = getVisualOrderStorageKey();
  state.visualCardVisibility = loadVisualCardVisibility();
  state.visualCardOrder = loadVisualCardOrder();
  if (countVisibleVisualCards(state.visualCardVisibility) < 1) {
    state.visualCardVisibility = createDefaultVisualCardVisibility();
    saveVisualCardVisibility();
  }
  if (visualVisibilitySettingsEl) {
    visualVisibilitySettingsEl.open = countVisibleVisualCards(state.visualCardVisibility) < VISUAL_CARD_KEYS.length;
  }
  setVisualLayoutPresetSelection(resolveMatchingVisualPresetId());
  syncVisualVisibilityInputs();
  renderVisualOrderList();
  applyVisualCardOrder();
  applyVisualCardVisibility();
}

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
  stopAiProgressIndicator();
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

function normalizeCriterionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase() === 'tanpa kriteria') return 'Tanpa Kriteria';
  return raw.toLowerCase().startsWith('kriteria ') ? raw : `Kriteria ${raw}`;
}

function setAdvancedVizTabs(mode) {
  const normalizedMode = String(mode || '').trim();
  advancedVizTabButtons.forEach((button) => {
    const buttonMode = String(button.dataset.vizMode || '').trim();
    const isActive = buttonMode === normalizedMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function renderAdvancedVizInsights(items = []) {
  if (!advancedVizInsightsEl) return;
  advancedVizInsightsEl.innerHTML = '';
  const normalizedItems = Array.isArray(items) ? items.filter((item) => item && item.title) : [];
  if (!normalizedItems.length) {
    const fallback = document.createElement('article');
    fallback.className = 'advanced-viz-insight-card';
    fallback.innerHTML = '<h4>Insight belum tersedia</h4><p>Tambah respons agar insight visual bisa dihitung otomatis.</p>';
    advancedVizInsightsEl.append(fallback);
    return;
  }

  normalizedItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'advanced-viz-insight-card';
    const tone = String(item.tone || '').trim();
    if (tone) card.classList.add(`is-${tone}`);

    const title = document.createElement('h4');
    title.textContent = item.title;
    const value = document.createElement('strong');
    value.textContent = item.value || '-';
    const note = document.createElement('p');
    note.textContent = item.note || '-';
    card.append(title, value, note);
    advancedVizInsightsEl.append(card);
  });
}

function renderEmptyAdvancedVizChart(canvas, message = 'Belum ada data untuk visual ini.') {
  state.charts.advancedViz = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Data'],
      datasets: [
        {
          label: 'Nilai',
          data: [0],
          borderRadius: 8,
          backgroundColor: 'rgba(88, 157, 255, 0.45)',
          borderColor: 'rgba(88, 157, 255, 0.95)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          enabled: false,
        },
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 5,
        },
      },
    },
  });
  if (advancedVizHelpEl) advancedVizHelpEl.textContent = message;
  renderAdvancedVizInsights([]);
}

function buildCriteriaVizRows() {
  const rawItems = Array.isArray(state.criteriaSummary) ? state.criteriaSummary : [];
  if (!rawItems.length) return [];
  return rawItems
    .filter((item) => Number(item?.totalQuestions || 0) > 0)
    .map((item) => ({
      label: normalizeCriterionLabel(item.criterion),
      avgScale: Number(item.avgScale || 0),
      totalQuestions: Number(item.totalQuestions || 0),
      totalScaleQuestions: Number(item.totalScaleQuestions || 0),
      totalScaleAnswered: Number(item.totalScaleAnswered || 0),
    }))
    .sort((a, b) => b.avgScale - a.avgScale);
}

function buildLikertTotals() {
  const totals = [0, 0, 0, 0, 0];
  const questions = Array.isArray(state.distribution?.questions) ? state.distribution.questions : [];
  questions
    .filter((question) => question?.type === 'scale')
    .forEach((question) => {
      const counts = Array.isArray(question.counts) ? question.counts : [];
      counts.forEach((entry) => {
        const index = Number(entry?.label || 0) - 1;
        if (index < 0 || index > 4) return;
        totals[index] += Number(entry?.total || 0);
      });
    });
  const totalAnswers = totals.reduce((sum, value) => sum + value, 0);
  return { totals, totalAnswers };
}

function buildWeeklyPattern(points = []) {
  const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const totals = new Array(7).fill(0);
  const samples = new Array(7).fill(0);

  (Array.isArray(points) ? points : []).forEach((point) => {
    const dayRaw = String(point?.day || '').trim();
    if (!dayRaw) return;
    const date = new Date(dayRaw);
    if (Number.isNaN(date.getTime())) return;
    const dayIndex = date.getDay();
    totals[dayIndex] += Number(point?.total || 0);
    samples[dayIndex] += 1;
  });

  const averages = order.map((dayIndex) => {
    if (samples[dayIndex] <= 0) return 0;
    return Number((totals[dayIndex] / samples[dayIndex]).toFixed(2));
  });
  const totalResponses = totals.reduce((sum, value) => sum + value, 0);
  return { labels, averages, totals, samples, order, totalResponses };
}

function buildPeriodComparison(points = []) {
  const normalizedPoints = (Array.isArray(points) ? points : [])
    .map((point) => ({
      day: String(point?.day || '').trim(),
      total: Number(point?.total || 0),
    }))
    .filter((point) => point.day);

  if (normalizedPoints.length < 2) return null;

  const splitIndex = Math.floor(normalizedPoints.length / 2);
  const previousPoints = normalizedPoints.slice(0, splitIndex);
  const currentPoints = normalizedPoints.slice(splitIndex);
  if (!previousPoints.length || !currentPoints.length) return null;

  const sumTotals = (items) => items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const previousTotal = sumTotals(previousPoints);
  const currentTotal = sumTotals(currentPoints);
  const previousAvgDaily = previousPoints.length > 0 ? previousTotal / previousPoints.length : 0;
  const currentAvgDaily = currentPoints.length > 0 ? currentTotal / currentPoints.length : 0;
  const deltaTotal = currentTotal - previousTotal;
  const deltaPct = previousTotal > 0 ? (deltaTotal / previousTotal) * 100 : currentTotal > 0 ? 100 : 0;

  return {
    previousCount: previousPoints.length,
    currentCount: currentPoints.length,
    previousTotal,
    currentTotal,
    previousAvgDaily: Number(previousAvgDaily.toFixed(2)),
    currentAvgDaily: Number(currentAvgDaily.toFixed(2)),
    deltaTotal,
    deltaPct: Number(deltaPct.toFixed(2)),
  };
}

function renderAdvancedVizChart() {
  destroyChart('advancedViz');
  const canvas = document.getElementById('advanced-viz-chart');
  if (!canvas) return;

  const mode = String(state.advancedVizMode || 'criteria').trim();
  setAdvancedVizTabs(mode);

  if (mode === 'criteria') {
    const rows = buildCriteriaVizRows();
    if (!rows.length) {
      renderEmptyAdvancedVizChart(canvas, 'Belum ada data kriteria untuk divisualkan pada filter ini.');
      return;
    }

    const labels = rows.map((item) => truncateText(item.label, 26));
    state.charts.advancedViz = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Rata-rata Skala',
            yAxisID: 'y',
            data: rows.map((item) => item.avgScale),
            borderRadius: 8,
            backgroundColor: 'rgba(47, 198, 229, 0.62)',
            borderColor: 'rgba(47, 198, 229, 1)',
            borderWidth: 1,
          },
          {
            type: 'line',
            label: 'Jumlah Soal',
            yAxisID: 'y1',
            data: rows.map((item) => item.totalQuestions),
            borderColor: '#8b8cff',
            backgroundColor: 'rgba(139, 140, 255, 0.18)',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.22,
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
                return first ? rows[first.dataIndex]?.label || '-' : '-';
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
            title: { display: true, text: 'Skor rata-rata' },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Jumlah soal' },
          },
        },
      },
    });

    const highest = rows[0];
    const lowest = rows[rows.length - 1];
    const avgGlobal = rows.reduce((sum, item) => sum + item.avgScale, 0) / rows.length;
    if (advancedVizHelpEl) {
      advancedVizHelpEl.textContent = `${rows.length} kelompok kriteria divisualkan untuk membandingkan kualitas (skor) dan cakupan (jumlah soal).`;
    }
    renderAdvancedVizInsights([
      {
        title: 'Kriteria Tertinggi',
        value: `${highest.label} (${formatNumber(highest.avgScale, 2)})`,
        note: `Soal: ${formatNumber(highest.totalQuestions)} | Respons skala: ${formatNumber(highest.totalScaleAnswered)}`,
        tone: 'good',
      },
      {
        title: 'Kriteria Terendah',
        value: `${lowest.label} (${formatNumber(lowest.avgScale, 2)})`,
        note: `Prioritas evaluasi berikutnya bisa dimulai dari kelompok ini.`,
        tone: 'warn',
      },
      {
        title: 'Rata-rata Global Kriteria',
        value: formatNumber(avgGlobal, 2),
        note: `Dihitung dari ${formatNumber(rows.length)} kelompok kriteria pada filter aktif.`,
      },
    ]);
    return;
  }

  if (mode === 'likert') {
    const likert = buildLikertTotals();
    if (likert.totalAnswers <= 0) {
      renderEmptyAdvancedVizChart(canvas, 'Belum ada jawaban skala (1-5) untuk filter ini.');
      return;
    }

    const labels = ['Skor 1', 'Skor 2', 'Skor 3', 'Skor 4', 'Skor 5'];
    state.charts.advancedViz = new Chart(canvas, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [
          {
            label: 'Total jawaban',
            data: likert.totals,
            backgroundColor: ['#1f6feb', '#2276f5', '#2d9bff', '#2bd4f6', '#2ce3a8'],
            borderColor: 'rgba(8, 18, 36, 0.6)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
          },
        },
      },
    });

    const dominantIndex = likert.totals.reduce(
      (best, value, index) => (value > likert.totals[best] ? index : best),
      0
    );
    const dominantTotal = likert.totals[dominantIndex] || 0;
    const dominantPercent = likert.totalAnswers > 0 ? (dominantTotal / likert.totalAnswers) * 100 : 0;
    if (advancedVizHelpEl) {
      advancedVizHelpEl.textContent = `Sebaran seluruh jawaban skala 1-5. Total terbaca: ${formatNumber(likert.totalAnswers)} jawaban.`;
    }
    renderAdvancedVizInsights([
      {
        title: 'Skor Dominan',
        value: `${labels[dominantIndex]} (${formatNumber(dominantTotal)})`,
        note: `Kontribusi ${formatNumber(dominantPercent, 1)}% dari total jawaban skala.`,
        tone: dominantIndex >= 3 ? 'good' : 'warn',
      },
      {
        title: 'Skor Tinggi (4-5)',
        value: formatNumber((likert.totals[3] || 0) + (likert.totals[4] || 0)),
        note: `Akumulasi respon positif untuk membaca kepuasan umum.`,
        tone: 'good',
      },
      {
        title: 'Skor Rendah (1-2)',
        value: formatNumber((likert.totals[0] || 0) + (likert.totals[1] || 0)),
        note: `Gunakan untuk menentukan area perbaikan prioritas.`,
        tone: 'warn',
      },
    ]);
    return;
  }

  if (mode === 'period') {
    const comparison = buildPeriodComparison(state.trend?.points || []);
    if (!comparison) {
      renderEmptyAdvancedVizChart(
        canvas,
        'Perbandingan periode membutuhkan minimal 2 hari data pada rentang tren aktif.'
      );
      return;
    }

    const previousLabel = `Periode Sebelumnya (${comparison.previousCount} hari)`;
    const currentLabel = `Periode Saat Ini (${comparison.currentCount} hari)`;
    state.charts.advancedViz = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [previousLabel, currentLabel],
        datasets: [
          {
            label: 'Total Respons',
            data: [comparison.previousTotal, comparison.currentTotal],
            borderRadius: 10,
            backgroundColor: ['rgba(126, 155, 255, 0.58)', 'rgba(47, 198, 229, 0.68)'],
            borderColor: ['rgba(126, 155, 255, 1)', 'rgba(47, 198, 229, 1)'],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });

    const directionLabel =
      comparison.deltaPct > 0 ? 'Naik' : comparison.deltaPct < 0 ? 'Turun' : 'Stabil (0%)';
    if (advancedVizHelpEl) {
      advancedVizHelpEl.textContent =
        'Perbandingan otomatis antara setengah awal dan setengah akhir dari rentang tren aktif.';
    }
    renderAdvancedVizInsights([
      {
        title: 'Perubahan Total Respons',
        value: `${directionLabel} ${formatNumber(Math.abs(comparison.deltaPct), 2)}%`,
        note: `${formatNumber(comparison.previousTotal)} -> ${formatNumber(comparison.currentTotal)} respons`,
        tone: comparison.deltaPct >= 0 ? 'good' : 'warn',
      },
      {
        title: 'Rata-rata Harian Sebelumnya',
        value: formatNumber(comparison.previousAvgDaily, 2),
        note: `Dari ${formatNumber(comparison.previousCount)} hari awal pada rentang tren.`,
      },
      {
        title: 'Rata-rata Harian Saat Ini',
        value: formatNumber(comparison.currentAvgDaily, 2),
        note: `Dari ${formatNumber(comparison.currentCount)} hari akhir pada rentang tren.`,
        tone: comparison.currentAvgDaily >= comparison.previousAvgDaily ? 'good' : 'warn',
      },
    ]);
    return;
  }

  const weekly = buildWeeklyPattern(state.trend?.points || []);
  if (weekly.totalResponses <= 0) {
    renderEmptyAdvancedVizChart(canvas, 'Belum ada respons harian untuk membentuk pola mingguan.');
    return;
  }

  state.charts.advancedViz = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: weekly.labels,
      datasets: [
        {
          label: 'Rata-rata respons per hari',
          data: weekly.averages,
          borderColor: '#33d9ff',
          backgroundColor: 'rgba(51, 217, 255, 0.2)',
          pointBackgroundColor: '#82f7ff',
          pointBorderColor: '#082039',
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          ticks: {
            backdropColor: 'transparent',
          },
        },
      },
    },
  });

  const peakValue = Math.max(...weekly.averages);
  const peakIndex = weekly.averages.findIndex((value) => value === peakValue);
  const activeDays = weekly.totals.filter((value) => value > 0).length;
  const totalDays = weekly.samples.reduce((sum, value) => sum + value, 0);
  if (advancedVizHelpEl) {
    advancedVizHelpEl.textContent = `Radar menunjukkan rata-rata respons per hari (berdasarkan rentang tren ${formatNumber(totalDays)} hari).`;
  }
  renderAdvancedVizInsights([
    {
      title: 'Hari Paling Aktif',
      value: `${weekly.labels[Math.max(0, peakIndex)]} (${formatNumber(peakValue, 2)})`,
      note: 'Nilai adalah rata-rata respons pada hari tersebut.',
      tone: 'good',
    },
    {
      title: 'Hari Aktif',
      value: `${formatNumber(activeDays)} / 7`,
      note: 'Jumlah hari yang memiliki respons lebih dari 0.',
    },
    {
      title: 'Total Respons Tren',
      value: formatNumber(weekly.totalResponses),
      note: 'Akumulasi respons pada rentang tren yang sedang ditampilkan.',
    },
  ]);
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

function ensureSelectedVersionExists() {
  const selected = String(filterVersionEl?.value || '').trim();
  if (!selected) return;
  const available = Array.isArray(state.availableVersions) ? state.availableVersions : [];
  const exists = available.some((version) => String(version.id || '').trim() === selected);
  if (exists) return;
  if (filterVersionEl) filterVersionEl.value = '';
  state.selectedVersionId = '';
}

async function refreshDashboardData({
  startMessage = 'Memuat data dashboard sesuai filter...',
  successMessage = 'Dashboard berhasil diperbarui.',
  keepPage = false,
} = {}) {
  ensureSelectedVersionExists();
  if (!validateDateRange()) return false;
  if (!keepPage) state.page = 1;
  try {
    setStatus(startMessage, 'warning');
    await runWithButtonLoading(applyFilterBtn, 'Memproses...', async () => {
      await loadSummaryAndCharts();
      await loadResponses();
      await loadAiLatest();
    });
    setStatus(successMessage, 'success');
    setError(null);
    return true;
  } catch (error) {
    presentError(error, 'Gagal memuat ulang dashboard.');
    return false;
  }
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
  renderAdvancedVizChart();
  renderContextInfo();
  updateCsvLink();
  applyVisualCardVisibility();
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

function formatElapsedLabel(totalSeconds) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  if (safeSeconds < 60) return `${safeSeconds} dtk`;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}m ${seconds} dtk`;
}

function resolveAiProgressNote(elapsedSeconds) {
  if (elapsedSeconds < 8) return 'Mengumpulkan respons sesuai mode dan filter...';
  if (elapsedSeconds < 18) return 'Menyusun ringkasan KPI dan temuan utama...';
  if (elapsedSeconds < 30) return 'Merapikan rekomendasi agar siap dibaca admin...';
  return 'Proses masih berjalan. Jika melewati 60 detik, cek koneksi lalu coba lagi.';
}

function setAiProgressVisibility(visible = false) {
  if (!aiProgressEl) return;
  aiProgressEl.hidden = !visible;
}

function stopAiProgressIndicator() {
  if (aiProgressState.timerId) {
    window.clearInterval(aiProgressState.timerId);
    aiProgressState.timerId = null;
  }
  aiProgressState.startedAt = 0;
  aiOutputEl.removeAttribute('aria-busy');
  setAiProgressVisibility(false);
}

function updateAiProgressIndicator() {
  if (!aiProgressElapsedEl || !aiProgressNoteEl || !aiProgressState.startedAt) return;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - aiProgressState.startedAt) / 1000));
  aiProgressElapsedEl.textContent = `Berjalan ${formatElapsedLabel(elapsedSeconds)}`;
  aiProgressNoteEl.textContent = resolveAiProgressNote(elapsedSeconds);
}

function startAiProgressIndicator() {
  stopAiProgressIndicator();
  aiProgressState.startedAt = Date.now();
  aiOutputEl.setAttribute('aria-busy', 'true');
  if (aiProgressTitleEl) {
    aiProgressTitleEl.textContent = `Menjalankan analisis ${getModeLabel(getActiveMode())}...`;
  }
  setAiProgressVisibility(true);
  updateAiProgressIndicator();
  aiProgressState.timerId = window.setInterval(updateAiProgressIndicator, 1000);
}

async function loadAiLatest() {
  stopAiProgressIndicator();
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
    const previousAnalysisText = String(state.latestAi?.analysis || '').trim();
    aiPdfBtn.disabled = true;
    startAiProgressIndicator();
    setAiOutput('Sedang memproses analisis AI. Mohon tunggu...');
    setStatus('Analisis AI dimulai. Estimasi 10-45 detik.', 'warning');
    try {
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
    } catch (error) {
      if (previousAnalysisText) {
        setAiOutput(previousAnalysisText);
        aiPdfBtn.disabled = false;
      } else {
        setAiOutput('Analisis gagal dijalankan. Periksa status error lalu coba lagi.');
        aiPdfBtn.disabled = true;
      }
      throw error;
    } finally {
      stopAiProgressIndicator();
    }
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
    await refreshDashboardData({
      startMessage: 'Memuat data dashboard sesuai filter...',
      successMessage: 'Dashboard berhasil diperbarui.',
    });
  });

  retryBtnEl?.addEventListener('click', async () => {
    await refreshDashboardData({
      startMessage: 'Mencoba ulang koneksi dashboard...',
      successMessage: 'Dashboard berhasil dipulihkan.',
      keepPage: true,
    });
  });

  responseSearchBtn.addEventListener('click', async () => {
    if (!validateDateRange()) return;
    state.page = 1;
    state.search = String(responseSearchEl.value || '').trim();
    try {
      await runWithButtonLoading(responseSearchBtn, 'Mencari...', async () => {
        await loadResponses();
        setStatus(`Pencarian selesai. Menampilkan hasil untuk "${state.search || 'semua'}".`, 'success');
        setError(null);
      });
    } catch (error) {
      presentError(error, 'Gagal mencari respons.');
    }
  });

  responsesPrevBtn.addEventListener('click', async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    try {
      await runWithButtonLoading(responsesPrevBtn, 'Memuat...', async () => {
        await loadResponses();
        setStatus('Halaman respons diperbarui.', 'success');
        setError(null);
      }, [responsesNextBtn]);
    } catch (error) {
      presentError(error, 'Gagal memuat halaman respons.');
    }
  });

  responsesNextBtn.addEventListener('click', async () => {
    const totalPages = Math.max(1, Math.ceil((state.totalResponses || 0) / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    try {
      await runWithButtonLoading(responsesNextBtn, 'Memuat...', async () => {
        await loadResponses();
        setStatus('Halaman respons diperbarui.', 'success');
        setError(null);
      }, [responsesPrevBtn]);
    } catch (error) {
      presentError(error, 'Gagal memuat halaman respons.');
    }
  });

  radioQuestionSelectEl.addEventListener('change', () => {
    state.selectedRadioQuestion = String(radioQuestionSelectEl.value || '').trim();
    renderRadioDistributionChart();
  });

  advancedVizTabsContainerEl?.addEventListener('click', (event) => {
    const tab = event.target.closest('.dashboard-viz-tab');
    if (!tab) return;
    const mode = String(tab.dataset.vizMode || '').trim();
    if (!mode || mode === state.advancedVizMode) return;
    state.advancedVizMode = mode;
    renderAdvancedVizChart();
  });

  visualVisibilityInputEls.forEach((input) => {
    input.addEventListener('change', () => {
      const key = String(input.dataset.visualCard || '').trim();
      if (!key || !VISUAL_CARD_CONFIG[key]) return;
      const nextVisibility = {
        ...state.visualCardVisibility,
        [key]: Boolean(input.checked),
      };
      if (countVisibleVisualCards(nextVisibility) < 1) {
        input.checked = true;
        setStatus('Minimal 1 panel visual harus tetap ditampilkan.', 'warning');
        return;
      }
      state.visualCardVisibility = nextVisibility;
      saveVisualCardVisibility();
      setVisualLayoutPresetSelection(resolveMatchingVisualPresetId());
      applyVisualCardVisibility();
      setStatus(`Tampilan visual diperbarui (${VISUAL_CARD_CONFIG[key].label}).`, 'success');
    });
  });

  visualLayoutApplyBtnEl?.addEventListener('click', () => {
    const presetId = String(visualLayoutPresetEl?.value || '').trim();
    if (!presetId) {
      setStatus('Pilih preset tampilan dulu.', 'warning');
      return;
    }
    const applied = applyVisualPreset(presetId);
    if (!applied) {
      setStatus('Preset gagal diterapkan. Coba lagi.', 'error');
      return;
    }
    const label = VISUAL_PRESET_CONFIG[presetId]?.label || 'Preset';
    setStatus(`Preset tampilan diterapkan: ${label}.`, 'success');
  });

  visualOrderListEl?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-order-key][data-order-move]');
    if (!button) return;
    const orderKey = String(button.dataset.orderKey || '').trim();
    const direction = String(button.dataset.orderMove || '').trim().toLowerCase();
    if (!orderKey || (direction !== 'up' && direction !== 'down')) return;
    const moved = moveVisualCardOrder(orderKey, direction);
    if (!moved) return;
    setVisualLayoutPresetSelection(resolveMatchingVisualPresetId());
    setStatus(`Urutan visual diperbarui (${VISUAL_CARD_CONFIG[orderKey]?.label || orderKey}).`, 'success');
  });

  visualVisibilityResetBtnEl?.addEventListener('click', () => {
    state.visualCardVisibility = createDefaultVisualCardVisibility();
    state.visualCardOrder = createDefaultVisualCardOrder();
    state.advancedVizMode = 'criteria';
    saveVisualCardVisibility();
    saveVisualCardOrder();
    syncVisualVisibilityInputs();
    renderVisualOrderList();
    applyVisualCardOrder();
    applyVisualCardVisibility();
    renderAdvancedVizChart();
    setVisualLayoutPresetSelection('full');
    if (visualVisibilitySettingsEl) visualVisibilitySettingsEl.open = false;
    setStatus('Tampilan visual dikembalikan ke default.', 'success');
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
    try {
      await runWithButtonLoading(aiLoadBtn, 'Memuat...', async () => {
        await loadAiLatest();
        setStatus('Analisis AI terbaru dimuat.', 'success');
        setError(null);
      }, [aiRunBtn]);
    } catch (error) {
      presentError(error, 'Gagal memuat analisis AI terbaru.');
    }
  });

  aiRunBtn.addEventListener('click', async () => {
    try {
      await runAiAnalysis();
    } catch (error) {
      presentError(error, 'Gagal menjalankan analisis AI.');
    }
  });

  aiModeEl.addEventListener('change', () => {
    stopAiProgressIndicator();
    aiPdfBtn.disabled = true;
    setAiOutput('Mode diganti. Klik "Muat Terakhir" atau "Jalankan Analisis" untuk mode ini.');
  });

  filterVersionEl.addEventListener('change', async () => {
    await refreshDashboardData({
      startMessage: 'Versi data diubah. Memuat ulang dashboard...',
      successMessage: 'Dashboard berhasil diperbarui untuk versi terpilih.',
    });
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

  initializeVisualCardVisibility();
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
  setStatus(toActionableErrorMessage(normalized), 'error', {
    retry: canRetryFromError(normalized),
  });
  setError(originalError);
});

init().catch((error) => {
  presentError(error, 'Gagal memuat dashboard questionnaire.');
});
