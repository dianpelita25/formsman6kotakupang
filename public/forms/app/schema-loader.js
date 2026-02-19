import { requestJson } from '/forms-static/shared/ux.js';
import { renderFormFields } from './field-renderers.js';

export function getSchemaEndpoint() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 3) {
    return './api/schema';
  }
  return './api/form-schema';
}

export async function loadSchema({ formTitle, greetingTitle, greetingText, fieldsContainer, setActiveFields } = {}) {
  const data = await requestJson(getSchemaEndpoint());
  formTitle.textContent = data.meta?.title || 'Form Feedback';
  greetingTitle.textContent = data.meta?.greetingTitle || 'Salam Hormat,';
  greetingText.textContent = data.meta?.greetingText || '';

  const fields = Array.isArray(data.fields) ? data.fields : [];
  setActiveFields(fields);
  renderFormFields(fieldsContainer, fields);
}
