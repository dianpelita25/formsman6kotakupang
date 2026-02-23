export function clearChildren(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  const { className = '', text = '', attrs = {} } = options;

  if (className) {
    element.className = className;
  }
  if (text !== '') {
    element.textContent = String(text);
  }

  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value == null) return;
    element.setAttribute(String(key), String(value));
  });

  return element;
}

export function appendTextNode(element, text) {
  if (!element) return null;
  const node = document.createTextNode(String(text ?? ''));
  element.append(node);
  return node;
}

export function appendCell(row, text, options = {}) {
  const tagName = String(options.tagName || 'td').toLowerCase();
  const cell = createElement(tagName, {
    className: options.className || '',
  });
  cell.textContent = String(text ?? '');
  row.append(cell);
  return cell;
}
