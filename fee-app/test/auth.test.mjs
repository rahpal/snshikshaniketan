import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeSpreadsheet, installEnv, installFetch } from './helpers/fake-sheets.mjs';
import { invoke } from './helpers/invoke.mjs';

installEnv();

const { default: loginHandler } = await import('../api/auth/login.js');
const { default: logoutHandler } = await import('../api/auth/logout.js');
const { default: meHandler } = await import('../api/auth/me.js');
const { default: changePasswordHandler } = await import('../api/auth/change-password.js');
const { createUser, findUserByUsername, setActive, MAX_FAILED_ATTEMPTS } = await import('../api/_lib/users.js');
const { requireAdmin, requireAuth, loadSessionUser, assertSameOrigin } = await import('../api/_lib/guards.js');
const { invalidate } = await import('../api/_lib/table.js');
const { resetAuthCache } = await import('../api/_lib/google.js');
const { TABS } = await import('../api/_lib/sheet-schema.js');

const PASSWORD = 'SchoolFee2026';

/**
 * Each test gets its own empty spreadsheet and its own fetch stub, so nothing
 * carries over between them.
 */
async function withSheet(run) {
  const sheet = new FakeSpreadsheet();
  const restore = installFetch(sheet);
  invalidate();
  resetAuthCache();
  try {
    return await run(sheet);
  } finally {
    restore();
    invalidate();
  }
}

async function seedUser({ username = 'rahul', role = 'admin', password = PASSWORD } = {}) {
  await createUser({
    username,
    full_name: username === 'rahul' ? 'Rahul Pal' : 'Office Staff',
    role,
    password,
    created_by: 'test',
  });
  return findUserByUsername(username, { fresh: true });
}

async function signIn({ username = 'rahul', password = PASSWORD } = {}) {
  const response = await invoke(loginHandler, {
    method: 'POST',
    body: { username, password },
  });
  return response;
}

// ---- signing in -----------------------------------------------------------

test('a correct username and password signs in and sets an httpOnly session cookie', async () => {
  await withSheet(async () => {
    await seedUser();
    const response = await signIn();

    assert.equal(response.status, 200);
    assert.equal(response.json.user.username, 'rahul');
    assert.equal(response.json.user.role, 'admin');
    // A newly created account always owes a password change.
    assert.equal(response.json.must_change_password, true);
    // The hash must never leave the server.
    assert.equal(response.json.user.password_hash, undefined);

    const cookie = response.setCookie;
    assert.ok(cookie, 'expected a Set-Cookie header');
    assert.match(cookie, /^sns_fee_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
  });
});

test('a wrong password is refused with the same message as an unknown user', async () => {
  await withSheet(async () => {
    await seedUser();

    const wrongPassword = await signIn({ password: 'NotThePassword9' });
    const unknownUser = await signIn({ username: 'nobody', password: 'NotThePassword9' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    // Identical answers: this endpoint cannot be used to discover usernames.
    assert.equal(wrongPassword.json.error, unknownUser.json.error);
    assert.equal(wrongPassword.json.code, 'invalid_credentials');
    assert.equal(wrongPassword.setCookie, null);
  });
});

test('failed attempts accumulate and lock the account, and a success clears them', async () => {
  await withSheet(async () => {
    await seedUser();

    for (let attempt = 1; attempt < MAX_FAILED_ATTEMPTS; attempt += 1) {
      const response = await signIn({ password: 'WrongPassword1' });
      assert.equal(response.status, 401, `attempt ${attempt} should be refused, not locked`);
    }

    const locking = await signIn({ password: 'WrongPassword1' });
    assert.equal(locking.status, 401);

    // Now locked: even the correct password is refused, with a different code.
    const locked = await signIn();
    assert.equal(locked.status, 429);
    assert.equal(locked.json.code, 'too_many_requests');
    assert.ok(locked.json.details.minutes >= 1);
  });
});

test('a successful sign-in resets the failed-attempt counter', async () => {
  await withSheet(async (sheet) => {
    await seedUser();
    await signIn({ password: 'WrongPassword1' });
    await signIn({ password: 'WrongPassword1' });

    const success = await signIn();
    assert.equal(success.status, 200);

    const [user] = sheet.objects(TABS.USERS);
    assert.equal(Number(user.failed_attempts), 0);
    assert.equal(user.locked_until, '');
    assert.ok(user.last_login_at, 'last_login_at should be recorded');
  });
});

test('a deactivated account cannot sign in, and is told why once it has proven the password', async () => {
  await withSheet(async () => {
    const user = await seedUser();
    await setActive(user, false);

    const response = await signIn();
    assert.equal(response.status, 403);
    assert.equal(response.json.code, 'account_disabled');
    assert.equal(response.setCookie, null);
  });
});

test('a cross-site sign-in attempt is rejected', async () => {
  await withSheet(async () => {
    await seedUser();
    const response = await invoke(loginHandler, {
      method: 'POST',
      body: { username: 'rahul', password: PASSWORD },
      origin: 'https://attacker.example',
    });
    assert.equal(response.status, 403);
    assert.equal(response.json.code, 'cross_origin');
  });
});

test('login rejects anything but POST', async () => {
  await withSheet(async () => {
    const response = await invoke(loginHandler, { method: 'GET' });
    assert.equal(response.status, 405);
  });
});

// ---- the session ----------------------------------------------------------

test('the session cookie identifies the user on later requests', async () => {
  await withSheet(async () => {
    await seedUser();
    const { cookie } = await signIn();

    const me = await invoke(meHandler, { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.json.user.username, 'rahul');
    assert.equal(me.json.must_change_password, true);
  });
});

test('no cookie, a junk cookie and a forged cookie are all refused', async () => {
  await withSheet(async () => {
    await seedUser();

    assert.equal((await invoke(meHandler)).status, 401);
    assert.equal((await invoke(meHandler, { cookie: 'sns_fee_session=garbage' })).status, 401);

    // A token signed with a different secret must not be accepted.
    const { SignJWT } = await import('jose');
    const forged = await new SignJWT({ username: 'rahul', role: 'admin', pwd_at: '' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('whatever')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-different-secret-that-is-long-enough-x'));

    const response = await invoke(meHandler, { cookie: `sns_fee_session=${forged}` });
    assert.equal(response.status, 401);
    assert.equal(response.json.code, 'session_invalid');
  });
});

test('deactivating a user invalidates their existing session immediately', async () => {
  await withSheet(async () => {
    const user = await seedUser();
    const { cookie } = await signIn();
    assert.equal((await invoke(meHandler, { cookie })).status, 200);

    await setActive(user, false);

    const after = await invoke(meHandler, { cookie });
    assert.equal(after.status, 403);
    assert.equal(after.json.code, 'account_disabled');
  });
});

test('signing out clears the cookie', async () => {
  await withSheet(async () => {
    await seedUser();
    const { cookie } = await signIn();

    const response = await invoke(logoutHandler, { method: 'POST', cookie });
    assert.equal(response.status, 200);
    assert.match(response.setCookie, /sns_fee_session=;/);
    assert.match(response.setCookie, /Max-Age=0/);
  });
});

test('signing out without a valid session still succeeds', async () => {
  await withSheet(async () => {
    const response = await invoke(logoutHandler, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.match(response.setCookie, /Max-Age=0/);
  });
});

// ---- changing a password --------------------------------------------------

test('changing the password clears the forced-change flag and keeps the user signed in', async () => {
  await withSheet(async () => {
    await seedUser();
    const { cookie } = await signIn();

    const response = await invoke(changePasswordHandler, {
      method: 'POST',
      cookie,
      body: { currentPassword: PASSWORD, newPassword: 'MyOwnPassword77' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.must_change_password, false);
    // A fresh cookie comes back, because the old one is now invalid.
    assert.ok(response.cookie);

    const me = await invoke(meHandler, { cookie: response.cookie });
    assert.equal(me.status, 200);
    assert.equal(me.json.must_change_password, false);

    // The new password works and the old one does not.
    assert.equal((await signIn({ password: 'MyOwnPassword77' })).status, 200);
    assert.equal((await signIn({ password: PASSWORD })).status, 401);
  });
});

test('changing the password invalidates sessions issued against the old one', async () => {
  await withSheet(async () => {
    await seedUser();
    const first = await signIn();
    const second = await signIn();

    const changed = await invoke(changePasswordHandler, {
      method: 'POST',
      cookie: second.cookie,
      body: { currentPassword: PASSWORD, newPassword: 'MyOwnPassword77' },
    });
    assert.equal(changed.status, 200);

    // The other session - a different browser, or a stolen cookie - is dead.
    const stale = await invoke(meHandler, { cookie: first.cookie });
    assert.equal(stale.status, 401);
    assert.equal(stale.json.code, 'password_changed');
  });
});

test('the change-password endpoint checks the current password and the new one', async () => {
  await withSheet(async () => {
    await seedUser();
    const { cookie } = await signIn();

    const wrongCurrent = await invoke(changePasswordHandler, {
      method: 'POST',
      cookie,
      body: { currentPassword: 'NotIt12345', newPassword: 'MyOwnPassword77' },
    });
    assert.equal(wrongCurrent.status, 401);
    assert.equal(wrongCurrent.json.code, 'wrong_password');

    const unchanged = await invoke(changePasswordHandler, {
      method: 'POST',
      cookie,
      body: { currentPassword: PASSWORD, newPassword: PASSWORD },
    });
    assert.equal(unchanged.status, 400);

    const tooWeak = await invoke(changePasswordHandler, {
      method: 'POST',
      cookie,
      body: { currentPassword: PASSWORD, newPassword: 'alllowercase' },
    });
    assert.equal(tooWeak.status, 400);
    assert.ok(tooWeak.json.details.newPassword);

    const containsUsername = await invoke(changePasswordHandler, {
      method: 'POST',
      cookie,
      body: { currentPassword: PASSWORD, newPassword: 'rahul12345' },
    });
    assert.equal(containsUsername.status, 400);
  });
});

test('validation failures name the fields that are wrong', async () => {
  await withSheet(async () => {
    const response = await invoke(loginHandler, { method: 'POST', body: { username: '' } });
    assert.equal(response.status, 400);
    assert.equal(response.json.code, 'validation_failed');
    assert.ok(response.json.details.username);
    assert.ok(response.json.details.password);
  });
});

// ---- roles ---------------------------------------------------------------

test('an operator is refused by requireAdmin but allowed by requireAuth', async () => {
  await withSheet(async () => {
    const operator = await seedUser({ username: 'office', role: 'operator' });
    // Clear the forced change so requireAuth is testing the role, not the flag.
    const { setPassword } = await import('../api/_lib/users.js');
    await setPassword(operator, PASSWORD);

    const { cookie } = await signIn({ username: 'office' });
    const req = { headers: { cookie, host: 'fees.example.test' } };

    const user = await requireAuth(req);
    assert.equal(user.username, 'office');
    assert.equal(user.role, 'operator');

    await assert.rejects(() => requireAdmin(req), (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'admin_only');
      return true;
    });
  });
});

test('an admin passes requireAdmin once the forced password change is done', async () => {
  await withSheet(async () => {
    const admin = await seedUser();
    const { setPassword } = await import('../api/_lib/users.js');
    await setPassword(admin, PASSWORD);

    const { cookie } = await signIn();
    const user = await requireAdmin({ headers: { cookie, host: 'fees.example.test' } });
    assert.equal(user.role, 'admin');
  });
});

test('a user who still owes a password change is held at that screen', async () => {
  await withSheet(async () => {
    await seedUser();
    const { cookie } = await signIn();
    const req = { headers: { cookie, host: 'fees.example.test' } };

    await assert.rejects(() => requireAuth(req), (error) => {
      assert.equal(error.code, 'password_change_required');
      return true;
    });

    // The change-password screen itself must stay reachable.
    const user = await requireAuth(req, { allowPasswordChangePending: true });
    assert.equal(user.username, 'rahul');
    // And so must the session lookup it is built on.
    assert.equal((await loadSessionUser(req)).username, 'rahul');
  });
});

// ---- users in the sheet --------------------------------------------------

test('creating a user stores a bcrypt hash, never the password', async () => {
  await withSheet(async (sheet) => {
    await seedUser();
    const [row] = sheet.objects(TABS.USERS);

    assert.match(row.password_hash, /^\$2[aby]\$/);
    assert.ok(!row.password_hash.includes(PASSWORD));
    assert.equal(row.username, 'rahul');
    assert.equal(row.role, 'admin');
    assert.equal(row.active, 'TRUE');
    assert.equal(row.must_change_password, 'TRUE');
    assert.ok(row.user_id);
    assert.ok(row.created_at);
  });
});

test('usernames are unique regardless of case', async () => {
  await withSheet(async () => {
    await seedUser({ username: 'rahul' });
    await assert.rejects(
      () => createUser({ username: 'RAHUL', full_name: 'Someone Else', role: 'operator', password: PASSWORD }),
      /already taken/
    );
  });
});

test('every sign-in and failure is written to the audit log', async () => {
  await withSheet(async (sheet) => {
    await seedUser();
    await signIn();
    await signIn({ password: 'WrongPassword1' });

    const entries = sheet.objects(TABS.AUDIT_LOG);
    const actions = entries.map((entry) => entry.action);
    assert.ok(actions.includes('login.success'));
    assert.ok(actions.includes('login.failed'));

    const success = entries.find((entry) => entry.action === 'login.success');
    assert.equal(success.user, 'rahul');
    assert.equal(success.ip, '203.0.113.7');
    assert.ok(success.timestamp);
    // The log must not carry the password or the hash.
    const serialised = JSON.stringify(entries);
    assert.ok(!serialised.includes(PASSWORD));
    assert.ok(!serialised.includes('$2b$'));
  });
});

test('same-origin checking allows a missing Origin header but rejects a mismatch', () => {
  assert.doesNotThrow(() => assertSameOrigin({ headers: { host: 'fees.example.test' } }));
  assert.doesNotThrow(() =>
    assertSameOrigin({ headers: { host: 'fees.example.test', origin: 'https://fees.example.test' } })
  );
  assert.throws(() => assertSameOrigin({ headers: { host: 'fees.example.test', origin: 'https://evil.test' } }));
  assert.throws(() => assertSameOrigin({ headers: { host: 'fees.example.test', origin: 'not-a-url' } }));
});
