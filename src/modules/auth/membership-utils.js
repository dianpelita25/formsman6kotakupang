export function mapMemberships(rows) {
  return rows.map((row) => ({
    role: row.role,
    schoolId: row.school_id || null,
    schoolSlug: row.school_slug || null,
    schoolName: row.school_name || null,
    schoolActive: row.school_is_active ?? null,
  }));
}

export function mapTenantMemberships(rows) {
  return rows.map((row) => ({
    role: row.role,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    tenantType: row.tenant_type,
    tenantActive: row.tenant_is_active ?? null,
  }));
}

export function hasSuperadmin(memberships) {
  return memberships.some((membership) => membership.role === 'superadmin');
}

export function canAccessSchool(memberships, schoolId) {
  if (hasSuperadmin(memberships)) return true;
  return memberships.some((membership) => membership.role === 'school_admin' && membership.schoolId === schoolId);
}

export function hasTenantAccess(tenantMemberships, tenantId, allowedRoles = ['tenant_admin', 'analyst']) {
  return tenantMemberships.some(
    (membership) =>
      membership.tenantId === tenantId &&
      (membership.role === 'superadmin' || allowedRoles.includes(membership.role))
  );
}
