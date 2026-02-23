import {
  createActionButton,
  createDynamicWrap,
  createSegmentRoleField,
  createTextInputField,
  createToggleField,
  createTypeField,
} from './question-card-dom.js';

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
  actions.append(
    createActionButton({ label: 'Naik', action: 'move-up', disabled: index === 0 }),
    createActionButton({ label: 'Turun', action: 'move-down', disabled: index === totalFields - 1 }),
    createActionButton({ label: 'Duplikat', action: 'duplicate' }),
    createActionButton({ label: 'Hapus', action: 'remove', className: 'secondary' })
  );
  topRow.append(title, actions);

  const keyRow = document.createElement('p');
  keyRow.className = 'small builder-question-key';
  keyRow.textContent = `Key: ${field.name} (otomatis)`;

  const editorGrid = document.createElement('div');
  editorGrid.className = 'builder-question-card__editor-grid';
  editorGrid.append(
    createToggleField({
      className: 'builder-required-toggle field--required',
      dataField: 'required',
      checked: field.required !== false,
      labelText: 'Wajib diisi',
    }),
    createTextInputField({
      className: 'field field-block field--label',
      labelText: 'Label Pertanyaan',
      dataField: 'label',
      value: field.label || '',
    }),
    createTypeField(field.type),
    createTextInputField({
      className: 'field field--criterion',
      labelText: 'Kriteria (opsional, disarankan)',
      dataField: 'criterion',
      value: field.criterion || '',
      placeholder: 'Contoh: A',
    }),
    createSegmentRoleField(
      field.type,
      String(field.segmentRole || 'auto').trim().toLowerCase() || 'auto'
    ),
    createTextInputField({
      className: 'field field--segment-label',
      labelText: 'Label Segmentasi (opsional)',
      dataField: 'segmentLabel',
      value: field.segmentLabel || '',
      maxLength: 64,
    }),
    createToggleField({
      className: 'builder-required-toggle field--sensitive',
      dataField: 'isSensitive',
      checked: field.isSensitive === true,
      labelText: 'Data sensitif (exclude dari segmentasi)',
    })
  );

  card.append(topRow, keyRow, editorGrid, createDynamicWrap(field));
  return card;
}
