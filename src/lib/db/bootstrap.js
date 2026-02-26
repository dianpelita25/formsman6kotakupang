import { getSqlClient } from './sql.js';
import {
  DEFAULT_QUESTIONNAIRE_NAME,
  DEFAULT_QUESTIONNAIRE_SLUG,
  DEFAULT_TENANT_TYPE,
  LEGACY_REDIRECT_PREFIX,
  LEGACY_SCHOOL_SLUG,
  REQUIRED_RUNTIME_TABLES,
} from './bootstrap/constants.js';
import { ensureDraftVersion, ensureLegacySchool, ensurePublishedVersion, migrateLegacyAiRows, migrateLegacyResponses } from './bootstrap/legacy-sync.js';
import { resolveBootstrapMode } from './bootstrap/mode.js';
import {
  syncAiAnalysisV2FromLegacy,
  syncQuestionnairesFromFormVersions,
  syncResponsesV2FromResponses,
  syncTenantMembershipsFromSchoolMemberships,
  syncTenantsFromSchools,
} from './bootstrap/questionnaire-sync.js';
import {
  createAiIndexes,
  createFormOpenDeviceIndexes,
  createFormVersionLookupIndex,
  createFormVersionStatusUniqueIndexes,
  createMembershipIndexes,
  createLoginThrottleIndexes,
  createPromptIndexes,
  createQuestionnaireLegacyVersionIndex,
  createQuestionnaireLookupIndexes,
  createQuestionnaireStatusUniqueIndexes,
  createResponseIndexes,
  createSessionIndex,
  createSuperadminMembershipIndex,
} from './bootstrap/schema-indexes.js';
import { createFormQuestionnaireTables, createIdentityTables, createPromptTables, createResponseTables, createSessionAndAiTables } from './bootstrap/schema-ddl.js';
import {
  dedupeSuperadminMemberships,
  normalizeFormVersionStatuses,
  normalizeQuestionnaireVersionStatuses,
} from './bootstrap/schema-normalizers.js';
import { ensureDefaultAiPromptVersions, ensureDefaultAiPromptVersionsV2, syncTenantPromptOverridesFromLegacy } from './bootstrap/prompt-seed.js';

const schemaPromisesByMode = new Map();

export {
  LEGACY_SCHOOL_SLUG,
  LEGACY_REDIRECT_PREFIX,
  DEFAULT_TENANT_TYPE,
  DEFAULT_QUESTIONNAIRE_SLUG,
  DEFAULT_QUESTIONNAIRE_NAME,
};

export { ensurePublishedVersion, ensureDraftVersion };

export async function ensurePlatformSchema(env, options = {}) {
  const mode = resolveBootstrapMode(env, options);
  const existingPromise = schemaPromisesByMode.get(mode);
  if (existingPromise) {
    return existingPromise;
  }

  const promise =
    mode === 'full'
      ? initializeSchema(env)
      : verifySchemaReady(env).catch((error) => {
          throw new Error(error?.message || 'Schema belum siap. Jalankan pnpm migrate:multi');
        });

  schemaPromisesByMode.set(
    mode,
    promise.catch((error) => {
      schemaPromisesByMode.delete(mode);
      throw error;
    })
  );
  return schemaPromisesByMode.get(mode);
}

async function verifySchemaReady(env) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${REQUIRED_RUNTIME_TABLES});
  `;

  const available = new Set(rows.map((row) => row.table_name));
  const missing = REQUIRED_RUNTIME_TABLES.filter((tableName) => !available.has(tableName));
  if (missing.length) {
    throw new Error(`Schema belum lengkap. Tabel hilang: ${missing.join(', ')}. Jalankan pnpm migrate:multi`);
  }
}

async function initializeSchema(env) {
  const sql = getSqlClient(env);

  await createIdentityTables(sql);
  await createMembershipIndexes(sql);
  await dedupeSuperadminMemberships(sql);
  await createSuperadminMembershipIndex(sql);

  await createFormQuestionnaireTables(sql);
  await createQuestionnaireLegacyVersionIndex(sql);
  await createFormVersionLookupIndex(sql);
  await normalizeFormVersionStatuses(sql);
  await createFormVersionStatusUniqueIndexes(sql);
  await createQuestionnaireLookupIndexes(sql);
  await normalizeQuestionnaireVersionStatuses(sql);
  await createQuestionnaireStatusUniqueIndexes(sql);

  await createResponseTables(sql);
  await createResponseIndexes(sql);
  await createFormOpenDeviceIndexes(sql);

  await createSessionAndAiTables(sql);
  await createSessionIndex(sql);
  await createLoginThrottleIndexes(sql);
  await createAiIndexes(sql);

  await createPromptTables(sql);
  await createPromptIndexes(sql);

  const legacySchool = await ensureLegacySchool(sql);
  const publishedVersion = await ensurePublishedVersion(sql, legacySchool.id, null);
  await migrateLegacyResponses(sql, legacySchool.id, publishedVersion.id);
  await migrateLegacyAiRows(sql, legacySchool.id, publishedVersion.id);
  await ensureDefaultAiPromptVersions(sql);
  await syncTenantsFromSchools(sql);
  await syncTenantMembershipsFromSchoolMemberships(sql);
  await syncQuestionnairesFromFormVersions(sql);
  await syncResponsesV2FromResponses(sql);
  await syncAiAnalysisV2FromLegacy(sql);
  await ensureDefaultAiPromptVersionsV2(sql);
  await syncTenantPromptOverridesFromLegacy(sql);
}
