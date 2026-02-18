import 'dotenv/config';
import { ensurePlatformSchema, LEGACY_SCHOOL_SLUG } from '../src/lib/db/bootstrap.js';
import { getSqlClient } from '../src/lib/db/sql.js';

async function main() {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
  };

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset.');
  }

  await ensurePlatformSchema(env, { forceFullBootstrap: true });
  const sql = getSqlClient(env);

  const [legacyTotal] = await sql`
    SELECT COUNT(*)::int AS total
    FROM form_responses;
  `.catch(() => [{ total: 0 }]);

  const [school] = await sql`
    SELECT id, slug
    FROM schools
    WHERE slug = ${LEGACY_SCHOOL_SLUG}
    LIMIT 1;
  `;

  const [newTotal] = school
    ? await sql`
        SELECT COUNT(*)::int AS total
        FROM responses
        WHERE school_id = ${school.id};
      `
    : [{ total: 0 }];

  const [nullSchoolAi] = await sql`
    SELECT COUNT(*)::int AS total
    FROM ai_analysis
    WHERE school_id IS NULL;
  `.catch(() => [{ total: 0 }]);

  const [tenantCount] = await sql`
    SELECT COUNT(*)::int AS total
    FROM tenants;
  `.catch(() => [{ total: 0 }]);

  const [schoolTenantCount] = await sql`
    SELECT COUNT(*)::int AS total
    FROM tenants
    WHERE tenant_type = 'school';
  `.catch(() => [{ total: 0 }]);

  const [schoolCount] = await sql`
    SELECT COUNT(*)::int AS total
    FROM schools;
  `.catch(() => [{ total: 0 }]);

  const [responsesV2Count] = await sql`
    SELECT COUNT(*)::int AS total
    FROM responses_v2
    WHERE tenant_id = ${school?.id || null};
  `.catch(() => [{ total: 0 }]);

  const [questionnaireVersionCount] = await sql`
    SELECT COUNT(*)::int AS total
    FROM questionnaire_versions
    WHERE legacy_form_version_id IS NOT NULL;
  `.catch(() => [{ total: 0 }]);

  const [formVersionCount] = await sql`
    SELECT COUNT(*)::int AS total
    FROM form_versions;
  `.catch(() => [{ total: 0 }]);

  const legacyCount = Number(legacyTotal?.total || 0);
  const migratedCount = Number(newTotal?.total || 0);
  const migratedV2Count = Number(responsesV2Count?.total || 0);
  const aiNullCount = Number(nullSchoolAi?.total || 0);
  const tenantsTotal = Number(tenantCount?.total || 0);
  const schoolTenantsTotal = Number(schoolTenantCount?.total || 0);
  const schoolsTotal = Number(schoolCount?.total || 0);
  const questionnaireVersionTotal = Number(questionnaireVersionCount?.total || 0);
  const formVersionTotal = Number(formVersionCount?.total || 0);
  const diff = migratedCount - legacyCount;
  const diffV2 = migratedV2Count - migratedCount;

  console.log('Migrasi schema multi-tenant selesai.');
  console.log(`Legacy rows (form_responses): ${legacyCount}`);
  console.log(`Rows di responses untuk ${LEGACY_SCHOOL_SLUG}: ${migratedCount}`);
  console.log(`Rows di responses_v2 untuk ${LEGACY_SCHOOL_SLUG}: ${migratedV2Count}`);
  console.log(`Diff rows: ${diff}`);
  console.log(`Diff rows responses -> responses_v2: ${diffV2}`);
  console.log(`ai_analysis rows tanpa school_id: ${aiNullCount}`);
  console.log(`Total schools: ${schoolsTotal}`);
  console.log(`Total tenants: ${tenantsTotal}`);
  console.log(`Total tenants type school: ${schoolTenantsTotal}`);
  console.log(`Total form_versions: ${formVersionTotal}`);
  console.log(`Total questionnaire_versions (legacy mapped): ${questionnaireVersionTotal}`);

  if (legacyCount !== migratedCount) {
    throw new Error(
      `Mismatch jumlah rows migrasi. legacy=${legacyCount}, migrated=${migratedCount}, diff=${diff}`
    );
  }

  if (aiNullCount !== 0) {
    throw new Error(`Masih ada ${aiNullCount} row ai_analysis tanpa school_id.`);
  }

  if (schoolsTotal !== schoolTenantsTotal) {
    throw new Error(
      `Mismatch schools vs tenants(type=school). schools=${schoolsTotal}, tenants_school=${schoolTenantsTotal}, tenants_total=${tenantsTotal}`
    );
  }

  if (formVersionTotal !== questionnaireVersionTotal) {
    throw new Error(
      `Mismatch form_versions vs questionnaire_versions (legacy mapped). form_versions=${formVersionTotal}, questionnaire_versions=${questionnaireVersionTotal}`
    );
  }

  if (migratedCount !== migratedV2Count) {
    throw new Error(
      `Mismatch responses vs responses_v2 untuk ${LEGACY_SCHOOL_SLUG}. responses=${migratedCount}, responses_v2=${migratedV2Count}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
