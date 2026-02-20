import { bindRuntimeErrorHandlers, normalizeUiError } from '/forms-static/shared/ux.js';
import { initThemeRuntime, mountThemeToggleSlots } from '/forms-static/shared/theme/theme-runtime.js';
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
const formProgress = document.getElementById('form-progress');
const mobileSubmitBar = document.getElementById('mobile-submit-bar');
const mobileSubmitProgress = document.getElementById('mobile-submit-progress');
const mobileSubmitBtn = document.getElementById('mobile-submit-btn');

let activeFields = [];
const { setStatus } = createFormStatusController(statusMessage, statusDebugWrap, statusDebug);
initThemeRuntime();
mountThemeToggleSlots('[data-theme-toggle]');
const mobileMediaQuery =
  typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 720px)') : null;

function escapeSelectorName(name) {
  if (window.CSS?.escape) return window.CSS.escape(name);
  return String(name || '').replace(/["\\]/g, '\\$&');
}

function isFieldAnswered(field, form) {
  const fieldName = String(field?.name || '').trim();
  if (!fieldName) return false;
  const selectorName = escapeSelectorName(fieldName);

  if (field.type === 'checkbox') {
    return form.querySelectorAll(`input[type="checkbox"][name="${selectorName}"]:checked`).length > 0;
  }

  if (field.type === 'radio' || field.type === 'scale') {
    return Boolean(form.querySelector(`input[type="radio"][name="${selectorName}"]:checked`));
  }

  if (field.type === 'text') {
    const input = form.querySelector(`[name="${selectorName}"]`);
    return Boolean(String(input?.value || '').trim());
  }

  return false;
}

function updateProgress() {
  const total = Array.isArray(activeFields) ? activeFields.length : 0;
  const answered = (Array.isArray(activeFields) ? activeFields : []).reduce((count, field) => {
    return count + (isFieldAnswered(field, feedbackForm) ? 1 : 0);
  }, 0);

  const progressLabel = `${answered}/${total} pertanyaan terisi`;
  if (formProgress) formProgress.textContent = progressLabel;
  if (mobileSubmitProgress) mobileSubmitProgress.textContent = `${answered}/${total} terisi`;
}

function syncMobileSubmitBarVisibility() {
  if (!mobileSubmitBar) return;
  const mobileActive = mobileMediaQuery ? mobileMediaQuery.matches : window.innerWidth <= 720;
  mobileSubmitBar.hidden = !mobileActive;
}

if (mobileSubmitBtn) {
  mobileSubmitBtn.addEventListener('click', () => {
    feedbackForm.requestSubmit();
  });
}

if (mobileMediaQuery && typeof mobileMediaQuery.addEventListener === 'function') {
  mobileMediaQuery.addEventListener('change', syncMobileSubmitBarVisibility);
}
window.addEventListener('resize', syncMobileSubmitBarVisibility, { passive: true });

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

bindFormSubmit({
  feedbackForm,
  submitBtn,
  setStatus,
  getActiveFields: () => activeFields,
  setSubmitting: (submitting) => {
    if (!mobileSubmitBtn) return;
    mobileSubmitBtn.disabled = Boolean(submitting);
    mobileSubmitBtn.textContent = submitting ? 'Mengirim...' : 'Kirim';
  },
  onAfterSubmit: updateProgress,
});

feedbackForm.addEventListener('input', updateProgress);
feedbackForm.addEventListener('change', updateProgress);

loadSchema({
  formTitle,
  greetingTitle,
  greetingText,
  fieldsContainer,
  setActiveFields: (fields) => {
    activeFields = fields;
    updateProgress();
  },
}).catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat form.');
  setStatus(normalized.message, 'error', error);
});

syncMobileSubmitBarVisibility();
updateProgress();
