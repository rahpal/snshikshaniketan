import { HttpError } from './errors.js';

/**
 * Wraps a handler so that: only the listed methods are allowed, responses are
 * never cached, thrown HttpErrors become clean JSON, and anything unexpected
 * becomes a 500 that is logged server-side but not described to the client.
 */
export function handler(methods, fn) {
  const allowed = Array.isArray(methods) ? methods : [methods];

  return async function wrapped(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    if (!allowed.includes(req.method)) {
      res.setHeader('Allow', allowed.join(', '));
      return send(res, 405, { error: `${req.method} is not allowed here.`, code: 'method_not_allowed' });
    }

    try {
      return await fn(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        return send(res, error.status, {
          error: error.message,
          code: error.code,
          ...(error.details ? { details: error.details } : {}),
        });
      }

      // Unexpected: log the real reason, tell the client nothing useful to an attacker.
      console.error('Unhandled error in', req.url, error);
      return send(res, 500, {
        error: 'Something went wrong on the server. Please try again.',
        code: 'internal_error',
      });
    }
  };
}

export function send(res, status, body) {
  // Set statusCode directly rather than res.status(), which is a Vercel helper
  // and not present on a bare Node response.
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

export const ok = (res, body = { ok: true }) => send(res, 200, body);

/**
 * Vercel parses JSON bodies for us, but `vercel dev` and non-JSON content types
 * do not always, so fall back to reading the stream.
 */
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON.', 'bad_json');
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'bad_json');
  }
}

/** Parses a zod schema, turning failures into a 400 that names the bad fields. */
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!details[key]) details[key] = issue.message;
    }
    throw new HttpError(400, 'Please correct the highlighted fields.', 'validation_failed', details);
  }
  return result.data;
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? '';
}
