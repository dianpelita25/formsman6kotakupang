import {
  bindRuntimeErrorHandlers,
  createActivityFeed,
  normalizeUiError,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';
import { createSchoolAdminApi } from './api-client.js';
import { createSchoolBootstrap } from './bootstrap.js';
import { bindSchoolAdminEvents } from './event-bindings.js';
import { createPromptManager } from './prompt-manager.js';
import { createSchoolAdminState, parseTenantSlug } from './state.js';

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

const state = createSchoolAdminState();
const activityFeed = createActivityFeed(activityFeedEl);

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

const { basePath, api } = createSchoolAdminApi({
  state,
  setStatus,
  setError,
  pushActivity,
});

const promptManager = createPromptManager({
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
});

const bootstrap = createSchoolBootstrap({
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
  loadPromptBundle: promptManager.loadPromptBundle,
});

bindSchoolAdminEvents({
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
  loadQuestionnaires: bootstrap.loadQuestionnaires,
  createQuestionnaire: bootstrap.createQuestionnaire,
  loadPromptBundle: promptManager.loadPromptBundle,
  updatePromptScopeUi: promptManager.updatePromptScopeUi,
  savePromptDraft: promptManager.savePromptDraft,
  publishPrompt: promptManager.publishPrompt,
});

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error');
  setError(originalError);
  pushActivity('error', 'Runtime error', normalized.message);
});

async function init() {
  state.tenantSlug = parseTenantSlug();
  if (!state.tenantSlug) {
    throw new Error('Tenant slug tidak ditemukan.');
  }

  promptManager.updatePromptScopeUi();
  await bootstrap.init();
}

init().catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat panel organisasi.');
  setStatus(normalized.message, 'error');
  setError(error);
  pushActivity('error', 'Init panel organisasi', normalized.message);
});
