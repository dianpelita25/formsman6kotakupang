const encoder = new TextEncoder();

function toBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value) {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function getSessionSecret(env) {
  const secret = env?.SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET belum diset.');
  }
  return secret;
}

export function splitSignedToken(value) {
  const stringValue = String(value || '').trim();
  const dotIndex = stringValue.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= stringValue.length - 1) {
    return null;
  }
  return {
    token: stringValue.slice(0, dotIndex),
    signature: stringValue.slice(dotIndex + 1),
  };
}

export async function signToken(token, secret) {
  const key = await importHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(String(token)));
  return toBase64Url(new Uint8Array(signatureBuffer));
}

export async function buildSignedToken(token, secret) {
  const signature = await signToken(token, secret);
  return `${token}.${signature}`;
}

export async function verifySignedToken(token, signature, secret) {
  if (!token || !signature) return false;
  try {
    const key = await importHmacKey(secret);
    const signatureBytes = fromBase64Url(signature);
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(String(token)));
    if (!valid) return false;

    const expectedSignature = await signToken(token, secret);
    return timingSafeEqual(expectedSignature, signature);
  } catch {
    return false;
  }
}
