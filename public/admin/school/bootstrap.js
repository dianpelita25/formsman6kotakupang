import { requestJson } from '/forms-static/shared/ux.js';
import { renderQuestionnaireList, renderQuestionnairePromptOptions } from './questionnaire-ui.js';

export function createSchoolBootstrap({
  state,
  titleEl,
  userInfoEl,
  setStatus,
  pushActivity,
  legacySections,
  questionnaireListBodyEl,
  questionnaireEmptyEl,
  tenantPromptQuestionnaireEl,
  basePath,
  api,
  loadPromptBundle,
} = {}) {
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

  async function loadQuestionnaires() {
    const payload = await api(`${basePath()}/questionnaires`, undefined, 'Load daftar questionnaire');
    state.questionnaireItems = Array.isArray(payload.data) ? payload.data : [];
    renderQuestionnaireList({ state, questionnaireListBodyEl, questionnaireEmptyEl });
    renderQuestionnairePromptOptions({ state, tenantPromptQuestionnaireEl });
  }

  async function createQuestionnaire({ name, slug, category }) {
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

    setStatus('Questionnaire berhasil dibuat.', 'success');
    pushActivity('success', 'Create questionnaire', `${name} (${slug})`);
    await loadQuestionnaires();
  }

  async function init() {
    titleEl.textContent = `Panel Admin Organisasi - ${state.tenantSlug}`;

    setStatus('Memuat panel organisasi...');
    await loadMe();
    await detectLegacyCompat();
    await loadQuestionnaires();
    await loadPromptBundle();
    setStatus('Panel organisasi siap dipakai.', 'success');
  }

  return {
    init,
    loadQuestionnaires,
    createQuestionnaire,
  };
}
