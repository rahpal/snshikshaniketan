/**
 * The only error type handlers should throw on purpose. Anything else bubbling
 * up is treated as a bug and reported as a 500 without leaking internals.
 */
export class HttpError extends Error {
  constructor(status, message, code = null, details = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Please sign in to continue.', code = 'unauthorized') =>
  new HttpError(401, message, code);
export const forbidden = (message = 'You do not have access to this.', code = 'forbidden') =>
  new HttpError(403, message, code);
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'not_found');
export const conflict = (message, details) => new HttpError(409, message, 'conflict', details);
export const tooMany = (message, details) => new HttpError(429, message, 'too_many_requests', details);
