import {
  bindRuntimeErrorHandlers,
  createActivityFeed,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';

const titleEl = document.getElementById('school-title');
const userInfoEl = document.getElementById('user-info');
const statusEl = document.getElementById('status');
const errorDebugEl = document.getElementById('error-debug');
const activityFeedEl = document.getElementById('activity-feed');

const questionnaireNameEl = document.getElementById('questionnaire-name');
const questionnaireSlugEl = document.getElementById('questionnaire-slug');
const questionnaireCategoryEl = document.getElementById('questionnaire-category');
const questionnaireListBodyEl = document.getElementById('questionnaire-list-body');
const questionnaireEmptyEl = document.getElementById('questionnaire-empty');
const legacySections = Array.from(document.querySelectorAll('[data-legacy-only]'));

const tenantPromptModeEl = document.getElementById('tenant-prompt-mode');
const tenantPromptScopeEl = document.getElementById('tenant-prompt-scope');
const tenantPromptQuestionnaireEl = document.getElementById('tenant-prompt-questionnaire');
const tenantPromptTemplateEl = document.getElementById('tenant-prompt-template');
const tenantPromptNoteEl = document.getElementById('tenant-prompt-note');
const tenantPromptEffectiveEl = document.getElementById('tenant-prompt-effective');

const activityFeed = createActivityFeed(activityFeedEl);

const state = {
  tenantSlug: '',
  questionnaireItems: [],
  legacyCompatEnabled: false,
};
const LEGACY_SCHOOL_SLUG = 'sman6-kotakupang';

function parseTenantSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] || '';
}

function basePath() {
  return `/forms/${encodeURIComponent(state.tenantSlug)}/admin/api`;
}

function setStatus(message, kind = 'info') {
  setInlineStatus(statusEl, message, kind);
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

function questionnaireBuilderLink(questionnaireSlug) {
  return `/forms/${state.tenantSlug}/admin/questionnaires/${questionnaireSlug}/builder/`;
}

function questionnaireDashboardLink(questionnaireSlug) {
  if (state.tenantSlug === LEGACY_SCHOOL_SLUG) {
    return `/forms/${state.tenantSlug}/admin/dashboard/`;
  }
  return `/forms/${state.tenantSlug}/admin/questionnaires/${questionnaireSlug}/dashboard/`;
}

function questionnairePublicLink(questionnaireSlug) {
  if (state.tenantSlug === LEGACY_SCHOOL_SLUG) {
    return `/forms/${state.tenantSlug}/`;
  }
  return `/forms/${state.tenantSlug}/${questionnaireSlug}/`;
}

function renderQuestionnairePromptOptions() {
  tenantPromptQuestionnaireEl.innerHTML = '';
  if (!state.questionnaireItems.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Belum ada kuesioner';
    tenantPromptQuestionnaireEl.append(option);
    return;
  }

  state.questionnaireItems.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} (${item.slug})${item.isDefault ? ' [default]' : ''}`;
    tenantPromptQuestionnaireEl.append(option);
  });
}

function renderQuestionnaireList() {
  questionnaireListBodyEl.innerHTML = '';
  if (!state.questionnaireItems.length) {
    questionnaireEmptyEl.style.display = 'block';
    return;
  }

  questionnaireEmptyEl.style.display = 'none';
  state.questionnaireItems.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}${item.isDefault ? ' <span class="small">[default]</span>' : ''}</td>
      <td><code>${item.slug}</code></td>
      <td>${item.category}</td>
      <td>${item.isActive ? 'Aktif' : 'Nonaktif'}</td>
      <td>${Number(item.totalResponses || 0).toLocaleString('id-ID')}</td>
      <td>
        <div class="row" style="gap:8px">
          <a class="ghost" style="padding:8px 10px;border-radius:9px;text-decoration:none" href="${questionnaireBuilderLink(item.slug)}">Builder Visual</a>
          <a class="ghost" style="padding:8px 10px;border-radius:9px;text-decoration:none" href="${questionnaireDashboardLink(item.slug)}">Dashboard</a>
          <a class="ghost" style="padding:8px 10px;border-radius:9px;text-decoration:none" href="${questionnairePublicLink(item.slug)}" target="_blank" rel="noopener">Form Publik</a>
          <button class="ghost" type="button" data-action="prompt" data-id="${item.id}" style="padding:8px 10px;border-radius:9px">Kelola Prompt</button>
        </div>
      </td>
    `;
    questionnaireListBodyEl.append(row);
  });
}

function updatePromptScopeUi() {
  const scope = String(tenantPromptScopeEl.value || 'tenant').trim().toLowerCase();
  tenantPromptQuestionnaireEl.disabled = scope !== 'questionnaire';
}

function getPromptSelection() {
  const scope = String(tenantPromptScopeEl.value || 'tenant').trim().toLowerCase();
  return {
    mode: String(tenantPromptModeEl.value || 'internal').trim(),
    scope,
    questionnaireId: scope === 'questionnaire' ? String(tenantPromptQuestionnaireEl.value || '').trim() : '',
  };
}

function resolvePromptDraftTemplate(bundle, selection) {
  if (!bundle) return '';
  if (selection.scope === 'questionnaire') {
    return (
      bundle.questionnaireDraft?.template ||
      bundle.questionnairePublished?.template ||
      bundle.tenantDraft?.template ||
      bundle.tenantPublished?.template ||
      bundle.globalDraft?.template ||
      bundle.globalPublished?.template ||
      bundle.effective?.template ||
      ''
    );
  }
  return (
    bundle.tenantDraft?.template ||
    bundle.tenantPublished?.template ||
    bundle.globalDraft?.template ||
    bundle.globalPublished?.template ||
    bundle.effective?.template ||
    ''
  );
}

function renderPromptEffective(bundle) {
  if (!bundle?.effective?.template) {
    tenantPromptEffectiveEl.textContent = 'Belum ada prompt efektif.';
    return;
  }
  const source = bundle.effective.source || 'fallback';
  tenantPromptEffectiveEl.textContent = `Sumber: ${source}\n\n${bundle.effective.template}`;
}

async function loadPromptBundle() {
  const selection = getPromptSelection();
  if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
    tenantPromptTemplateEl.value = '';
    tenantPromptEffectiveEl.textContent = 'Pilih kuesioner untuk scope questionnaire.';
    setStatus('Pilih kuesioner dulu untuk load prompt.', 'warning');
    return;
  }

  const params = new URLSearchParams();
  params.set('mode', selection.mode);
  params.set('scope', selection.scope);
  if (selection.questionnaireId) params.set('questionnaireId', selection.questionnaireId);

  const payload = await api(`${basePath()}/ai-prompts?${params.toString()}`, undefined, 'Load prompt tenant');
  tenantPromptTemplateEl.value = resolvePromptDraftTemplate(payload.data, selection);
  renderPromptEffective(payload.data);
  pushActivity('success', 'Load prompt', `${selection.mode} / ${selection.scope}`);
}

async function savePromptDraft() {
  const selection = getPromptSelection();
  if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
    throw new Error('Pilih kuesioner untuk scope questionnaire.');
  }
  const template = String(tenantPromptTemplateEl.value || '').trim();
  if (!template) throw new Error('Template prompt tidak boleh kosong.');

  await api(
    `${basePath()}/ai-prompts/draft`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: selection.mode,
        scope: selection.scope,
        questionnaireId: selection.questionnaireId || undefined,
        template,
        changeNote: String(tenantPromptNoteEl.value || '').trim(),
      }),
    },
    'Save prompt draft tenant'
  );
  setStatus('Draft prompt berhasil disimpan.', 'success');
  pushActivity('success', 'Save prompt draft', `${selection.mode} / ${selection.scope}`);
  await loadPromptBundle();
}

async function publishPrompt() {
  const selection = getPromptSelection();
  if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
    throw new Error('Pilih kuesioner untuk scope questionnaire.');
  }
  await api(
    `${basePath()}/ai-prompts/publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: selection.mode,
        scope: selection.scope,
        questionnaireId: selection.questionnaireId || undefined,
        changeNote: String(tenantPromptNoteEl.value || '').trim(),
      }),
    },
    'Publish prompt tenant'
  );
  setStatus('Prompt berhasil dipublish.', 'success');
  pushActivity('success', 'Publish prompt', `${selection.mode} / ${selection.scope}`);
  await loadPromptBundle();
}

async function loadQuestionnaires() {
  const payload = await api(`${basePath()}/questionnaires`, undefined, 'Load daftar questionnaire');
  state.questionnaireItems = Array.isArray(payload.data) ? payload.data : [];
  renderQuestionnaireList();
  renderQuestionnairePromptOptions();
}

async function createQuestionnaire() {
  const name = String(questionnaireNameEl.value || '').trim();
  const slug = String(questionnaireSlugEl.value || '').trim();
  const category = String(questionnaireCategoryEl.value || '').trim() || 'general_feedback';
  if (!name || !slug) {
    throw new Error('Nama dan slug kuesioner wajib diisi.');
  }

  await api(
    `${basePath()}/questionnaires`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        slug,
        category,
      }),
    },
    'Create questionnaire'
  );

  questionnaireNameEl.value = '';
  questionnaireSlugEl.value = '';
  questionnaireCategoryEl.value = '';
  setStatus('Questionnaire berhasil dibuat.', 'success');
  pushActivity('success', 'Create questionnaire', `${name} (${slug})`);
  await loadQuestionnaires();
}

async function detectLegacyCompat() {
  try {
    const response = await requestJson(`/forms/${encodeURIComponent(state.tenantSlug)}/api/form-schema`);
    state.legacyCompatEnabled = Boolean(response?.meta && response?.fields);
  } catch {
    state.legacyCompatEnabled = false;
  }

  legacySections.forEach((section) => {
    section.style.display = state.legacyCompatEnabled ? '' : 'none';
  });

  const legacyDashboardLink = document.getElementById('legacy-dashboard-link');
  if (legacyDashboardLink) {
    legacyDashboardLink.href = `/forms/${state.tenantSlug}/admin/dashboard/`;
  }
}

async function loadMe() {
  const payload = await api('/forms/admin/api/me', undefined, 'Validasi sesi admin');
  userInfoEl.textContent = `Login sebagai ${payload.user.email}`;
}

function bindEvents() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await requestJson('/forms/admin/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/forms/admin/login';
  });

  document.getElementById('create-questionnaire-btn').addEventListener('click', async () => {
    try {
      await createQuestionnaire();
      await loadPromptBundle();
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal membuat kuesioner.');
      setStatus(normalized.message, 'error');
      setError(error);
    }
  });

  document.getElementById('refresh-questionnaires-btn').addEventListener('click', async () => {
    await loadQuestionnaires();
    setStatus('Daftar kuesioner dimuat ulang.', 'success');
  });

  questionnaireListBodyEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="prompt"]');
    if (!button) return;
    const questionnaireId = String(button.dataset.id || '').trim();
    if (!questionnaireId) return;
    tenantPromptScopeEl.value = 'questionnaire';
    updatePromptScopeUi();
    tenantPromptQuestionnaireEl.value = questionnaireId;
    document.getElementById('prompt-manager-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await loadPromptBundle();
  });

  tenantPromptModeEl.addEventListener('change', () => loadPromptBundle());
  tenantPromptScopeEl.addEventListener('change', () => {
    updatePromptScopeUi();
    loadPromptBundle();
  });
  tenantPromptQuestionnaireEl.addEventListener('change', () => loadPromptBundle());

  document.getElementById('tenant-prompt-load-btn').addEventListener('click', async () => {
    await loadPromptBundle();
    setStatus('Prompt berhasil dimuat.', 'success');
  });

  document.getElementById('tenant-prompt-save-btn').addEventListener('click', async () => {
    try {
      await savePromptDraft();
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal menyimpan prompt.');
      setStatus(normalized.message, 'error');
      setError(error);
    }
  });

  document.getElementById('tenant-prompt-publish-btn').addEventListener('click', async () => {
    try {
      await publishPrompt();
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal publish prompt.');
      setStatus(normalized.message, 'error');
      setError(error);
    }
  });
}

async function init() {
  state.tenantSlug = parseTenantSlug();
  if (!state.tenantSlug) {
    throw new Error('Tenant slug tidak ditemukan.');
  }

  titleEl.textContent = `Panel Admin Organisasi - ${state.tenantSlug}`;

  bindEvents();
  updatePromptScopeUi();

  setStatus('Memuat panel organisasi...');
  await loadMe();
  await detectLegacyCompat();
  await loadQuestionnaires();
  await loadPromptBundle();
  setStatus('Panel organisasi siap dipakai.', 'success');
}

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error');
  setError(originalError);
  pushActivity('error', 'Runtime error', normalized.message);
});

init().catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat panel organisasi.');
  setStatus(normalized.message, 'error');
  setError(error);
  pushActivity('error', 'Init panel organisasi', normalized.message);
});
