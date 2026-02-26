import { getSqlClient } from '../../lib/db/sql.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function recordFormOpenDevice(env, { tenantId, questionnaireId, deviceHash }) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO form_open_devices (
      tenant_id,
      questionnaire_id,
      device_hash,
      first_seen_at,
      last_seen_at,
      open_count
    )
    VALUES (
      ${tenantId},
      ${questionnaireId},
      ${deviceHash},
      NOW(),
      NOW(),
      1
    )
    ON CONFLICT (tenant_id, questionnaire_id, device_hash) DO UPDATE SET
      last_seen_at = NOW(),
      open_count = form_open_devices.open_count + 1;
  `;
}

export async function getFormOpenDeviceSummary(env, { tenantId, questionnaireId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      COUNT(*)::int AS unique_open_devices,
      COALESCE(SUM(open_count), 0)::int AS total_opens
    FROM form_open_devices
    WHERE tenant_id = ${tenantId}
      AND questionnaire_id = ${questionnaireId};
  `;
  const row = rows[0] || {};
  return {
    uniqueOpenDevices: toNumber(row.unique_open_devices),
    totalOpens: toNumber(row.total_opens),
  };
}
