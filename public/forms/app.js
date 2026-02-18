import {
  bindRuntimeErrorHandlers,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
} from '/forms-static/shared/ux.js';

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

function setDebug(error = null) {
  if (!statusDebugWrap || !statusDebug) return;
  if (!error) {
    statusDebugWrap.style.display = 'none';
    statusDebugWrap.open = false;
    statusDebug.textContent = 'Belum ada error.';
    return;
  }
  statusDebugWrap.style.display = 'block';
  statusDebugWrap.open = true;
  setErrorDebugPanel(statusDebug, error);
}

function setStatus(message, type = '', error = null) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
  setDebug(error);
}

function getSchemaEndpoint() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 3) {
    return './api/schema';
  }
  return './api/form-schema';
}

function createQuestionShell(field, index) {
  const wrapper = document.createElement('section');
  wrapper.className = 'question ai-card';

  const header = document.createElement('div');
  header.className = 'question-header';

  const badge = document.createElement('span');
  badge.className = 'question-kicker';
  badge.textContent = `AI Prompt ${index + 1}`;

  const title = document.createElement('div');
  title.className = 'question-title';
  title.innerHTML = `${field.label}${field.required !== false ? '<span class="required">*</span>' : ''}`;

  header.append(badge, title);
  wrapper.append(header);

  return wrapper;
}

function createTextField(field, index) {
  const wrapper = createQuestionShell(field, index);
  const label = document.createElement('label');
  label.className = 'sr-only';
  label.htmlFor = field.name;
  label.textContent = field.label;

  const input = document.createElement('input');
  input.type = 'text';
  input.name = field.name;
  input.id = field.name;
  input.required = field.required !== false;

  const body = document.createElement('div');
  body.className = 'question-body';
  body.append(label, input);
  wrapper.append(body);
  return wrapper;
}

function createRadioField(field, index) {
  const wrapper = createQuestionShell(field, index);
  const group = document.createElement('div');
  group.className = 'radio-group';

  (field.options || []).forEach((option, optionIndex) => {
    const label = document.createElement('label');
    label.className = 'radio-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = field.name;
    input.value = option;
    input.required = field.required !== false && optionIndex === 0;

    const span = document.createElement('span');
    span.textContent = option;

    label.append(input, span);
    group.append(label);
  });

  const body = document.createElement('div');
  body.className = 'question-body';
  body.append(group);
  wrapper.append(body);
  return wrapper;
}

function createCheckboxField(field, index) {
  const wrapper = createQuestionShell(field, index);
  const group = document.createElement('div');
  group.className = 'radio-group';

  (field.options || []).forEach((option) => {
    const label = document.createElement('label');
    label.className = 'radio-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = field.name;
    input.value = option;

    const span = document.createElement('span');
    span.textContent = option;

    label.append(input, span);
    group.append(label);
  });

  const body = document.createElement('div');
  body.className = 'question-body';
  body.append(group);
  wrapper.append(body);
  return wrapper;
}

function createScaleField(field, index) {
  const wrapper = createQuestionShell(field, index);
  const scaleWrap = document.createElement('div');
  scaleWrap.className = 'scale-wrap';

  const legend = document.createElement('div');
  legend.className = 'scale-legend';
  const left = document.createElement('span');
  left.textContent = field.fromLabel || 'Rendah';
  const right = document.createElement('span');
  right.textContent = field.toLabel || 'Tinggi';
  legend.append(left, right);

  const options = document.createElement('div');
  options.className = 'scale-options';
  [1, 2, 3, 4, 5].forEach((value) => {
    const label = document.createElement('label');
    label.className = 'scale-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = field.name;
    input.value = String(value);
    input.required = field.required !== false && value === 1;
    label.append(input, document.createTextNode(String(value)));
    options.append(label);
  });

  scaleWrap.append(legend, options);
  const body = document.createElement('div');
  body.className = 'question-body';
  body.append(scaleWrap);
  wrapper.append(body);
  return wrapper;
}

function renderField(field, index) {
  if (field.type === 'text') return createTextField(field, index);
  if (field.type === 'radio') return createRadioField(field, index);
  if (field.type === 'checkbox') return createCheckboxField(field, index);
  if (field.type === 'scale') return createScaleField(field, index);
  return document.createElement('div');
}

function escapeSelectorName(name) {
  if (window.CSS?.escape) return window.CSS.escape(name);
  return String(name || '').replace(/["\\]/g, '\\$&');
}

function validateRequiredCheckboxGroups(fields, form) {
  const requiredCheckboxFields = (fields || []).filter((field) => field?.type === 'checkbox' && field?.required !== false);
  for (const field of requiredCheckboxFields) {
    const selector = `input[type="checkbox"][name="${escapeSelectorName(field.name)}"]:checked`;
    const checkedTotal = form.querySelectorAll(selector).length;
    if (checkedTotal > 0) continue;
    return field;
  }
  return null;
}

function collectFormData(form) {
  const data = new FormData(form);
  const output = {};
  const checkboxFieldNames = new Set((activeFields || []).filter((field) => field?.type === 'checkbox').map((field) => field.name));
  for (const [key, value] of data.entries()) {
    if (checkboxFieldNames.has(key)) {
      if (!Array.isArray(output[key])) output[key] = [];
      output[key].push(value);
      continue;
    }
    output[key] = value;
  }
  return output;
}

function initCardReveal() {
  const cards = Array.from(document.querySelectorAll('.question.ai-card'));
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { root: null, threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );

  cards.forEach((card) => observer.observe(card));
}

async function loadSchema() {
  const data = await requestJson(getSchemaEndpoint());
  formTitle.textContent = data.meta?.title || 'Form Feedback';
  greetingTitle.textContent = data.meta?.greetingTitle || 'Salam Hormat,';
  greetingText.textContent = data.meta?.greetingText || '';

  const fields = Array.isArray(data.fields) ? data.fields : [];
  activeFields = fields;
  fieldsContainer.innerHTML = '';
  fields.forEach((field, index) => {
    fieldsContainer.append(renderField(field, index));
  });

  initCardReveal();
}

feedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!feedbackForm.reportValidity()) {
    setStatus('Mohon lengkapi semua field wajib.', 'error');
    return;
  }

  const missingCheckboxField = validateRequiredCheckboxGroups(activeFields, feedbackForm);
  if (missingCheckboxField) {
    const firstCheckbox = feedbackForm.querySelector(
      `input[type="checkbox"][name="${escapeSelectorName(missingCheckboxField.name)}"]`
    );
    if (firstCheckbox) firstCheckbox.focus();
    setStatus(`Mohon pilih minimal satu opsi untuk "${missingCheckboxField.label}".`, 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Mengirim data...');

  try {
    const payload = collectFormData(feedbackForm);
    const result = await requestJson('./api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setStatus(result.message || 'Terima kasih, feedback berhasil dikirim.', 'success');
    feedbackForm.reset();
  } catch (error) {
    const normalized = normalizeUiError(error, 'Gagal mengirim feedback.');
    setStatus(normalized.message, 'error', error);
  } finally {
    submitBtn.disabled = false;
  }
});

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

loadSchema().catch((error) => {
  const normalized = normalizeUiError(error, 'Gagal memuat form.');
  setStatus(normalized.message, 'error', error);
});
