/**
 * The only place the app talks to the server.
 *
 * Nothing here handles credentials: the session travels as an httpOnly cookie
 * the browser attaches by itself, which is why there is no token to store.
 */

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.code = code ?? null;
    /** Field name -> message, for forms to show errors inline. */
    this.details = details ?? null;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Please check your connection and try again.', {
      code: 'network_error',
    });
  }

  const text = await response.text();
  let data = {};
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new ApiError(data.error ?? `Request failed (${response.status}).`, {
      status: response.status,
      code: data.code,
      details: data.details,
    });
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  del: (path) => request(path, { method: 'DELETE' }),
};
