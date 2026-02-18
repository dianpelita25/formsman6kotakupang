export const SESSION_COOKIE_NAME = 'forms_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

function detectSecure(requestUrl) {
  try {
    return new URL(requestUrl).protocol === 'https:';
  } catch {
    return true;
  }
}

export function buildSessionCookieOptions(requestUrl = '') {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: detectSecure(requestUrl),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
