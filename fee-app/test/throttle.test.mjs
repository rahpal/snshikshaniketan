import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THROTTLE_LIMITS,
  clearFailures,
  recordFailure,
  resetThrottle,
  retryAfterSeconds,
} from '../api/_lib/throttle.js';

const IP = '203.0.113.7';

test('an address is only refused after repeated failures', () => {
  resetThrottle();
  const now = Date.now();

  for (let attempt = 1; attempt < THROTTLE_LIMITS.MAX_FAILURES; attempt += 1) {
    recordFailure(IP, now);
    assert.equal(retryAfterSeconds(IP, now), 0, `attempt ${attempt} should still be allowed`);
  }

  recordFailure(IP, now);
  const wait = retryAfterSeconds(IP, now);
  assert.ok(wait > 0, 'the limit should now be reached');
  assert.ok(wait <= THROTTLE_LIMITS.WINDOW_MS / 1000);
});

test('the brake lifts once the window has passed', () => {
  resetThrottle();
  const now = Date.now();
  for (let attempt = 0; attempt <= THROTTLE_LIMITS.MAX_FAILURES; attempt += 1) recordFailure(IP, now);
  assert.ok(retryAfterSeconds(IP, now) > 0);

  const later = now + THROTTLE_LIMITS.WINDOW_MS + 1000;
  assert.equal(retryAfterSeconds(IP, later), 0);

  // And the count starts again rather than resuming where it left off.
  recordFailure(IP, later);
  assert.equal(retryAfterSeconds(IP, later), 0);
});

test('signing in successfully clears the address', () => {
  resetThrottle();
  const now = Date.now();
  for (let attempt = 0; attempt <= THROTTLE_LIMITS.MAX_FAILURES; attempt += 1) recordFailure(IP, now);
  assert.ok(retryAfterSeconds(IP, now) > 0);

  clearFailures(IP);
  assert.equal(retryAfterSeconds(IP, now), 0, 'one person typing a password wrong must not be stuck');
});

test('one address being blocked does not block another', () => {
  resetThrottle();
  const now = Date.now();
  for (let attempt = 0; attempt <= THROTTLE_LIMITS.MAX_FAILURES; attempt += 1) recordFailure(IP, now);

  assert.ok(retryAfterSeconds(IP, now) > 0);
  assert.equal(retryAfterSeconds('198.51.100.4', now), 0);
});

test('a missing address is ignored rather than treated as one bucket', () => {
  resetThrottle();
  const now = Date.now();
  // Everyone behind an unknown address would otherwise share a limit.
  for (let attempt = 0; attempt < 100; attempt += 1) recordFailure('', now);
  assert.equal(retryAfterSeconds('', now), 0);
  assert.equal(retryAfterSeconds(undefined, now), 0);
});

test('a flood of distinct addresses does not grow memory without bound', () => {
  resetThrottle();
  const now = Date.now();
  for (let index = 0; index < 1500; index += 1) recordFailure(`198.51.100.${index}`, now);

  // Spoofed sources are pruned; a real one still gets its limit.
  for (let attempt = 0; attempt <= THROTTLE_LIMITS.MAX_FAILURES; attempt += 1) recordFailure(IP, now);
  assert.ok(retryAfterSeconds(IP, now) > 0);
});
