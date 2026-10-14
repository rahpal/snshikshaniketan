import { clientIp, handler, ok, parse, readBody } from '../../_lib/http.js';
import { updateUserSchema } from '../../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../../_lib/guards.js';
import { publicUser, setActive, setRole } from '../../_lib/users.js';
import { assertNotLastAdmin, assertNotSelf, findTarget } from '../../_lib/user-admin.js';
import { audit } from '../../_lib/audit.js';

/**
 * POST /api/admin/users/update
 *
 * Changes a role, or switches an account off. Accounts are never deleted: the
 * audit log and every payment row refer to them by name.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const actor = await requireAdmin(req);
  const input = parse(updateUserSchema, await readBody(req));

  const { target, users } = await findTarget(input.user_id);
  const before = { role: target.role, active: target.active };

  if (input.role !== undefined && input.role !== target.role) {
    assertNotSelf(actor, target, 'change the role of');
    assertNotLastAdmin(users, target, { becomingRole: input.role });
  }
  if (input.active !== undefined && input.active !== target.active) {
    assertNotSelf(actor, target, 'deactivate');
    assertNotLastAdmin(users, target, { becomingActive: input.active });
  }

  let updated = target;
  if (input.role !== undefined && input.role !== target.role) updated = await setRole(updated, input.role);
  if (input.active !== undefined && input.active !== target.active) {
    updated = await setActive(updated, input.active);
  }

  await audit({
    user: actor.username,
    action: 'user.update',
    entity_id: target.user_id,
    before,
    after: { role: updated.role, active: updated.active },
    ip: clientIp(req),
  });

  return ok(res, { user: publicUser(updated) });
});
