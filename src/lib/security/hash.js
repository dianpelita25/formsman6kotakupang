const encoder = new TextEncoder();
const DEFAULT_PBKDF2_ITERATIONS = 10000;

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
