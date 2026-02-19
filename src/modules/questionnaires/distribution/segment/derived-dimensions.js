export function buildCriterionSegmentDimension(criteriaSummary = []) {
  const rows = Array.isArray(criteriaSummary) ? criteriaSummary : [];
  if (!rows.length) return null;
  const buckets = rows.map((row) => ({
    label: String(row.criterion || 'Tanpa Kriteria'),
    total: Number(row.totalScaleAnswered || 0),
    totalQuestions: Number(row.totalQuestions || 0),
    totalScaleQuestions: Number(row.totalScaleQuestions || 0),
    avgScale: Number(row.avgScale || 0),
  }));
  return {
    id: 'criteria',
    kind: 'criteria',
    label: 'Kriteria Soal',
    metric: 'avg_scale',
    buckets,
  };
}
