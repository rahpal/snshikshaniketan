import { handler, ok } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/guards.js';
import { listUsers, publicUser, isLockedOut, lockoutMinutesRemaining } from '../../_lib/users.js';

/** GET /api/admin/users/list */
export default handler('GET', async (req, res) => {
  await requireAdmin(req);
  const users = await listUsers({ fresh: true });

  return ok(res, {
    users: users
      .map((user) => ({
        ...publicUser(user),
        // Surfaced so an admin can see why someone is complaining they cannot
        // sign in, and clear it with a password reset.
        locked: isLockedOut(user),
        locked_minutes: isLockedOut(user) ? lockoutMinutesRemaining(user) : 0,
        failed_attempts: user.failed_attempts,
        created_at: user.created_at,
      }))
      .sort((a, b) => a.username.localeCompare(b.username)),
  });
});
