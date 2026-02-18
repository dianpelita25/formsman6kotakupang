import {
  bindRuntimeErrorHandlers,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';

const loginForm = document.getElementById('login-form');
const statusEl = document.getElementById('status');
const errorDebugEl = document.getElementById('error-debug');

function setStatus(message, kind = 'info', error = null) {
  setInlineStatus(statusEl, message, kind);
  if (error) {
    setErrorDebugPanel(errorDebugEl, error);
  } else if (errorDebugEl) {
    errorDebugEl.textContent = 'Belum ada error.';
  }
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('redirect');
  if (!target) return '';
  if (!target.startsWith('/forms/')) return '';
  if (target.includes('//')) return '';
  return target;
}

function resolveTargetByRole(payload, role) {
  const memberships = Array.isArray(payload?.memberships) ? payload.memberships : [];
  const tenantMembershipsRaw = Array.isArray(payload?.tenantMemberships) ? payload.tenantMemberships : [];
  const isSuperadmin = memberships.some((membership) => membership.role === 'superadmin');
  const schoolMemberships = memberships.filter((membership) => membership.role === 'school_admin' && membership.schoolSlug);
  const tenantMemberships = tenantMembershipsRaw.filter(
    (membership) => ['tenant_admin', 'analyst'].includes(membership.role) && membership.tenantSlug
  );

  if (role === 'superadmin') {
    if (!isSuperadmin) {
      return { ok: false, message: 'Akun ini bukan superadmin. Pilih login Admin Organisasi.' };
    }
    return { ok: true, target: '/forms/admin/' };
  }

  if (role === 'admin') {
    if (schoolMemberships.length === 1) {
      return { ok: true, target: `/forms/${schoolMemberships[0].schoolSlug}/admin/` };
    }
    if (schoolMemberships.length > 1) {
      return { ok: true, target: '/forms/admin/select-school' };
    }
    if (tenantMemberships.length === 1) {
      return { ok: true, target: `/forms/${tenantMemberships[0].tenantSlug}/admin/` };
    }
    if (tenantMemberships.length > 1) {
      return { ok: true, target: '/forms/admin/select-school' };
    }
    return { ok: false, message: 'Akun ini tidak punya akses Admin Organisasi.' };
  }

  return { ok: false, message: 'Role login tidak valid.' };
}

function resolvePostLoginTarget(payload, role) {
  const byRole = resolveTargetByRole(payload, role);
  if (!byRole.ok) return byRole;
  return {
    ok: true,
    target: getRedirectTarget() || byRole.target,
  };
}

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

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
