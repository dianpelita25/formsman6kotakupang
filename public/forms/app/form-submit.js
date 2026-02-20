import { normalizeUiError, requestJson } from '/forms-static/shared/ux.js';
import { collectFormData, focusFirstCheckboxByField, validateRequiredCheckboxGroups } from './form-validation.js';

export function bindFormSubmit({ feedbackForm, submitBtn, setStatus, getActiveFields, setSubmitting, onAfterSubmit } = {}) {
  feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();

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
      setStatus(result.message || 'Terima kasih, feedback berhasil dikirim.', 'success');
      feedbackForm.reset();
      if (typeof onAfterSubmit === 'function') onAfterSubmit();
    } catch (error) {
      const normalized = normalizeUiError(error, 'Gagal mengirim feedback.');
      setStatus(normalized.message, 'error', error);
    } finally {
      submitBtn.disabled = false;
      if (typeof setSubmitting === 'function') setSubmitting(false);
    }
  });
}
