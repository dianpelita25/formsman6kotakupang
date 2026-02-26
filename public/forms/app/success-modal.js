function focusElement(element) {
  if (!element || typeof element.focus !== 'function') return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function createSubmitSuccessModal({ root, closeButton, messageNode } = {}) {
  if (!root || !closeButton || !messageNode) {
    return {
      open() {},
      close() {},
    };
  }

  const defaultMessage =
    String(messageNode.textContent || '').trim() || 'Terima kasih, jawaban Anda sudah masuk ke sistem.';
  const dismissTargets = Array.from(root.querySelectorAll('[data-submit-success-close]'));
  let isOpen = false;
  let lastFocusedElement = null;

  function onEscape(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  function open(message) {
    const nextMessage = String(message || '').trim() || defaultMessage;
    messageNode.textContent = nextMessage;

    if (isOpen) {
      focusElement(closeButton);
      return;
    }

    isOpen = true;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    document.body.classList.add('has-modal-open');
    window.addEventListener('keydown', onEscape);
    focusElement(closeButton);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    document.body.classList.remove('has-modal-open');
    window.removeEventListener('keydown', onEscape);
    focusElement(lastFocusedElement);
  }

  closeButton.addEventListener('click', close);
  for (const target of dismissTargets) {
    target.addEventListener('click', close);
  }

  return {
    open,
    close,
  };
}
