import {
  bindRuntimeErrorHandlers,
  createActivityFeed,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';
import { createAdvancedJsonController } from './advanced-json.js';
import { createBuilderApiClient } from './api-client.js';
import { createQuestionComposer } from './composer.js';
import { createBuilderDraftService } from './draft-service.js';
import { createBuilderDomRefs } from './dom-refs.js';
import { bindBuilderEvents } from './event-bindings.js';
import { ensureUniqueFieldKey, normalizeBuilderField, slugToKey } from './field-normalizer.js';
import { createBuilderPublishService } from './publish-service.js';
import { createBuilderQuestionCard } from './question-card.js';
import { createQuestionListController } from './question-list-controller.js';
import {
  buildBuilderBaseApiPath,
  buildBuilderDashboardPath,
  buildBuilderPublicFormPath,
  parseBuilderRouteContext,
} from './route-context.js';
import { cloneBuilderField, createBuilderState } from './state.js';
import { renderBuilderPreview, syncBuilderMetaFromInputs, syncBuilderMetaToInputs } from './preview-renderer.js';

export function bootstrapQuestionnaireBuilderRuntime() {
  const refs = createBuilderDomRefs(document);
  const state = createBuilderState();
  const activityFeed = createActivityFeed(refs.activityFeedEl);

  function setStatus(message, kind = 'info') {
    setInlineStatus(refs.statusEl, message, kind);
    setInlineStatus(refs.inlineStatusEl, message, kind);
  }

  function setError(error = null) {
    if (!error) {
      refs.errorDebugEl.textContent = 'Belum ada error.';
      if (refs.errorDebugWrapEl) {
        refs.errorDebugWrapEl.hidden = true;
        refs.errorDebugWrapEl.open = false;
      }
      return;
    }
    if (refs.errorDebugWrapEl) {
      refs.errorDebugWrapEl.hidden = false;
      refs.errorDebugWrapEl.open = false;
    }
    setErrorDebugPanel(refs.errorDebugEl, error);
  }

  function pushActivity(level, action, detail = '') {
    activityFeed.push(level, action, detail);
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

  const route = parseBuilderRouteContext();
  state.tenantSlug = route.tenantSlug;
  state.questionnaireSlug = route.questionnaireSlug;

  const baseApiPath = () => buildBuilderBaseApiPath(state);
  const publicFormPath = () => buildBuilderPublicFormPath(state);

  const { api } = createBuilderApiClient({
    requestJson,
    normalizeUiError,
    setStatus,
    setError,
    pushActivity,
  });

  let renderQuestionList = () => {};
  const renderPreview = () => renderBuilderPreview(state, refs);
  const syncMetaFromInputs = () => syncBuilderMetaFromInputs(state, refs);
  const syncMetaToInputs = () => syncBuilderMetaToInputs(state, refs);

  const advancedJson = createAdvancedJsonController({
    state,
    refs,
    normalizeBuilderField,
    syncMetaToInputs,
    renderQuestionList: () => renderQuestionList(),
    pushActivity,
    setStatus,
  });
  const syncAdvancedJson = () => advancedJson.syncAdvancedJson();

  const questionListController = createQuestionListController({
    state,
    refs,
    createQuestionCard: createBuilderQuestionCard,
    renderPreview,
    syncAdvancedJson,
    cloneField: cloneBuilderField,
    ensureUniqueFieldKey,
  });
  renderQuestionList = questionListController.renderQuestionList;

  const composer = createQuestionComposer({
    state,
    refs,
    slugToKey,
    normalizeBuilderField,
    renderQuestionList,
    pushActivity,
  });

  const draftService = createBuilderDraftService({
    state,
    refs,
    baseApiPath,
    normalizeBuilderField,
    cloneField: cloneBuilderField,
    syncMetaFromInputs,
    syncMetaToInputs,
    renderQuestionList,
    api,
    pushActivity,
    setStatus,
  });

  const publishService = createBuilderPublishService({
    state,
    refs,
    baseApiPath,
    publicFormPath,
    setStatus,
    pushActivity,
    api,
    saveDraft: draftService.saveDraft,
    loadDraft: draftService.loadDraft,
    refreshResponseFlag: draftService.refreshResponseFlag,
    detectBreakingChanges: draftService.detectBreakingChanges,
  });

  bindBuilderEvents({
    refs,
    state,
    normalizeUiError,
    setStatus,
    setError,
    pushActivity,
    syncMetaFromInputs,
    renderPreview,
    syncAdvancedJson,
    setComposerQuestionTypeVisibility: composer.setComposerQuestionTypeVisibility,
    addQuestionFromComposer: composer.addQuestionFromComposer,
    questionListController,
    loadDraft: draftService.loadDraft,
    saveDraft: draftService.saveDraft,
    publishDraft: publishService.publishDraft,
    runWithButtonLoading,
    applyJsonAdvanced: advancedJson.applyJsonAdvanced,
  });

  bindRuntimeErrorHandlers((normalized, originalError) => {
    setStatus(normalized.message, 'error');
    setError(originalError);
    pushActivity('error', 'Error runtime', normalized.message);
  });

  async function init() {
    refs.backPanelLink.href = `/forms/${state.tenantSlug}/admin/`;
    refs.openDashboardLink.href = buildBuilderDashboardPath(state);
    composer.setComposerQuestionTypeVisibility();
    publishService.hidePublishResult();
    setStatus('Memuat data builder...');
    await draftService.loadDraft();
    await draftService.refreshResponseFlag().catch(() => {
      state.hasResponses = false;
    });
    setStatus('Builder siap dipakai.', 'success');
  }

  return init().catch((error) => {
    const normalized = normalizeUiError(error, 'Gagal memuat builder.');
    setStatus(normalized.message, 'error');
    setError(error);
    pushActivity('error', 'Init builder', normalized.message);
  });
}
