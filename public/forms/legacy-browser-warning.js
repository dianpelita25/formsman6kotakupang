(function () {
  var title = document.getElementById('form-title');
  if (title) {
    title.textContent = 'Form Feedback';
  }

  var greetingTitle = document.getElementById('greeting-title');
  if (greetingTitle && !String(greetingTitle.textContent || '').trim()) {
    greetingTitle.textContent = 'Salam Hormat,';
  }

  var statusMessage = document.getElementById('status-message');
  if (statusMessage) {
    statusMessage.className = 'status-message error';
    statusMessage.textContent =
      'Browser ini belum mendukung fitur form modern. Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.';
  }
})();
