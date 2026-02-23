import { getSqlClient } from '../../lib/db/sql.js';

function parseFailures(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
      }
    } catch {
      return [];
    }
  }

  return [];
}

function toTimestampMs(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export async function findLoginThrottleState(env, keyHash) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT key_hash, failures_json, blocked_until
    FROM login_throttle_state
    WHERE key_hash = ${keyHash}
    LIMIT 1;
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    keyHash: row.key_hash,
    failures: parseFailures(row.failures_json),
    blockedUntil: toTimestampMs(row.blocked_until),
  };
}

export async function saveLoginThrottleState(env, { keyHash, failures = [], blockedUntil = 0 }) {
  const sql = getSqlClient(env);
  const normalizedFailures = Array.isArray(failures)
    ? failures.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  const failuresJson = JSON.stringify(normalizedFailures);
  const blockedUntilIso = Number(blockedUntil) > 0 ? new Date(Number(blockedUntil)).toISOString() : null;

  await sql`
    INSERT INTO login_throttle_state (key_hash, failures_json, blocked_until, updated_at)
    VALUES (
      ${keyHash},
      CAST(${failuresJson} AS jsonb),
      ${blockedUntilIso},
      NOW()
    )
    ON CONFLICT (key_hash) DO UPDATE SET
      failures_json = EXCLUDED.failures_json,
      blocked_until = EXCLUDED.blocked_until,
      updated_at = NOW();
  `;
}

export async function clearLoginThrottleState(env, keyHash) {
  const sql = getSqlClient(env);
  await sql`
    DELETE FROM login_throttle_state
    WHERE key_hash = ${keyHash};
  `;
}
