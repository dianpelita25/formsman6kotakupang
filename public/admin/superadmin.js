import {
  bindRuntimeErrorHandlers,
  createActivityFeed,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';

const userInfoEl = document.getElementById('user-info');
const statusEl = document.getElementById('status');
const errorDebugEl = document.getElementById('error-debug');
const tenantsBody = document.getElementById('tenants-body');
const tenantSelectEl = document.getElementById('tenant-select');
const activityFeedEl = document.getElementById('activity-feed');

const promptPanel = document.getElementById('prompt-manager-panel');
const promptModeEl = document.getElementById('prompt-mode');
const promptScopeEl = document.getElementById('prompt-scope');
const promptTenantWrapEl = document.getElementById('prompt-tenant-wrap');
const promptTenantSelectEl = document.getElementById('prompt-tenant-select');
const promptQuestionnaireWrapEl = document.getElementById('prompt-questionnaire-wrap');
const promptQuestionnaireSelectEl = document.getElementById('prompt-questionnaire-select');
const promptTemplateEl = document.getElementById('prompt-template');
const promptChangeNoteEl = document.getElementById('prompt-change-note');
const promptEffectiveMetaEl = document.getElementById('prompt-effective-meta');
const promptEffectiveEl = document.getElementById('prompt-effective');
const promptHistoryBody = document.getElementById('prompt-history-body');
const promptDraftMetaEl = document.getElementById('prompt-draft-meta');
const promptStatusEl = document.getElementById('prompt-status');
const toggleModalEl = document.getElementById('tenant-toggle-modal');
const toggleModalTitleEl = document.getElementById('tenant-toggle-title');
const toggleModalMessageEl = document.getElementById('tenant-toggle-message');
const toggleModalCancelBtn = document.getElementById('tenant-toggle-cancel');
const toggleModalConfirmBtn = document.getElementById('tenant-toggle-confirm');

const MODE_LABELS = Object.freeze({
  internal: 'Internal',
  external_pemerintah: 'External Pemerintah',
  external_mitra: 'External Mitra',
  live_guru: 'Live Guru',
});

const activityFeed = createActivityFeed(activityFeedEl);

let tenantCache = [];
let questionnaireCache = [];
let promptBundleCache = null;
let activeActionMenu = null;
let activeActionTrigger = null;
let pendingToggleAction = null;
let modalLastFocusedElement = null;
const LEGACY_SCHOOL_SLUG = 'sman6-kotakupang';

function tenantTypeLabel(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'school') return 'School';
  if (normalized === 'business') return 'Business';
  if (normalized === 'government') return 'Government';
  if (normalized === 'class') return 'Class';
  if (normalized === 'community') return 'Community';
  if (normalized === 'event') return 'Event';
  return 'Other';
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTenantById(tenantId) {
  return tenantCache.find((tenant) => tenant.id === tenantId) || null;
}

function getTenantDefaultQuestionnaireSlug(tenant) {
  return String(tenant?.default_questionnaire_slug || tenant?.defaultQuestionnaireSlug || '').trim();
}

function setStatus(message, kind = 'info', error = null) {
  setInlineStatus(statusEl, message, kind);
  if (error) {
    setErrorDebugPanel(errorDebugEl, error);
  } else if (errorDebugEl) {
    errorDebugEl.textContent = 'Belum ada error.';
  }
}

function setPromptStatus(message, kind = 'info') {
  setInlineStatus(promptStatusEl, message, kind);
}

function pushActivity(level, action, detail) {
  activityFeed.push(level, action, detail);
}

async function api(path, options, actionLabel) {
  try {
    return await requestJson(path, options);
  } catch (error) {
    const normalized = normalizeUiError(error);
    setStatus(normalized.message, 'error', error);
    pushActivity('error', actionLabel || 'Request gagal', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
    throw error;
  }
}

function createPromptChip(label, value) {
  const chip = document.createElement('span');
  chip.className = 'prompt-chip';

  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;

  const text = document.createElement('span');
  text.textContent = value;

  chip.append(strong, text);
  return chip;
}

function mapTenantOptions(items) {
  tenantSelectEl.innerHTML = '';
  promptTenantSelectEl.innerHTML = '';

  if (!items.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Belum ada organisasi';
    tenantSelectEl.append(option.cloneNode(true));
    promptTenantSelectEl.append(option);
    return;
  }

  items.forEach((tenant) => {
    const label = `${tenant.name} (${tenant.slug})`;

    const adminOption = document.createElement('option');
    adminOption.value = tenant.id;
    adminOption.textContent = label;
    tenantSelectEl.append(adminOption);

    const promptOption = document.createElement('option');
    promptOption.value = tenant.id;
    promptOption.textContent = label;
    promptTenantSelectEl.append(promptOption);
  });
}

function mapQuestionnaireOptions(questionnaires) {
  promptQuestionnaireSelectEl.innerHTML = '';
  questionnaireCache = questionnaires || [];

  if (!questionnaireCache.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Belum ada questionnaire';
    promptQuestionnaireSelectEl.append(option);
    return;
  }

  questionnaireCache.forEach((questionnaire) => {
    const option = document.createElement('option');
    option.value = questionnaire.id;
    option.textContent = `${questionnaire.name} (${questionnaire.slug})`;
    promptQuestionnaireSelectEl.append(option);
  });
}

async function loadQuestionnairesForSelectedTenant() {
  const tenantId = String(promptTenantSelectEl.value || '');
  const tenant = getTenantById(tenantId);
  if (!tenant?.slug) {
    mapQuestionnaireOptions([]);
    return;
  }

  try {
    const payload = await api(`/forms/${tenant.slug}/admin/api/questionnaires`, undefined, 'Load questionnaire tenant');
    mapQuestionnaireOptions(payload.data || []);
  } catch {
    mapQuestionnaireOptions([]);
  }
}

function createActionLink(label, href, className = 'action-link') {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

function closeAllTenantActionMenus({ restoreFocus = false } = {}) {
  const trigger = activeActionTrigger;
  if (activeActionTrigger) {
    activeActionTrigger.setAttribute('aria-expanded', 'false');
  }
  if (activeActionMenu) {
    activeActionMenu.hidden = true;
    activeActionMenu.innerHTML = '';
  }
  activeActionTrigger = null;
  if (restoreFocus && trigger && typeof trigger.focus === 'function') {
    trigger.focus();
  }
}

function setButtonLoading(button, loading, loadingLabel = 'Memproses...') {
  if (!button) return;
  if (loading) {
    button.dataset.labelOriginal = button.textContent || '';
    button.textContent = loadingLabel;
    button.disabled = true;
    button.classList.add('is-loading');
    return;
  }
  const original = button.dataset.labelOriginal;
  if (original) {
    button.textContent = original;
  }
  button.disabled = false;
  button.classList.remove('is-loading');
}

function setToggleModalLoading(loading) {
  setButtonLoading(toggleModalConfirmBtn, loading);
  if (toggleModalCancelBtn) {
    toggleModalCancelBtn.disabled = loading;
  }
}

function openToggleModal(tenant, next, returnFocusElement = null) {
  if (!toggleModalEl || !toggleModalTitleEl || !toggleModalMessageEl || !toggleModalConfirmBtn) return;
  pendingToggleAction = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    next,
  };
  modalLastFocusedElement = returnFocusElement || activeActionTrigger || null;
  toggleModalTitleEl.textContent = next ? 'Aktifkan Organisasi?' : 'Nonaktifkan Organisasi?';
  toggleModalMessageEl.textContent = next
    ? `Anda akan mengaktifkan organisasi "${tenant.name}". Lanjutkan?`
    : `Anda akan menonaktifkan organisasi "${tenant.name}". Lanjutkan?`;
  toggleModalConfirmBtn.textContent = next ? 'Lanjutkan Aktifkan' : 'Lanjutkan Nonaktifkan';
  toggleModalConfirmBtn.dataset.labelOriginal = toggleModalConfirmBtn.textContent;
  toggleModalEl.hidden = false;
  document.body.classList.add('modal-open');
  setToggleModalLoading(false);
  toggleModalConfirmBtn.focus();
}

function closeToggleModal() {
  if (!toggleModalEl || toggleModalEl.hidden) return;
  toggleModalEl.hidden = true;
  pendingToggleAction = null;
  setToggleModalLoading(false);
  document.body.classList.remove('modal-open');
  const target = modalLastFocusedElement || activeActionTrigger;
  if (target && typeof target.focus === 'function') {
    target.focus();
  }
  modalLastFocusedElement = null;
}

function ensureFloatingActionMenu() {
  let menu = document.getElementById('tenant-action-menu-floating');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'tenant-action-menu-floating';
    menu.className = 'action-menu action-menu--floating';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    const floatingHost = document.querySelector('.superadmin-page') || document.body;
    floatingHost.append(menu);
  }
  return menu;
}

function buildFloatingMenuItems(menu, tenant) {
  menu.innerHTML = '';
  const defaultQuestionnaireSlug = getTenantDefaultQuestionnaireSlug(tenant);
  let publicEntry;
  if (defaultQuestionnaireSlug) {
    publicEntry = createActionLink(
      'Form Publik',
      buildPublicQuestionnaireLink(tenant),
      'action-menu-item action-menu-item--link'
    );
    publicEntry.setAttribute('role', 'menuitem');
  } else {
    const disabledButton = document.createElement('button');
    disabledButton.type = 'button';
    disabledButton.className = 'action-menu-item is-disabled';
    disabledButton.disabled = true;
    disabledButton.title = 'Belum ada questionnaire default.';
    disabledButton.setAttribute('aria-disabled', 'true');
    disabledButton.textContent = 'Form Publik';
    publicEntry = disabledButton;
  }

  const dashboardLink = createActionLink('Dashboard', buildTenantDashboardLink(tenant), 'action-menu-item action-menu-item--link');
  dashboardLink.setAttribute('role', 'menuitem');

  const promptButton = document.createElement('button');
  promptButton.type = 'button';
  promptButton.className = 'action-menu-item';
  promptButton.dataset.action = 'prompt-override';
  promptButton.dataset.id = tenant.id;
  promptButton.setAttribute('role', 'menuitem');
  promptButton.textContent = 'Kelola Prompt';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'action-menu-item is-danger';
  toggleButton.dataset.action = 'toggle';
  toggleButton.dataset.id = tenant.id;
  toggleButton.dataset.next = String(!tenant.is_active);
  toggleButton.setAttribute('role', 'menuitem');
  toggleButton.textContent = tenant.is_active ? 'Nonaktifkan Organisasi' : 'Aktifkan Organisasi';

  const divider = document.createElement('div');
  divider.className = 'action-menu-divider';

  menu.append(publicEntry, dashboardLink, promptButton, divider, toggleButton);
}

function toggleTenantActionMenu(triggerButton, tenant) {
  if (!triggerButton || !tenant) return;
  const isSameTrigger = activeActionTrigger === triggerButton;
  if (isSameTrigger && activeActionMenu && !activeActionMenu.hidden) {
    closeAllTenantActionMenus();
    return;
  }

  closeAllTenantActionMenus();

  const menu = ensureFloatingActionMenu();
  buildFloatingMenuItems(menu, tenant);
  menu.hidden = false;
  menu.style.visibility = 'hidden';

  const triggerRect = triggerButton.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  let top = triggerRect.bottom + 6;
  if (viewportHeight - triggerRect.bottom < menuRect.height + 8) {
    top = triggerRect.top - menuRect.height - 6;
  }
  top = Math.max(8, Math.min(top, viewportHeight - menuRect.height - 8));

  let left = triggerRect.right - menuRect.width;
  left = Math.max(8, Math.min(left, viewportWidth - menuRect.width - 8));

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.visibility = 'visible';

  activeActionMenu = menu;
  activeActionTrigger = triggerButton;
  activeActionTrigger.setAttribute('aria-expanded', 'true');
}

function createTruncateCell(className, value) {
  const cell = document.createElement('td');
  if (className) {
    cell.className = className;
  }

  const span = document.createElement('span');
  span.className = 'cell-truncate';
  span.textContent = value || '-';
  span.title = value || '-';
  cell.append(span);
  return cell;
}

function buildPublicQuestionnaireLink(tenant) {
  if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
    return `/forms/${tenant.slug}/`;
  }
  const preferredSlug = getTenantDefaultQuestionnaireSlug(tenant);
  if (!preferredSlug) {
    return `/forms/${tenant.slug}/`;
  }
  return `/forms/${tenant.slug}/${preferredSlug}/`;
}

function buildTenantDashboardLink(tenant) {
  if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
    return `/forms/${tenant.slug}/admin/dashboard/`;
  }
  const preferredSlug = getTenantDefaultQuestionnaireSlug(tenant);
  if (!preferredSlug) {
    return `/forms/${tenant.slug}/admin/`;
  }
  return `/forms/${tenant.slug}/admin/questionnaires/${preferredSlug}/dashboard/`;
}

function createTenantActionsCell(tenant) {
  const cell = document.createElement('td');
  cell.className = 'school-actions-cell';

  const actionWrap = document.createElement('div');
  actionWrap.className = 'tenant-actions-inline';

  const actionRow = document.createElement('div');
  actionRow.className = 'tenant-actions-row';

  const panelLink = createActionLink(
    'Panel Organisasi',
    `/forms/${tenant.slug}/admin/`,
    'action-link action-link--primary'
  );

  const menuTrigger = document.createElement('button');
  menuTrigger.type = 'button';
  menuTrigger.className = 'action-menu-trigger ghost';
  menuTrigger.dataset.action = 'toggle-menu';
  menuTrigger.dataset.id = tenant.id;
  menuTrigger.setAttribute('aria-label', `Aksi organisasi ${tenant.name}`);
  menuTrigger.setAttribute('aria-haspopup', 'menu');
  menuTrigger.setAttribute('aria-expanded', 'false');
  menuTrigger.textContent = 'Aksi';

  actionRow.append(panelLink, menuTrigger);
  actionWrap.append(actionRow);
  cell.append(actionWrap);
  return cell;
}

function renderTenants(tenants) {
  tenantsBody.innerHTML = '';

  if (!tenants.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'Belum ada organisasi.';
    row.append(cell);
    tenantsBody.append(row);
    return;
  }

  tenants.forEach((tenant) => {
    const row = document.createElement('tr');

    row.append(createTruncateCell('school-name-cell', tenant.name));
    row.append(createTruncateCell('school-slug-cell', tenant.slug));

    const typeCell = document.createElement('td');
    typeCell.textContent = tenantTypeLabel(tenant.tenant_type);
    row.append(typeCell);

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${tenant.is_active ? 'is-active' : 'is-inactive'}`;
    statusBadge.textContent = tenant.is_active ? 'Aktif' : 'Nonaktif';
    statusCell.append(statusBadge);
    row.append(statusCell);

    const totalQuestionnairesCell = document.createElement('td');
    totalQuestionnairesCell.className = 'cell-number';
    totalQuestionnairesCell.textContent = String(tenant.total_questionnaires ?? 0);
    row.append(totalQuestionnairesCell);

    const totalResponsesCell = document.createElement('td');
    totalResponsesCell.className = 'total-responses-cell cell-number';
    totalResponsesCell.textContent = String(tenant.total_responses ?? 0);
    row.append(totalResponsesCell);

    row.append(createTenantActionsCell(tenant));
    tenantsBody.append(row);
  });
}

async function loadMe() {
  const payload = await api('/forms/admin/api/me', undefined, 'Validasi sesi superadmin');
  if (!payload.user?.isSuperadmin) {
    throw new Error('Akun ini bukan superadmin.');
  }
  userInfoEl.textContent = `Login sebagai ${payload.user.email}`;
  pushActivity('success', 'Sesi valid', payload.user.email);
}

async function loadTenants() {
  const payload = await api('/forms/admin/api/tenants', undefined, 'Load daftar tenant');
  tenantCache = Array.isArray(payload.data) ? payload.data : [];
  renderTenants(tenantCache);
  mapTenantOptions(tenantCache);
  pushActivity('success', 'Load tenant', `${tenantCache.length} organisasi`);
}

function syncPromptScopeUi() {
  const scope = String(promptScopeEl.value || 'global').trim().toLowerCase();
  const needsTenant = scope === 'tenant' || scope === 'questionnaire';
  const needsQuestionnaire = scope === 'questionnaire';
  promptTenantWrapEl.style.display = needsTenant ? 'block' : 'none';
  promptQuestionnaireWrapEl.style.display = needsQuestionnaire ? 'block' : 'none';
}

function getPromptSelection() {
  const mode = promptModeEl.value;
  const scope = String(promptScopeEl.value || 'global').trim().toLowerCase();
  const tenantId = scope === 'global' ? '' : String(promptTenantSelectEl.value || '');
  const questionnaireId = scope === 'questionnaire' ? String(promptQuestionnaireSelectEl.value || '') : '';
  return { mode, scope, tenantId, questionnaireId };
}

function toPromptQuery({ mode, scope, tenantId, questionnaireId }) {
  const params = new URLSearchParams();
  params.set('mode', mode);
  params.set('scope', scope);
  if (scope !== 'global' && tenantId) {
    params.set('tenantId', tenantId);
  }
  if (scope === 'questionnaire' && questionnaireId) {
    params.set('questionnaireId', questionnaireId);
  }
  return params.toString();
}

function resolveDraftTemplate(bundle, selection) {
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

  if (selection.scope === 'tenant') {
    return (
      bundle.tenantDraft?.template ||
      bundle.tenantPublished?.template ||
      bundle.globalDraft?.template ||
      bundle.globalPublished?.template ||
      bundle.effective?.template ||
      ''
    );
  }

  return bundle.globalDraft?.template || bundle.globalPublished?.template || bundle.effective?.template || '';
}

function resolvePublishedTemplate(bundle, selection) {
  if (!bundle) return '';
  if (selection.scope === 'questionnaire') {
    return (
      bundle.questionnairePublished?.template ||
      bundle.tenantPublished?.template ||
      bundle.globalPublished?.template ||
      bundle.effective?.template ||
      ''
    );
  }
  if (selection.scope === 'tenant') {
    return bundle.tenantPublished?.template || bundle.globalPublished?.template || bundle.effective?.template || '';
  }
  return bundle.globalPublished?.template || bundle.effective?.template || '';
}

function renderPromptEffective(bundle, selection) {
  if (!bundle?.effective) {
    promptEffectiveMetaEl.innerHTML = '';
    promptEffectiveEl.textContent = 'Belum ada effective prompt.';
    return;
  }

  const source =
    bundle.effective.source === 'questionnaire'
      ? 'override questionnaire'
      : bundle.effective.source === 'tenant'
        ? 'override tenant'
        : bundle.effective.source === 'global'
          ? 'global'
          : 'fallback';

  const effectiveTenant =
    bundle.effective.tenantId && getTenantById(bundle.effective.tenantId)
      ? getTenantById(bundle.effective.tenantId).name
      : '-';
  const effectiveQuestionnaire = questionnaireCache.find(
    (item) => item.id === (bundle.effective.questionnaireId || bundle.questionnaireId || selection.questionnaireId)
  );

  promptEffectiveMetaEl.innerHTML = '';
  promptEffectiveMetaEl.append(
    createPromptChip('Mode', MODE_LABELS[bundle.mode] || bundle.mode),
    createPromptChip('Source', source),
    createPromptChip('Scope', selection.scope),
    createPromptChip('Tenant', selection.scope === 'global' ? '-' : effectiveTenant),
    createPromptChip('Questionnaire', effectiveQuestionnaire?.name || '-'),
    createPromptChip('Published', formatDateTime(bundle.effective.publishedAt))
  );

  promptEffectiveEl.textContent = bundle.effective.template || '';
}

function updatePromptDraftMeta() {
  const selection = getPromptSelection();
  const tenantName = selection.scope === 'global' ? '-' : getTenantById(selection.tenantId)?.name || '-';
  const questionnaireName =
    selection.scope === 'questionnaire'
      ? questionnaireCache.find((item) => item.id === selection.questionnaireId)?.name || '-'
      : '-';
  const templateLength = String(promptTemplateEl.value || '').length;
  const noteLength = String(promptChangeNoteEl.value || '').length;

  promptDraftMetaEl.textContent = `Draft ${MODE_LABELS[selection.mode] || selection.mode} | Scope: ${
    selection.scope
  } | Tenant: ${tenantName} | Questionnaire: ${questionnaireName} | Template: ${templateLength} karakter | Catatan: ${noteLength}/500`;
}

function renderPromptHistoryRows(rows) {
  promptHistoryBody.innerHTML = '';
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'Belum ada riwayat.';
    row.append(cell);
    promptHistoryBody.append(row);
    return;
  }

  rows.forEach((entry) => {
    const row = document.createElement('tr');

    const statusCell = document.createElement('td');
    statusCell.textContent = entry.status || '-';
    row.append(statusCell);

    const scopeCell = document.createElement('td');
    if (entry.scope === 'questionnaire') {
      const tenant = getTenantById(entry.tenantId);
      const questionnaire = questionnaireCache.find((item) => item.id === entry.questionnaireId);
      scopeCell.textContent = questionnaire
        ? `questionnaire: ${questionnaire.name} @ ${tenant?.name || '-'}`
        : `questionnaire: ${entry.questionnaireId || '-'}`;
    } else if (entry.scope === 'tenant') {
      const tenant = getTenantById(entry.tenantId);
      scopeCell.textContent = tenant ? `tenant: ${tenant.name}` : `tenant: ${entry.tenantId || '-'}`;
    } else {
      scopeCell.textContent = 'global';
    }
    row.append(scopeCell);

    const noteCell = document.createElement('td');
    noteCell.textContent = entry.changeNote || '-';
    row.append(noteCell);

    const createdCell = document.createElement('td');
    createdCell.textContent = formatDateTime(entry.createdAt);
    row.append(createdCell);

    const publishedCell = document.createElement('td');
    publishedCell.textContent = formatDateTime(entry.publishedAt);
    row.append(publishedCell);

    promptHistoryBody.append(row);
  });
}

async function loadPromptManager() {
  syncPromptScopeUi();
  const selection = getPromptSelection();

  if ((selection.scope === 'tenant' || selection.scope === 'questionnaire') && !selection.tenantId) {
    promptBundleCache = null;
    promptTemplateEl.value = '';
    promptEffectiveMetaEl.innerHTML = '';
    promptEffectiveEl.textContent = 'Pilih tenant dulu untuk override prompt.';
    renderPromptHistoryRows([]);
    updatePromptDraftMeta();
    setPromptStatus('Pilih tenant untuk scope override.', 'warning');
    return;
  }

  if (selection.scope === 'questionnaire') {
    await loadQuestionnairesForSelectedTenant();
    const refreshed = getPromptSelection();
    if (!refreshed.questionnaireId) {
      promptBundleCache = null;
      promptTemplateEl.value = '';
      promptEffectiveMetaEl.innerHTML = '';
      promptEffectiveEl.textContent = 'Pilih questionnaire untuk override prompt.';
      renderPromptHistoryRows([]);
      updatePromptDraftMeta();
      setPromptStatus('Pilih questionnaire untuk scope override.', 'warning');
      return;
    }
  }

  try {
    setPromptStatus('Memuat prompt manager...');
    const query = toPromptQuery(getPromptSelection());
    const historyQuery = toPromptQuery(getPromptSelection());
    const [bundlePayload, historyPayload] = await Promise.all([
      requestJson(`/forms/admin/api/ai-prompts?${query}`),
      requestJson(`/forms/admin/api/ai-prompts/history?${historyQuery}`),
    ]);

    promptBundleCache = bundlePayload.data;
    promptTemplateEl.value = resolveDraftTemplate(promptBundleCache, getPromptSelection());
    renderPromptEffective(promptBundleCache, getPromptSelection());
    renderPromptHistoryRows(historyPayload.data || []);
    updatePromptDraftMeta();
    setPromptStatus('Prompt manager siap.', 'success');
    pushActivity('success', 'Load prompt manager', `${getPromptSelection().mode} / ${getPromptSelection().scope}`);
  } catch (error) {
    const normalized = normalizeUiError(error);
    setPromptStatus(normalized.message, 'error');
    setErrorDebugPanel(errorDebugEl, error);
    pushActivity('error', 'Load prompt manager', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
  }
}

async function savePromptDraft() {
  const selection = getPromptSelection();
  if (selection.scope !== 'global' && !selection.tenantId) {
    setPromptStatus('Pilih tenant untuk menyimpan override.', 'warning');
    return;
  }
  if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
    setPromptStatus('Pilih questionnaire untuk menyimpan override.', 'warning');
    return;
  }

  const template = String(promptTemplateEl.value || '').trim();
  if (!template) {
    setPromptStatus('Template prompt tidak boleh kosong.', 'warning');
    return;
  }

  const payload = {
    mode: selection.mode,
    scope: selection.scope,
    tenantId: selection.scope === 'global' ? undefined : selection.tenantId,
    questionnaireId: selection.scope === 'questionnaire' ? selection.questionnaireId : undefined,
    template,
    changeNote: String(promptChangeNoteEl.value || '').trim(),
  };

  try {
    await requestJson('/forms/admin/api/ai-prompts/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setPromptStatus('Draft prompt berhasil disimpan.', 'success');
    pushActivity('success', 'Save prompt draft', `${selection.mode} / ${selection.scope}`);
    await loadPromptManager();
  } catch (error) {
    const normalized = normalizeUiError(error);
    setPromptStatus(normalized.message, 'error');
    setErrorDebugPanel(errorDebugEl, error);
    pushActivity('error', 'Save prompt draft', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
  }
}

async function publishPrompt() {
  const selection = getPromptSelection();
  if (selection.scope !== 'global' && !selection.tenantId) {
    setPromptStatus('Pilih tenant untuk publish override.', 'warning');
    return;
  }
  if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
    setPromptStatus('Pilih questionnaire untuk publish override.', 'warning');
    return;
  }

  const payload = {
    mode: selection.mode,
    scope: selection.scope,
    tenantId: selection.scope === 'global' ? undefined : selection.tenantId,
    questionnaireId: selection.scope === 'questionnaire' ? selection.questionnaireId : undefined,
    changeNote: String(promptChangeNoteEl.value || '').trim(),
  };

  try {
    await requestJson('/forms/admin/api/ai-prompts/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setPromptStatus('Prompt berhasil dipublish.', 'success');
    pushActivity('success', 'Publish prompt', `${selection.mode} / ${selection.scope}`);
    await loadPromptManager();
  } catch (error) {
    const normalized = normalizeUiError(error);
    setPromptStatus(normalized.message, 'error');
    setErrorDebugPanel(errorDebugEl, error);
    pushActivity('error', 'Publish prompt', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
  }
}

function resetPromptToPublished() {
  promptTemplateEl.value = resolvePublishedTemplate(promptBundleCache, getPromptSelection());
  updatePromptDraftMeta();
  setPromptStatus('Draft direset ke versi published saat ini.', 'success');
}

function focusPromptOverride(tenantId) {
  promptScopeEl.value = 'tenant';
  syncPromptScopeUi();
  promptTenantSelectEl.value = tenantId;
  promptPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  loadPromptManager();
}

async function executeTenantStatusToggle() {
  if (!pendingToggleAction) return;
  const { tenantId, tenantName, next } = pendingToggleAction;
  setStatus('Memproses perubahan status organisasi...', 'warning');
  setToggleModalLoading(true);

  try {
    await api(
      `/forms/admin/api/tenants/${tenantId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      },
      'Toggle tenant status'
    );
    await loadTenants();
    await loadPromptManager();
    closeToggleModal();
    setStatus('Status organisasi berhasil diperbarui.', 'success');
    pushActivity('success', 'Toggle tenant status', `${tenantName} -> ${next ? 'aktif' : 'nonaktif'}`);
  } catch {
    setToggleModalLoading(false);
  }
}

async function bootstrap() {
  try {
    await loadMe();
    await loadTenants();
    syncPromptScopeUi();
    await loadQuestionnairesForSelectedTenant();
    await loadPromptManager();
    setStatus('Panel superadmin siap dipakai.', 'success');
  } catch {
    window.location.href = `/forms/admin/login?redirect=${encodeURIComponent('/forms/admin/')}`;
  }
}

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
  pushActivity(
    'error',
    'Runtime error',
    `${normalized.method || '-'} ${normalized.path || '-'} (status ${normalized.status || '-'})`
  );
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await requestJson('/forms/admin/api/logout', { method: 'POST' });
  } finally {
    window.location.href = '/forms/admin/login';
  }
});

document.getElementById('create-tenant-btn').addEventListener('click', async () => {
  const name = String(document.getElementById('tenant-name').value || '').trim();
  const slug = String(document.getElementById('tenant-slug').value || '').trim();
  const tenantType = String(document.getElementById('tenant-type').value || 'school').trim();

  if (!name) {
    setStatus('Nama organisasi wajib diisi.', 'warning');
    return;
  }

  try {
    await api(
      '/forms/admin/api/tenants',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, tenantType }),
      },
      'Create tenant'
    );
    document.getElementById('tenant-name').value = '';
    document.getElementById('tenant-slug').value = '';
    document.getElementById('tenant-type').value = 'school';
    await loadTenants();
    await loadPromptManager();
    setStatus('Organisasi berhasil dibuat.', 'success');
    pushActivity('success', 'Create tenant', `${name} (${tenantType})`);
  } catch {
    // handled in api()
  }
});

tenantsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const tenantId = button.dataset.id;
  const action = button.dataset.action;
  if (!tenantId || !action) return;

  if (action !== 'toggle-menu') return;
  event.preventDefault();
  const tenant = getTenantById(tenantId);
  if (!tenant) return;
  toggleTenantActionMenu(button, tenant);
});

document.body.addEventListener('click', async (event) => {
  const floatingMenu = activeActionMenu;
  if (!floatingMenu || floatingMenu.hidden) return;

  const menuAction = event.target.closest('[data-action]');
  if (!menuAction || !floatingMenu.contains(menuAction)) return;
  const tenantId = String(menuAction.dataset.id || '').trim();
  const action = String(menuAction.dataset.action || '').trim();
  if (!tenantId || !action) return;

  if (action === 'toggle') {
    const tenant = getTenantById(tenantId);
    const next = menuAction.dataset.next === 'true';
    if (!tenant) return;
    const focusTarget = activeActionTrigger;
    closeAllTenantActionMenus();
    openToggleModal(tenant, next, focusTarget);
    return;
  }

  if (action === 'prompt-override') {
    closeAllTenantActionMenus();
    focusPromptOverride(tenantId);
  }
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.tenant-actions-inline')) return;
  if (event.target.closest('.action-menu--floating')) return;
  closeAllTenantActionMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (toggleModalEl && !toggleModalEl.hidden) {
    if (toggleModalConfirmBtn?.disabled) return;
    event.preventDefault();
    closeToggleModal();
    return;
  }
  closeAllTenantActionMenus({ restoreFocus: true });
});

window.addEventListener('resize', closeAllTenantActionMenus);
window.addEventListener('scroll', closeAllTenantActionMenus, true);

if (toggleModalCancelBtn) {
  toggleModalCancelBtn.addEventListener('click', closeToggleModal);
}

if (toggleModalConfirmBtn) {
  toggleModalConfirmBtn.addEventListener('click', executeTenantStatusToggle);
}

if (toggleModalEl) {
  toggleModalEl.addEventListener('click', (event) => {
    if (toggleModalConfirmBtn?.disabled) return;
    if (event.target === toggleModalEl) {
      closeToggleModal();
    }
  });
}

document.getElementById('create-admin-btn').addEventListener('click', async () => {
  const tenantId = String(tenantSelectEl.value || '').trim();
  const email = String(document.getElementById('admin-email').value || '').trim();
  const password = String(document.getElementById('admin-password').value || '');

  if (!tenantId) {
    setStatus('Pilih organisasi dulu.', 'warning');
    return;
  }

  try {
    await api(
      `/forms/admin/api/tenants/${tenantId}/admins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      'Create tenant admin'
    );
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-password').value = '';
    setStatus('Admin organisasi berhasil ditambahkan.', 'success');
    pushActivity('success', 'Create tenant admin', email);
  } catch {
    // handled in api()
  }
});

promptModeEl.addEventListener('change', () => loadPromptManager());
promptScopeEl.addEventListener('change', async () => {
  syncPromptScopeUi();
  await loadQuestionnairesForSelectedTenant();
  await loadPromptManager();
});
promptTenantSelectEl.addEventListener('change', async () => {
  await loadQuestionnairesForSelectedTenant();
  await loadPromptManager();
});
promptQuestionnaireSelectEl.addEventListener('change', () => loadPromptManager());
promptTemplateEl.addEventListener('input', updatePromptDraftMeta);
promptChangeNoteEl.addEventListener('input', updatePromptDraftMeta);
document.getElementById('prompt-save-btn').addEventListener('click', savePromptDraft);
document.getElementById('prompt-publish-btn').addEventListener('click', publishPrompt);
document.getElementById('prompt-reset-btn').addEventListener('click', resetPromptToPublished);
document.getElementById('prompt-refresh-btn').addEventListener('click', () => loadPromptManager());

bootstrap();
