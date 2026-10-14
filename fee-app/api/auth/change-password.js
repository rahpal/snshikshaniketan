import { clientIp, handler, ok, parse, readBody } from '../_lib/http.js';
import { changePasswordSchema } from '../_lib/schemas.js';
import { describePasswordProblem, verifyPassword } from '../_lib/password.js';
import { publicUser, setPassword } from '../_lib/users.js';
import { assertSameOrigin, requireAuth } from '../_lib/guards.js';
import { setSessionCookie, signSession } from '../_lib/session.js';
import { audit } from '../_lib/audit.js';
import { badRequest, unauthorized } from '../_lib/errors.js';

/**
 * POST /api/auth/change-password
 *
 * Reachable while a password change is still pending - that is the whole point
 * of it. Changing the password moves password_changed_at, which invalidates
 * every other session for this user, so a new cookie is issued here to avoid
 * signing out the person who just did it.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const user = await requireAuth(req, { allowPasswordChangePending: true });
  const { currentPassword, newPassword } = parse(changePasswordSchema, await readBody(req));

  const matches = await verifyPassword(currentPassword, user.password_hash);
  if (!matches) throw unauthorized('Your current password is not correct.', 'wrong_password');

  if (currentPassword === newPassword) {
    throw badRequest('The new password must be different from the current one.', {
      newPassword: 'Choose a password you have not used here before.',
    });
  }

  const problem = describePasswordProblem(newPassword, { username: user.username });
  if (problem) throw badRequest(problem, { newPassword: problem });

  const updated = await setPassword(user, newPassword);

  const token = await signSession({
    user_id: updated.user_id,
    username: updated.username,
    role: updated.role,
    pwd_at: updated.password_changed_at,
  });
  setSessionCookie(res, token);

  await audit({
    user: updated.username,
    action: 'password.changed',
    entity_id: updated.user_id,
    ip: clientIp(req),
  });

  return ok(res, { user: publicUser(updated), must_change_password: false });
});
