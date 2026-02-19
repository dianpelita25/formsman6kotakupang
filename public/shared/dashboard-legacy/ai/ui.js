import { hasAnalysisText } from './state.js';

export function refreshModeControls({ state, dom, getActiveMode, getModeSubtitle }) {
  const mode = getActiveMode(state);
  const {
    aiGroupInternalBtn,
    aiGroupExternalBtn,
    aiGroupLiveBtn,
    aiExternalLabel,
    aiSubtitle,
  } = dom;

  aiGroupInternalBtn?.classList.toggle('active', state.activeAnalysisGroup === 'internal');
  aiGroupExternalBtn?.classList.toggle('active', state.activeAnalysisGroup === 'external');
  aiGroupLiveBtn?.classList.toggle('active', state.activeAnalysisGroup === 'live');

  if (aiExternalLabel) {
    aiExternalLabel.classList.toggle('is-hidden', state.activeAnalysisGroup !== 'external');
  }

  if (aiSubtitle) {
    aiSubtitle.textContent = getModeSubtitle(mode);
  }
}

export function refreshAiPdfButtonState({ state, dom }) {
  const { aiDownloadPdfBtn } = dom;
  if (!aiDownloadPdfBtn) return;
  aiDownloadPdfBtn.disabled = !hasAnalysisText(state.latestAnalysisState.analysis);
}

export function applyLatestAnalysisState({ state, nextState, dom, getActiveMode }) {
  const activeMode = getActiveMode(state);
  const updated = {
    ...state,
    latestAnalysisState: {
      mode: nextState?.mode || activeMode,
      analysis: nextState?.analysis || '',
      meta: nextState?.meta || null,
      createdAt: nextState?.createdAt || null,
    },
  };

  if (dom.aiOutput) {
    dom.aiOutput.textContent = hasAnalysisText(updated.latestAnalysisState.analysis)
      ? updated.latestAnalysisState.analysis
      : 'Belum ada analisa.';
  }

  refreshAiPdfButtonState({ state: updated, dom });
  return updated;
}
