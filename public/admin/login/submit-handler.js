import { normalizeUiError, requestJson } from '/forms-static/shared/ux.js';
import { resolvePostLoginTarget } from './redirect.js';

export function bindLoginSubmit({ loginForm, setStatus } = {}) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const role = String(document.getElementById('login-role').value || '').trim().toLowerCase();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setStatus('Memproses login...');

    try {
      const payload = await requestJson('/forms/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const postLogin = resolvePostLoginTarget(payload, role);
      if (!postLogin.ok) {
        await fetch('/forms/admin/api/logout', { method: 'POST' }).catch(() => {});
        throw new Error(postLogin.message);
      }

      setStatus('Login berhasil, mengarahkan...', 'success');
      window.location.href = postLogin.target;
    } catch (error) {
      const normalized = normalizeUiError(error, 'Login gagal.');
      setStatus(normalized.message, 'error', error);
    }
  });
}
