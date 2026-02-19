export function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('redirect');
  if (!target) return '';
  if (!target.startsWith('/forms/')) return '';
  if (target.includes('//')) return '';
  return target;
}

export function resolveTargetByRole(payload, role) {
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

export function resolvePostLoginTarget(payload, role) {
  const byRole = resolveTargetByRole(payload, role);
  if (!byRole.ok) return byRole;
  return {
    ok: true,
    target: getRedirectTarget() || byRole.target,
  };
}
