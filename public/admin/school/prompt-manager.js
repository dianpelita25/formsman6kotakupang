export function createPromptManager({
  state,
  tenantPromptModeEl,
  tenantPromptScopeEl,
  tenantPromptQuestionnaireEl,
  tenantPromptTemplateEl,
  tenantPromptNoteEl,
  tenantPromptEffectiveEl,
  setStatus,
  pushActivity,
  api,
  basePath,
} = {}) {
  function formatScopeLabel(scope) {
    const normalized = String(scope || '').trim().toLowerCase();
    if (normalized === 'questionnaire') return 'kuesioner';
    if (normalized === 'tenant') return 'organisasi';
    return 'global';
  }

  function formatSourceLabel(source) {
    const normalized = String(source || '').trim().toLowerCase();
    if (normalized === 'questionnaire') return 'override kuesioner';
    if (normalized === 'tenant') return 'override organisasi';
    if (normalized === 'global') return 'global';
    return 'cadangan';
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
    const source = formatSourceLabel(bundle.effective.source || 'fallback');
    tenantPromptEffectiveEl.textContent = `Sumber: ${source}\n\n${bundle.effective.template}`;
  }

  async function loadPromptBundle() {
    const selection = getPromptSelection();
    if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
      tenantPromptTemplateEl.value = '';
      tenantPromptEffectiveEl.textContent = 'Pilih kuesioner untuk cakupan kuesioner.';
      setStatus('Pilih kuesioner dulu untuk memuat prompt.', 'warning');
      return;
    }

    const params = new URLSearchParams();
    params.set('mode', selection.mode);
    params.set('scope', selection.scope);
    if (selection.questionnaireId) params.set('questionnaireId', selection.questionnaireId);

    const payload = await api(`${basePath()}/ai-prompts?${params.toString()}`, undefined, 'Muat prompt organisasi');
    tenantPromptTemplateEl.value = resolvePromptDraftTemplate(payload.data, selection);
    renderPromptEffective(payload.data);
    pushActivity('success', 'Muat prompt', `${selection.mode} / ${formatScopeLabel(selection.scope)}`);
  }

  async function savePromptDraft() {
    const selection = getPromptSelection();
    if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
      throw new Error('Pilih kuesioner untuk cakupan kuesioner.');
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
      'Simpan draf prompt organisasi'
    );
    setStatus('Draft prompt berhasil disimpan.', 'success');
    pushActivity('success', 'Simpan draf prompt', `${selection.mode} / ${formatScopeLabel(selection.scope)}`);
    await loadPromptBundle();
  }

  async function publishPrompt() {
    const selection = getPromptSelection();
    if (selection.scope === 'questionnaire' && !selection.questionnaireId) {
      throw new Error('Pilih kuesioner untuk cakupan kuesioner.');
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
      'Publikasikan prompt organisasi'
    );
    setStatus('Prompt berhasil dipublikasikan.', 'success');
    pushActivity('success', 'Publikasikan prompt', `${selection.mode} / ${formatScopeLabel(selection.scope)}`);
    await loadPromptBundle();
  }

  return {
    updatePromptScopeUi,
    loadPromptBundle,
    savePromptDraft,
    publishPrompt,
  };
}
