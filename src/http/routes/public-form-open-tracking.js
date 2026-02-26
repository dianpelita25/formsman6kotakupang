const DEFAULT_COOKIE_NAME = 'aiti_device_id';
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function buildFallbackCookieOptions(requestUrl = '') {
  return {
    path: '/forms',
    httpOnly: true,
    sameSite: 'Lax',
    secure: String(requestUrl || '').startsWith('https://'),
    maxAge: DEFAULT_COOKIE_MAX_AGE_SECONDS,
  };
}

function toCookieToken(value) {
  return encodeURIComponent(String(value || '').trim());
}

function serializeCookieHeader(name, value, options = {}) {
  const parts = [`${toCookieToken(name)}=${toCookieToken(value)}`];
  if (Number.isFinite(Number(options.maxAge))) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(Number(options.maxAge)))}`);
  }
  if (options.path) parts.push(`Path=${String(options.path)}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${String(options.sameSite)}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function appendSetCookieHeader(response, setCookieHeader = '') {
  const headerValue = String(setCookieHeader || '').trim();
  if (!headerValue) return response;
  const headers = new Headers(response.headers);
  headers.append('set-cookie', headerValue);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function captureOpenDeviceBestEffort(
  c,
  {
    tenantId = '',
    questionnaireId = '',
    captureFormOpenBestEffort,
    getCookie,
    buildOpenTrackingCookieOptions,
    deviceCookieName = DEFAULT_COOKIE_NAME,
  } = {}
) {
  if (typeof captureFormOpenBestEffort !== 'function') {
    return { setCookieHeader: '' };
  }
  const cookieName = String(deviceCookieName || DEFAULT_COOKIE_NAME).trim() || DEFAULT_COOKIE_NAME;
  const cookieValue = typeof getCookie === 'function' ? getCookie(c, cookieName) : '';

  try {
    const tracking = await captureFormOpenBestEffort(c.env, {
      tenantId,
      questionnaireId,
      cookieValue,
    });
    if (!tracking?.shouldSetCookie || !tracking.deviceCookieValue) {
      return { setCookieHeader: '' };
    }
    const cookieOptions =
      typeof buildOpenTrackingCookieOptions === 'function'
        ? buildOpenTrackingCookieOptions(c.req.url)
        : buildFallbackCookieOptions(c.req.url);
    return {
      setCookieHeader: serializeCookieHeader(cookieName, tracking.deviceCookieValue, cookieOptions),
    };
  } catch (error) {
    console.warn(
      `[OPEN_TRACKING_WARNING] gagal capture route=${c.req.path} tenantId=${tenantId} questionnaireId=${questionnaireId}: ${
        String(error?.message || error)
      }`
    );
    return { setCookieHeader: '' };
  }
}
