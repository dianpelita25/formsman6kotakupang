const formTitle = document.getElementById('form-title');
const greetingTitle = document.getElementById('greeting-title');
const greetingText = document.getElementById('greeting-text');
const fieldsContainer = document.getElementById('fields-container');
const feedbackForm = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const viewDashboardBtn = document.getElementById('view-dashboard-btn');
const statusMessage = document.getElementById('status-message');

function setDashboardLinkEnabled(enabled) {
  if (!viewDashboardBtn) return;

  viewDashboardBtn.classList.toggle('disabled', !enabled);
  if (enabled) {
    viewDashboardBtn.removeAttribute('aria-disabled');
  } else {
    viewDashboardBtn.setAttribute('aria-disabled', 'true');
  }
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
    {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  cards.forEach((card) => observer.observe(card));
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
  title.innerHTML = `${field.label}<span class="required">*</span>`;

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
  input.required = Boolean(field.required);

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

  field.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'radio-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = field.name;
    input.value = option;
    input.required = index === 0;

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
  left.textContent = field.fromLabel;

  const right = document.createElement('span');
  right.textContent = field.toLabel;

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
    input.required = value === 1;

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
  if (field.type === 'scale') return createScaleField(field, index);
  return document.createElement('div');
}

function collectFormData(form) {
  const data = new FormData(form);
  const output = {};

  for (const [key, value] of data.entries()) {
    output[key] = value;
  }

  return output;
}

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}

async function loadSchema() {
  const response = await fetch('./api/form-schema');
  if (!response.ok) throw new Error('Gagal memuat schema form.');

  const data = await response.json();

  formTitle.textContent = data.meta.title;
  greetingTitle.textContent = data.meta.greetingTitle;
  greetingText.textContent = data.meta.greetingText;

  data.fields.forEach((field, index) => {
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

  submitBtn.disabled = true;
  setStatus('Mengirim data...', '');

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
      setStatus(result.message || 'Gagal mengirim feedback.', 'error');
      setDashboardLinkEnabled(false);
      return;
    }

    setStatus('Terima kasih, feedback berhasil dikirim. Klik "Lihat Visual Dashboard" untuk melihat hasil terbaru.', 'success');
    setDashboardLinkEnabled(true);
    feedbackForm.reset();
  } catch (error) {
    setStatus(error.message || 'Terjadi kesalahan koneksi.', 'error');
    setDashboardLinkEnabled(false);
  } finally {
    submitBtn.disabled = false;
  }
});

loadSchema().catch((error) => {
  setStatus(error.message || 'Gagal memuat form.', 'error');
  setDashboardLinkEnabled(false);
});

setDashboardLinkEnabled(false);
