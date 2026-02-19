export function setDashboardLinkEnabled(viewDashboardBtn, enabled) {
  if (!viewDashboardBtn) return;

  viewDashboardBtn.classList.toggle('disabled', !enabled);
  if (enabled) {
    viewDashboardBtn.removeAttribute('aria-disabled');
  } else {
    viewDashboardBtn.setAttribute('aria-disabled', 'true');
  }
}

export function setStatus(statusMessage, message, type = '') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}
