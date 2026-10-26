// Jorsenshop — Netlify adapter for the existing API handlers.
// Keep business logic, validation, authorization and database queries in /server;
// this file only adapts Netlify's Web Request/Response runtime to the existing
// Node-style req/res contract so the Vercel-to-Netlify migration does not fork logic.
import api from '../../api/index.js';

function jsonResponse(body, status, headers) {
  const outputHeaders = new Headers(headers);
  if (!outputHeaders.has('content-type')) {
    outputHeaders.set('content-type', 'application/json; charset=utf-8');
  }
  if (!outputHeaders.has('cache-control')) outputHeaders.set('cache-control', 'no-store');
  if (!outputHeaders.has('x-content-type-options')) outputHeaders.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(body ?? null), { status: status || 200, headers: outputHeaders });
}

function routeFromPath(pathname) {
  const markers = ['/api/', '/.netlify/functions/api/'];
  for (const marker of markers) {
    const at = pathname.indexOf(marker);
    if (at !== -1) return pathname.slice(at + marker.length).replace(/\/+$/, '');
  }
  if (pathname === '/api' || pathname === '/.netlify/functions/api') return '';
  return '';
}

export default async function handler(request) {
  const url = new URL(request.url);
  const pathRoute = routeFromPath(url.pathname);
  const route = pathRoute || url.searchParams.get('route') || '';
  const headersIn = Object.fromEntries(request.headers.entries());
  const query = Object.fromEntries(url.searchParams.entries());
  if (route) query.route = route;

  let body;
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    const raw = await request.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        return jsonResponse({ error: 'Corps JSON invalide' }, 400);
      }
    }
  }

  const headersOut = new Headers();
  let statusCode = 200;
  let responseBody;
  let finished = false;
  const res = {
    status(code) {
      statusCode = Number(code) || 200;
      return this;
    },
    setHeader(name, value) {
      const key = String(name).toLowerCase();
      if (key === 'set-cookie' && Array.isArray(value)) {
        for (const cookie of value) headersOut.append(key, String(cookie));
      } else {
        headersOut.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
      return this;
    },
    getHeader(name) {
      return headersOut.get(String(name).toLowerCase());
    },
    json(value) {
      responseBody = value;
      finished = true;
      if (!headersOut.has('content-type')) headersOut.set('content-type', 'application/json; charset=utf-8');
      return this;
    },
    end(value) {
      if (value !== undefined) responseBody = value;
      finished = true;
      return this;
    }
  };

  const req = {
    method: request.method.toUpperCase(),
    url: '/api/' + route + (url.search ? url.search : ''),
    headers: headersIn,
    query,
    body,
    socket: { remoteAddress: headersIn['x-nf-client-connection-ip'] || headersIn['x-forwarded-for'] || '' }
  };

  try {
    await api(req, res);
    if (!finished) {
      return jsonResponse({ error: 'Réponse API incomplète' }, 500, headersOut);
    }
    return jsonResponse(responseBody, statusCode, headersOut);
  } catch (error) {
    console.error('[Jorsenshop Netlify API]', error?.name || 'UnknownError');
    return jsonResponse({ error: 'Service temporairement indisponible' }, 500, headersOut);
  }
}
