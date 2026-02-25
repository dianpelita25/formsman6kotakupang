import { requestJson } from '/forms-static/shared/ux.js';
import { renderFormFields } from './field-renderers.js';

const DEFAULT_FORM_TITLE = 'Form Feedback';
const DEFAULT_GREETING_TITLE = 'Salam Hormat,';
const DEFAULT_GREETING_TEXT = '';
const SCHEMA_TIMEOUT_MS = 9000;
const SCHEMA_RETRY_DELAYS_MS = [350, 900];

export function getSchemaEndpoint() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 3) {
    return './api/schema';
  }
  return './api/form-schema';
}

function setNodeText(node, value) {
  if (!node) return;
  node.textContent = String(value || '');
}

function normalizeMeta(data) {
  const meta = data && typeof data === 'object' ? data.meta : null;
  return meta && typeof meta === 'object' ? meta : {};
}

function applyMetaText(meta, { formTitle, greetingTitle, greetingText } = {}) {
  const title = String(meta.title || '').trim() || DEFAULT_FORM_TITLE;
  const greetingHeading = String(meta.greetingTitle || '').trim() || DEFAULT_GREETING_TITLE;
  const greetingBody = String(meta.greetingText || '');

  setNodeText(formTitle, title);
  setNodeText(greetingTitle, greetingHeading);
  setNodeText(greetingText, greetingBody);
}

function isRetriableSchemaError(error) {
  const status = Number((error && error.status) || 0);
  if (!status) return true;
  if (status === 429) return true;
  return status >= 500;
}

function wait(delayMs) {
  const normalized = Math.max(0, Number(delayMs) || 0);
  if (!normalized) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, normalized);
  });
}

async function fetchSchemaWithRetry(endpoint) {
  let lastError = null;
  const totalAttempts = SCHEMA_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    try {
      return await requestJson(endpoint, { timeoutMs: SCHEMA_TIMEOUT_MS });
    } catch (error) {
      lastError = error;
      const canRetry = attempt < totalAttempts - 1 && isRetriableSchemaError(error);
      if (!canRetry) break;
      await wait(SCHEMA_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

export function applySchemaFallbackMeta({ formTitle, greetingTitle, greetingText } = {}) {
  applyMetaText(
    {
      title: DEFAULT_FORM_TITLE,
      greetingTitle: DEFAULT_GREETING_TITLE,
      greetingText: DEFAULT_GREETING_TEXT,
    },
    {
      formTitle,
      greetingTitle,
      greetingText,
    }
  );
}

export async function loadSchema({ formTitle, greetingTitle, greetingText, fieldsContainer, setActiveFields } = {}) {
  const data = await fetchSchemaWithRetry(getSchemaEndpoint());
  const meta = normalizeMeta(data);
  applyMetaText(meta, { formTitle, greetingTitle, greetingText });

  const fields = Array.isArray(data.fields) ? data.fields : [];
  setActiveFields(fields);
  renderFormFields(fieldsContainer, fields);
}
