const encoder = new TextEncoder();
export const DEFAULT_PBKDF2_ITERATIONS = 10000;
export const DEFAULT_PBKDF2_TARGET_ITERATIONS = 100000;
// Cloudflare Workers WebCrypto PBKDF2 currently supports up to 100000 iterations.
const MAX_PBKDF2_ITERATIONS = 100000;

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function randomSalt(size = 16) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function normalizePbkdf2Iterations(raw, fallback = DEFAULT_PBKDF2_ITERATIONS) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return Number(fallback);
  const rounded = Math.floor(parsed);
  if (rounded < DEFAULT_PBKDF2_ITERATIONS) return DEFAULT_PBKDF2_ITERATIONS;
  if (rounded > MAX_PBKDF2_ITERATIONS) return MAX_PBKDF2_ITERATIONS;
  return rounded;
}

export function resolvePbkdf2TargetIterations(env = null) {
  const runtimeValue = env?.PASSWORD_PBKDF2_ITERATIONS;
  const processValue =
    typeof process !== 'undefined' && process?.env ? process.env.PASSWORD_PBKDF2_ITERATIONS : undefined;
  return normalizePbkdf2Iterations(runtimeValue ?? processValue, DEFAULT_PBKDF2_TARGET_ITERATIONS);
}

export async function sha256Hex(input) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(String(input)));
  return toHex(hash);
}

export async function hashPassword(password, salt, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations,
    },
    keyMaterial,
    256
  );

  return toHex(derivedBits);
}

export async function verifyPassword(password, salt, expectedHash, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const actualHash = await hashPassword(password, salt, iterations);
  return actualHash === expectedHash;
}
