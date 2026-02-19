export function hasAnalysisText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createInitialAiState() {
  return {
    activeAnalysisGroup: 'internal',
    activeExternalAudience: 'pemerintah',
    latestAnalysisState: {
      mode: 'internal',
      analysis: '',
      meta: null,
      createdAt: null,
    },
  };
}
