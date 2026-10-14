import { TABS, ROLES } from './sheet-schema.js';
import { appendObjects, asBool, asNumber, asText, readTable, updateRow } from './table.js';
import { hashPassword } from './password.js';
import { ulid } from './ulid.js';
import { conflict, notFound } from './errors.js';

const TAB = TABS.USERS;

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

function hydrate(row) {
  if (!row) return null;
  return {
    _row: row._row,
    user_id: asText(row.user_id),
    username: asText(row.username).toLowerCase(),
    password_hash: asText(row.password_hash),
    role: asText(row.role).toLowerCase() === ROLES.ADMIN ? ROLES.ADMIN : ROLES.OPERATOR,
    full_name: asText(row.full_name),
    active: asBool(row.active, false),
    must_change_password: asBool(row.must_change_password, false),
    failed_attempts: asNumber(row.failed_attempts, 0),
    locked_until: asText(row.locked_until),
    password_changed_at: asText(row.password_changed_at),
    last_login_at: asText(row.last_login_at),
    created_at: asText(row.created_at),
    created_by: asText(row.created_by),
  };
}

/** What is safe to send to the browser: no hash, no lockout internals. */
export function publicUser(user) {
  if (!user) return null;
  return {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    active: user.active,
    must_change_password: user.must_change_password,
    last_login_at: user.last_login_at || null,
  };
}

export async function listUsers({ fresh = false } = {}) {
  const { rows } = await readTable(TAB, { fresh });
  return rows.map(hydrate).filter((user) => user.username);
}

export async function findUserByUsername(username, options = {}) {
  const wanted = String(username ?? '').trim().toLowerCase();
  if (!wanted) return null;
  const users = await listUsers(options);
  return users.find((user) => user.username === wanted) ?? null;
}

export async function findUserById(userId, options = {}) {
  const wanted = String(userId ?? '').trim();
  if (!wanted) return null;
  const users = await listUsers(options);
  return users.find((user) => user.user_id === wanted) ?? null;
}

export function isLockedOut(user, now = new Date()) {
  if (!user.locked_until) return false;
  const until = new Date(user.locked_until);
  if (Number.isNaN(until.getTime())) return false;
  return until > now;
}

export function lockoutMinutesRemaining(user, now = new Date()) {
  const until = new Date(user.locked_until);
  return Math.max(1, Math.ceil((until - now) / 60000));
}

export async function createUser({ username, full_name, role, password, created_by }) {
  const normalized = String(username).trim().toLowerCase();
  const existing = await findUserByUsername(normalized, { fresh: true });
  if (existing) throw conflict(`The username "${normalized}" is already taken.`);

  const now = new Date().toISOString();
  const user = {
    user_id: ulid(),
    username: normalized,
    password_hash: await hashPassword(password),
    role: role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.OPERATOR,
    full_name: String(full_name).trim(),
    active: true,
    // Forces a change at first login, so the password the admin handed over
    // stops being valid as soon as it has been used once.
    must_change_password: true,
    failed_attempts: 0,
    locked_until: '',
    password_changed_at: now,
    last_login_at: '',
    created_at: now,
    created_by: created_by ?? 'bootstrap',
  };

  await appendObjects(TAB, user);
  return user;
}

async function patch(user, fields) {
  if (!user?._row) throw notFound('That user no longer exists.');
  return hydrate(await updateRow(TAB, user._row, fields));
}

export async function recordFailedLogin(user) {
  const attempts = user.failed_attempts + 1;
  const lock = attempts >= MAX_FAILED_ATTEMPTS;
  return patch(user, {
    failed_attempts: attempts,
    locked_until: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : '',
  });
}

export async function recordSuccessfulLogin(user) {
  return patch(user, {
    failed_attempts: 0,
    locked_until: '',
    last_login_at: new Date().toISOString(),
  });
}

/**
 * Sets a new password. `password_changed_at` moves, which invalidates every
 * session that was issued against the old password.
 */
export async function setPassword(user, plainPassword, { mustChangeAgain = false } = {}) {
  return patch(user, {
    password_hash: await hashPassword(plainPassword),
    password_changed_at: new Date().toISOString(),
    must_change_password: mustChangeAgain,
    failed_attempts: 0,
    locked_until: '',
  });
}

export async function setActive(user, active) {
  return patch(user, { active: Boolean(active) });
}

export async function setRole(user, role) {
  return patch(user, { role: role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.OPERATOR });
}
