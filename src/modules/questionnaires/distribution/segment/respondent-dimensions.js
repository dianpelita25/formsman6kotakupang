import { buildRowScaleAverages } from './scale-metrics.js';
import { normalizeSegmentBucketValue, titleCaseSegmentKey } from './string-utils.js';

export function buildRespondentSegmentDimensions(responseRows = [], scaleNames = []) {
  const rows = Array.isArray(responseRows) ? responseRows : [];
  if (!rows.length) return [];

  const rowScaleAverages = buildRowScaleAverages(rows, scaleNames);
  const valueMaps = new Map();
  rows.forEach((row, rowIndex) => {
    const respondent = row?.respondent && typeof row.respondent === 'object' ? row.respondent : {};
    const rowScaleAvg = rowScaleAverages[rowIndex];
    Object.entries(respondent).forEach(([key, rawValue]) => {
      const normalizedValue = normalizeSegmentBucketValue(rawValue);
      if (!normalizedValue) return;
      if (!valueMaps.has(key)) valueMaps.set(key, new Map());
      const map = valueMaps.get(key);
      if (!map.has(normalizedValue)) {
        map.set(normalizedValue, {
          label: normalizedValue,
          total: 0,
          totalScaleAnswered: 0,
          scaleWeightedSum: 0,
        });
      }
      const bucket = map.get(normalizedValue);
      bucket.total += 1;
      if (Number.isFinite(rowScaleAvg)) {
        bucket.totalScaleAnswered += 1;
        bucket.scaleWeightedSum += rowScaleAvg;
      }
    });
  });

  const dimensions = [];
  valueMaps.forEach((valueMap, key) => {
    const entries = Array.from(valueMap.values()).map((entry) => ({
      label: String(entry.label || '-'),
      total: Number(entry.total || 0),
      totalScaleAnswered: Number(entry.totalScaleAnswered || 0),
      avgScale:
        Number(entry.totalScaleAnswered || 0) > 0
          ? Number((entry.scaleWeightedSum / entry.totalScaleAnswered).toFixed(2))
          : 0,
    }));
    const uniqueCount = entries.length;
    if (uniqueCount < 2 || uniqueCount > 12) return;

    const answeredCount = entries.reduce((sum, item) => sum + item.total, 0);
    if (answeredCount < 2) return;

    const metric = entries.some((entry) => Number(entry.totalScaleAnswered || 0) > 0) ? 'avg_scale' : 'count';
    const buckets = entries.sort((a, b) => {
      if (metric === 'avg_scale') {
        if (b.avgScale !== a.avgScale) return b.avgScale - a.avgScale;
        if (b.total !== a.total) return b.total - a.total;
      } else if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.label.localeCompare(b.label, 'id');
    });

    dimensions.push({
      id: `respondent:${key}`,
      kind: 'respondent',
      label: titleCaseSegmentKey(key),
      key,
      metric,
      drilldownEligible: true,
      buckets,
    });
  });

  return dimensions.sort((a, b) => {
    const aTop = Number(a.buckets?.[0]?.total || 0);
    const bTop = Number(b.buckets?.[0]?.total || 0);
    if (aTop !== bTop) return bTop - aTop;
    return String(a.label || '').localeCompare(String(b.label || ''), 'id');
  });
}
