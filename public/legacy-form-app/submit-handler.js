function collectFormData(form) {
  const data = new FormData(form);
  const output = {};
  for (const [key, value] of data.entries()) {
    output[key] = value;
  }
  return output;
}

export function attachSubmitHandler({ refs, setStatus, setDashboardLinkEnabled }) {
  const { feedbackForm, submitBtn, statusMessage, viewDashboardBtn } = refs;

  feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!feedbackForm.reportValidity()) {
      setStatus(statusMessage, 'Mohon lengkapi semua field wajib.', 'error');
      return;
    }

    submitBtn.disabled = true;
    setStatus(statusMessage, 'Mengirim data...', '');

    try {
      const payload = collectFormData(feedbackForm);
      const response = await fetch('./api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        setStatus(statusMessage, result.message || 'Gagal mengirim feedback.', 'error');
        setDashboardLinkEnabled(viewDashboardBtn, false);
        return;
      }

      setStatus(statusMessage, 'Terima kasih, feedback berhasil dikirim.', 'success');
      setDashboardLinkEnabled(viewDashboardBtn, true);
      feedbackForm.reset();
    } catch (error) {
      setStatus(statusMessage, error.message || 'Terjadi kesalahan koneksi.', 'error');
      setDashboardLinkEnabled(viewDashboardBtn, false);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
