function createQuestionShell(field, index) {
  const wrapper = document.createElement('section');
  wrapper.className = 'question ai-card';

  const header = document.createElement('div');
  header.className = 'question-header';

  const badge = document.createElement('span');
  badge.className = 'question-kicker';
  badge.textContent = `Pertanyaan ${index + 1}`;

  const title = document.createElement('div');
  title.className = 'question-title';
  title.textContent = String(field.label || '');
  if (field.required !== false) {
    const requiredMark = document.createElement('span');
    requiredMark.className = 'required';
    requiredMark.textContent = '*';
    title.append(requiredMark);
  }

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

export function renderField(field, index) {
  if (field.type === 'text') return createTextField(field, index);
  if (field.type === 'radio') return createRadioField(field, index);
  if (field.type === 'checkbox') return createCheckboxField(field, index);
  if (field.type === 'scale') return createScaleField(field, index);
  return document.createElement('div');
}

export function initCardReveal() {
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

export function renderFormFields(fieldsContainer, fields = []) {
  fieldsContainer.innerHTML = '';
  fields.forEach((field, index) => {
    fieldsContainer.append(renderField(field, index));
  });
  initCardReveal();
}
