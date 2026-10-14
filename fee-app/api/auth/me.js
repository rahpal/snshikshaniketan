import { handler, ok } from '../_lib/http.js';
import { loadSessionUser } from '../_lib/guards.js';
import { publicUser } from '../_lib/users.js';

/**
 * GET /api/auth/me
 *
 * How the app finds out, on load, whether there is a usable session. Allows a
 * user who still owes a password change through, because the UI needs to know
 * that in order to send them to the change-password screen.
 */
export default handler('GET', async (req, res) => {
  const user = await loadSessionUser(req);
  return ok(res, {
    user: publicUser(user),
    must_change_password: user.must_change_password,
  });
});
