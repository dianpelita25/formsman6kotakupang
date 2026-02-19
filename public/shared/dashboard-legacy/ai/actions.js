import { AI_MODES, getModeCacheKey, getModeLabel } from './modes.js';
import { applyLatestAnalysisState } from './ui.js';

export function createAiActions(config = {}) {
  const {
    apiBase,
    requestJson,
    normalizeError,
    setAiStatus,
    formatDateTime,
    dom,
    getState,
    setState,
    getActiveMode,
    refreshModeControls,
    refreshAiPdfButtonState,
  } = config;

  const { aiRunBtn, aiOutput } = dom;

  async function runAiAnalysis() {
    if (!aiRunBtn) return;

    const previousState = getState();
    const activeMode = getActiveMode(previousState);
    const modeLabel = getModeLabel(activeMode);
    aiRunBtn.disabled = true;
    if (dom.aiDownloadPdfBtn) dom.aiDownloadPdfBtn.disabled = true;
    setAiStatus(`Menjalankan analisa AI (${modeLabel})...`);
    if (aiOutput) aiOutput.textContent = 'Sedang memproses data...';

    try {
      const payload = await requestJson(`${apiBase}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: activeMode }),
      });

      const currentState = applyLatestAnalysisState({
        state: getState(),
        nextState: payload,
        dom,
        getActiveMode: getActiveMode,
      });
      setState(currentState);
      const analyzedAt = formatDateTime(payload?.createdAt);
      setAiStatus(`Analisa ${getModeLabel(payload?.mode || activeMode)} selesai. Tersimpan pada ${analyzedAt}.`);
      localStorage.setItem(getModeCacheKey(payload?.mode || activeMode), payload.analysis || '');
    } catch (error) {
      const restoredState = applyLatestAnalysisState({
        state: getState(),
        nextState: previousState.latestAnalysisState,
        dom,
        getActiveMode,
      });
      setState(restoredState);
      const normalized = normalizeError(error, 'Analisa gagal.');
      setAiStatus(normalized.message, true, error);
    } finally {
      aiRunBtn.disabled = false;
      refreshAiPdfButtonState();
    }
  }

  async function loadLatestAi() {
    if (!aiOutput) return;
    const state = getState();
    const activeMode = getActiveMode(state);
    const modeLabel = getModeLabel(activeMode);

    try {
      const payload = await requestJson(`${apiBase}/ai/latest?mode=${encodeURIComponent(activeMode)}`);
      const next = applyLatestAnalysisState({
        state: getState(),
        nextState: payload,
        dom,
        getActiveMode,
      });
      setState(next);
      if (payload?.analysis) {
        localStorage.setItem(getModeCacheKey(payload?.mode || activeMode), payload.analysis);
        setAiStatus(
          `Menampilkan analisa ${getModeLabel(payload?.mode || activeMode)} terakhir (${formatDateTime(payload?.createdAt)}).`
        );
      } else {
        setAiStatus(`Belum ada analisa ${modeLabel} tersimpan.`);
      }
      return;
    } catch (error) {
      const normalized = normalizeError(error, `Belum ada analisa ${modeLabel} tersimpan.`);
      if (normalized.status && normalized.status !== 404) {
        setAiStatus(normalized.message, true, error);
      }
    }

    let cached = localStorage.getItem(getModeCacheKey(activeMode));
    if (!cached && activeMode === AI_MODES.internal) {
      cached = localStorage.getItem('ai-latest-analysis');
    }
    if (cached) {
      const next = applyLatestAnalysisState({
        state: getState(),
        nextState: { mode: activeMode, analysis: cached, meta: null, createdAt: null },
        dom,
        getActiveMode,
      });
      setState(next);
      setAiStatus(`Menampilkan cache lokal untuk mode ${modeLabel}.`);
      return;
    }

    const next = applyLatestAnalysisState({
      state: getState(),
      nextState: { mode: activeMode, analysis: '', meta: null, createdAt: null },
      dom,
      getActiveMode,
    });
    setState(next);
    setAiStatus(`Belum ada analisa ${modeLabel} tersimpan.`);
  }

  function switchAnalysisGroup(nextGroup) {
    const state = getState();
    setState({
      ...state,
      activeAnalysisGroup: nextGroup,
    });
    refreshModeControls();
    loadLatestAi();
  }

  return {
    runAiAnalysis,
    loadLatestAi,
    switchAnalysisGroup,
  };
}
