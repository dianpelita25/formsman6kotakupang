import { normalizeUiError, requestJson } from '/forms-static/shared/ux.js';

export function bindSchoolAdminEvents({
  state,
  legacySections,
  questionnaireNameEl,
  questionnaireSlugEl,
  questionnaireCategoryEl,
  questionnaireListBodyEl,
  tenantPromptModeEl,
  tenantPromptScopeEl,
  tenantPromptQuestionnaireEl,
  setStatus,
  setError,
  loadQuestionnaires,
  createQuestionnaire,
  loadPromptBundle,
  updatePromptScopeUi,
  savePromptDraft,
  publishPrompt,
} = {}) {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await requestJson('/forms/admin/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/forms/admin/login';
  });

  document.getElementById('create-questionnaire-btn').addEventListener('click', async () => {
    try {
      await createQuestionnaire({
        name: String(questionnaireNameEl.value || '').trim(),
        slug: String(questionnaireSlugEl.value || '').trim(),
        category: String(questionnaireCategoryEl.value || '').trim() || 'general_feedback',
      });
      questionnaireNameEl.value = '';
      questionnaireSlugEl.value = '';
      questionnaireCategoryEl.value = '';
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

  return {
    renderLegacySections() {
      legacySections.forEach((section) => {
        section.style.display = state.legacyCompatEnabled ? '' : 'none';
      });
    },
  };
}
