export function parseChoiceValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const text = String(value || '').trim();
  if (!text) return [];
  return [text];
}

export function normalizeCriterion(rawValue) {
  const text = String(rawValue || '').trim();
  return text || null;
}

export function resolveQuestionCode(field, index) {
  const name = String(field?.name || '').trim();
  const match = name.match(/^q0*([1-9]\d*)$/i);
  if (match) {
    return `Q${Number(match[1])}`;
  }
  return `Q${index + 1}`;
}

export function toQuestionDescriptor(field, index) {
  return {
    ...field,
    questionCode: resolveQuestionCode(field, index),
    criterion: normalizeCriterion(field?.criterion),
  };
}

export function resolveVersionFields(version) {
  const fields = Array.isArray(version?.schema?.fields) ? version.schema.fields : [];
  return fields
    .filter((field) => field && typeof field === 'object' && typeof field.name === 'string')
    .map((field, index) => toQuestionDescriptor(field, index));
}

export function resolveScaleFieldNames(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .filter((field) => String(field?.type || '').trim() === 'scale')
    .map((field) => String(field?.name || '').trim())
    .filter((name) => name);
}
