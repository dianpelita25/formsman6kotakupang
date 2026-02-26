import { sha256Hex } from '../../lib/security/hash.js';
import { getFormOpenDeviceSummary, recordFormOpenDevice } from './repository.js';

const DEVICE_COOKIE_NAME = 'aiti_device_id';
const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function parseBooleanFlag(input, fallback = false) {
  if (typeof input !== 'string') return fallback;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function isOpenTrackingEnabled(env) {
  const appEnv = String(env?.APP_ENV || 'local').trim().toLowerCase();
  const defaultValue = appEnv !== 'production';
  return parseBooleanFlag(env?.ENABLE_FORM_OPEN_TRACKING, defaultValue);
}

function isOpenTrackingStorageUnavailable(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('form_open_devices') &&
    (message.includes('relation') ||
      message.includes('does not exist') ||
      message.includes('column') ||
      message.includes('undefined_table'))
  );
}

function normalizeDeviceCookieValue(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value.length < 16 || value.length > 128) return '';
  return value;
}

function generateDeviceCookieValue() {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveTrackingSalt(env) {
  return String(env?.OPEN_TRACKING_SALT || '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function captureFormOpenBestEffort(
  env,
  { tenantId = '', questionnaireId = '', cookieValue = '' } = {}
) {
  if (!isOpenTrackingEnabled(env)) {
    return {
      shouldSetCookie: false,
      deviceCookieValue: '',
    };
  }

  if (!tenantId || !questionnaireId) {
    return {
      shouldSetCookie: false,
      deviceCookieValue: '',
    };
  }

  const trackingSalt = resolveTrackingSalt(env);
  if (!trackingSalt) {
    console.warn('[OPEN_TRACKING_WARNING] OPEN_TRACKING_SALT kosong. Tracking device-open dilewati.');
    return {
      shouldSetCookie: false,
      deviceCookieValue: '',
    };
  }

  let normalizedCookieValue = normalizeDeviceCookieValue(cookieValue);
  let shouldSetCookie = false;
  if (!normalizedCookieValue) {
    normalizedCookieValue = generateDeviceCookieValue();
    shouldSetCookie = true;
  }

  try {
    const deviceHash = await sha256Hex(`${normalizedCookieValue}:${trackingSalt}`);
    await recordFormOpenDevice(env, {
      tenantId,
      questionnaireId,
      deviceHash,
    });
  } catch (error) {
    if (!isOpenTrackingStorageUnavailable(error)) {
      console.warn(
        `[OPEN_TRACKING_WARNING] tenantId=${tenantId} questionnaireId=${questionnaireId} gagal merekam open-device: ${
          String(error?.message || error)
        }`
      );
    } else {
      console.warn(
        `[OPEN_TRACKING_WARNING] tabel form_open_devices belum siap. tenantId=${tenantId} questionnaireId=${questionnaireId}`
      );
    }
  }

  return {
    shouldSetCookie,
    deviceCookieValue: normalizedCookieValue,
  };
}

export async function resolveOpenDeviceSummary(env, { tenantId = '', questionnaireId = '' } = {}) {
  if (!tenantId || !questionnaireId || !isOpenTrackingEnabled(env)) {
    return {
      uniqueOpenDevices: 0,
      totalOpens: 0,
    };
  }

  try {
    return await getFormOpenDeviceSummary(env, { tenantId, questionnaireId });
  } catch (error) {
    if (!isOpenTrackingStorageUnavailable(error)) {
      console.warn(
        `[OPEN_TRACKING_WARNING] tenantId=${tenantId} questionnaireId=${questionnaireId} gagal membaca summary: ${
          String(error?.message || error)
        }`
      );
    }
    return {
      uniqueOpenDevices: 0,
      totalOpens: 0,
    };
  }
}

export function buildOpenTrackingCookieOptions(requestUrl) {
  const url = String(requestUrl || '').trim();
  const secure = url.startsWith('https://');
  return {
    path: '/forms',
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  };
}

export function toOpenDeviceSummaryPayload(summary = {}, submitted = 0) {
  return {
    uniqueOpenDevices: toNumber(summary.uniqueOpenDevices),
    totalOpens: toNumber(summary.totalOpens),
    submitted: toNumber(submitted),
  };
}

export { DEVICE_COOKIE_NAME };
