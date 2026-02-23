function createActionButton({ label, action, className = 'ghost', disabled = false }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.action = action;
  button.textContent = label;
  button.disabled = Boolean(disabled);
  return button;
}

function createToggleField({ className, dataField, checked, labelText }) {
  const wrapper = document.createElement('label');
  wrapper.className = className;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.field = dataField;
  input.checked = Boolean(checked);

  const label = document.createElement('span');
  label.textContent = labelText;
  wrapper.append(input, label);
  return wrapper;
}

function createTextInputField({
  className,
  labelText,
  dataField,
  value = '',
  placeholder = '',
  maxLength = null,
}) {
  const wrapper = document.createElement('label');
  wrapper.className = className;

  const label = document.createElement('span');
  label.textContent = labelText;

  const input = document.createElement('input');
  input.dataset.field = dataField;
  input.value = String(value || '');
  if (placeholder) input.placeholder = placeholder;
  if (typeof maxLength === 'number') input.maxLength = maxLength;

  wrapper.append(label, input);
  return wrapper;
}

function createTypeField(fieldType) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field field--type';

  const label = document.createElement('span');
  label.textContent = 'Tipe';

  const select = document.createElement('select');
  select.dataset.field = 'type';

  [
    { value: 'text', label: 'Teks bebas' },
    { value: 'radio', label: 'Pilihan tunggal' },
    { value: 'checkbox', label: 'Pilihan ganda (centang)' },
    { value: 'scale', label: 'Skala 1-5' },
  ].forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === fieldType;
    select.append(option);
  });

  const helper = document.createElement('small');
  helper.className = 'small builder-type-help';
  helper.textContent = 'Tipe menentukan field lanjutan: opsi atau label skala.';

  wrapper.append(label, select, helper);
  return wrapper;
}

function createSegmentRoleField(fieldType, segmentRoleValue) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field field--segment-role';

  const label = document.createElement('span');
  label.textContent = 'Peran Segmentasi';

  const select = document.createElement('select');
  select.dataset.field = 'segmentRole';

  const supportsForcedDimension = fieldType === 'radio' || fieldType === 'checkbox';
  [
    { value: 'auto', label: 'Auto', disabled: false },
    { value: 'dimension', label: 'Paksa Dimensi', disabled: !supportsForcedDimension },
    { value: 'exclude', label: 'Exclude', disabled: false },
  ].forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.disabled = item.disabled;
    option.selected = item.value === segmentRoleValue;
    select.append(option);
  });

  wrapper.append(label, select);
  return wrapper;
}

function createDynamicWrap(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'builder-question-card__dynamic';

  if (field.type === 'radio' || field.type === 'checkbox') {
    wrapper.append(
      createTextInputField({
        className: 'field field-block',
        labelText:
          field.type === 'checkbox'
            ? 'Opsi Pilihan Ganda (pisahkan koma)'
            : 'Opsi Pilihan (pisahkan koma)',
        dataField: 'options',
        value: (field.options || []).join(', '),
      })
    );
    return wrapper;
  }

  if (field.type === 'scale') {
    wrapper.append(
      createTextInputField({
        className: 'field',
        labelText: 'Label Skala Kiri',
        dataField: 'fromLabel',
        value: field.fromLabel || '',
      })
    );
    wrapper.append(
      createTextInputField({
        className: 'field',
        labelText: 'Label Skala Kanan',
        dataField: 'toLabel',
        value: field.toLabel || '',
      })
    );
  }

  return wrapper;
}

export {
  createActionButton,
  createDynamicWrap,
  createSegmentRoleField,
  createTextInputField,
  createToggleField,
  createTypeField,
};
