const AI_MODE_LABELS = Object.freeze({
  internal: 'Internal',
  external_pemerintah: 'External Pemerintah',
  external_mitra: 'External Mitra',
  live_guru: 'Live Guru',
});

export function createAiRuntimeController({
  state,
  aiModeEl,
  aiOutputSummaryEl,
  aiOutputDetailsEl,
  aiOutputEl,
  aiLoadBtn,
  aiRunBtn,
  aiPdfBtn,
  aiProgressEl,
  aiProgressTitleEl,
  aiProgressElapsedEl,
  aiProgressNoteEl,
  filterFromEl,
  filterToEl,
  baseApiPath,
  api,
  runWithButtonLoading,
  setStatus,
  setError,
} = {}) {
  const aiProgressState = {
    startedAt: 0,
    timerId: null,
  };

  function getActiveMode() {
    return String(aiModeEl?.value || 'internal').trim();
  }

  function getModeLabel(mode) {
    return AI_MODE_LABELS[String(mode || '').trim()] || String(mode || 'Internal').trim();
  }

  function stripAiMarkup(text) {
    return String(text || '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function summarizeAiOutput(message) {
    const normalized = stripAiMarkup(message);
    if (!normalized) {
      return 'Belum ada analisis. Klik "Jalankan Analisis" untuk membuat ringkasan.';
    }
    if (normalized.length <= 260) return normalized;
    return `${normalized.slice(0, 257)}...`;
  }

  function setAiOutput(message, options = {}) {
    const { showDetails = true } = options || {};
    const normalized = String(message || '').trim();
    const finalText = normalized || 'Belum ada analisis.';
    const hasRealAnalysis = Boolean(normalized) && !normalized.toLowerCase().startsWith('belum ada analisis');

    if (!aiOutputEl) return;
    aiOutputEl.textContent = finalText;
    if (aiOutputSummaryEl) {
      aiOutputSummaryEl.textContent = summarizeAiOutput(finalText);
    }
    if (aiOutputDetailsEl) {
      aiOutputDetailsEl.hidden = !(showDetails && hasRealAnalysis);
      if (!showDetails || !hasRealAnalysis) {
        aiOutputDetailsEl.open = false;
      }
    }
  }

  function formatElapsedLabel(totalSeconds) {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    if (safeSeconds < 60) return `${safeSeconds} dtk`;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}m ${seconds} dtk`;
  }

  function resolveAiProgressNote(elapsedSeconds) {
    if (elapsedSeconds < 8) return 'Mengumpulkan respons sesuai mode dan filter...';
    if (elapsedSeconds < 18) return 'Menyusun ringkasan KPI dan temuan utama...';
    if (elapsedSeconds < 30) return 'Merapikan rekomendasi agar siap dibaca admin...';
    return 'Proses masih berjalan. Jika melewati 60 detik, cek koneksi lalu coba lagi.';
  }

  function setAiProgressVisibility(visible = false) {
    if (!aiProgressEl) return;
    aiProgressEl.hidden = !visible;
  }

  function stopAiProgressIndicator() {
    if (aiProgressState.timerId) {
      window.clearInterval(aiProgressState.timerId);
      aiProgressState.timerId = null;
    }
    aiProgressState.startedAt = 0;
    aiOutputEl?.removeAttribute('aria-busy');
    setAiProgressVisibility(false);
  }

  function updateAiProgressIndicator() {
    if (!aiProgressElapsedEl || !aiProgressNoteEl || !aiProgressState.startedAt) return;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - aiProgressState.startedAt) / 1000));
    aiProgressElapsedEl.textContent = `Berjalan ${formatElapsedLabel(elapsedSeconds)}`;
    aiProgressNoteEl.textContent = resolveAiProgressNote(elapsedSeconds);
  }

  function startAiProgressIndicator() {
    stopAiProgressIndicator();
    aiProgressState.startedAt = Date.now();
    aiOutputEl?.setAttribute('aria-busy', 'true');
    if (aiProgressTitleEl) {
      aiProgressTitleEl.textContent = `Menjalankan analisis ${getModeLabel(getActiveMode())}...`;
    }
    setAiProgressVisibility(true);
    updateAiProgressIndicator();
    aiProgressState.timerId = window.setInterval(updateAiProgressIndicator, 1000);
  }

  async function loadAiLatest() {
    stopAiProgressIndicator();
    const params = new URLSearchParams();
    params.set('mode', getActiveMode());
    if (state.questionnaireVersionId) params.set('questionnaireVersionId', state.questionnaireVersionId);
    const from = String(filterFromEl?.value || '').trim();
    const to = String(filterToEl?.value || '').trim();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const payload = await api(`${baseApiPath()}/ai/latest?${params.toString()}`, undefined, 'Gagal memuat analisis AI.');
    state.latestAi = payload.data || null;
    setAiOutput(payload.data?.analysis || 'Belum ada analisis untuk mode ini.');
    if (aiPdfBtn) aiPdfBtn.disabled = !String(payload.data?.analysis || '').trim();
  }

  async function runAiAnalysis() {
    await runWithButtonLoading(
      aiRunBtn,
      'Menganalisis...',
      async () => {
        const previousAnalysisText = String(state.latestAi?.analysis || '').trim();
        if (aiPdfBtn) aiPdfBtn.disabled = true;
        startAiProgressIndicator();
        setAiOutput('Sedang memproses analisis AI. Mohon tunggu...', { showDetails: false });
        setStatus('Analisis AI dimulai. Estimasi 10-45 detik.', 'warning');
        try {
          const payload = await api(
            `${baseApiPath()}/ai/analyze`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                mode: getActiveMode(),
                questionnaireVersionId: state.questionnaireVersionId || undefined,
                from: String(filterFromEl?.value || '').trim() || undefined,
                to: String(filterToEl?.value || '').trim() || undefined,
              }),
            },
            'Gagal menjalankan analisis AI.'
          );
          state.latestAi = payload.data || null;
          setAiOutput(payload.data?.analysis || 'Analisis kosong.');
          if (aiPdfBtn) aiPdfBtn.disabled = !String(payload.data?.analysis || '').trim();
          if (payload.data?.reused) {
            const remaining = Number(payload.data?.cooldownSeconds || 0);
            setStatus(`Analisis AI memakai hasil terbaru (cooldown ${remaining} detik).`, 'success');
          } else {
            setStatus('Analisis AI selesai diproses.', 'success');
          }
          setError(null);
        } catch (error) {
          if (previousAnalysisText) {
            setAiOutput(previousAnalysisText);
            if (aiPdfBtn) aiPdfBtn.disabled = false;
          } else {
            setAiOutput('Analisis gagal dijalankan. Periksa status error lalu coba lagi.');
            if (aiPdfBtn) aiPdfBtn.disabled = true;
          }
          throw error;
        } finally {
          stopAiProgressIndicator();
        }
      },
      [aiLoadBtn]
    );
  }

  return {
    getActiveMode,
    getModeLabel,
    setAiOutput,
    stopAiProgressIndicator,
    loadAiLatest,
    runAiAnalysis,
  };
}
