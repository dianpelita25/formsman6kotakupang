import {
  renderPromptEffective,
  renderPromptHistoryRows,
  resolveDraftTemplate,
  resolvePublishedTemplate,
  updatePromptDraftMeta as renderPromptDraftMeta,
} from './prompt-manager-view.js';

export function createPromptManagerService({
  refs,
  state,
  modeLabels,
  getTenantById,
  formatDateTime,
  api,
  requestJson,
  normalizeUiError,
  setPromptStatus,
  pushActivity,
  setErrorDebugPanel,
}) {
  function mapQuestionnaireOptions(questionnaires) {
    refs.promptQuestionnaireSelectEl.innerHTML = '';
    state.questionnaireCache = questionnaires || [];
    if (!state.questionnaireCache.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Belum ada questionnaire';
      refs.promptQuestionnaireSelectEl.append(option);
      return;
    }

    state.questionnaireCache.forEach((questionnaire) => {
      const option = document.createElement('option');
      option.value = questionnaire.id;
      option.textContent = `${questionnaire.name} (${questionnaire.slug})`;
      refs.promptQuestionnaireSelectEl.append(option);
    });
  }
  async function loadQuestionnairesForSelectedTenant() {
    const tenantId = String(refs.promptTenantSelectEl.value || '');
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
  function syncPromptScopeUi() {
    const scope = String(refs.promptScopeEl.value || 'global').trim().toLowerCase();
    const needsTenant = scope === 'tenant' || scope === 'questionnaire';
    const needsQuestionnaire = scope === 'questionnaire';
    refs.promptTenantWrapEl.style.display = needsTenant ? 'block' : 'none';
    refs.promptQuestionnaireWrapEl.style.display = needsQuestionnaire ? 'block' : 'none';
  }
  function getPromptSelection() {
    const mode = refs.promptModeEl.value;
    const scope = String(refs.promptScopeEl.value || 'global').trim().toLowerCase();
    const tenantId = scope === 'global' ? '' : String(refs.promptTenantSelectEl.value || '');
    const questionnaireId = scope === 'questionnaire' ? String(refs.promptQuestionnaireSelectEl.value || '') : '';
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
  function updatePromptDraftMeta() {
    renderPromptDraftMeta({
      refs,
      selection: getPromptSelection(),
      modeLabels,
      getTenantById,
      questionnaireCache: state.questionnaireCache,
    });
  }
  async function loadPromptManager() {
    syncPromptScopeUi();
    const selection = getPromptSelection();
    if ((selection.scope === 'tenant' || selection.scope === 'questionnaire') && !selection.tenantId) {
      state.promptBundleCache = null;
      refs.promptTemplateEl.value = '';
      refs.promptEffectiveMetaEl.innerHTML = '';
      refs.promptEffectiveEl.textContent = 'Pilih tenant dulu untuk override prompt.';
      renderPromptHistoryRows({ refs, rows: [], getTenantById, questionnaireCache: state.questionnaireCache, formatDateTime });
      updatePromptDraftMeta();
      setPromptStatus('Pilih tenant untuk scope override.', 'warning');
      return;
    }
    if (selection.scope === 'questionnaire') {
      await loadQuestionnairesForSelectedTenant();
      if (!getPromptSelection().questionnaireId) {
        state.promptBundleCache = null;
        refs.promptTemplateEl.value = '';
        refs.promptEffectiveMetaEl.innerHTML = '';
        refs.promptEffectiveEl.textContent = 'Pilih questionnaire untuk override prompt.';
        renderPromptHistoryRows({ refs, rows: [], getTenantById, questionnaireCache: state.questionnaireCache, formatDateTime });
        updatePromptDraftMeta();
        setPromptStatus('Pilih questionnaire untuk scope override.', 'warning');
        return;
      }
    }
    try {
      setPromptStatus('Memuat prompt manager...');
      const query = toPromptQuery(getPromptSelection());
      const [bundlePayload, historyPayload] = await Promise.all([
        requestJson(`/forms/admin/api/ai-prompts?${query}`),
        requestJson(`/forms/admin/api/ai-prompts/history?${query}`),
      ]);

      state.promptBundleCache = bundlePayload.data;
      refs.promptTemplateEl.value = resolveDraftTemplate(state.promptBundleCache, getPromptSelection());
      renderPromptEffective({
        refs,
        bundle: state.promptBundleCache,
        selection: getPromptSelection(),
        modeLabels,
        getTenantById,
        questionnaireCache: state.questionnaireCache,
        formatDateTime,
      });
      renderPromptHistoryRows({
        refs,
        rows: historyPayload.data || [],
        getTenantById,
        questionnaireCache: state.questionnaireCache,
        formatDateTime,
      });
      updatePromptDraftMeta();
      setPromptStatus('Prompt manager siap.', 'success');
      pushActivity('success', 'Load prompt manager', `${getPromptSelection().mode} / ${getPromptSelection().scope}`);
    } catch (error) {
      const normalized = normalizeUiError(error);
      setPromptStatus(normalized.message, 'error');
      setErrorDebugPanel(refs.errorDebugEl, error);
      pushActivity('error', 'Load prompt manager', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
    }
  }
  async function savePromptDraft() {
    const selection = getPromptSelection();
    if (selection.scope !== 'global' && !selection.tenantId) return setPromptStatus('Pilih tenant untuk menyimpan override.', 'warning');
    if (selection.scope === 'questionnaire' && !selection.questionnaireId) return setPromptStatus('Pilih questionnaire untuk menyimpan override.', 'warning');
    const template = String(refs.promptTemplateEl.value || '').trim();
    if (!template) return setPromptStatus('Template prompt tidak boleh kosong.', 'warning');
    try {
      await requestJson('/forms/admin/api/ai-prompts/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selection.mode, scope: selection.scope, tenantId: selection.scope === 'global' ? undefined : selection.tenantId, questionnaireId: selection.scope === 'questionnaire' ? selection.questionnaireId : undefined, template, changeNote: String(refs.promptChangeNoteEl.value || '').trim() }),
      });
      setPromptStatus('Draft prompt berhasil disimpan.', 'success');
      pushActivity('success', 'Save prompt draft', `${selection.mode} / ${selection.scope}`);
      await loadPromptManager();
    } catch (error) {
      const normalized = normalizeUiError(error);
      setPromptStatus(normalized.message, 'error');
      setErrorDebugPanel(refs.errorDebugEl, error);
      pushActivity('error', 'Save prompt draft', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
    }
  }
  async function publishPrompt() {
    const selection = getPromptSelection();
    if (selection.scope !== 'global' && !selection.tenantId) return setPromptStatus('Pilih tenant untuk publish override.', 'warning');
    if (selection.scope === 'questionnaire' && !selection.questionnaireId) return setPromptStatus('Pilih questionnaire untuk publish override.', 'warning');
    try {
      await requestJson('/forms/admin/api/ai-prompts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selection.mode, scope: selection.scope, tenantId: selection.scope === 'global' ? undefined : selection.tenantId, questionnaireId: selection.scope === 'questionnaire' ? selection.questionnaireId : undefined, changeNote: String(refs.promptChangeNoteEl.value || '').trim() }),
      });
      setPromptStatus('Prompt berhasil dipublish.', 'success');
      pushActivity('success', 'Publish prompt', `${selection.mode} / ${selection.scope}`);
      await loadPromptManager();
    } catch (error) {
      const normalized = normalizeUiError(error);
      setPromptStatus(normalized.message, 'error');
      setErrorDebugPanel(refs.errorDebugEl, error);
      pushActivity('error', 'Publish prompt', `${normalized.method} ${normalized.path} (status ${normalized.status})`);
    }
  }
  function resetPromptToPublished() {
    refs.promptTemplateEl.value = resolvePublishedTemplate(state.promptBundleCache, getPromptSelection());
    updatePromptDraftMeta();
    setPromptStatus('Draft direset ke versi published saat ini.', 'success');
  }
  function focusPromptOverride(tenantId) {
    refs.promptScopeEl.value = 'tenant';
    syncPromptScopeUi();
    refs.promptTenantSelectEl.value = tenantId;
    refs.promptPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadPromptManager();
  }
  return {
    loadPromptManager,
    loadQuestionnairesForSelectedTenant,
    syncPromptScopeUi,
    updatePromptDraftMeta,
    savePromptDraft,
    publishPrompt,
    resetPromptToPublished,
    focusPromptOverride,
  };
}
