export function createBuilderQuestionCard(field, index, totalFields) {
  const card = document.createElement('article');
  card.className = 'builder-question-card';
  card.dataset.index = String(index);

  const topRow = document.createElement('div');
  topRow.className = 'builder-question-card__top';

  const title = document.createElement('h3');
  title.textContent = `Pertanyaan ${index + 1}`;

  const actions = document.createElement('div');
  actions.className = 'builder-question-card__actions';
  actions.innerHTML = `
    <button type="button" class="ghost" data-action="move-up"${index === 0 ? ' disabled' : ''}>Naik</button>
    <button type="button" class="ghost" data-action="move-down"${index === totalFields - 1 ? ' disabled' : ''}>Turun</button>
    <button type="button" class="ghost" data-action="duplicate">Duplikat</button>
    <button type="button" class="secondary" data-action="remove">Hapus</button>
  `;
  topRow.append(title, actions);

  const keyRow = document.createElement('p');
  keyRow.className = 'small builder-question-key';
  keyRow.textContent = `Key: ${field.name} (otomatis)`;

  const requiredField = document.createElement('label');
  requiredField.className = 'builder-required-toggle';
  requiredField.innerHTML = `
    <input data-field="required" type="checkbox"${field.required === false ? '' : ' checked'} />
    <span>Wajib diisi</span>
  `;

  const labelField = document.createElement('label');
  labelField.className = 'field field-block';
  labelField.innerHTML = `
    <span>Label Pertanyaan</span>
    <input data-field="label" value="${field.label.replace(/"/g, '&quot;')}" />
  `;

  const typeField = document.createElement('label');
  typeField.className = 'field';
  typeField.innerHTML = `
    <span>Tipe</span>
    <select data-field="type">
      <option value="text"${field.type === 'text' ? ' selected' : ''}>Teks</option>
      <option value="radio"${field.type === 'radio' ? ' selected' : ''}>Pilihan Tunggal</option>
      <option value="checkbox"${field.type === 'checkbox' ? ' selected' : ''}>Pilihan Ganda (Centang)</option>
      <option value="scale"${field.type === 'scale' ? ' selected' : ''}>Skala 1-5</option>
    </select>
  `;

  const criterionField = document.createElement('label');
  criterionField.className = 'field';
  criterionField.innerHTML = `
    <span>Kriteria (opsional, disarankan)</span>
    <input data-field="criterion" value="${String(field.criterion || '').replace(/"/g, '&quot;')}" placeholder="Contoh: A" />
  `;

  const supportsForcedDimension = field.type === 'radio' || field.type === 'checkbox';
  const segmentRoleField = document.createElement('label');
  segmentRoleField.className = 'field';
  segmentRoleField.innerHTML = `
    <span>Peran Segmentasi</span>
    <select data-field="segmentRole">
      <option value="auto"${String(field.segmentRole || 'auto') === 'auto' ? ' selected' : ''}>Auto</option>
      <option value="dimension"${String(field.segmentRole || '') === 'dimension' ? ' selected' : ''}${
        supportsForcedDimension ? '' : ' disabled'
      }>Paksa Dimensi</option>
      <option value="exclude"${String(field.segmentRole || '') === 'exclude' ? ' selected' : ''}>Exclude</option>
    </select>
  `;

  const segmentLabelField = document.createElement('label');
  segmentLabelField.className = 'field';
  segmentLabelField.innerHTML = `
    <span>Label Segmentasi (opsional)</span>
    <input data-field="segmentLabel" maxlength="64" value="${String(field.segmentLabel || '').replace(/"/g, '&quot;')}" />
  `;

  const sensitiveField = document.createElement('label');
  sensitiveField.className = 'builder-required-toggle';
  sensitiveField.innerHTML = `
    <input data-field="isSensitive" type="checkbox"${field.isSensitive ? ' checked' : ''} />
    <span>Data sensitif (exclude dari segmentasi)</span>
  `;

  const dynamicWrap = document.createElement('div');
  dynamicWrap.className = 'builder-question-card__dynamic';
  if (field.type === 'radio' || field.type === 'checkbox') {
    dynamicWrap.innerHTML = `
      <label class="field field-block">
        <span>${field.type === 'checkbox' ? 'Opsi Pilihan Ganda (pisahkan koma)' : 'Opsi Pilihan (pisahkan koma)'}</span>
        <input data-field="options" value="${(field.options || []).join(', ').replace(/"/g, '&quot;')}" />
      </label>
    `;
  } else if (field.type === 'scale') {
    dynamicWrap.innerHTML = `
      <label class="field">
        <span>Label Skala Kiri</span>
        <input data-field="fromLabel" value="${String(field.fromLabel || '').replace(/"/g, '&quot;')}" />
      </label>
      <label class="field">
        <span>Label Skala Kanan</span>
        <input data-field="toLabel" value="${String(field.toLabel || '').replace(/"/g, '&quot;')}" />
      </label>
    `;
  }

  card.append(topRow, keyRow, requiredField, labelField, typeField, criterionField, segmentRoleField, segmentLabelField, sensitiveField, dynamicWrap);
  return card;
}
