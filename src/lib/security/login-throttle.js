export const LOGIN_THROTTLE_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_THROTTLE_MAX_FAILURES = 5;
export const LOGIN_THROTTLE_BLOCK_MS = 15 * 60 * 1000;

const attemptsByKey = new Map();

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function buildThrottleKey(ipAddress, email) {
  const ip = String(ipAddress || '').trim() || 'unknown-ip';
  const normalizedEmail = normalizeEmail(email) || 'unknown-email';
  return `${ip}|${normalizedEmail}`;
}

export function normalizeThrottleRecord(record, now = Date.now()) {
  const source = record && typeof record === 'object' ? record : {};
  const failureCandidates = Array.isArray(source.failures) ? source.failures : [];
  const filteredFailures = failureCandidates
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && now - value <= LOGIN_THROTTLE_WINDOW_MS);

  return {
    failures: filteredFailures,
    blockedUntil: Number(source.blockedUntil || 0),
    lastSeenAt: now,
  };
}

function getThrottleRecord(key, now = Date.now()) {
  const existing = attemptsByKey.get(key);
  if (!existing) {
    return normalizeThrottleRecord(null, now);
  }
  return normalizeThrottleRecord(existing, now);
}

function saveThrottleRecord(key, record, now = Date.now()) {
  const failures = Array.isArray(record?.failures) ? record.failures : [];
  const blockedUntil = Number(record?.blockedUntil || 0);
  const isExpired = failures.length <= 0 && blockedUntil <= now;
  if (isExpired) {
    attemptsByKey.delete(key);
    return;
  }
  attemptsByKey.set(key, {
    failures,
    blockedUntil,
    lastSeenAt: now,
  });
}

export function resolveLoginThrottleIp(request) {
  return (
    request?.header?.('cf-connecting-ip') ||
    request?.header?.('x-forwarded-for') ||
    request?.header?.('x-real-ip') ||
    ''
  );
}

export function checkLoginThrottle({ ipAddress = '', email = '', now = Date.now() } = {}) {
  const key = buildThrottleKey(ipAddress, email);
  const record = getThrottleRecord(key, now);

  if (record.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((record.blockedUntil - now) / 1000)),
      key,
    };
  }

  saveThrottleRecord(key, record, now);
  return {
    blocked: false,
    retryAfterSeconds: 0,
    key,
  };
}

export function recordLoginFailure({ ipAddress = '', email = '', now = Date.now() } = {}) {
  const key = buildThrottleKey(ipAddress, email);
  const record = getThrottleRecord(key, now);
  record.failures.push(now);

  if (record.failures.length >= LOGIN_THROTTLE_MAX_FAILURES) {
    record.blockedUntil = now + LOGIN_THROTTLE_BLOCK_MS;
  }

  saveThrottleRecord(key, record, now);
}

export function resetLoginThrottle({ ipAddress = '', email = '', now = Date.now() } = {}) {
  const key = buildThrottleKey(ipAddress, email);
  saveThrottleRecord(
    key,
    {
      failures: [],
      blockedUntil: 0,
    },
    now
  );
}
