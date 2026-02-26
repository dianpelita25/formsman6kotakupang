import { normalizeUiError, requestJson } from '/forms-static/shared/ux.js';
import { collectFormData, focusFirstCheckboxByField, validateRequiredCheckboxGroups } from './form-validation.js';

export function bindFormSubmit({
  feedbackForm,
  submitBtn,
  setStatus,
  canSubmit,
  getActiveFields,
  setSubmitting,
  onAfterSubmit,
  onSubmitSuccess,
} = {}) {
  feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (typeof canSubmit === 'function' && !canSubmit()) {
      setStatus('Pertanyaan masih dimuat. Mohon tunggu beberapa detik.');
      return;
    }

    if (!feedbackForm.reportValidity()) {
      setStatus('Mohon lengkapi semua field wajib.', 'error');
      return;
    }

    const activeFields = getActiveFields();
    const missingCheckboxField = validateRequiredCheckboxGroups(activeFields, feedbackForm);
    if (missingCheckboxField) {
      focusFirstCheckboxByField(feedbackForm, missingCheckboxField.name);
      setStatus(`Mohon pilih minimal satu opsi untuk "${missingCheckboxField.label}".`, 'error');
      return;
    }

    submitBtn.disabled = true;
    if (typeof setSubmitting === 'function') setSubmitting(true);
    setStatus('Mengirim data...');

    try {
      const payload = collectFormData(feedbackForm, activeFields);
      const result = await requestJson('./api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const successMessage = result.message || 'Terima kasih, feedback berhasil dikirim.';
      setStatus(successMessage, 'success');
      feedbackForm.reset();
      if (typeof onAfterSubmit === 'function') onAfterSubmit();
      if (typeof onSubmitSuccess === 'function') onSubmitSuccess(successMessage);
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal mengirim feedback.');
      setStatus(normalized.message, 'error', error);
    } finally {
      submitBtn.disabled = false;
      if (typeof setSubmitting === 'function') setSubmitting(false);
    }
  });
}
