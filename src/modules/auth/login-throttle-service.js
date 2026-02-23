import { sha256Hex } from '../../lib/security/hash.js';
import {
  buildThrottleKey,
  checkLoginThrottle as checkLoginThrottleMemory,
  LOGIN_THROTTLE_BLOCK_MS,
  LOGIN_THROTTLE_MAX_FAILURES,
  normalizeThrottleRecord,
  recordLoginFailure as recordLoginFailureMemory,
  resetLoginThrottle as resetLoginThrottleMemory,
  resolveLoginThrottleIp,
} from '../../lib/security/login-throttle.js';
import { clearLoginThrottleState, findLoginThrottleState, saveLoginThrottleState } from './throttle-repository.js';

function isThrottleStorageUnavailable(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('login_throttle_state') &&
    (message.includes('relation') ||
      message.includes('does not exist') ||
      message.includes('column') ||
      message.includes('undefined_table'))
  );
}

function forceMemoryStorage(env) {
  return String(env?.LOGIN_THROTTLE_FORCE_MEMORY || '')
    .trim()
    .toLowerCase() === 'true';
}

function buildBlockedResponse(blockedUntil, now, keyHash, storage) {
  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
    keyHash,
    storage,
  };
}

function buildAllowedResponse(keyHash, storage) {
  return {
    blocked: false,
    retryAfterSeconds: 0,
    keyHash,
    storage,
  };
}

async function resolveKeyHash(ipAddress, email) {
  const key = buildThrottleKey(ipAddress, email);
  return sha256Hex(key);
}

export { resolveLoginThrottleIp };

export async function checkLoginThrottleHybrid(env, { ipAddress = '', email = '', now = Date.now() } = {}) {
  const keyHash = await resolveKeyHash(ipAddress, email);

  if (forceMemoryStorage(env)) {
    const result = checkLoginThrottleMemory({ ipAddress, email, now });
    return {
      blocked: result.blocked,
      retryAfterSeconds: result.retryAfterSeconds,
      keyHash,
      storage: 'memory',
    };
  }

  try {
    const stored = await findLoginThrottleState(env, keyHash);
    const record = normalizeThrottleRecord(stored, now);

    if (record.blockedUntil > now) {
      return buildBlockedResponse(record.blockedUntil, now, keyHash, 'db');
    }

    await saveLoginThrottleState(env, {
      keyHash,
      failures: record.failures,
      blockedUntil: record.blockedUntil > now ? record.blockedUntil : 0,
    });
    return buildAllowedResponse(keyHash, 'db');
  } catch (error) {
    if (!isThrottleStorageUnavailable(error)) {
      throw error;
    }
    const result = checkLoginThrottleMemory({ ipAddress, email, now });
    return {
      blocked: result.blocked,
      retryAfterSeconds: result.retryAfterSeconds,
      keyHash,
      storage: 'memory',
    };
  }
}

export async function recordLoginFailureHybrid(env, { ipAddress = '', email = '', now = Date.now() } = {}) {
  const keyHash = await resolveKeyHash(ipAddress, email);

  if (forceMemoryStorage(env)) {
    recordLoginFailureMemory({ ipAddress, email, now });
    return { storage: 'memory', keyHash };
  }

  try {
    const stored = await findLoginThrottleState(env, keyHash);
    const record = normalizeThrottleRecord(stored, now);
    record.failures.push(now);
    if (record.failures.length >= LOGIN_THROTTLE_MAX_FAILURES) {
      record.blockedUntil = now + LOGIN_THROTTLE_BLOCK_MS;
    }
    await saveLoginThrottleState(env, {
      keyHash,
      failures: record.failures,
      blockedUntil: record.blockedUntil,
    });
    return { storage: 'db', keyHash };
  } catch (error) {
    if (!isThrottleStorageUnavailable(error)) {
      throw error;
    }
    recordLoginFailureMemory({ ipAddress, email, now });
    return { storage: 'memory', keyHash };
  }
}

export async function resetLoginThrottleHybrid(env, { ipAddress = '', email = '', now = Date.now() } = {}) {
  const keyHash = await resolveKeyHash(ipAddress, email);

  if (forceMemoryStorage(env)) {
    resetLoginThrottleMemory({ ipAddress, email, now });
    return { storage: 'memory', keyHash };
  }

  try {
    await clearLoginThrottleState(env, keyHash);
    return { storage: 'db', keyHash };
  } catch (error) {
    if (!isThrottleStorageUnavailable(error)) {
      throw error;
    }
    resetLoginThrottleMemory({ ipAddress, email, now });
    return { storage: 'memory', keyHash };
  }
}
