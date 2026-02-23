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
  function formatScopeLabel(scope) {
    const normalized = String(scope || '').trim().toLowerCase();
    if (normalized === 'questionnaire') return 'override_kuesioner';
    if (normalized === 'tenant') return 'override_organisasi';
    return 'global';
  }
  function mapQuestionnaireOptions(questionnaires) {
    refs.promptQuestionnaireSelectEl.innerHTML = '';
    state.questionnaireCache = questionnaires || [];
    if (!state.questionnaireCache.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Belum ada kuesioner';
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
      const payload = await api(`/forms/${tenant.slug}/admin/api/questionnaires`, undefined, 'Muat kuesioner organisasi');
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
  function revealErrorDebug(error) {
    if (refs.errorDebugWrapEl) {
      refs.errorDebugWrapEl.hidden = false;
      refs.errorDebugWrapEl.open = false;
    }
    setErrorDebugPanel(refs.errorDebugEl, error);
  }
  async function loadPromptManager() {
    syncPromptScopeUi();
    const selection = getPromptSelection();
    if ((selection.scope === 'tenant' || selection.scope === 'questionnaire') && !selection.tenantId) {
      state.promptBundleCache = null;
      refs.promptTemplateEl.value = '';
      refs.promptEffectiveMetaEl.innerHTML = '';
      refs.promptEffectiveEl.textContent = 'Pilih organisasi dulu untuk override prompt.';
      renderPromptHistoryRows({ refs, rows: [], getTenantById, questionnaireCache: state.questionnaireCache, formatDateTime });
      updatePromptDraftMeta();
      setPromptStatus('Pilih organisasi untuk cakupan override.', 'warning');
      return;
    }
    if (selection.scope === 'questionnaire') {
      await loadQuestionnairesForSelectedTenant();
      if (!getPromptSelection().questionnaireId) {
        state.promptBundleCache = null;
        refs.promptTemplateEl.value = '';
        refs.promptEffectiveMetaEl.innerHTML = '';
        refs.promptEffectiveEl.textContent = 'Pilih kuesioner untuk override prompt.';
        renderPromptHistoryRows({ refs, rows: [], getTenantById, questionnaireCache: state.questionnaireCache, formatDateTime });
        updatePromptDraftMeta();
        setPromptStatus('Pilih kuesioner untuk cakupan override.', 'warning');
        return;
      }
    }
    try {
      setPromptStatus('Memuat pengelola prompt...');
      const query = toPromptQuery(getPromptSelection());
      const [bundlePayload, historyPayload] = await Promise.all([requestJson(`/forms/admin/api/ai-prompts?${query}`), requestJson(`/forms/admin/api/ai-prompts/history?${query}`)]);
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
      setPromptStatus('Pengelola prompt siap.', 'success');
      pushActivity('success', 'Muat pengelola prompt', `${getPromptSelection().mode} / ${formatScopeLabel(getPromptSelection().scope)}`);
    } catch (error) {
      const normalized = normalizeUiError(error);
      setPromptStatus(normalized.message, 'error');
      revealErrorDebug(error);
      pushActivity('error', 'Muat pengelola prompt', normalized.message);
    }
  }
  async function savePromptDraft() {
    const selection = getPromptSelection();
    if (selection.scope !== 'global' && !selection.tenantId)
      return setPromptStatus('Pilih organisasi untuk menyimpan override.', 'warning');
    if (selection.scope === 'questionnaire' && !selection.questionnaireId)
      return setPromptStatus('Pilih kuesioner untuk menyimpan override.', 'warning');
    const template = String(refs.promptTemplateEl.value || '').trim();
    if (!template) return setPromptStatus('Template prompt tidak boleh kosong.', 'warning');
    try {
      await requestJson('/forms/admin/api/ai-prompts/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selection.mode, scope: selection.scope, tenantId: selection.scope === 'global' ? undefined : selection.tenantId, questionnaireId: selection.scope === 'questionnaire' ? selection.questionnaireId : undefined, template, changeNote: String(refs.promptChangeNoteEl.value || '').trim() }),
      });
      setPromptStatus('Draft prompt berhasil disimpan.', 'success');
      pushActivity('success', 'Simpan draf prompt', `${selection.mode} / ${formatScopeLabel(selection.scope)}`);
      await loadPromptManager();
    } catch (error) {
      const normalized = normalizeUiError(error);
      setPromptStatus(normalized.message, 'error');
      revealErrorDebug(error);
      pushActivity('error', 'Simpan draf prompt', normalized.message);
    }
  }
  async function publishPrompt() {
    const selection = getPromptSelection();
    if (selection.scope !== 'global' && !selection.tenantId)
      return setPromptStatus('Pilih organisasi untuk memublikasikan override.', 'warning');
    if (selection.scope === 'questionnaire' && !selection.questionnaireId)
      return setPromptStatus('Pilih kuesioner untuk memublikasikan override.', 'warning');
    try {
      await requestJson('/forms/admin/api/ai-prompts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selection.mode, scope: selection.scope, tenantId: selection.scope === 'global' ? undefined : selection.tenantId, questionnaireId: selection.scope === 'questionnaire' ? selection.questionnaireId : undefined, changeNote: String(refs.promptChangeNoteEl.value || '').trim() }),
      });
      setPromptStatus('Prompt berhasil dipublikasikan.', 'success');
      pushActivity('success', 'Publikasikan prompt', `${selection.mode} / ${formatScopeLabel(selection.scope)}`);
      await loadPromptManager();
    } catch (error) {
      const normalized = normalizeUiError(error);
      setPromptStatus(normalized.message, 'error');
      revealErrorDebug(error);
      pushActivity('error', 'Publikasikan prompt', normalized.message);
    }
  }
  function resetPromptToPublished() {
    refs.promptTemplateEl.value = resolvePublishedTemplate(state.promptBundleCache, getPromptSelection());
    updatePromptDraftMeta();
    setPromptStatus('Draf direset ke versi terpublikasi saat ini.', 'success');
  }
  function focusPromptOverride(tenantId) {
    refs.promptScopeEl.value = 'tenant';
    syncPromptScopeUi();
    refs.promptTenantSelectEl.value = tenantId;
    window.dispatchEvent(new CustomEvent('superadmin:open-section', { detail: { sectionId: 'sec-prompt-manager' } }));
    refs.promptPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadPromptManager();
  }
  return { loadPromptManager, loadQuestionnairesForSelectedTenant, syncPromptScopeUi, updatePromptDraftMeta, savePromptDraft, publishPrompt, resetPromptToPublished, focusPromptOverride };
}
