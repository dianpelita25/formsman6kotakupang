export function normalizeQuestionCode(question, index = 0) {
  const existing = String(question?.questionCode || '').trim();
  if (existing) return existing;
  const name = String(question?.name || '').trim();
  const match = name.match(/^q0*([1-9]\d*)$/i);
  if (match) return `Q${Number(match[1])}`;
  return `Q${index + 1}`;
}

export function normalizeQuestionCriterion(question) {
  const criterion = String(question?.criterion || '').trim();
  return criterion || null;
}

export function buildScaleAveragesFallback(questionAverages = {}, allQuestions = []) {
  const scaleQuestions = Array.isArray(allQuestions) ? allQuestions.filter((question) => question.type === 'scale') : [];
  const questionMap = new Map(scaleQuestions.map((question, index) => [question.name, { ...question, _index: index }]));
  return Object.entries(questionAverages || {}).map(([name, average], index) => {
    const mapped = questionMap.get(name) || null;
    return {
      name,
      label: mapped?.label || name,
      questionCode: normalizeQuestionCode(mapped || { name }, mapped?._index ?? index),
      criterion: normalizeQuestionCriterion(mapped),
      average: Number(average || 0),
      totalAnswered: Number(mapped?.totalAnswered || 0),
    };
  });
}

export function buildQuestionLookup(allQuestions = []) {
  const lookup = new Map();
  allQuestions.forEach((question, index) => {
    const normalized = {
      ...question,
      questionCode: normalizeQuestionCode(question, index),
      criterion: normalizeQuestionCriterion(question),
    };
    lookup.set(normalized.name, normalized);
    lookup.set(normalized.questionCode.toUpperCase(), normalized);
  });
  return lookup;
}
