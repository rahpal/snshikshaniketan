import { handler, ok, clientIp } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/session.js';
import { loadSessionUser } from '../_lib/guards.js';
import { audit } from '../_lib/audit.js';

/**
 * POST /api/auth/logout
 *
 * Always clears the cookie and always answers 200, even if the session was
 * already invalid - there is nothing useful to report, and "sign out" failing
 * would only leave a confused user on a page they cannot use.
 */
export default handler('POST', async (req, res) => {
  let username = null;
  let userId = '';
  try {
    const user = await loadSessionUser(req);
    username = user.username;
    userId = user.user_id;
  } catch {
    // No valid session: clearing the cookie is still the right outcome.
  }

  clearSessionCookie(res);
  if (username) {
    await audit({ user: username, action: 'logout', entity_id: userId, ip: clientIp(req) });
  }
  return ok(res, { ok: true });
});
