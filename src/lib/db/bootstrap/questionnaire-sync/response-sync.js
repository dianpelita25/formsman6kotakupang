export async function syncResponsesV2FromResponses(sql) {
  await sql`
    INSERT INTO responses_v2 (
      legacy_response_id,
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      respondent,
      answers,
      payload,
      created_at
    )
      SELECT
        r.id,
        r.school_id,
        q.id,
        qv.id,
      jsonb_build_object(
        'namaGuru', r.nama_guru,
        'lamaMengajar', r.lama_mengajar,
        'mataPelajaran', r.mata_pelajaran
      ),
      (
        jsonb_build_object(
          'namaGuru', r.nama_guru,
          'lamaMengajar', r.lama_mengajar,
          'mataPelajaran', r.mata_pelajaran,
          'q1', r.q1,
          'q2', r.q2,
          'q3', r.q3,
          'q4', r.q4,
          'q5', r.q5,
          'q6', r.q6,
          'q7', r.q7,
          'q8', r.q8,
          'q9', r.q9,
          'q10', r.q10,
          'q11', r.q11,
          'q12', r.q12
        ) || COALESCE(r.extra_answers, '{}'::jsonb)
      ),
      COALESCE(r.payload, '{}'::jsonb),
      r.created_at
    FROM responses r
    JOIN questionnaire_versions qv
      ON qv.legacy_form_version_id = r.form_version_id
    JOIN questionnaires q
      ON q.id = qv.questionnaire_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM responses_v2 rv2
      WHERE rv2.legacy_response_id = r.id
    );
  `;
}
