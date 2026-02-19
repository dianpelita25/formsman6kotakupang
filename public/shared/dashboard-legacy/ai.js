import { createAiActions } from './ai/actions.js';
import { AI_MODES, getActiveAnalysisMode, getModeLabel, getModeSubtitle } from './ai/modes.js';
import { createInitialAiState } from './ai/state.js';
import { applyLatestAnalysisState, refreshAiPdfButtonState, refreshModeControls } from './ai/ui.js';

export { AI_MODES };

export function createAiModule(config = {}) {
  const { apiBase, requestJson, normalizeError, setAiStatus, formatDateTime, dom } = config;
  const {
    aiRunBtn,
    aiOutput,
    aiGroupInternalBtn,
    aiGroupExternalBtn,
    aiGroupLiveBtn,
    aiExternalAudienceSelect,
  } = dom;

  let state = createInitialAiState();
  const getState = () => state;
  const setState = (nextState) => {
    state = nextState;
  };

  const refreshModes = () => refreshModeControls({ state, dom, getActiveMode: getActiveAnalysisMode, getModeSubtitle });
  const refreshPdfButton = () => refreshAiPdfButtonState({ state, dom });

  const actions = createAiActions({
    apiBase,
    requestJson,
    normalizeError,
    setAiStatus,
    formatDateTime,
    dom,
    getState,
    setState,
    getActiveMode: getActiveAnalysisMode,
    refreshModeControls: refreshModes,
    refreshAiPdfButtonState: refreshPdfButton,
  });

  const syncLatestAnalysisState = (nextState) => {
    state = applyLatestAnalysisState({
      state,
      nextState,
      dom,
      getActiveMode: getActiveAnalysisMode,
    });
    refreshPdfButton();
  };

  function init() {
    if (aiRunBtn) {
      aiRunBtn.addEventListener('click', actions.runAiAnalysis);
    }
    if (aiGroupInternalBtn) {
      aiGroupInternalBtn.addEventListener('click', () => actions.switchAnalysisGroup('internal'));
    }
    if (aiGroupExternalBtn) {
      aiGroupExternalBtn.addEventListener('click', () => actions.switchAnalysisGroup('external'));
    }
    if (aiGroupLiveBtn) {
      aiGroupLiveBtn.addEventListener('click', () => actions.switchAnalysisGroup('live'));
    }
    if (aiExternalAudienceSelect) {
      aiExternalAudienceSelect.addEventListener('change', (event) => {
        setState({
          ...state,
          activeExternalAudience: event.target.value === 'mitra' ? 'mitra' : 'pemerintah',
        });
        refreshModes();
        actions.loadLatestAi();
      });
      aiExternalAudienceSelect.value = state.activeExternalAudience;
    }

    syncLatestAnalysisState(state.latestAnalysisState);
    refreshModes();
    actions.loadLatestAi();
  }

  return {
    init,
    getLatestAnalysisState: () => ({ ...state.latestAnalysisState }),
    getActiveAnalysisMode: () => getActiveAnalysisMode(state),
    getModeLabel: (mode = getActiveAnalysisMode(state)) => getModeLabel(mode),
    refreshAiPdfButtonState: refreshPdfButton,
    setLatestAnalysisStateForTest: syncLatestAnalysisState,
  };
}
