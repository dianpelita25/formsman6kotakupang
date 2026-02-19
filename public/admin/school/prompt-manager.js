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

  return {
    updatePromptScopeUi,
    loadPromptBundle,
    savePromptDraft,
    publishPrompt,
  };
}
