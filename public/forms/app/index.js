import { bindRuntimeErrorHandlers, normalizeUiError } from '/forms-static/shared/ux.js';
import { initThemeRuntime, mountThemeToggleSlots } from '/forms-static/shared/theme/theme-runtime.js';
import { createFormStatusController } from './status.js';
import { bindFormSubmit } from './form-submit.js';
import { applySchemaFallbackMeta, loadSchema } from './schema-loader.js';
import { createSubmitSuccessModal } from './success-modal.js';
import { createFormViewState } from './view-state.js';

const formTitle = document.getElementById('form-title');
const greetingTitle = document.getElementById('greeting-title');
const greetingText = document.getElementById('greeting-text');
const fieldsContainer = document.getElementById('fields-container');
const formLoadingNote = document.getElementById('form-loading-note');
const feedbackForm = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMessage = document.getElementById('status-message');
const statusDebugWrap = document.getElementById('status-debug-wrap');
const statusDebug = document.getElementById('status-debug');
const formProgress = document.getElementById('form-progress');
const mobileSubmitBar = document.getElementById('mobile-submit-bar');
const mobileSubmitProgress = document.getElementById('mobile-submit-progress');
const mobileSubmitBtn = document.getElementById('mobile-submit-btn');
const publicDashboardLink = document.getElementById('public-dashboard-link');
const submitSuccessModalRoot = document.getElementById('submit-success-modal');
const submitSuccessModalCloseBtn = document.getElementById('submit-success-close-btn');
const submitSuccessModalMessage = document.getElementById('submit-success-message');

let activeFields = [];
let schemaReady = false;
let submitting = false;
const { setStatus } = createFormStatusController(statusMessage, statusDebugWrap, statusDebug);
const submitSuccessModal = createSubmitSuccessModal({
  root: submitSuccessModalRoot,
  closeButton: submitSuccessModalCloseBtn,
  messageNode: submitSuccessModalMessage,
});
const viewState = createFormViewState({
  feedbackForm,
  submitBtn,
  mobileSubmitBtn,
  formProgress,
  mobileSubmitProgress,
  formLoadingNote,
});
initThemeRuntime();
mountThemeToggleSlots('[data-theme-toggle]');
const mobileMediaQuery =
  typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 720px)') : null;
let resizeGuardTimer = 0;

function resolvePublicDashboardPath() {
  const parts = String(window.location.pathname || '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 3) return '';
  if (parts[0] !== 'forms') return '';
  const tenantSlug = String(parts[1] || '').trim();
  const questionnaireSlug = String(parts[2] || '').trim();
  if (!tenantSlug || !questionnaireSlug) return '';
  if (tenantSlug === 'admin' || tenantSlug === 'api') return '';
  if (questionnaireSlug === 'api' || questionnaireSlug === 'admin') return '';
  return `/forms/${tenantSlug}/${questionnaireSlug}/dashboard/`;
}

function updateProgress() {
  viewState.updateProgress({ schemaReady, activeFields });
}

function syncSubmitControls() {
  viewState.syncSubmitControls({ schemaReady, activeFields, submitting });
}

function syncMobileSubmitBarVisibility() {
  if (!mobileSubmitBar) return;
  const mobileActive = mobileMediaQuery ? mobileMediaQuery.matches : window.innerWidth <= 720;
  mobileSubmitBar.hidden = !mobileActive;
}

function markViewportResizing() {
  document.documentElement.dataset.viewportResizing = 'true';
  if (resizeGuardTimer) window.clearTimeout(resizeGuardTimer);
  resizeGuardTimer = window.setTimeout(() => {
    delete document.documentElement.dataset.viewportResizing;
    resizeGuardTimer = 0;
  }, 180);
}

if (mobileSubmitBtn) {
  mobileSubmitBtn.addEventListener('click', () => {
    if (!schemaReady) {
      setStatus('Pertanyaan masih dimuat. Mohon tunggu sebentar.');
      return;
    }
    if (typeof feedbackForm.requestSubmit === 'function') {
      feedbackForm.requestSubmit();
      return;
    }
    // Fallback for older mobile browsers that do not support requestSubmit().
    if (submitBtn && typeof submitBtn.click === 'function') {
      submitBtn.click();
      return;
    }
    feedbackForm.submit();
  });
}

if (mobileMediaQuery && typeof mobileMediaQuery.addEventListener === 'function') {
  mobileMediaQuery.addEventListener('change', syncMobileSubmitBarVisibility);
}
window.addEventListener('resize', syncMobileSubmitBarVisibility, { passive: true });
window.addEventListener(
  'resize',
  () => {
    markViewportResizing();
  },
  { passive: true }
);

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

bindFormSubmit({
  feedbackForm,
  submitBtn,
  setStatus,
  canSubmit: () => schemaReady && activeFields.length > 0,
  getActiveFields: () => activeFields,
  setSubmitting: (isSubmitting) => {
    submitting = Boolean(isSubmitting);
    syncSubmitControls();
  },
  onAfterSubmit: updateProgress,
  onSubmitSuccess: (message) => {
    submitSuccessModal.open(message);
  },
});

feedbackForm.addEventListener('input', updateProgress);
feedbackForm.addEventListener('change', updateProgress);

loadSchema({
  formTitle,
  greetingTitle,
  greetingText,
  fieldsContainer,
  setActiveFields: (fields) => {
    activeFields = Array.isArray(fields) ? fields : [];
    syncSubmitControls();
  },
})
  .then(() => {
    schemaReady = true;
    viewState.setLoadingNote('', false);
    syncSubmitControls();
    updateProgress();
  })
  .catch((error) => {
    applySchemaFallbackMeta({
      formTitle,
      greetingTitle,
      greetingText,
    });
    schemaReady = false;
    activeFields = [];
    viewState.setLoadingNote('Form belum siap dimuat. Coba muat ulang halaman ini.', true);
    syncSubmitControls();
    updateProgress();
    const normalized = normalizeUiError(error, 'Gagal memuat form.');
    setStatus(normalized.message, 'error', error);
  });

if (publicDashboardLink) {
  const dashboardPath = resolvePublicDashboardPath();
  if (dashboardPath) {
    publicDashboardLink.href = dashboardPath;
    publicDashboardLink.hidden = false;
  } else {
    publicDashboardLink.hidden = true;
  }
}

syncMobileSubmitBarVisibility();
viewState.setLoadingNote('Memuat pertanyaan...', true);
syncSubmitControls();
updateProgress();
