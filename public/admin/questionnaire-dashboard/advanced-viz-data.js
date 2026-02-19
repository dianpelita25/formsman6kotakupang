export function normalizeCriterionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase() === 'tanpa kriteria') return 'Tanpa Kriteria';
  return raw.toLowerCase().startsWith('kriteria ') ? raw : `Kriteria ${raw}`;
}

export function buildCriteriaVizRows(criteriaSummary = []) {
  const rawItems = Array.isArray(criteriaSummary) ? criteriaSummary : [];
  if (!rawItems.length) return [];
  return rawItems
    .filter((item) => Number(item?.totalQuestions || 0) > 0)
    .map((item) => ({
      label: normalizeCriterionLabel(item.criterion),
      avgScale: Number(item.avgScale || 0),
      totalQuestions: Number(item.totalQuestions || 0),
      totalScaleQuestions: Number(item.totalScaleQuestions || 0),
      totalScaleAnswered: Number(item.totalScaleAnswered || 0),
    }))
    .sort((a, b) => b.avgScale - a.avgScale);
}

export function buildLikertTotals(questions = []) {
  const totals = [0, 0, 0, 0, 0];
  (Array.isArray(questions) ? questions : [])
    .filter((question) => question?.type === 'scale')
    .forEach((question) => {
      const counts = Array.isArray(question.counts) ? question.counts : [];
      counts.forEach((entry) => {
        const index = Number(entry?.label || 0) - 1;
        if (index < 0 || index > 4) return;
        totals[index] += Number(entry?.total || 0);
      });
    });
  const totalAnswers = totals.reduce((sum, value) => sum + value, 0);
  return { totals, totalAnswers };
}

export function buildWeeklyPattern(points = []) {
  const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const totals = new Array(7).fill(0);
  const samples = new Array(7).fill(0);

  (Array.isArray(points) ? points : []).forEach((point) => {
    const dayRaw = String(point?.day || '').trim();
    if (!dayRaw) return;
    const date = new Date(dayRaw);
    if (Number.isNaN(date.getTime())) return;
    const dayIndex = date.getDay();
    totals[dayIndex] += Number(point?.total || 0);
    samples[dayIndex] += 1;
  });

  const averages = order.map((dayIndex) => {
    if (samples[dayIndex] <= 0) return 0;
    return Number((totals[dayIndex] / samples[dayIndex]).toFixed(2));
  });
  const totalResponses = totals.reduce((sum, value) => sum + value, 0);
  return { labels, averages, totals, samples, order, totalResponses };
}

export function buildPeriodComparison(points = []) {
  const normalizedPoints = (Array.isArray(points) ? points : [])
    .map((point) => ({
      day: String(point?.day || '').trim(),
      total: Number(point?.total || 0),
    }))
    .filter((point) => point.day);

  if (normalizedPoints.length < 2) return null;

  const splitIndex = Math.floor(normalizedPoints.length / 2);
  const previousPoints = normalizedPoints.slice(0, splitIndex);
  const currentPoints = normalizedPoints.slice(splitIndex);
  if (!previousPoints.length || !currentPoints.length) return null;

  const sumTotals = (items) => items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const previousTotal = sumTotals(previousPoints);
  const currentTotal = sumTotals(currentPoints);
  const previousAvgDaily = previousPoints.length > 0 ? previousTotal / previousPoints.length : 0;
  const currentAvgDaily = currentPoints.length > 0 ? currentTotal / currentPoints.length : 0;
  const deltaTotal = currentTotal - previousTotal;
  const deltaPct = previousTotal > 0 ? (deltaTotal / previousTotal) * 100 : currentTotal > 0 ? 100 : 0;

  return {
    previousCount: previousPoints.length,
    currentCount: currentPoints.length,
    previousTotal,
    currentTotal,
    previousAvgDaily: Number(previousAvgDaily.toFixed(2)),
    currentAvgDaily: Number(currentAvgDaily.toFixed(2)),
    deltaTotal,
    deltaPct: Number(deltaPct.toFixed(2)),
  };
}

export function resolveSegmentDimensions(segmentSummary = null) {
  const dimensions = Array.isArray(segmentSummary?.dimensions) ? segmentSummary.dimensions : [];
  return dimensions
    .filter((dimension) => dimension && typeof dimension === 'object')
    .map((dimension) => ({
      ...dimension,
      id: String(dimension.id || '').trim(),
      label: String(dimension.label || 'Dimensi').trim() || 'Dimensi',
      kind: String(dimension.kind || '').trim(),
      metric: String(dimension.metric || '').trim(),
      buckets: Array.isArray(dimension.buckets) ? dimension.buckets : [],
    }))
    .filter((dimension) => dimension.id);
}

export function findSegmentDimensionById(segmentSummary = null, dimensionId = '') {
  const targetId = String(dimensionId || '').trim();
  if (!targetId) return null;
  return resolveSegmentDimensions(segmentSummary).find((dimension) => dimension.id === targetId) || null;
}

export function formatSegmentDimensionOptionLabel(dimension) {
  const kind = String(dimension?.kind || '').trim();
  const metric = String(dimension?.metric || '').trim();
  const kindLabel =
    kind === 'criteria'
      ? 'Kriteria'
      : kind === 'respondent'
        ? 'Profil'
        : kind === 'question'
          ? 'Pertanyaan'
          : kind === 'derived'
            ? 'Turunan'
            : 'Dimensi';
  const metricLabel = metric === 'avg_scale' ? 'rata-rata' : 'jumlah';
  return `${dimension.label} (${kindLabel} | ${metricLabel})`;
}
