/**
 * A best-effort brake on repeated failed sign-ins from one address.
 *
 * The real control against guessing a password is the per-account lockout in
 * users.js, which is stored in the spreadsheet and therefore holds across every
 * serverless instance. This is for something different: a flood of attempts
 * costs a bcrypt comparison and two spreadsheet writes each, so without a brake
 * someone can exhaust the Sheets API quota and take the register down for the
 * office. Refusing here costs nothing and touches nothing.
 *
 * It is deliberately in memory, and therefore per instance: an attacker spread
 * across instances gets a higher ceiling than the numbers below suggest. That
 * is accepted. It is a cost-limiter, not an access control, and nothing relies
 * on it for correctness.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;
const MAX_TRACKED = 1000;

const failures = new Map(); // ip -> { count, resetAt }

/** Visible for tests; also lets a long-lived instance start clean. */
export function resetThrottle() {
  failures.clear();
}

function prune(now) {
  for (const [ip, entry] of failures) {
    if (entry.resetAt <= now) failures.delete(ip);
  }
  // A stream of spoofed addresses must not grow this without bound.
  if (failures.size > MAX_TRACKED) {
    const oldest = [...failures.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [ip] of oldest.slice(0, failures.size - MAX_TRACKED)) failures.delete(ip);
  }
}

/** Seconds to wait, or 0 when this address may try again now. */
export function retryAfterSeconds(ip, now = Date.now()) {
  if (!ip) return 0;
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) return 0;
  if (entry.count < MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
}

export function recordFailure(ip, now = Date.now()) {
  if (!ip) return;
  prune(now);
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) {
    failures.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/** A successful sign-in clears the address, so one typo costs a user nothing. */
export function clearFailures(ip) {
  if (ip) failures.delete(ip);
}

export const THROTTLE_LIMITS = { WINDOW_MS, MAX_FAILURES };
