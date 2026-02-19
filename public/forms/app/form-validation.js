function escapeSelectorName(name) {
  if (window.CSS?.escape) return window.CSS.escape(name);
  return String(name || '').replace(/["\\]/g, '\\$&');
}

export function validateRequiredCheckboxGroups(fields, form) {
  const requiredCheckboxFields = (fields || []).filter((field) => field?.type === 'checkbox' && field?.required !== false);
  for (const field of requiredCheckboxFields) {
    const selector = `input[type="checkbox"][name="${escapeSelectorName(field.name)}"]:checked`;
    const checkedTotal = form.querySelectorAll(selector).length;
    if (checkedTotal > 0) continue;
    return field;
  }
  return null;
}

export function collectFormData(form, activeFields = []) {
  const data = new FormData(form);
  const output = {};
  const checkboxFieldNames = new Set(
    (activeFields || []).filter((field) => field?.type === 'checkbox').map((field) => field.name)
  );
  for (const [key, value] of data.entries()) {
    if (checkboxFieldNames.has(key)) {
      if (!Array.isArray(output[key])) output[key] = [];
      output[key].push(value);
      continue;
    }
    output[key] = value;
  }
  return output;
}

export function focusFirstCheckboxByField(form, fieldName) {
  const selector = `input[type="checkbox"][name="${escapeSelectorName(fieldName)}"]`;
  const firstCheckbox = form.querySelector(selector);
  if (firstCheckbox) firstCheckbox.focus();
}
