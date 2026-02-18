import {
  bindRuntimeErrorHandlers,
  createActivityFeed,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';

const statusEl = document.getElementById('status');
const inlineStatusEl = document.getElementById('status-inline');
const errorDebugEl = document.getElementById('error-debug');
const activityFeedEl = document.getElementById('activity-feed');
const subtitleEl = document.getElementById('builder-subtitle');

const metaTitleEl = document.getElementById('meta-title');
const metaGreetingTitleEl = document.getElementById('meta-greeting-title');
const metaGreetingTextEl = document.getElementById('meta-greeting-text');

const questionListEl = document.getElementById('question-list');
const newQuestionLabelEl = document.getElementById('new-question-label');
const newQuestionTypeEl = document.getElementById('new-question-type');
const newQuestionCriterionEl = document.getElementById('new-question-criterion');
const newQuestionRequiredEl = document.getElementById('new-question-required');
const newQuestionOptionsWrapEl = document.getElementById('new-question-options-wrap');
const newQuestionOptionsEl = document.getElementById('new-question-options');
const newQuestionFromWrapEl = document.getElementById('new-question-from-wrap');
const newQuestionToWrapEl = document.getElementById('new-question-to-wrap');
const newQuestionFromEl = document.getElementById('new-question-from');
const newQuestionToEl = document.getElementById('new-question-to');

const previewTitleEl = document.getElementById('preview-title');
const previewGreetingTitleEl = document.getElementById('preview-greeting-title');
const previewGreetingTextEl = document.getElementById('preview-greeting-text');
const previewFieldsEl = document.getElementById('preview-fields');

const publishWarningEl = document.getElementById('publish-warning');
const publishResultEl = document.getElementById('publish-result');
const publishResultTitleEl = document.getElementById('publish-result-title');
const publishResultMessageEl = document.getElementById('publish-result-message');
const publishResultFormLinkEl = document.getElementById('publish-result-form-link');
const publishResultDashboardLinkEl = document.getElementById('publish-result-dashboard-link');
const reloadDraftBtn = document.getElementById('reload-draft-btn');
const saveDraftBtn = document.getElementById('save-draft-btn');
const publishBtn = document.getElementById('publish-btn');
const advancedJsonEl = document.getElementById('advanced-json');

const stepButtons = Array.from(document.querySelectorAll('.builder-step'));
const stepPanels = Array.from(document.querySelectorAll('.builder-step-panel'));

const backPanelLink = document.getElementById('back-panel-link');
const openDashboardLink = document.getElementById('open-dashboard-link');
const addQuestionBtn = document.getElementById('add-question-btn');

const activityFeed = createActivityFeed(activityFeedEl);

const state = {
  tenantSlug: '',
  questionnaireSlug: '',
  questionnaireName: '',
  questionnaireId: '',
  meta: {
    title: '',
    greetingTitle: '',
    greetingText: '',
  },
  fields: [],
  loadedSnapshot: [],
  hasResponses: false,
  isPublishing: false,
};
const LEGACY_SCHOOL_SLUG = 'sman6-kotakupang';

function parseRouteContext() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const formsIndex = parts.indexOf('forms');
  if (formsIndex === -1) throw new Error('Route tidak valid.');
  const tenantSlug = parts[formsIndex + 1];
  const questionnaireSlug = parts[formsIndex + 4];
  if (!tenantSlug || !questionnaireSlug) {
    throw new Error('Tenant atau questionnaire slug tidak ditemukan di URL.');
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

function formatPublishTime(value) {
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

function publicFormPath() {
  return `/forms/${encodeURIComponent(state.tenantSlug)}/${encodeURIComponent(state.questionnaireSlug)}/`;
}

function hidePublishResult() {
  publishResultEl.hidden = true;
  publishResultTitleEl.textContent = 'Publikasi berhasil.';
  publishResultMessageEl.textContent = '';
}

function setPublishProcessing(isBusy) {
  state.isPublishing = Boolean(isBusy);
  if (publishBtn) {
    publishBtn.disabled = state.isPublishing;
    publishBtn.classList.toggle('is-loading', state.isPublishing);
    publishBtn.textContent = state.isPublishing ? 'Mempublikasikan...' : 'Publikasikan';
  }
  if (saveDraftBtn) saveDraftBtn.disabled = state.isPublishing;
  if (reloadDraftBtn) reloadDraftBtn.disabled = state.isPublishing;
  if (addQuestionBtn) addQuestionBtn.disabled = state.isPublishing;
}

async function runWithButtonLoading(button, loadingText, task) {
  if (!button) return task();
  const idleText = button.textContent;
  button.disabled = true;
  button.classList.add('is-loading');
  button.textContent = loadingText;
  try {
    return await task();
  } finally {
    button.textContent = idleText;
    button.classList.remove('is-loading');
    button.disabled = false;
  }
}

function showPublishResult(published = {}) {
  const version = published?.version ? `v${published.version}` : 'versi terbaru';
  const publishedAt = formatPublishTime(published?.publishedAt);
  publishResultTitleEl.textContent = `Publikasi ${version} berhasil.`;
  publishResultMessageEl.textContent = `Kuesioner sudah live dengan ${state.fields.length} pertanyaan. Dipublish pada ${publishedAt}. Pilih tombol di bawah untuk lanjut.`;
  publishResultFormLinkEl.href = publicFormPath();
  publishResultDashboardLinkEl.href = openDashboardLink.href;
  publishResultEl.hidden = false;
}

function setError(error = null) {
  if (!error) {
    errorDebugEl.textContent = 'Belum ada error.';
    return;
  }
  setErrorDebugPanel(errorDebugEl, error);
}

function pushActivity(level, action, detail = '') {
  activityFeed.push(level, action, detail);
}

function api(path, options, actionLabel) {
  return requestJson(path, options).catch((error) => {
    const normalized = normalizeUiError(error, 'Terjadi kesalahan.');
    setStatus(normalized.message, 'error');
    setError(error);
    pushActivity('error', actionLabel, `${normalized.method} ${normalized.path} (${normalized.status})`);
    throw error;
  });
}

function cloneField(field) {
  return JSON.parse(JSON.stringify(field));
}

function slugToKey(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ensureUniqueFieldKey(preferred, fields, excludedKey = null) {
  const base = slugToKey(preferred) || 'q_item';
  const used = new Set(fields.map((field) => field.name).filter((name) => name && name !== excludedKey));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function normalizeField(rawField, fields = [], excludedKey = null) {
  const type = String(rawField?.type || 'text').trim();
  const label = String(rawField?.label || '').trim();
  const name = ensureUniqueFieldKey(rawField?.name || label, fields, excludedKey);
  const criterion = String(rawField?.criterion || '').trim();
  const required = rawField?.required !== false;
  if (!label) {
    throw new Error('Label pertanyaan wajib diisi.');
  }

  if (!['text', 'radio', 'checkbox', 'scale'].includes(type)) {
    throw new Error('Tipe pertanyaan tidak didukung.');
  }

  if (type === 'text') {
    return {
      type,
      name,
      label,
      criterion,
      required,
    };
  }

  if (type === 'radio' || type === 'checkbox') {
    const options = Array.isArray(rawField?.options)
      ? rawField.options.map((item) => String(item || '').trim()).filter(Boolean)
      : String(rawField?.options || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    if (options.length < 2) {
      throw new Error(`Pertanyaan "${label}" tipe pilihan harus memiliki minimal 2 opsi.`);
    }
    return {
      type,
      name,
      label,
      criterion,
      required,
      options,
    };
  }

  return {
    type,
    name,
    label,
    criterion,
    required,
    fromLabel: String(rawField?.fromLabel || 'Tidak Setuju').trim() || 'Tidak Setuju',
    toLabel: String(rawField?.toLabel || 'Sangat Setuju').trim() || 'Sangat Setuju',
  };
}

function syncMetaFromInputs() {
  state.meta = {
    title: String(metaTitleEl.value || '').trim(),
    greetingTitle: String(metaGreetingTitleEl.value || '').trim(),
    greetingText: String(metaGreetingTextEl.value || '').trim(),
  };
}

function syncMetaToInputs() {
  metaTitleEl.value = state.meta.title || '';
  metaGreetingTitleEl.value = state.meta.greetingTitle || '';
  metaGreetingTextEl.value = state.meta.greetingText || '';
}

function syncAdvancedJson() {
  advancedJsonEl.value = JSON.stringify(
    {
      meta: state.meta,
      fields: state.fields,
    },
    null,
    2
  );
}

function setAddQuestionTypeVisibility() {
  const type = String(newQuestionTypeEl.value || 'text').trim();
  newQuestionOptionsWrapEl.hidden = !['radio', 'checkbox'].includes(type);
  newQuestionFromWrapEl.hidden = type !== 'scale';
  newQuestionToWrapEl.hidden = type !== 'scale';
}

function renderPreview() {
  previewTitleEl.textContent = state.meta.title || '-';
  previewGreetingTitleEl.textContent = state.meta.greetingTitle || '-';
  previewGreetingTextEl.textContent = state.meta.greetingText || '-';

  previewFieldsEl.innerHTML = '';
  if (!state.fields.length) {
    const empty = document.createElement('li');
    empty.className = 'small';
    empty.textContent = 'Belum ada pertanyaan.';
    previewFieldsEl.append(empty);
    return;
  }

  state.fields.forEach((field, index) => {
    const item = document.createElement('li');
    let detail = 'Teks';
    if (field.type === 'radio') {
      detail = `Pilihan Tunggal (${(field.options || []).join(', ')})`;
    } else if (field.type === 'checkbox') {
      detail = `Pilihan Ganda (${(field.options || []).join(', ')})`;
    } else if (field.type === 'scale') {
      detail = `Skala 1-5 (${field.fromLabel || '-'} -> ${field.toLabel || '-'})`;
    }
    item.innerHTML = `<strong>${index + 1}. ${field.label}</strong> <span class="small">[${field.name}] ${detail} | ${
      field.criterion ? `Kriteria ${field.criterion} | ` : ''
    }${field.required === false ? 'Opsional' : 'Wajib'
    }</span>`;
    previewFieldsEl.append(item);
  });
}

function createQuestionCard(field, index) {
  const card = document.createElement('article');
  card.className = 'builder-question-card';
  card.dataset.index = String(index);

  const topRow = document.createElement('div');
  topRow.className = 'builder-question-card__top';

  const title = document.createElement('h3');
  title.textContent = `Pertanyaan ${index + 1}`;

  const actions = document.createElement('div');
  actions.className = 'builder-question-card__actions';
  actions.innerHTML = `
    <button type="button" class="ghost" data-action="move-up"${index === 0 ? ' disabled' : ''}>Naik</button>
    <button type="button" class="ghost" data-action="move-down"${index === state.fields.length - 1 ? ' disabled' : ''}>Turun</button>
    <button type="button" class="ghost" data-action="duplicate">Duplikat</button>
    <button type="button" class="secondary" data-action="remove">Hapus</button>
  `;

  topRow.append(title, actions);

  const keyRow = document.createElement('p');
  keyRow.className = 'small builder-question-key';
  keyRow.textContent = `Key: ${field.name} (otomatis)`;

  const requiredField = document.createElement('label');
  requiredField.className = 'builder-required-toggle';
  requiredField.innerHTML = `
    <input data-field="required" type="checkbox"${field.required === false ? '' : ' checked'} />
    <span>Wajib diisi</span>
  `;

  const labelField = document.createElement('label');
  labelField.className = 'field field-block';
  labelField.innerHTML = `
    <span>Label Pertanyaan</span>
    <input data-field="label" value="${field.label.replace(/"/g, '&quot;')}" />
  `;

  const typeField = document.createElement('label');
  typeField.className = 'field';
  typeField.innerHTML = `
    <span>Tipe</span>
    <select data-field="type">
      <option value="text"${field.type === 'text' ? ' selected' : ''}>Teks</option>
      <option value="radio"${field.type === 'radio' ? ' selected' : ''}>Pilihan Tunggal</option>
      <option value="checkbox"${field.type === 'checkbox' ? ' selected' : ''}>Pilihan Ganda (Centang)</option>
      <option value="scale"${field.type === 'scale' ? ' selected' : ''}>Skala 1-5</option>
    </select>
  `;

  const criterionField = document.createElement('label');
  criterionField.className = 'field';
  criterionField.innerHTML = `
    <span>Kriteria (opsional, disarankan)</span>
    <input data-field="criterion" value="${String(field.criterion || '').replace(/"/g, '&quot;')}" placeholder="Contoh: A" />
  `;

  const dynamicWrap = document.createElement('div');
  dynamicWrap.className = 'builder-question-card__dynamic';
  if (field.type === 'radio' || field.type === 'checkbox') {
    dynamicWrap.innerHTML = `
      <label class="field field-block">
        <span>${field.type === 'checkbox' ? 'Opsi Pilihan Ganda (pisahkan koma)' : 'Opsi Pilihan (pisahkan koma)'}</span>
        <input data-field="options" value="${(field.options || []).join(', ').replace(/"/g, '&quot;')}" />
      </label>
    `;
  } else if (field.type === 'scale') {
    dynamicWrap.innerHTML = `
      <label class="field">
        <span>Label Skala Kiri</span>
        <input data-field="fromLabel" value="${String(field.fromLabel || '').replace(/"/g, '&quot;')}" />
      </label>
      <label class="field">
        <span>Label Skala Kanan</span>
        <input data-field="toLabel" value="${String(field.toLabel || '').replace(/"/g, '&quot;')}" />
      </label>
    `;
  }

  card.append(topRow, keyRow, requiredField, labelField, typeField, criterionField, dynamicWrap);
  return card;
}

function renderQuestionList() {
  questionListEl.innerHTML = '';
  if (!state.fields.length) {
    const empty = document.createElement('p');
    empty.className = 'small';
    empty.textContent = 'Belum ada pertanyaan. Tambahkan pertanyaan pertama Anda.';
    questionListEl.append(empty);
    renderPreview();
    syncAdvancedJson();
    return;
  }

  state.fields.forEach((field, index) => {
    questionListEl.append(createQuestionCard(field, index));
  });
  renderPreview();
  syncAdvancedJson();
}

function openStep(stepName) {
  stepButtons.forEach((button) => {
    const active = button.dataset.stepTarget === stepName;
    button.classList.toggle('is-active', active);
  });

  stepPanels.forEach((panel) => {
    const active = panel.dataset.stepPanel === stepName;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

function normalizeDraftPayloadFromState() {
  syncMetaFromInputs();
  if (!state.meta.title || !state.meta.greetingTitle || !state.meta.greetingText) {
    throw new Error('Info kuesioner belum lengkap. Judul dan sapaan wajib diisi.');
  }
  if (!state.fields.length) {
    throw new Error('Minimal harus ada 1 pertanyaan sebelum disimpan.');
  }
  return {
    meta: state.meta,
    fields: state.fields.map((field) => ({ ...field, required: field.required !== false })),
  };
}

function detectBreakingChanges() {
  const before = new Map(state.loadedSnapshot.map((field) => [field.name, field]));
  const after = new Map(state.fields.map((field) => [field.name, field]));

  const removed = [];
  const typeChanged = [];

  before.forEach((field, key) => {
    if (!after.has(key)) {
      removed.push(field.label || key);
      return;
    }
    const next = after.get(key);
    if (next.type !== field.type) {
      typeChanged.push(`${field.label || key} (${field.type} -> ${next.type})`);
    }
  });

  return { removed, typeChanged };
}

async function loadDraft() {
  const payload = await api(`${baseApiPath()}/draft`, undefined, 'Load draft questionnaire');
  const data = payload?.data || {};
  const draft = data.draft || {};
  const questionnaire = data.questionnaire || {};

  state.questionnaireId = questionnaire.id || '';
  state.questionnaireName = questionnaire.name || state.questionnaireSlug;
  state.meta = {
    title: String(draft.meta?.title || '').trim(),
    greetingTitle: String(draft.meta?.greetingTitle || '').trim(),
    greetingText: String(draft.meta?.greetingText || '').trim(),
  };
  state.fields = Array.isArray(draft.fields)
    ? draft.fields.map((field) => normalizeField(field, state.fields))
    : [];
  state.loadedSnapshot = state.fields.map(cloneField);
  syncMetaToInputs();
  renderQuestionList();

  subtitleEl.textContent = `Organisasi: ${state.tenantSlug} | Kuesioner: ${state.questionnaireName} (${state.questionnaireSlug})`;
  pushActivity('success', 'Load draft', `${state.questionnaireName} v${draft.version || '-'}`);
}

async function refreshResponseFlag() {
  const payload = await api(
    `${baseApiPath()}/analytics/summary`,
    undefined,
    'Load ringkasan untuk validasi breaking change'
  );
  const totalResponses = Number(payload?.data?.totalResponses || 0);
  state.hasResponses = totalResponses > 0;
}

async function saveDraft(options = {}) {
  const { silentStatus = false, silentActivity = false } = options;
  const body = normalizeDraftPayloadFromState();
  await api(
    `${baseApiPath()}/draft`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'Save draft questionnaire'
  );
  state.loadedSnapshot = state.fields.map(cloneField);
  if (!silentActivity) {
    pushActivity('success', 'Save draft', `${state.questionnaireSlug} tersimpan`);
  }
  if (!silentStatus) {
    setStatus('Draf berhasil disimpan.', 'success');
  }
}

async function publishDraft() {
  if (state.isPublishing) return;
  hidePublishResult();
  await refreshResponseFlag().catch(() => {
    state.hasResponses = false;
  });

  const breaking = detectBreakingChanges();
  const { removed, typeChanged } = breaking;
  if (state.hasResponses && (removed.length || typeChanged.length)) {
    const warnings = [];
    if (removed.length) warnings.push(`Pertanyaan dihapus: ${removed.join(', ')}`);
    if (typeChanged.length) warnings.push(`Tipe diubah: ${typeChanged.join(', ')}`);

    publishWarningEl.hidden = false;
    publishWarningEl.innerHTML = `
      <strong>Peringatan perubahan breaking</strong>
      <p>Kuesioner ini sudah memiliki respons. Publish akan membuat versi baru. Pastikan perubahan ini memang final.</p>
      <ul>${warnings.map((item) => `<li>${item}</li>`).join('')}</ul>
    `;

    const confirmed = window.confirm(
      'Kuesioner sudah memiliki respons. Perubahan breaking terdeteksi dan akan dipublish sebagai versi baru. Lanjutkan?'
    );
    if (!confirmed) {
      setStatus('Publish dibatalkan.', 'warning');
      pushActivity('warning', 'Publish dibatalkan', 'User membatalkan setelah warning breaking change');
      return;
    }
  } else {
    publishWarningEl.hidden = true;
    publishWarningEl.innerHTML = '';
  }

  setPublishProcessing(true);
  setStatus('Sedang menyimpan perubahan dan mempublikasikan. Mohon tunggu...', 'warning');
  pushActivity('warning', 'Publish questionnaire', 'Sedang memproses publish...');
  try {
    await saveDraft({
      silentStatus: true,
      silentActivity: true,
    });

    const payload = await api(
      `${baseApiPath()}/publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
      'Publish questionnaire'
    );
    const published = payload?.data?.published || {};
    const versionInfo = published?.version ? `v${published.version}` : state.questionnaireSlug;
    pushActivity('success', 'Publish questionnaire', `${state.questionnaireSlug} (${versionInfo})`);
    setStatus(
      'Publikasi berhasil. Gunakan tombol "Buka Form Publik" atau "Buka Dashboard" untuk lanjut.',
      'success'
    );
    showPublishResult(published);
    await loadDraft();
  } finally {
    setPublishProcessing(false);
  }
}

function applyJsonAdvanced() {
  const parsed = JSON.parse(advancedJsonEl.value || '{}');
  const incomingMeta = parsed?.meta || {};
  const incomingFields = Array.isArray(parsed?.fields) ? parsed.fields : [];

  const normalizedFields = [];
  incomingFields.forEach((field) => {
    normalizedFields.push(normalizeField(field, normalizedFields, null));
  });

  state.meta = {
    title: String(incomingMeta.title || '').trim(),
    greetingTitle: String(incomingMeta.greetingTitle || '').trim(),
    greetingText: String(incomingMeta.greetingText || '').trim(),
  };
  state.fields = normalizedFields;
  syncMetaToInputs();
  renderQuestionList();
  pushActivity('success', 'Apply JSON lanjutan', 'Perubahan dari JSON berhasil diterapkan ke builder visual');
  setStatus('Mode lanjutan berhasil diterapkan.', 'success');
}

function handleQuestionListInteraction(event) {
  const card = event.target.closest('.builder-question-card');
  if (!card) return;
  const index = Number(card.dataset.index);
  if (!Number.isFinite(index)) return;
  const field = state.fields[index];
  if (!field) return;

  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === 'move-up' && index > 0) {
      const [item] = state.fields.splice(index, 1);
      state.fields.splice(index - 1, 0, item);
      renderQuestionList();
      return;
    }
    if (action === 'move-down' && index < state.fields.length - 1) {
      const [item] = state.fields.splice(index, 1);
      state.fields.splice(index + 1, 0, item);
      renderQuestionList();
      return;
    }
    if (action === 'duplicate') {
      const duplicate = cloneField(field);
      duplicate.name = ensureUniqueFieldKey(`${field.name}_copy`, state.fields);
      state.fields.splice(index + 1, 0, duplicate);
      renderQuestionList();
      return;
    }
    if (action === 'remove') {
      const confirmed = window.confirm(`Hapus pertanyaan "${field.label}"?`);
      if (!confirmed) return;
      state.fields.splice(index, 1);
      renderQuestionList();
      return;
    }
  }

  if (event.type === 'click') return;

  const fieldInput = event.target.closest('[data-field]');
  if (!fieldInput) return;
  const key = fieldInput.dataset.field;
  const value = fieldInput.value;

  if (key === 'label') {
    state.fields[index].label = value;
  } else if (key === 'required') {
    state.fields[index].required = Boolean(fieldInput.checked);
  } else if (key === 'criterion') {
    state.fields[index].criterion = String(value || '').trim();
  } else if (key === 'type') {
    state.fields[index].type = value;
    if (value === 'radio' || value === 'checkbox') {
      state.fields[index].options = Array.isArray(state.fields[index].options) ? state.fields[index].options : ['Ya', 'Tidak'];
      delete state.fields[index].fromLabel;
      delete state.fields[index].toLabel;
    } else if (value === 'scale') {
      state.fields[index].fromLabel = state.fields[index].fromLabel || 'Tidak Setuju';
      state.fields[index].toLabel = state.fields[index].toLabel || 'Sangat Setuju';
      delete state.fields[index].options;
    } else {
      delete state.fields[index].options;
      delete state.fields[index].fromLabel;
      delete state.fields[index].toLabel;
    }
    renderQuestionList();
    return;
  } else if (key === 'options') {
    state.fields[index].options = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (key === 'fromLabel') {
    state.fields[index].fromLabel = value;
  } else if (key === 'toLabel') {
    state.fields[index].toLabel = value;
  }

  renderPreview();
  syncAdvancedJson();
}

function addQuestionFromComposer() {
  const label = String(newQuestionLabelEl.value || '').trim();
  if (!label) {
    throw new Error('Label pertanyaan baru wajib diisi.');
  }

  const type = String(newQuestionTypeEl.value || 'text').trim();
  const candidate = {
    type,
    label,
    name: slugToKey(label),
    criterion: String(newQuestionCriterionEl?.value || '').trim(),
    required: Boolean(newQuestionRequiredEl?.checked ?? true),
  };

  if (type === 'radio' || type === 'checkbox') {
    candidate.options = String(newQuestionOptionsEl.value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (type === 'scale') {
    candidate.fromLabel = String(newQuestionFromEl.value || '').trim() || 'Tidak Setuju';
    candidate.toLabel = String(newQuestionToEl.value || '').trim() || 'Sangat Setuju';
  }

  const normalized = normalizeField(candidate, state.fields);
  state.fields.push(normalized);
  renderQuestionList();

  newQuestionLabelEl.value = '';
  if (newQuestionCriterionEl) newQuestionCriterionEl.value = '';
  newQuestionOptionsEl.value = '';
  newQuestionFromEl.value = '';
  newQuestionToEl.value = '';
  newQuestionTypeEl.value = 'text';
  if (newQuestionRequiredEl) newQuestionRequiredEl.checked = true;
  setAddQuestionTypeVisibility();
  pushActivity('success', 'Tambah pertanyaan', normalized.label);
}

function bindEvents() {
  stepButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openStep(button.dataset.stepTarget);
    });
  });

  metaTitleEl.addEventListener('input', () => {
    syncMetaFromInputs();
    renderPreview();
    syncAdvancedJson();
  });
  metaGreetingTitleEl.addEventListener('input', () => {
    syncMetaFromInputs();
    renderPreview();
    syncAdvancedJson();
  });
  metaGreetingTextEl.addEventListener('input', () => {
    syncMetaFromInputs();
    renderPreview();
    syncAdvancedJson();
  });

  newQuestionTypeEl.addEventListener('change', setAddQuestionTypeVisibility);
  addQuestionBtn.addEventListener('click', () => {
    try {
      addQuestionFromComposer();
      setStatus('Pertanyaan baru ditambahkan.', 'success');
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal menambah pertanyaan.');
      if (
        String(normalized.message || '')
          .toLowerCase()
          .includes('minimal 2 opsi')
      ) {
        newQuestionOptionsEl.focus();
      }
      setStatus(normalized.message, 'error');
      setError(error);
      pushActivity('error', 'Tambah pertanyaan', normalized.message);
    }
  });

  questionListEl.addEventListener('click', handleQuestionListInteraction);
  questionListEl.addEventListener('input', handleQuestionListInteraction);
  questionListEl.addEventListener('change', handleQuestionListInteraction);

  reloadDraftBtn.addEventListener('click', async () => {
    if (state.isPublishing) return;
    await runWithButtonLoading(reloadDraftBtn, 'Memuat...', async () => {
      await loadDraft();
      setStatus('Draf dimuat ulang.', 'success');
    });
  });
  saveDraftBtn.addEventListener('click', async () => {
    if (state.isPublishing) return;
    await runWithButtonLoading(saveDraftBtn, 'Menyimpan...', async () => {
      await saveDraft();
    });
  });
  publishBtn.addEventListener('click', async () => {
    await publishDraft();
  });

  document.getElementById('sync-advanced-btn').addEventListener('click', () => {
    syncAdvancedJson();
    setStatus('JSON lanjutan disinkronkan dari builder visual.', 'success');
  });
  document.getElementById('apply-advanced-btn').addEventListener('click', () => {
    applyJsonAdvanced();
  });
}

async function init() {
  const route = parseRouteContext();
  state.tenantSlug = route.tenantSlug;
  state.questionnaireSlug = route.questionnaireSlug;

  backPanelLink.href = `/forms/${state.tenantSlug}/admin/`;
  openDashboardLink.href =
    state.tenantSlug === LEGACY_SCHOOL_SLUG
      ? `/forms/${state.tenantSlug}/admin/dashboard/`
      : `/forms/${state.tenantSlug}/admin/questionnaires/${state.questionnaireSlug}/dashboard/`;

  bindEvents();
  setAddQuestionTypeVisibility();

  setStatus('Memuat data builder...');
  await loadDraft();
  await refreshResponseFlag().catch(() => {
    state.hasResponses = false;
  });
  setStatus('Builder siap dipakai.', 'success');
}

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error');
  setError(originalError);
  pushActivity('error', 'Runtime error', normalized.message);
});

init().catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat builder.');
  setStatus(normalized.message, 'error');
  setError(error);
  pushActivity('error', 'Init builder', normalized.message);
});
