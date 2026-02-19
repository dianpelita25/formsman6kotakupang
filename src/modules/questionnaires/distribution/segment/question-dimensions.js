import { buildRowScaleAverages } from './scale-metrics.js';
import { collectSegmentAnswerValues } from './string-utils.js';

export function buildQuestionSegmentDimensions(fields = [], responseRows = [], scaleNames = []) {
  const rows = Array.isArray(responseRows) ? responseRows : [];
  if (!rows.length) return [];

  const candidates = (Array.isArray(fields) ? fields : [])
    .filter((field) => {
      const type = String(field?.type || '').trim();
      const segmentRole = String(field?.segmentRole || 'auto')
        .trim()
        .toLowerCase();
      const isSensitive = field?.isSensitive === true;
      if (isSensitive || segmentRole === 'exclude') return false;

      if (segmentRole === 'dimension') {
        return type === 'radio' || type === 'checkbox';
      }

      return type === 'radio' || type === 'checkbox' || type === 'text';
    })
    .map((field, index) => ({ ...field, _index: index }));

  if (!candidates.length) return [];

  const rowScaleAverages = buildRowScaleAverages(rows, scaleNames);
  const dimensions = [];

  candidates.forEach((field) => {
    const valueMap = new Map();

    rows.forEach((row, rowIndex) => {
      const values = collectSegmentAnswerValues(field, row?.answers?.[field.name]);
      if (!values.length) return;
      const rowScaleAvg = rowScaleAverages[rowIndex];

      values.forEach((value) => {
        if (!valueMap.has(value)) {
          valueMap.set(value, {
            label: value,
            total: 0,
            totalScaleAnswered: 0,
            scaleWeightedSum: 0,
          });
        }

        const bucket = valueMap.get(value);
        bucket.total += 1;
        if (Number.isFinite(rowScaleAvg)) {
          bucket.totalScaleAnswered += 1;
          bucket.scaleWeightedSum += rowScaleAvg;
        }
      });
    });

    const entries = Array.from(valueMap.values());
    const uniqueCount = entries.length;
    if (uniqueCount < 2 || uniqueCount > 12) return;

    const answeredCount = entries.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    if (answeredCount < 2) return;

    // Free-text with very high uniqueness is likely essay content, not segmentation.
    if (String(field.type || '').trim() === 'text' && uniqueCount / Math.max(answeredCount, 1) > 0.6) return;

    const hasScaleSignal = entries.some((entry) => Number(entry.totalScaleAnswered || 0) > 0);
    const metric = hasScaleSignal ? 'avg_scale' : 'count';

    const buckets = entries
      .map((entry) => ({
        label: String(entry.label || '-'),
        total: Number(entry.total || 0),
        totalScaleAnswered: Number(entry.totalScaleAnswered || 0),
        avgScale:
          Number(entry.totalScaleAnswered || 0) > 0
            ? Number((entry.scaleWeightedSum / entry.totalScaleAnswered).toFixed(2))
            : 0,
      }))
      .sort((a, b) => {
        if (metric === 'avg_scale') {
          if (b.avgScale !== a.avgScale) return b.avgScale - a.avgScale;
          if (b.total !== a.total) return b.total - a.total;
        } else if (b.total !== a.total) {
          return b.total - a.total;
        }
        return a.label.localeCompare(b.label, 'id');
      });

    const questionCode = String(field.questionCode || '').trim();
    const labelText = String(field.segmentLabel || field.label || '').trim();
    const label = questionCode && labelText ? `${questionCode} - ${labelText}` : questionCode || labelText || field.name;
    dimensions.push({
      id: `question:${field.name}`,
      kind: 'question',
      label,
      key: field.name,
      questionCode,
      metric,
      drilldownEligible: true,
      buckets,
    });
  });

  return dimensions.sort((a, b) => {
    const aCoverage = (Array.isArray(a.buckets) ? a.buckets : []).reduce((sum, bucket) => sum + Number(bucket.total || 0), 0);
    const bCoverage = (Array.isArray(b.buckets) ? b.buckets : []).reduce((sum, bucket) => sum + Number(bucket.total || 0), 0);
    if (aCoverage !== bCoverage) return bCoverage - aCoverage;
    return String(a.label || '').localeCompare(String(b.label || ''), 'id');
  });
}
