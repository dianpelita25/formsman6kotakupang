import { buildCriteriaSummary } from './criteria-aggregator.js';
import { parseChoiceValues, resolveVersionFields } from './field-parser.js';
import { buildSegmentSummary } from './segment-aggregator.js';

export { resolveVersionFields } from './field-parser.js';

export function computeDistribution(fields, responseRows) {
  const byQuestion = [];
  const questionAverages = {};
  const scaleAverages = [];
  let totalScaleAverage = 0;
  let totalScaleQuestions = 0;
  let totalChoiceAnswers = 0;
  let totalCheckboxAnswers = 0;
  let totalTextAnswers = 0;
  let totalQuestionsWithCriterion = 0;

  for (const field of fields) {
    if (field.criterion) totalQuestionsWithCriterion += 1;

    if (field.type === 'scale') {
      const counts = new Map([
        ['1', 0],
        ['2', 0],
        ['3', 0],
        ['4', 0],
        ['5', 0],
      ]);
      let total = 0;
      let sum = 0;

      responseRows.forEach((row) => {
        const value = row.answers?.[field.name];
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        if (parsed < 1 || parsed > 5) return;
        const key = String(parsed);
        counts.set(key, Number(counts.get(key) || 0) + 1);
        total += 1;
        sum += parsed;
      });

      const average = total > 0 ? sum / total : 0;
      questionAverages[field.name] = Number(average.toFixed(2));
      totalScaleAverage += average;
      totalScaleQuestions += 1;
      scaleAverages.push({
        name: field.name,
        label: field.label,
        questionCode: field.questionCode,
        criterion: field.criterion,
        average: Number(average.toFixed(2)),
        totalAnswered: total,
      });

      byQuestion.push({
        name: field.name,
        label: field.label,
        questionCode: field.questionCode,
        criterion: field.criterion,
        type: field.type,
        fromLabel: field.fromLabel || 'Rendah',
        toLabel: field.toLabel || 'Tinggi',
        totalAnswered: total,
        average: Number(average.toFixed(2)),
        counts: Array.from(counts.entries()).map(([label, totalValue]) => ({ label, total: totalValue })),
      });
      continue;
    }

    if (field.type === 'radio' || field.type === 'checkbox') {
      const allowedOptions = Array.isArray(field.options) ? field.options : [];
      const counts = new Map(allowedOptions.map((option) => [String(option), 0]));
      let totalAnswered = 0;
      let totalSelected = 0;

      responseRows.forEach((row) => {
        const values = parseChoiceValues(row.answers?.[field.name]);
        if (!values.length) return;
        totalAnswered += 1;
        values.forEach((value) => {
          if (!counts.has(value)) {
            counts.set(value, 0);
          }
          counts.set(value, Number(counts.get(value) || 0) + 1);
          totalSelected += 1;
        });
      });

      if (field.type === 'checkbox') {
        totalCheckboxAnswers += totalSelected;
      }
      totalChoiceAnswers += totalSelected;
      byQuestion.push({
        name: field.name,
        label: field.label,
        questionCode: field.questionCode,
        criterion: field.criterion,
        type: field.type,
        totalAnswered,
        totalSelected,
        counts: Array.from(counts.entries()).map(([label, totalValue]) => ({ label, total: totalValue })),
      });
      continue;
    }

    const samples = [];
    let total = 0;
    responseRows.forEach((row) => {
      const value = String(row.answers?.[field.name] || '').trim();
      if (!value) return;
      total += 1;
      if (samples.length < 5) samples.push(value);
    });
    totalTextAnswers += total;

    byQuestion.push({
      name: field.name,
      label: field.label,
      questionCode: field.questionCode,
      criterion: field.criterion,
      type: field.type,
      totalAnswered: total,
      samples,
    });
  }

  const criteriaSummary = buildCriteriaSummary(byQuestion);
  const segmentSummary = buildSegmentSummary(fields, responseRows, criteriaSummary);

  return {
    byQuestion,
    questionAverages,
    scaleAverages,
    criteriaSummary,
    segmentSummary,
    totalQuestionsWithCriterion,
    avgScaleOverall: totalScaleQuestions > 0 ? Number((totalScaleAverage / totalScaleQuestions).toFixed(2)) : 0,
    totalRadioAnswers: totalChoiceAnswers,
    totalChoiceAnswers,
    totalCheckboxAnswers,
    totalTextAnswers,
  };
}
