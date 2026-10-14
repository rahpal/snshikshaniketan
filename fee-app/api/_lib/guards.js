import { forbidden, unauthorized } from './errors.js';
import { COOKIE_NAME, readCookie, verifySession } from './session.js';
import { findUserById } from './users.js';
import { ROLES } from './sheet-schema.js';

/**
 * Authorisation is decided here, on the server, on every single request.
 *
 * The browser hiding a button is cosmetic. These checks are what actually
 * enforce "operators can view and enter data but cannot change an existing
 * entry", so every write handler must call requireAdmin or requireAuth.
 */

/**
 * Resolves the signed-in user from the cookie and re-reads their row, so a
 * deactivated account or a password reset takes effect on the next request
 * rather than when the token happens to expire.
 */
export async function loadSessionUser(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) throw unauthorized('Please sign in to continue.', 'no_session');

  let claims;
  try {
    claims = await verifySession(token);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'session_invalid');
  }

  const user = await findUserById(claims.user_id);
  if (!user) throw unauthorized('Your account no longer exists.', 'user_missing');
  if (!user.active) {
    throw forbidden('This account has been deactivated. Please contact the administrator.', 'account_disabled');
  }
  if ((user.password_changed_at ?? '') !== (claims.pwd_at ?? '')) {
    throw unauthorized('Your password was changed. Please sign in again.', 'password_changed');
  }

  return user;
}

/**
 * The normal guard for an endpoint. Blocks users who still owe a password
 * change, so a handed-over temporary password cannot be used to work
 * indefinitely without being replaced.
 */
export async function requireAuth(req, { allowPasswordChangePending = false } = {}) {
  const user = await loadSessionUser(req);
  if (user.must_change_password && !allowPasswordChangePending) {
    throw forbidden('Please set a new password before continuing.', 'password_change_required');
  }
  return user;
}

export async function requireAdmin(req) {
  const user = await requireAuth(req);
  if (user.role !== ROLES.ADMIN) {
    throw forbidden('Only an administrator can do this.', 'admin_only');
  }
  return user;
}

/**
 * Belt and braces against CSRF on top of the SameSite=Strict cookie: if the
 * browser told us where the request came from, it has to be us.
 */
export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return; // Same-origin fetches and server-side calls often omit it.

  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden('Request rejected: malformed origin.', 'bad_origin');
  }
  if (originHost !== host) {
    throw forbidden('Request rejected: cross-site request.', 'cross_origin');
  }
}
