export const AI_MODES = Object.freeze({
  internal: 'internal',
  external_pemerintah: 'external_pemerintah',
  external_mitra: 'external_mitra',
  live_guru: 'live_guru',
});

function hasAnalysisText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createAiModule(config = {}) {
  const {
    apiBase,
    requestJson,
    normalizeError,
    setAiStatus,
    formatDateTime,
    dom,
  } = config;

  const {
    aiRunBtn,
    aiOutput,
    aiDownloadPdfBtn,
    aiSubtitle,
    aiGroupInternalBtn,
    aiGroupExternalBtn,
    aiGroupLiveBtn,
    aiExternalLabel,
    aiExternalAudienceSelect,
  } = dom;

  let activeAnalysisGroup = 'internal';
  let activeExternalAudience = 'pemerintah';
  let latestAnalysisState = {
    mode: 'internal',
    analysis: '',
    meta: null,
    createdAt: null,
  };

  function getActiveAnalysisMode() {
    if (activeAnalysisGroup === 'external') {
      return activeExternalAudience === 'mitra' ? AI_MODES.external_mitra : AI_MODES.external_pemerintah;
    }
    if (activeAnalysisGroup === 'live') return AI_MODES.live_guru;
    return AI_MODES.internal;
  }

  function getModeLabel(mode = getActiveAnalysisMode()) {
    if (mode === AI_MODES.external_pemerintah) return 'External - Pemerintah';
    if (mode === AI_MODES.external_mitra) return 'External - Mitra';
    if (mode === AI_MODES.live_guru) return 'Live Guru';
    return 'Internal';
  }

  function getModeSubtitle(mode = getActiveAnalysisMode()) {
    if (mode === AI_MODES.external_pemerintah) {
      return 'Laporan formal untuk Dinas/Pemda berbasis data terbaru.';
    }
    if (mode === AI_MODES.external_mitra) {
      return 'Memo business impact untuk mitra/sponsor/investor.';
    }
    if (mode === AI_MODES.live_guru) {
      return 'Ringkasan live untuk diproyeksikan di akhir kegiatan.';
    }
    return 'Ringkasan otomatis berbasis data untuk kebutuhan internal tim.';
  }

  function getModeCacheKey(mode = getActiveAnalysisMode()) {
    return `ai-latest-analysis-${mode}`;
  }

  function refreshModeControls() {
    const mode = getActiveAnalysisMode();
    aiGroupInternalBtn?.classList.toggle('active', activeAnalysisGroup === 'internal');
    aiGroupExternalBtn?.classList.toggle('active', activeAnalysisGroup === 'external');
    aiGroupLiveBtn?.classList.toggle('active', activeAnalysisGroup === 'live');

    if (aiExternalLabel) {
      aiExternalLabel.classList.toggle('is-hidden', activeAnalysisGroup !== 'external');
    }

    if (aiSubtitle) {
      aiSubtitle.textContent = getModeSubtitle(mode);
    }
  }

  function refreshAiPdfButtonState() {
    if (!aiDownloadPdfBtn) return;
    aiDownloadPdfBtn.disabled = !hasAnalysisText(latestAnalysisState.analysis);
  }

  function applyLatestAnalysisState(nextState) {
    const activeMode = getActiveAnalysisMode();
    latestAnalysisState = {
      mode: nextState?.mode || activeMode,
      analysis: nextState?.analysis || '',
      meta: nextState?.meta || null,
      createdAt: nextState?.createdAt || null,
    };

    if (aiOutput) {
      aiOutput.textContent = hasAnalysisText(latestAnalysisState.analysis)
        ? latestAnalysisState.analysis
        : 'Belum ada analisa.';
    }

    refreshAiPdfButtonState();
  }

  async function runAiAnalysis() {
    if (!aiRunBtn) return;

    const previousState = { ...latestAnalysisState };
    const activeMode = getActiveAnalysisMode();
    const modeLabel = getModeLabel(activeMode);
    aiRunBtn.disabled = true;
    if (aiDownloadPdfBtn) aiDownloadPdfBtn.disabled = true;
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

      applyLatestAnalysisState(payload);
      const analyzedAt = formatDateTime(payload?.createdAt);
      setAiStatus(`Analisa ${getModeLabel(payload?.mode || activeMode)} selesai. Tersimpan pada ${analyzedAt}.`);
      localStorage.setItem(getModeCacheKey(payload?.mode || activeMode), payload.analysis || '');
    } catch (error) {
      applyLatestAnalysisState(previousState);
      const normalized = normalizeError(error, 'Analisa gagal.');
      setAiStatus(normalized.message, true, error);
    } finally {
      aiRunBtn.disabled = false;
      refreshAiPdfButtonState();
    }
  }

  function switchAnalysisGroup(nextGroup) {
    activeAnalysisGroup = nextGroup;
    refreshModeControls();
    loadLatestAi();
  }

  async function loadLatestAi() {
    if (!aiOutput) return;
    const activeMode = getActiveAnalysisMode();
    const modeLabel = getModeLabel(activeMode);

    try {
      const payload = await requestJson(`${apiBase}/ai/latest?mode=${encodeURIComponent(activeMode)}`);
      applyLatestAnalysisState(payload);
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
      applyLatestAnalysisState({ mode: activeMode, analysis: cached, meta: null, createdAt: null });
      setAiStatus(`Menampilkan cache lokal untuk mode ${modeLabel}.`);
      return;
    }

    applyLatestAnalysisState({ mode: activeMode, analysis: '', meta: null, createdAt: null });
    setAiStatus(`Belum ada analisa ${modeLabel} tersimpan.`);
  }

  function init() {
    if (aiRunBtn) {
      aiRunBtn.addEventListener('click', runAiAnalysis);
    }
    if (aiGroupInternalBtn) {
      aiGroupInternalBtn.addEventListener('click', () => switchAnalysisGroup('internal'));
    }
    if (aiGroupExternalBtn) {
      aiGroupExternalBtn.addEventListener('click', () => switchAnalysisGroup('external'));
    }
    if (aiGroupLiveBtn) {
      aiGroupLiveBtn.addEventListener('click', () => switchAnalysisGroup('live'));
    }
    if (aiExternalAudienceSelect) {
      aiExternalAudienceSelect.addEventListener('change', (event) => {
        activeExternalAudience = event.target.value === 'mitra' ? 'mitra' : 'pemerintah';
        refreshModeControls();
        loadLatestAi();
      });
      aiExternalAudienceSelect.value = activeExternalAudience;
    }
    refreshModeControls();
    loadLatestAi();
  }

  return {
    init,
    getLatestAnalysisState: () => ({ ...latestAnalysisState }),
    getActiveAnalysisMode,
    getModeLabel,
    refreshAiPdfButtonState,
  };
}
