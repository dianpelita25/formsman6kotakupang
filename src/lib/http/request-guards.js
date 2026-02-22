const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function resolveRequestId(c) {
  const requestId = String(c.get('requestId') || '').trim();
  return requestId || 'unknown';
}

function isMutationMethod(method) {
  return MUTATION_METHODS.has(String(method || '').trim().toUpperCase());
}

function hasRequestBody(c) {
  const method = String(c.req.method || '').trim().toUpperCase();
  if (method === 'PUT' || method === 'PATCH') return true;

  const contentLength = Number(c.req.header('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 0) return true;

  const transferEncoding = String(c.req.header('transfer-encoding') || '').trim().toLowerCase();
  return transferEncoding.length > 0;
}

function parseHostFromUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    return new URL(input).host;
  } catch {
    return '';
  }
}

export async function requireJsonMutationPayload(c, next) {
  if (!isMutationMethod(c.req.method) || !hasRequestBody(c)) {
    await next();
    return;
  }

  const contentType = String(c.req.header('content-type') || '')
    .trim()
    .toLowerCase();

  if (!contentType.includes('application/json')) {
    return c.json(
      {
        message: 'Permintaan mutasi admin wajib menggunakan Content-Type application/json.',
        requestId: resolveRequestId(c),
      },
      415
    );
  }

  await next();
}

export async function monitorAdminOrigin(c, next) {
  if (!isMutationMethod(c.req.method)) {
    await next();
    return;
  }

  const origin = String(c.req.header('origin') || '').trim();
  if (origin) {
    const requestHost = new URL(c.req.url).host;
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = '';
    }

    if (!originHost || originHost !== requestHost) {
      console.warn(
        `[ORIGIN_MONITOR] requestId=${resolveRequestId(c)} method=${c.req.method} path=${c.req.path} origin=${origin} host=${requestHost}`
      );
    }
  }

  await next();
}

export async function enforceAdminOrigin(c, next) {
  if (!isMutationMethod(c.req.method)) {
    await next();
    return;
  }

  const requestHost = parseHostFromUrl(c.req.url);
  const origin = String(c.req.header('origin') || '').trim();
  const referer = String(c.req.header('referer') || '').trim();

  if (origin) {
    const originHost = parseHostFromUrl(origin);
    if (!originHost || originHost !== requestHost) {
      return c.json(
        {
          message: 'Permintaan mutasi admin ditolak karena origin tidak valid.',
          requestId: resolveRequestId(c),
        },
        403
      );
    }
  }

  if (!origin && referer) {
    const refererHost = parseHostFromUrl(referer);
    if (!refererHost || refererHost !== requestHost) {
      return c.json(
        {
          message: 'Permintaan mutasi admin ditolak karena referer tidak valid.',
          requestId: resolveRequestId(c),
        },
        403
      );
    }
  }

  await next();
}
