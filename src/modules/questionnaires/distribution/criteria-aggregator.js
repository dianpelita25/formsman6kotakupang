import { normalizeCriterion } from './field-parser.js';

function resolveCriterionBucket(criterion) {
  return normalizeCriterion(criterion) || 'Tanpa Kriteria';
}

export function buildCriteriaSummary(questions = []) {
  const criteriaMap = new Map();

  questions.forEach((question) => {
    const criterion = resolveCriterionBucket(question?.criterion);
    if (!criteriaMap.has(criterion)) {
      criteriaMap.set(criterion, {
        criterion,
        totalQuestions: 0,
        totalScaleQuestions: 0,
        totalScaleAnswered: 0,
        scaleWeightedSum: 0,
        questionCodes: [],
      });
    }

    const entry = criteriaMap.get(criterion);
    entry.totalQuestions += 1;
    if (question?.questionCode) entry.questionCodes.push(String(question.questionCode));

    if (question?.type === 'scale') {
      entry.totalScaleQuestions += 1;
      const totalAnswered = Number(question.totalAnswered || 0);
      const average = Number(question.average || 0);
      if (totalAnswered > 0 && Number.isFinite(average)) {
        entry.totalScaleAnswered += totalAnswered;
        entry.scaleWeightedSum += average * totalAnswered;
      }
    }
  });

  return Array.from(criteriaMap.values())
    .map((entry) => ({
      criterion: entry.criterion,
      totalQuestions: entry.totalQuestions,
      totalScaleQuestions: entry.totalScaleQuestions,
      totalScaleAnswered: entry.totalScaleAnswered,
      avgScale:
        entry.totalScaleAnswered > 0 ? Number((entry.scaleWeightedSum / entry.totalScaleAnswered).toFixed(2)) : 0,
      questionCodes: Array.from(new Set(entry.questionCodes)),
    }))
    .sort((a, b) => a.criterion.localeCompare(b.criterion, 'id'));
}
