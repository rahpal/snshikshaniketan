import { randomBytes } from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no I/L/O/U
const TIME_LEN = 10;
const RANDOM_LEN = 16;

/**
 * ULID: time-sortable, collision-resistant, generated without coordinating with
 * anything else. That matters here because two staff can submit a payment at the
 * same moment on two different serverless instances, where a shared counter in a
 * spreadsheet cell could not be incremented safely.
 */
export function ulid(now = Date.now()) {
  let time = '';
  let remainder = now;
  for (let i = TIME_LEN - 1; i >= 0; i -= 1) {
    time = ENCODING[remainder % 32] + time;
    remainder = Math.floor(remainder / 32);
  }

  const bytes = randomBytes(RANDOM_LEN);
  let random = '';
  for (let i = 0; i < RANDOM_LEN; i += 1) random += ENCODING[bytes[i] % 32];

  return time + random;
}

/** A short, human-speakable suffix for receipt numbers. */
export function shortId(length = 6) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ENCODING[bytes[i] % 32];
  return out;
}
