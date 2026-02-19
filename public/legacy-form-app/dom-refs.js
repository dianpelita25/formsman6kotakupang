export function getLegacyFormDomRefs() {
  return {
    formTitle: document.getElementById('form-title'),
    greetingTitle: document.getElementById('greeting-title'),
    greetingText: document.getElementById('greeting-text'),
    fieldsContainer: document.getElementById('fields-container'),
    feedbackForm: document.getElementById('feedback-form'),
    submitBtn: document.getElementById('submit-btn'),
    viewDashboardBtn: document.getElementById('view-dashboard-btn'),
    statusMessage: document.getElementById('status-message'),
  };
}
