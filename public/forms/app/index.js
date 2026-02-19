import { bindRuntimeErrorHandlers, normalizeUiError } from '/forms-static/shared/ux.js';
import { createFormStatusController } from './status.js';
import { bindFormSubmit } from './form-submit.js';
import { loadSchema } from './schema-loader.js';

const formTitle = document.getElementById('form-title');
const greetingTitle = document.getElementById('greeting-title');
const greetingText = document.getElementById('greeting-text');
const fieldsContainer = document.getElementById('fields-container');
const feedbackForm = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMessage = document.getElementById('status-message');
const statusDebugWrap = document.getElementById('status-debug-wrap');
const statusDebug = document.getElementById('status-debug');

let activeFields = [];
const { setStatus } = createFormStatusController(statusMessage, statusDebugWrap, statusDebug);

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

bindFormSubmit({
  feedbackForm,
  submitBtn,
  setStatus,
  getActiveFields: () => activeFields,
});

loadSchema({
  formTitle,
  greetingTitle,
  greetingText,
  fieldsContainer,
  setActiveFields: (fields) => {
    activeFields = fields;
  },
}).catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat form.');
  setStatus(normalized.message, 'error', error);
});
