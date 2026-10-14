import { handler, ok, readBody, parse, clientIp } from '../_lib/http.js';
import { loginSchema } from '../_lib/schemas.js';
import { burnTime, verifyPassword } from '../_lib/password.js';
import {
  findUserByUsername,
  isLockedOut,
  lockoutMinutesRemaining,
  publicUser,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../_lib/users.js';
import { setSessionCookie, signSession } from '../_lib/session.js';
import { assertSameOrigin } from '../_lib/guards.js';
import { audit } from '../_lib/audit.js';
import { forbidden, tooMany, unauthorized } from '../_lib/errors.js';

/**
 * POST /api/auth/login
 *
 * Deliberately vague on failure: a wrong username and a wrong password give the
 * same message and take the same time, so this endpoint cannot be used to find
 * out which usernames exist.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);

  const { username, password } = parse(loginSchema, await readBody(req));
  const ip = clientIp(req);
  const genericFailure = unauthorized('Incorrect username or password.', 'invalid_credentials');

  const user = await findUserByUsername(username, { fresh: true });
  if (!user) {
    await burnTime(password);
    await audit({ user: username, action: 'login.failed', entity_id: '', after: { reason: 'no_such_user' }, ip });
    throw genericFailure;
  }

  if (isLockedOut(user)) {
    const minutes = lockoutMinutesRemaining(user);
    await audit({ user: user.username, action: 'login.locked', entity_id: user.user_id, ip });
    throw tooMany(
      `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask the administrator to reset your password.`,
      { minutes }
    );
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);

  if (!passwordMatches) {
    const updated = await recordFailedLogin(user);
    await audit({
      user: user.username,
      action: 'login.failed',
      entity_id: user.user_id,
      after: { failed_attempts: updated.failed_attempts },
      ip,
    });
    throw genericFailure;
  }

  // Only told to someone who proved they hold the password, so this does not
  // reveal anything about accounts to an outsider.
  if (!user.active) {
    await audit({ user: user.username, action: 'login.disabled', entity_id: user.user_id, ip });
    throw forbidden(
      'This account has been deactivated. Please contact the administrator.',
      'account_disabled'
    );
  }

  const fresh = await recordSuccessfulLogin(user);
  const token = await signSession({
    user_id: fresh.user_id,
    username: fresh.username,
    role: fresh.role,
    pwd_at: fresh.password_changed_at,
  });
  setSessionCookie(res, token);

  await audit({ user: fresh.username, action: 'login.success', entity_id: fresh.user_id, ip });

  return ok(res, {
    user: publicUser(fresh),
    must_change_password: fresh.must_change_password,
  });
});
