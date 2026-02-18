const schoolsList = document.getElementById('schools-list');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `status${isError ? ' error' : ' success'}`;
}

function renderSchoolOptions(memberships = []) {
  schoolsList.innerHTML = '';
  memberships.forEach((membership) => {
    if (membership.role !== 'school_admin' || !membership.schoolSlug) return;
    const link = document.createElement('a');
    link.className = 'ghost';
    link.style.padding = '10px 12px';
    link.style.textDecoration = 'none';
    link.href = `/forms/${membership.schoolSlug}/admin/`;
    link.textContent = `${membership.schoolName || membership.schoolSlug} (${membership.schoolSlug})`;
    schoolsList.append(link);
  });
}

function renderTenantOptions(memberships = []) {
  memberships.forEach((membership) => {
    if (!['tenant_admin', 'analyst'].includes(membership.role) || !membership.tenantSlug) return;
    const link = document.createElement('a');
    link.className = 'ghost';
    link.style.padding = '10px 12px';
    link.style.textDecoration = 'none';
    link.href = `/forms/${membership.tenantSlug}/admin/`;
    link.textContent = `${membership.tenantName || membership.tenantSlug} (${membership.tenantSlug})`;
    schoolsList.append(link);
  });
}

async function bootstrap() {
  setStatus('Memuat akses organisasi...');
  try {
    const response = await fetch('/forms/admin/api/me');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Gagal memuat user.');
    }

    if (payload.user?.isSuperadmin) {
      window.location.href = '/forms/admin/';
      return;
    }

    const schoolMemberships = (payload.memberships || []).filter((membership) => membership.role === 'school_admin' && membership.schoolSlug);
    const tenantMemberships = (payload.tenantMemberships || []).filter(
      (membership) => ['tenant_admin', 'analyst'].includes(membership.role) && membership.tenantSlug
    );
    const optionsTotal = schoolMemberships.length + tenantMemberships.length;

    if (!optionsTotal) {
      setStatus('Akun ini tidak memiliki akses organisasi.', true);
      return;
    }

    if (schoolMemberships.length === 1 && !tenantMemberships.length) {
      window.location.href = `/forms/${schoolMemberships[0].schoolSlug}/admin/`;
      return;
    }

    if (tenantMemberships.length === 1 && !schoolMemberships.length) {
      window.location.href = `/forms/${tenantMemberships[0].tenantSlug}/admin/`;
      return;
    }

    renderSchoolOptions(schoolMemberships);
    renderTenantOptions(tenantMemberships);
    setStatus(`Silakan pilih salah satu dari ${optionsTotal} organisasi.`);
  } catch (error) {
    setStatus(error.message || 'Gagal memuat daftar organisasi.', true);
  }
}

bootstrap();
