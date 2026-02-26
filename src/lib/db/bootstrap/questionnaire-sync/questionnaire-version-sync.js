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

function buildQuestionnaireVersionPayload(questionnaireId, versionRow, schema) {
  return {
    questionnaireId,
    legacyFormVersionId: versionRow.id,
    version: versionRow.version,
    status: versionRow.status,
    meta: JSON.stringify(parseJson(versionRow.meta, {})),
    schema: JSON.stringify(schema),
    publishedAt: versionRow.published_at,
    createdBy: versionRow.created_by,
    createdAt: versionRow.created_at,
    updatedAt: versionRow.updated_at,
  };
}

async function findQuestionnaireVersionByLegacyFormId(sql, legacyFormVersionId) {
  const rows = await sql`
    SELECT id
    FROM questionnaire_versions
    WHERE legacy_form_version_id = ${legacyFormVersionId}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;
  `;
  return rows[0] || null;
}

async function findQuestionnaireVersionByVersionSlot(sql, { questionnaireId, version }) {
  const rows = await sql`
    SELECT id, legacy_form_version_id
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND version = ${version}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;
  `;
  return rows[0] || null;
}

async function updateQuestionnaireVersionById(sql, id, payload) {
  const targetStatus = normalizeVersionStatus(payload.status);
  if (targetStatus) {
    await sql`
      UPDATE questionnaire_versions
      SET
        status = 'archived',
        updated_at = COALESCE(${payload.updatedAt}, updated_at)
      WHERE questionnaire_id = ${payload.questionnaireId}
        AND status = ${targetStatus}
        AND id <> ${id};
    `;
  }

  await sql`
    UPDATE questionnaire_versions
    SET
      questionnaire_id = ${payload.questionnaireId},
      legacy_form_version_id = ${payload.legacyFormVersionId},
      version = ${payload.version},
      status = ${payload.status},
      meta = ${payload.meta},
      schema = ${payload.schema},
      published_at = ${payload.publishedAt},
      created_by = COALESCE(${payload.createdBy}, created_by),
      updated_at = COALESCE(${payload.updatedAt}, updated_at)
    WHERE id = ${id};
  `;
}

async function claimQuestionnaireVersionSlot(sql, payload) {
  const candidates = await sql`
    SELECT id
    FROM questionnaire_versions
    WHERE questionnaire_id = ${payload.questionnaireId}
      AND version = ${payload.version}
      AND (
        legacy_form_version_id IS NULL
        OR legacy_form_version_id = ${payload.legacyFormVersionId}
      )
    ORDER BY
      CASE
        WHEN legacy_form_version_id = ${payload.legacyFormVersionId} THEN 0
        WHEN legacy_form_version_id IS NULL THEN 1
        ELSE 2
      END,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST
    LIMIT 1;
  `;
  const candidate = candidates[0] || null;
  if (!candidate?.id) return null;

  await updateQuestionnaireVersionById(sql, candidate.id, payload);
  return candidate;
}

function isQuestionnaireVersionSlotConflict(error) {
  const message = String(error?.message || '');
  return message.includes('questionnaire_versions_questionnaire_id_version_key');
}

function normalizeVersionStatus(input) {
  const status = String(input || '').trim().toLowerCase();
  if (status === 'published' || status === 'draft') return status;
  return '';
}

async function archiveStatusConflicts(sql, payload) {
  const targetStatus = normalizeVersionStatus(payload.status);
  if (!targetStatus) return;

  await sql`
    UPDATE questionnaire_versions
    SET
      status = 'archived',
      updated_at = COALESCE(${payload.updatedAt}, updated_at)
    WHERE questionnaire_id = ${payload.questionnaireId}
      AND status = ${targetStatus}
      AND NOT (
        legacy_form_version_id = ${payload.legacyFormVersionId}
        OR (
          version = ${payload.version}
          AND (
            legacy_form_version_id IS NULL
            OR legacy_form_version_id = ${payload.legacyFormVersionId}
          )
        )
      );
  `;
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
      const payload = buildQuestionnaireVersionPayload(questionnaire.id, versionRow, schema);
      await archiveStatusConflicts(sql, payload);

      const byLegacyId = await findQuestionnaireVersionByLegacyFormId(sql, payload.legacyFormVersionId);
      if (byLegacyId?.id) {
        await updateQuestionnaireVersionById(sql, byLegacyId.id, payload);
        continue;
      }

      const claimedSlot = await claimQuestionnaireVersionSlot(sql, payload);
      if (claimedSlot?.id) {
        continue;
      }

      try {
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
            ${payload.questionnaireId},
            ${payload.legacyFormVersionId},
            ${payload.version},
            ${payload.status},
            ${payload.meta},
            ${payload.schema},
            ${payload.publishedAt},
            ${payload.createdBy},
            ${payload.createdAt},
            ${payload.updatedAt}
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
      } catch (error) {
        if (!isQuestionnaireVersionSlotConflict(error)) {
          throw error;
        }

        const versionSlot = await findQuestionnaireVersionByVersionSlot(sql, {
          questionnaireId: payload.questionnaireId,
          version: payload.version,
        });
        const currentLegacyId = String(versionSlot?.legacy_form_version_id || '').trim();
        if (!currentLegacyId || currentLegacyId === payload.legacyFormVersionId) {
          await claimQuestionnaireVersionSlot(sql, payload);
          continue;
        }

        console.warn(
          `[BOOTSTRAP_WARNING] skip legacy sync schoolId=${school.id} version=${payload.version} legacyFormVersionId=${payload.legacyFormVersionId} karena slot versi sudah dipakai legacyFormVersionId=${currentLegacyId}`
        );
      }
    }
  }
}
