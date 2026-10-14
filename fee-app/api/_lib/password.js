import { compare, hash } from 'bcryptjs';
import { randomInt } from 'node:crypto';

/**
 * Cost 12 takes a couple of hundred milliseconds per check, which is
 * unnoticeable on a login and expensive enough to make a stolen hash table
 * impractical to brute-force.
 */
const BCRYPT_COST = 12;

/**
 * A real hash of a throwaway string. Compared against when a username does not
 * exist, so a wrong username and a wrong password take the same time to answer
 * and cannot be told apart by timing.
 */
const DUMMY_HASH = '$2b$12$dxTh.hkXBmqOf7lNMdJ/v.oWzlMA65cAgcS2y8dhKqJEspSJJDYs.';

export const PASSWORD_MIN_LENGTH = 8;

export async function hashPassword(plain) {
  return hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain, storedHash) {
  if (!storedHash) {
    await compare(plain, DUMMY_HASH);
    return false;
  }
  return compare(plain, storedHash);
}

/** Burns the same time a real check would, for usernames that do not exist. */
export async function burnTime(plain = 'placeholder') {
  await compare(plain, DUMMY_HASH);
}

/**
 * Returns a human-readable complaint, or null if the password is acceptable.
 * Kept deliberately mild: staff here are not security professionals, and rules
 * so strict that passwords end up on a sticky note are worse than none.
 */
export function describePasswordProblem(password, { username = '' } = {}) {
  const value = String(password ?? '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (value.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[A-Za-z]/.test(value)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.';
  if (username && value.toLowerCase().includes(String(username).toLowerCase())) {
    return 'Password must not contain the username.';
  }
  if (/^(password|12345678|qwerty)/i.test(value)) return 'Please choose a less obvious password.';
  return null;
}

// Omits characters that get misread when a password is written on paper and
// handed over: 0/O and 1/l/I.
const SAFE_LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const SAFE_DIGITS = '23456789';
const SAFE_CHARS = SAFE_LETTERS + SAFE_DIGITS;

const pick = (alphabet) => alphabet[randomInt(alphabet.length)];

/** A temporary password for an admin to hand over. The user must change it at first login. */
export function generateTempPassword(length = 12) {
  if (length < 8) throw new Error('Temporary passwords must be at least 8 characters.');

  const chars = Array.from({ length }, () => pick(SAFE_CHARS));

  // Force one digit and one letter into distinct positions, so the result
  // always satisfies describePasswordProblem no matter what was drawn.
  const digitAt = randomInt(length);
  let letterAt = randomInt(length);
  while (letterAt === digitAt) letterAt = randomInt(length);
  chars[digitAt] = pick(SAFE_DIGITS);
  chars[letterAt] = pick(SAFE_LETTERS);

  return chars.join('');
}
