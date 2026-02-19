import { getDefaultPromptTemplateMap } from '../../../modules/ai-prompts/templates.js';

export async function ensureDefaultAiPromptVersions(sql) {
  const templates = getDefaultPromptTemplateMap();
  const modes = Object.keys(templates);

  for (const mode of modes) {
    const template = templates[mode];
    await sql`
      INSERT INTO ai_prompt_versions (
        id, mode, scope, school_id, status, template, change_note, created_by, published_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        'published',
        ${template},
        'seed: default global published',
        NULL,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    `;

    await sql`
      INSERT INTO ai_prompt_versions (
        id, mode, scope, school_id, status, template, change_note, created_by
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        'draft',
        ${template},
        'seed: default global draft',
        NULL
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}

export async function ensureDefaultAiPromptVersionsV2(sql) {
  const templates = getDefaultPromptTemplateMap();
  const modes = Object.keys(templates);

  for (const mode of modes) {
    const template = templates[mode];
    await sql`
      INSERT INTO ai_prompt_versions_v2 (
        id, mode, scope, tenant_id, questionnaire_id, status, template, change_note, created_by, published_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        NULL,
        'published',
        ${template},
        'seed: global published',
        NULL,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    `;

    await sql`
      INSERT INTO ai_prompt_versions_v2 (
        id, mode, scope, tenant_id, questionnaire_id, status, template, change_note, created_by
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        NULL,
        'draft',
        ${template},
        'seed: global draft',
        NULL
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}

export async function syncTenantPromptOverridesFromLegacy(sql) {
  const rows = await sql`
    SELECT
      ap.mode,
      ap.school_id,
      ap.status,
      ap.template,
      ap.change_note,
      ap.created_by,
      ap.created_at,
      ap.published_at
    FROM (
      SELECT
        ap.*,
        ROW_NUMBER() OVER (
          PARTITION BY ap.mode, ap.school_id, ap.status
          ORDER BY ap.created_at DESC, ap.id DESC
        ) AS rn
      FROM ai_prompt_versions ap
      WHERE ap.scope = 'school'
        AND ap.school_id IS NOT NULL
        AND ap.status IN ('draft', 'published')
    ) ap
    WHERE ap.rn = 1;
  `;

  for (const row of rows) {
    await sql`
      INSERT INTO ai_prompt_versions_v2 (
        id,
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        status,
        template,
        change_note,
        created_by,
        created_at,
        published_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${row.mode},
        'tenant',
        ${row.school_id},
        NULL,
        ${row.status},
        ${row.template},
        ${row.change_note},
        ${row.created_by},
        ${row.created_at},
        ${row.published_at}
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}
