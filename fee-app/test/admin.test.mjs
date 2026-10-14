import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeSpreadsheet, installEnv, installFetch } from './helpers/fake-sheets.mjs';
import { invoke } from './helpers/invoke.mjs';

installEnv();

const { default: listUsersApi } = await import('../api/admin/users/list.js');
const { default: createUserApi } = await import('../api/admin/users/create.js');
const { default: updateUserApi } = await import('../api/admin/users/update.js');
const { default: resetPasswordApi } = await import('../api/admin/users/reset-password.js');
const { default: loginHandler } = await import('../api/auth/login.js');
const { default: meHandler } = await import('../api/auth/me.js');
const { createUser, setPassword, findUserByUsername } = await import('../api/_lib/users.js');
const { invalidate } = await import('../api/_lib/table.js');
const { resetAuthCache } = await import('../api/_lib/google.js');
const { TABS } = await import('../api/_lib/sheet-schema.js');

const PASSWORD = 'SchoolFee2026';

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

async function signedIn(role = 'admin', username = role) {
  await createUser({ username, full_name: `${username} user`, role, password: PASSWORD, created_by: 'test' });
  const user = await findUserByUsername(username, { fresh: true });
  await setPassword(user, PASSWORD);
  const login = await invoke(loginHandler, { method: 'POST', body: { username, password: PASSWORD } });
  assert.equal(login.status, 200);
  return { cookie: login.cookie, user_id: login.json.user.user_id };
}

const post = (handlerFn, cookie, body) => invoke(handlerFn, { method: 'POST', cookie, body });

// ---- creating accounts ----------------------------------------------------

test('an admin creates an account and is shown the temporary password once', async () => {
  await withSheet(async (sheet) => {
    const admin = await signedIn('admin');

    const response = await post(createUserApi, admin.cookie, {
      username: 'office',
      full_name: 'Office Staff',
      role: 'operator',
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.user.username, 'office');
    assert.equal(response.json.user.role, 'operator');
    assert.ok(response.json.temporary_password, 'the password must come back once');
    assert.equal(response.json.user.password_hash, undefined);

    // Only the hash is stored - the password itself exists nowhere.
    const row = sheet.objects(TABS.USERS).find((user) => user.username === 'office');
    assert.match(row.password_hash, /^\$2[aby]\$/);
    assert.ok(!JSON.stringify(sheet.objects(TABS.USERS)).includes(response.json.temporary_password));

    // It works, and must be replaced at first sign-in.
    const login = await invoke(loginHandler, {
      method: 'POST',
      body: { username: 'office', password: response.json.temporary_password },
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.must_change_password, true);
  });
});

test('an operator cannot manage accounts at all', async () => {
  await withSheet(async () => {
    const operator = await signedIn('operator');

    for (const [name, handlerFn, body] of [
      ['create', createUserApi, { username: 'x1', full_name: 'X Y', role: 'operator' }],
      ['update', updateUserApi, { user_id: 'whatever', active: false }],
      ['reset', resetPasswordApi, { user_id: 'whatever' }],
    ]) {
      const response = await post(handlerFn, operator.cookie, body);
      assert.equal(response.status, 403, `${name} should be refused`);
      assert.equal(response.json.code, 'admin_only');
    }

    assert.equal((await invoke(listUsersApi, { cookie: operator.cookie })).status, 403);
  });
});

test('usernames stay unique', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const body = { username: 'office', full_name: 'Office Staff', role: 'operator' };
    assert.equal((await post(createUserApi, admin.cookie, body)).status, 200);

    const again = await post(createUserApi, admin.cookie, { ...body, username: 'OFFICE' });
    assert.equal(again.status, 409);
  });
});

// ---- the guard rails ------------------------------------------------------

test('an admin cannot deactivate or demote their own account', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');

    const deactivate = await post(updateUserApi, admin.cookie, { user_id: admin.user_id, active: false });
    assert.equal(deactivate.status, 403);
    assert.equal(deactivate.json.code, 'not_on_yourself');

    const demote = await post(updateUserApi, admin.cookie, { user_id: admin.user_id, role: 'operator' });
    assert.equal(demote.status, 403);

    // Still signed in and still an admin.
    assert.equal((await invoke(meHandler, { cookie: admin.cookie })).json.user.role, 'admin');
  });
});

test('the last administrator cannot be removed', async () => {
  await withSheet(async () => {
    const first = await signedIn('admin', 'bkpal');
    const second = await signedIn('admin', 'second');

    // Two admins: demoting one is allowed.
    const demote = await post(updateUserApi, second.cookie, { user_id: first.user_id, role: 'operator' });
    assert.equal(demote.status, 200);
    assert.equal(demote.json.user.role, 'operator');

    // One admin left, who is also the actor, so self-protection catches it.
    const self = await post(updateUserApi, second.cookie, { user_id: second.user_id, role: 'operator' });
    assert.equal(self.status, 403);

    // And from a third admin's seat, the last-admin rule is what catches it.
    const third = await signedIn('admin', 'third');
    await post(updateUserApi, third.cookie, { user_id: third.user_id, active: true }); // no-op
    const demoteSecond = await post(updateUserApi, third.cookie, { user_id: second.user_id, role: 'operator' });
    assert.equal(demoteSecond.status, 200, 'two admins remain, so this is fine');

    const demoteLast = await post(updateUserApi, second.cookie, { user_id: third.user_id, role: 'operator' });
    assert.equal(demoteLast.status, 403, 'second is no longer an admin');
  });
});

test('deactivating an account ends that person\'s session at once', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const operator = await signedIn('operator');
    assert.equal((await invoke(meHandler, { cookie: operator.cookie })).status, 200);

    const response = await post(updateUserApi, admin.cookie, { user_id: operator.user_id, active: false });
    assert.equal(response.status, 200);
    assert.equal(response.json.user.active, false);

    const after = await invoke(meHandler, { cookie: operator.cookie });
    assert.equal(after.status, 403);
    assert.equal(after.json.code, 'account_disabled');

    // And they cannot sign back in.
    const login = await invoke(loginHandler, { method: 'POST', body: { username: 'operator', password: PASSWORD } });
    assert.equal(login.status, 403);
  });
});

test('a role change takes effect on the next request', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const operator = await signedIn('operator');

    await post(updateUserApi, admin.cookie, { user_id: operator.user_id, role: 'admin' });

    const promoted = await invoke(meHandler, { cookie: operator.cookie });
    assert.equal(promoted.json.user.role, 'admin');
    // They can now do admin work on the session they already had.
    assert.equal((await invoke(listUsersApi, { cookie: operator.cookie })).status, 200);
  });
});

// ---- resetting a password -------------------------------------------------

test('a password reset issues a new one, clears the lockout and signs the user out', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const operator = await signedIn('operator');

    // Lock the account out with wrong passwords.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await invoke(loginHandler, { method: 'POST', body: { username: 'operator', password: 'WrongOne1' } });
    }
    const locked = await invoke(loginHandler, { method: 'POST', body: { username: 'operator', password: PASSWORD } });
    assert.equal(locked.status, 429);

    const reset = await post(resetPasswordApi, admin.cookie, { user_id: operator.user_id });
    assert.equal(reset.status, 200);
    assert.ok(reset.json.temporary_password);

    // The session they held is dead, because the stored password changed.
    assert.equal((await invoke(meHandler, { cookie: operator.cookie })).status, 401);

    // The old password no longer works; the new one does, and must be replaced.
    assert.equal(
      (await invoke(loginHandler, { method: 'POST', body: { username: 'operator', password: PASSWORD } })).status,
      401
    );
    const fresh = await invoke(loginHandler, {
      method: 'POST',
      body: { username: 'operator', password: reset.json.temporary_password },
    });
    assert.equal(fresh.status, 200, 'the lockout should have been cleared');
    assert.equal(fresh.json.must_change_password, true);
  });
});

test('the user list shows who is locked out, and never a hash', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    await signedIn('operator');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await invoke(loginHandler, { method: 'POST', body: { username: 'operator', password: 'WrongOne1' } });
    }

    const response = await invoke(listUsersApi, { cookie: admin.cookie });
    assert.equal(response.status, 200);

    const operator = response.json.users.find((user) => user.username === 'operator');
    assert.equal(operator.locked, true);
    assert.ok(operator.locked_minutes >= 1);
    assert.equal(operator.failed_attempts, 5);
    assert.ok(!JSON.stringify(response.json).includes('$2b$'), 'no hash may leave the server');
  });
});

test('account changes are written to the audit log', async () => {
  await withSheet(async (sheet) => {
    const admin = await signedIn('admin');
    const created = await post(createUserApi, admin.cookie, {
      username: 'office',
      full_name: 'Office Staff',
      role: 'operator',
    });
    await post(updateUserApi, admin.cookie, { user_id: created.json.user.user_id, role: 'admin' });
    await post(resetPasswordApi, admin.cookie, { user_id: created.json.user.user_id });

    const actions = sheet.objects(TABS.AUDIT_LOG).map((entry) => entry.action);
    assert.ok(actions.includes('user.create'));
    assert.ok(actions.includes('user.update'));
    assert.ok(actions.includes('user.reset_password'));

    // The temporary password must not be anywhere in the log.
    const log = JSON.stringify(sheet.objects(TABS.AUDIT_LOG));
    assert.ok(!log.includes(created.json.temporary_password));
  });
});

// ---- the fee structure ----------------------------------------------------

test('a monthly fee can be set per class, and replaced', async () => {
  await withSheet(async (sheet) => {
    const admin = await signedIn('admin');
    const { default: setFeeApi } = await import('../api/admin/fees/set.js');
    const { default: listFeesApi } = await import('../api/fees/list.js');

    await post(setFeeApi, admin.cookie, { academic_year: '2026-27', class: '5', monthly_fee: 800 });
    await post(setFeeApi, admin.cookie, { academic_year: '2026-27', class: 'NUR', monthly_fee: 600 });

    const listed = await invoke(listFeesApi, { cookie: admin.cookie, url: '/api/fees/list?academic_year=2026-27' });
    assert.equal(listed.json.fees.length, 2);
    assert.equal(listed.json.fees.find((fee) => fee.class === '5').monthly_fee, 800);

    // Raising it replaces the figure rather than adding a second row.
    const raised = await post(setFeeApi, admin.cookie, {
      academic_year: '2026-27',
      class: '5',
      monthly_fee: 900,
    });
    assert.equal(raised.json.fee.previous, 800);
    assert.equal(sheet.objects(TABS.FEE_STRUCTURE).length, 2, 'it must not duplicate the class');

    const after = await invoke(listFeesApi, { cookie: admin.cookie, url: '/api/fees/list?academic_year=2026-27' });
    assert.equal(after.json.fees.find((fee) => fee.class === '5').monthly_fee, 900);

    // The effective date is the start of that academic year.
    assert.equal(raised.json.fee.effective_from, '2026-04-01');
  });
});

test('fees are read by anyone signed in, but set only by an admin', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const operator = await signedIn('operator');
    const { default: setFeeApi } = await import('../api/admin/fees/set.js');
    const { default: listFeesApi } = await import('../api/fees/list.js');

    await post(setFeeApi, admin.cookie, { academic_year: '2026-27', class: '5', monthly_fee: 800 });

    // The entry form needs this, and operators use the entry form.
    const read = await invoke(listFeesApi, { cookie: operator.cookie, url: '/api/fees/list?academic_year=2026-27' });
    assert.equal(read.status, 200);
    assert.equal(read.json.fees.length, 1);

    const write = await post(setFeeApi, operator.cookie, {
      academic_year: '2026-27',
      class: '5',
      monthly_fee: 1,
    });
    assert.equal(write.status, 403);
  });
});

test('a fee of zero or a class the school does not have is refused', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const { default: setFeeApi } = await import('../api/admin/fees/set.js');

    assert.equal(
      (await post(setFeeApi, admin.cookie, { academic_year: '2026-27', class: '5', monthly_fee: 0 })).status,
      400
    );
    assert.equal(
      (await post(setFeeApi, admin.cookie, { academic_year: '2026-27', class: 'XI', monthly_fee: 800 })).status,
      400
    );
  });
});

// ---- the activity log -----------------------------------------------------

test('the activity log reads newest first and is admin only', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const operator = await signedIn('operator');
    const { default: auditApi } = await import('../api/admin/audit.js');

    await post(createUserApi, admin.cookie, { username: 'office', full_name: 'Office Staff', role: 'operator' });

    const response = await invoke(auditApi, { cookie: admin.cookie, url: '/api/admin/audit?limit=50' });
    assert.equal(response.status, 200);
    assert.ok(response.json.entries.length > 0);

    const timestamps = response.json.entries.map((entry) => entry.timestamp);
    assert.deepEqual(timestamps, [...timestamps].sort().reverse(), 'newest first');
    assert.equal(response.json.entries[0].action, 'user.create');

    assert.equal((await invoke(auditApi, { cookie: operator.cookie })).status, 403);
    assert.equal((await invoke(auditApi, {})).status, 401);
  });
});

test('the activity log limit is clamped to something sane', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const { default: auditApi } = await import('../api/admin/audit.js');

    assert.equal((await invoke(auditApi, { cookie: admin.cookie, url: '/api/admin/audit?limit=99999' })).json.limit, 500);
    assert.equal((await invoke(auditApi, { cookie: admin.cookie, url: '/api/admin/audit?limit=0' })).json.limit, 1);
    assert.equal((await invoke(auditApi, { cookie: admin.cookie, url: '/api/admin/audit?limit=abc' })).json.limit, 200);
  });
});
