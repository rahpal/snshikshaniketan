import { clientIp, handler, ok, parse, readBody } from '../../_lib/http.js';
import { createUserSchema } from '../../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../../_lib/guards.js';
import { createUser, publicUser } from '../../_lib/users.js';
import { generateTempPassword } from '../../_lib/password.js';
import { audit } from '../../_lib/audit.js';

/**
 * POST /api/admin/users/create
 *
 * Returns a temporary password, once. It is not stored anywhere in readable
 * form and cannot be shown again - the admin hands it over, and the user is
 * made to replace it at first sign-in.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const actor = await requireAdmin(req);
  const input = parse(createUserSchema, await readBody(req));

  const password = generateTempPassword();
  const user = await createUser({ ...input, password, created_by: actor.username });

  await audit({
    user: actor.username,
    action: 'user.create',
    entity_id: user.user_id,
    after: { username: user.username, role: user.role, full_name: user.full_name },
    ip: clientIp(req),
  });

  return ok(res, { user: publicUser(user), temporary_password: password });
});
