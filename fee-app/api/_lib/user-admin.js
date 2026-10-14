import { ROLES } from './sheet-schema.js';
import { listUsers } from './users.js';
import { badRequest, forbidden, notFound } from './errors.js';

/**
 * The guard rails around account changes.
 *
 * All of them exist to stop one mistake: an administrator locking themselves,
 * or everyone, out of an app whose only other way in is a developer running a
 * script against the spreadsheet.
 */

export async function findTarget(userId) {
  const users = await listUsers({ fresh: true });
  const target = users.find((user) => user.user_id === userId);
  if (!target) throw notFound('That user no longer exists.');
  return { target, users };
}

/** Would this change leave nobody able to administer the app? */
export function assertNotLastAdmin(users, target, { becomingActive, becomingRole }) {
  const stillAdmin =
    (becomingRole ?? target.role) === ROLES.ADMIN && (becomingActive ?? target.active) === true;
  if (stillAdmin) return;
  if (target.role !== ROLES.ADMIN || !target.active) return;

  const othersLeft = users.filter(
    (user) => user.user_id !== target.user_id && user.role === ROLES.ADMIN && user.active
  );
  if (othersLeft.length === 0) {
    throw badRequest(
      'This is the only administrator left. Make someone else an administrator first.',
      { user_id: 'The last administrator cannot be removed.' }
    );
  }
}

/**
 * Changing your own role or switching yourself off takes effect on the very
 * next request, so it is refused: ask another administrator.
 */
export function assertNotSelf(actor, target, what) {
  if (actor.user_id === target.user_id) {
    throw forbidden(
      `You cannot ${what} your own account. Ask another administrator to do it.`,
      'not_on_yourself'
    );
  }
}
