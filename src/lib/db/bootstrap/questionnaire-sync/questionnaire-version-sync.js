import { parseJson } from '../json-utils.js';
import { ensureDefaultQuestionnaire } from './default-questionnaire.js';

function buildQuestionnaireSchemaFromLegacyForm(row) {
  const coreFields = parseJson(row.core_schema, []);
  const extraFields = parseJson(row.extra_schema, []);
  return {
    fields: [...coreFields, ...extraFields],
    coreFields,
    extraFields,
    legacy: {
      schoolId: row.school_id,
      formVersionId: row.id,
    },
  };
}

export async function syncQuestionnairesFromFormVersions(sql) {
  const schools = await sql`
    SELECT id, name
    FROM schools
    ORDER BY created_at ASC;
  `;

  for (const school of schools) {
    const questionnaire = await ensureDefaultQuestionnaire(sql, {
      tenantId: school.id,
      createdBy: null,
    });
    if (!questionnaire?.id) continue;

    const formVersions = await sql`
      SELECT
        id,
        school_id,
        version,
        status,
        meta,
        core_schema,
        extra_schema,
        published_at,
        created_by,
        created_at,
        updated_at
      FROM form_versions
      WHERE school_id = ${school.id}
      ORDER BY version ASC;
    `;

    for (const versionRow of formVersions) {
      const schema = buildQuestionnaireSchemaFromLegacyForm(versionRow);
      await sql`
        INSERT INTO questionnaire_versions (
          id,
          questionnaire_id,
          legacy_form_version_id,
          version,
          status,
          meta,
          schema,
          published_at,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()},
          ${questionnaire.id},
          ${versionRow.id},
          ${versionRow.version},
          ${versionRow.status},
          ${JSON.stringify(parseJson(versionRow.meta, {}))},
          ${JSON.stringify(schema)},
          ${versionRow.published_at},
          ${versionRow.created_by},
          ${versionRow.created_at},
          ${versionRow.updated_at}
        )
        ON CONFLICT (legacy_form_version_id) DO UPDATE
        SET
          questionnaire_id = EXCLUDED.questionnaire_id,
          version = EXCLUDED.version,
          status = EXCLUDED.status,
          meta = EXCLUDED.meta,
          schema = EXCLUDED.schema,
          published_at = EXCLUDED.published_at,
          created_by = COALESCE(EXCLUDED.created_by, questionnaire_versions.created_by),
          updated_at = COALESCE(EXCLUDED.updated_at, questionnaire_versions.updated_at);
      `;
    }
  }
}
