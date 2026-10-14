/**
 * Calls a Vercel-style handler with a fake req/res pair, so endpoints can be
 * tested exactly as deployed - including the status codes, JSON bodies and
 * Set-Cookie headers the browser would see.
 */

const HOST = 'fees.example.test';

export async function invoke(handler, { method = 'GET', url = '/', body, cookie, origin, headers = {} } = {}) {
  const req = {
    method,
    url,
    headers: {
      host: HOST,
      ...(origin === null ? {} : { origin: origin ?? `https://${HOST}` }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    // Vercel parses JSON bodies before the handler sees them.
    body,
    socket: { remoteAddress: '203.0.113.7' },
  };

  const collected = { statusCode: 200, headers: {}, body: '' };
  const res = {
    get statusCode() {
      return collected.statusCode;
    },
    set statusCode(value) {
      collected.statusCode = value;
    },
    setHeader(name, value) {
      collected.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return collected.headers[name.toLowerCase()];
    },
    end(payload) {
      collected.body = payload ?? '';
      return res;
    },
  };

  await handler(req, res);

  let json = null;
  if (collected.body) {
    try {
      json = JSON.parse(collected.body);
    } catch {
      json = null;
    }
  }

  const setCookie = collected.headers['set-cookie'] ?? null;
  return {
    status: collected.statusCode,
    json,
    headers: collected.headers,
    setCookie,
    /** The "name=value" part, ready to send back as a Cookie header. */
    cookie: setCookie ? setCookie.split(';')[0] : null,
  };
}
