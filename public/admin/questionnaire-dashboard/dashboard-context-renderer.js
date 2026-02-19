export function createDashboardContextRenderer({
  state,
  contextVersionEl,
  contextTotalQuestionsEl,
  contextQuestionTypesEl,
  contextNoteEl,
  kpiTotalEl,
  kpiTodayEl,
  kpiScaleEl,
  kpiLastEl,
  formatNumber,
  formatDateTime,
  formatVersionShort,
} = {}) {
  function renderSummary() {
    const summary = state.summary || {};
    if (kpiTotalEl) kpiTotalEl.textContent = formatNumber(summary.totalResponses || 0);
    if (kpiTodayEl) kpiTodayEl.textContent = formatNumber(summary.responsesToday || 0);
    if (kpiScaleEl) kpiScaleEl.textContent = formatNumber(summary.avgScaleOverall || 0, 2);
    if (kpiLastEl) kpiLastEl.textContent = formatDateTime(summary.lastSubmittedAt);
  }

  function renderContextInfo() {
    const stats = state.questionTypeStats;
    const versionId = String(state.questionnaireVersionId || '').trim();
    const selected = state.availableVersions.find((entry) => entry.id === versionId);
    if (contextVersionEl) {
      contextVersionEl.textContent = selected ? `v${selected.version} (${selected.status})` : formatVersionShort(versionId);
      contextVersionEl.title = versionId || 'Belum ada versi publish';
    }
    if (contextTotalQuestionsEl) contextTotalQuestionsEl.textContent = String(stats.total || 0);
    if (contextQuestionTypesEl) {
      contextQuestionTypesEl.textContent = `${stats.scale} / ${stats.radio} / ${stats.checkbox} / ${stats.text}`;
    }

    if (!contextNoteEl) return;
    const totalResponses = Number(state.summary?.totalResponses || 0);
    if (!versionId) {
      contextNoteEl.textContent = 'Belum ada versi publish aktif. Publish kuesioner dulu agar dashboard bisa membaca data.';
      return;
    }

    if (totalResponses === 0) {
      contextNoteEl.textContent =
        'Belum ada respons pada versi aktif ini. Jika Anda baru publish versi baru, data versi sebelumnya tidak otomatis digabung.';
      return;
    }

    contextNoteEl.textContent = `Dashboard ini membaca data spesifik untuk versi aktif (${formatVersionShort(versionId)}).`;
  }

  return {
    renderSummary,
    renderContextInfo,
  };
}
