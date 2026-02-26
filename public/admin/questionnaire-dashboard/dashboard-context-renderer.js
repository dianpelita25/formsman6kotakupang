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
  kpiOpenedDevicesEl,
  kpiSubmittedEl,
  kpiOpenGapEl,
  formatNumber,
  formatDateTime,
  formatVersionShort,
} = {}) {
  function formatDataQualitySummary(dataQuality = null) {
    const quality = dataQuality && typeof dataQuality === 'object' ? dataQuality : null;
    if (!quality) return '-';
    const confidence = String(quality.confidence || 'low').trim().toUpperCase();
    const warnings = Array.isArray(quality.warnings) ? quality.warnings.length : 0;
    return `${confidence} (${warnings} peringatan)`;
  }

  function formatDataQualityWarnings(dataQuality = null) {
    const warnings = Array.isArray(dataQuality?.warnings) ? dataQuality.warnings : [];
    if (!warnings.length) return 'tanpa peringatan';
    const labelMap = {
      low_sample_size: 'sampel kecil',
      segment_filtered: 'filter segment aktif',
      date_range_narrow: 'rentang tanggal sempit',
      stale_last_submission: 'data tidak baru',
    };
    const labels = warnings.map((code) => labelMap[String(code || '').trim()] || String(code || '').trim()).filter(Boolean);
    return labels.length ? labels.join(', ') : 'tanpa peringatan';
  }

  function formatCriteriaContext(capabilities = null) {
    if (!capabilities || capabilities.totalQuestions <= 0) return 'belum ada pertanyaan.';
    if (!capabilities.hasCriteria) return 'tidak ada kriteria, gunakan mode per pertanyaan.';
    if (capabilities.criteriaMode === 'full') {
      return `lengkap (${capabilities.criteriaCount}/${capabilities.totalQuestions} soal).`;
    }
    return `campuran (${capabilities.criteriaCount}/${capabilities.totalQuestions} soal, ${capabilities.criteriaCoveragePercent}%).`;
  }

  function formatTrendContext(capabilities = null) {
    if (!capabilities) return '-';
    if (capabilities.trendRelevant) {
      return `aktif (${capabilities.trendActiveDays} hari berisi data).`;
    }
    return `disembunyikan otomatis (hanya ${capabilities.trendActiveDays} hari berisi data).`;
  }

  function formatSegmentContext(segmentSummary = null) {
    const dimensions = Array.isArray(segmentSummary?.dimensions) ? segmentSummary.dimensions : [];
    if (!dimensions.length) return 'tidak ada dimensi segmentasi aktif.';
    const totalBuckets = dimensions.reduce((sum, dimension) => {
      const buckets = Array.isArray(dimension?.buckets) ? dimension.buckets : [];
      return sum + buckets.length;
    }, 0);
    return `${dimensions.length} dimensi, ${totalBuckets} bucket terlihat.`;
  }

  function formatBenchmarkContext(capabilities = null, benchmarkSummary = null) {
    if (!capabilities?.hasBenchmark) {
      return 'butuh minimal 2 sekolah dengan kuesioner sama.';
    }
    const totalSchools = Number(benchmarkSummary?.totalSchools || 0);
    const schoolsWithResponses = Number(benchmarkSummary?.schoolsWithResponses || 0);
    return `${schoolsWithResponses}/${totalSchools} sekolah sudah punya respons.`;
  }

  function renderSummary() {
    const summary = state.summary || {};
    const openDeviceSummary =
      state.openDeviceSummary && typeof state.openDeviceSummary === 'object' ? state.openDeviceSummary : {};
    const openedDevices = Number(openDeviceSummary.uniqueOpenDevices || 0);
    const submitted = Number(openDeviceSummary.submitted || summary.totalResponses || 0);
    const gap = openedDevices - submitted;
    if (kpiTotalEl) kpiTotalEl.textContent = formatNumber(summary.totalResponses || 0);
    if (kpiTodayEl) kpiTodayEl.textContent = formatNumber(summary.responsesToday || 0);
    if (kpiScaleEl) kpiScaleEl.textContent = formatNumber(summary.avgScaleOverall || 0, 2);
    if (kpiLastEl) kpiLastEl.textContent = formatDateTime(summary.lastSubmittedAt);
    if (kpiOpenedDevicesEl) kpiOpenedDevicesEl.textContent = formatNumber(openedDevices);
    if (kpiSubmittedEl) kpiSubmittedEl.textContent = formatNumber(submitted);
    if (kpiOpenGapEl) kpiOpenGapEl.textContent = formatNumber(gap);
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
      contextNoteEl.textContent = 'Belum ada versi terpublikasi aktif. Publikasikan kuesioner dulu agar dashboard bisa membaca data.';
      return;
    }

    if (totalResponses === 0) {
      contextNoteEl.textContent =
        'Belum ada respons pada versi aktif ini. Jika Anda baru memublikasikan versi baru, data versi sebelumnya tidak otomatis digabung.';
      return;
    }
    const quality = state.summary?.dataQuality || state.dataQuality;
    const capabilities = state.analyticsCapabilities;
    contextNoteEl.textContent =
      `Dashboard ini membaca data spesifik untuk versi aktif (${formatVersionShort(versionId)}) | ` +
      `Kualitas data: ${formatDataQualitySummary(quality)} [${formatDataQualityWarnings(quality)}] | ` +
      `Kriteria: ${formatCriteriaContext(capabilities)} | ` +
      `Tren: ${formatTrendContext(capabilities)} | ` +
      `Segmentasi: ${formatSegmentContext(state.segmentSummary)} | ` +
      `Benchmark: ${formatBenchmarkContext(capabilities, state.benchmarkSummary)}`;
  }

  return {
    renderSummary,
    renderContextInfo,
  };
}
