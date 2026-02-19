export function createDashboardState() {
  const visualOrderDragState = {
    draggedKey: '',
    overKey: '',
  };

  const VISUAL_CARD_CONFIG = Object.freeze({
    scaleAverage: Object.freeze({
      cardId: 'card-scale-average',
      label: 'Rata-rata Pertanyaan Skala',
    }),
    radioDistribution: Object.freeze({
      cardId: 'card-radio-distribution',
      label: 'Pertanyaan Pilihan',
    }),
    trend: Object.freeze({
      cardId: 'card-trend',
      label: 'Tren Respons Harian',
    }),
    criteriaSummary: Object.freeze({
      cardId: 'card-criteria-summary',
      label: 'Analisis per Kriteria',
    }),
    advancedViz: Object.freeze({
      cardId: 'card-advanced-viz',
      label: 'Visual Lanjutan',
    }),
  });

  const VISUAL_CARD_KEYS = Object.keys(VISUAL_CARD_CONFIG);

  const VISUAL_PRESET_CONFIG = Object.freeze({
    full: Object.freeze({
      label: 'Lengkap',
      visibility: Object.freeze({
        scaleAverage: true,
        radioDistribution: true,
        trend: true,
        criteriaSummary: true,
        advancedViz: true,
      }),
      order: Object.freeze(['scaleAverage', 'radioDistribution', 'trend', 'criteriaSummary', 'advancedViz']),
      advancedVizMode: 'criteria',
    }),
    compact: Object.freeze({
      label: 'Ringkas',
      visibility: Object.freeze({
        scaleAverage: true,
        radioDistribution: false,
        trend: false,
        criteriaSummary: true,
        advancedViz: true,
      }),
      order: Object.freeze(['advancedViz', 'criteriaSummary', 'scaleAverage', 'radioDistribution', 'trend']),
      advancedVizMode: 'criteria',
    }),
    monitoring: Object.freeze({
      label: 'Monitoring Tren',
      visibility: Object.freeze({
        scaleAverage: false,
        radioDistribution: false,
        trend: true,
        criteriaSummary: true,
        advancedViz: true,
      }),
      order: Object.freeze(['trend', 'advancedViz', 'criteriaSummary', 'scaleAverage', 'radioDistribution']),
      advancedVizMode: 'period',
    }),
  });

  const state = {
    tenantSlug: '',
    questionnaireSlug: '',
    questionnaireVersionId: '',
    page: 1,
    pageSize: 20,
    totalResponses: 0,
    search: '',
    summary: null,
    distribution: null,
    trend: null,
    dataQuality: null,
    responses: [],
    latestAi: null,
    criteriaSummary: [],
    questionLookup: new Map(),
    selectedQuestionCode: '',
    radioQuestions: [],
    selectedRadioQuestion: '',
    advancedVizMode: 'criteria',
    segmentSummary: null,
    selectedSegmentDimension: '',
    selectedSegmentBucket: '',
    selectedSegmentCompareBuckets: [],
    activeSegmentFilter: {
      dimensionId: '',
      bucket: '',
    },
    segmentCompareResult: null,
    onSegmentBucketClick: null,
    visualCardVisibility: {},
    visualPreferencesStorageKey: '',
    visualVisibilityStorageKey: '',
    visualOrderStorageKey: '',
    visualCardOrder: [],
    availableVersions: [],
    selectedVersionId: '',
    questionTypeStats: {
      total: 0,
      scale: 0,
      radio: 0,
      checkbox: 0,
      text: 0,
    },
    charts: {
      scaleAverage: null,
      radioDistribution: null,
      trend: null,
      advancedViz: null,
    },
  };

  return {
    state,
    visualOrderDragState,
    VISUAL_CARD_CONFIG,
    VISUAL_CARD_KEYS,
    VISUAL_PRESET_CONFIG,
  };
}
