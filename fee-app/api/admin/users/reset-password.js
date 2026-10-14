import { clientIp, handler, ok, parse, readBody } from '../../_lib/http.js';
import { userIdSchema } from '../../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../../_lib/guards.js';
import { publicUser, setPassword } from '../../_lib/users.js';
import { generateTempPassword } from '../../_lib/password.js';
import { findTarget } from '../../_lib/user-admin.js';
import { audit } from '../../_lib/audit.js';

/**
 * POST /api/admin/users/reset-password
 *
 * Issues a new temporary password and shows it once. It also clears any
 * lockout, and - because the stored password changes - signs that person out
 * everywhere they were signed in.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const actor = await requireAdmin(req);
  const { user_id: userId } = parse(userIdSchema, await readBody(req));

  const { target } = await findTarget(userId);
  const password = generateTempPassword();
  const updated = await setPassword(target, password, { mustChangeAgain: true });

  await audit({
    user: actor.username,
    action: 'user.reset_password',
    entity_id: target.user_id,
    after: { username: target.username },
    ip: clientIp(req),
  });

  return ok(res, { user: publicUser(updated), temporary_password: password });
});
