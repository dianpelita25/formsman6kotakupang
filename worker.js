// Cloudflare Worker router with Basic Auth for dashboard and AI endpoints
// Env vars required:
// - PAGES_ORIGIN (e.g., https://xxxxx.pages.dev)
// - API_ORIGIN (e.g., https://yyyyy.onrender.com)
// - ADMIN_USER, ADMIN_PASS for Basic Auth

const PREFIX = '/formsman6kotakupang';

function needsAuth(subPath) {
  return (
    subPath.startsWith('/dashboard') ||
    subPath.startsWith('/api/ai/') ||
    subPath.startsWith('/api/analytics/')
  );
}

function unauthorized() {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="dashboard"' },
  });
}

function checkBasicAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) return false;
  const creds = atob(auth.slice(6)).split(':');
  const [user, pass] = creds;
  return user === env.ADMIN_USER && pass === env.ADMIN_PASS;
}

function buildProxyRequest(request, targetUrl, extraHeaders = {}) {
  const headers = new Headers(request.headers);
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  // Preserve body only for methods that allow it
  const method = request.method;
  const hasBody = !['GET', 'HEAD'].includes(method);

  return new Request(targetUrl, {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // If path outside prefix, pass through
    if (!url.pathname.startsWith(PREFIX)) {
      return fetch(request);
    }

    // Normalize trailing slash on prefix
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/', 301);
    }

    const subPath = url.pathname.slice(PREFIX.length) || '/';
    const isApi = subPath.startsWith('/api/');
    const isHealth = subPath === '/health';

    // Auth only for dashboard & /api/ai/*
    if (needsAuth(subPath)) {
      if (!checkBasicAuth(request, env)) return unauthorized();
    }

    const upstreamBase = isApi || isHealth ? env.API_ORIGIN : env.PAGES_ORIGIN;
    const target = new URL(upstreamBase);
    target.pathname = subPath;
    target.search = url.search;

    const proxiedReq = buildProxyRequest(
      request,
      target.toString(),
      isApi || isHealth ? { 'Cache-Control': 'no-store' } : {}
    );

    return fetch(proxiedReq);
  },
};
