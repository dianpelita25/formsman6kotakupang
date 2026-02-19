import { upsertSchoolFromTenantRow, upsertTenantFromSchoolRow } from './repository.js';

export async function syncTenantFromSchool(env, school) {
  if (!school?.id) return;
  await upsertTenantFromSchoolRow(env, school);
}

export async function syncSchoolFromTenant(env, tenant) {
  if (!tenant?.id) return;
  if (String(tenant.tenant_type || tenant.tenantType || '').trim().toLowerCase() !== 'school') return;
  await upsertSchoolFromTenantRow(env, tenant);
}
