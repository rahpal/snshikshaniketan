import test from 'node:test';
import assert from 'node:assert/strict';

import { BACKUP_SHEET_ID, FakeSpreadsheet, installEnv, installFetch } from './helpers/fake-sheets.mjs';
import { invoke } from './helpers/invoke.mjs';

installEnv();

const { runBackup } = await import('../api/_lib/backup.js');
const { default: cronBackup } = await import('../api/cron/backup.js');
const { default: loginHandler } = await import('../api/auth/login.js');
const { createUser, setPassword, findUserByUsername } = await import('../api/_lib/users.js');
const { createStudent } = await import('../api/_lib/students.js');
const { createPayment } = await import('../api/_lib/payments.js');
const { invalidate } = await import('../api/_lib/table.js');
const { resetAuthCache } = await import('../api/_lib/google.js');
const { resetThrottle } = await import('../api/_lib/throttle.js');
const { TABS } = await import('../api/_lib/sheet-schema.js');

const PASSWORD = 'SchoolFee2026';
const YEAR = '2026-27';

async function withSheets(run) {
  const live = new FakeSpreadsheet();
  // A brand new, empty backup file, as the school would have just created.
  const backup = new FakeSpreadsheet({ seedHeaders: false });
  const restore = installFetch(live, { [BACKUP_SHEET_ID]: backup });
  invalidate();
  resetAuthCache();
  resetThrottle();
  try {
    return await run({ live, backup });
  } finally {
    restore();
    invalidate();
    delete process.env.BACKUP_SHEET_ID;
    delete process.env.CRON_SECRET;
  }
}

async function seedRegister() {
  await createUser({ username: 'bkpal', full_name: 'BK Pal', role: 'admin', password: PASSWORD, created_by: 't' });
  await setPassword(await findUserByUsername('bkpal', { fresh: true }), PASSWORD);
  const student = await createStudent(
    { academic_year: YEAR, class: '5', student_name: 'Arjun Verma', parent_name: 'Rakesh Verma' },
    'bkpal'
  );
  await createPayment(
    {
      academic_year: YEAR,
      class: '5',
      student_id: student.student_id,
      student_name: 'Arjun Verma',
      parent_name: 'Rakesh Verma',
      months: [{ month: '2026-04', amount: 800 }, { month: '2026-05', amount: 800 }],
      payment_date: '2026-05-10',
      payment_mode: 'cash',
      remarks: '',
    },
    { username: 'bkpal' }
  );
}

test('a backup copies every tab into the second spreadsheet', async () => {
  await withSheets(async ({ live, backup }) => {
    await seedRegister();

    const result = await runBackup({ backupSheetId: BACKUP_SHEET_ID, now: new Date('2026-10-18T18:30:00Z') });
    assert.equal(result.ok, true);
    assert.ok(result.at);

    for (const tab of Object.values(TABS)) {
      assert.ok(backup.tabs.has(tab), `${tab} should exist in the backup`);
      // Compared as records, not as raw arrays: the Sheets API does not return
      // trailing empty cells, so a copied row is legitimately shorter than the
      // original while holding exactly the same data.
      assert.deepEqual(backup.rows(tab)[0], live.rows(tab)[0], `${tab} headers`);
      assert.deepEqual(backup.objects(tab), live.objects(tab), `${tab} rows`);
    }

    // The payments really are there, not just the headers.
    const payments = backup.objects(TABS.PAYMENTS);
    assert.equal(payments.length, 2);
    assert.equal(payments[0].student_name, 'Arjun Verma');

    const counts = Object.fromEntries(result.tabs.map((entry) => [entry.tab, entry.rows]));
    assert.equal(counts[TABS.PAYMENTS], 2);
    assert.equal(counts[TABS.STUDENTS], 1);
  });
});

test('a backup records when it ran, and what it found', async () => {
  await withSheets(async ({ backup }) => {
    await seedRegister();
    await runBackup({ backupSheetId: BACKUP_SHEET_ID, now: new Date('2026-10-18T18:30:00Z') });

    const snapshot = backup.rows('Snapshot');
    assert.equal(snapshot[0][0], 'Backed up at');
    assert.equal(snapshot[0][1], '2026-10-18T18:30:00.000Z');
    assert.deepEqual(snapshot[1], ['Tab', 'Rows']);
    assert.ok(snapshot.some((row) => row[0] === TABS.PAYMENTS && row[1] === 2));
  });
});

test('a later, smaller backup does not leave the tail of the previous one behind', async () => {
  await withSheets(async ({ live, backup }) => {
    await seedRegister();
    await runBackup({ backupSheetId: BACKUP_SHEET_ID });
    assert.equal(backup.objects(TABS.PAYMENTS).length, 2);

    // The live register shrinks - a void and a tidy-up, or a new year.
    live.tabs.set(TABS.PAYMENTS, [live.rows(TABS.PAYMENTS)[0]]);
    invalidate();
    await runBackup({ backupSheetId: BACKUP_SHEET_ID });

    assert.equal(
      backup.objects(TABS.PAYMENTS).length,
      0,
      'the backup must mirror the register, not accumulate rows'
    );
  });
});

test('running the backup twice is harmless', async () => {
  await withSheets(async ({ live, backup }) => {
    await seedRegister();
    await runBackup({ backupSheetId: BACKUP_SHEET_ID });
    await runBackup({ backupSheetId: BACKUP_SHEET_ID });

    assert.deepEqual(backup.objects(TABS.PAYMENTS), live.objects(TABS.PAYMENTS));
    assert.equal(backup.objects(TABS.PAYMENTS).length, 2);
  });
});

test('with no backup spreadsheet configured, the job reports rather than fails', async () => {
  await withSheets(async () => {
    await seedRegister();
    const result = await runBackup({ backupSheetId: undefined });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, 'not_configured');
  });
});

// ---- who may run it -------------------------------------------------------

test("the scheduler's secret runs the backup", async () => {
  await withSheets(async ({ backup }) => {
    await seedRegister();
    process.env.CRON_SECRET = 'a-secret-the-scheduler-sends';
    process.env.BACKUP_SHEET_ID = BACKUP_SHEET_ID;

    const response = await invoke(cronBackup, {
      headers: { authorization: 'Bearer a-secret-the-scheduler-sends' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(backup.objects(TABS.PAYMENTS).length, 2);
  });
});

test('a wrong secret, or none, is refused without saying why', async () => {
  await withSheets(async ({ backup }) => {
    await seedRegister();
    process.env.CRON_SECRET = 'a-secret-the-scheduler-sends';
    process.env.BACKUP_SHEET_ID = BACKUP_SHEET_ID;

    for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: 'Basic x' }]) {
      const response = await invoke(cronBackup, { headers });
      assert.equal(response.status, 403);
      assert.equal(response.json.code, 'not_permitted');
      // The message must not reveal whether a secret is set, or what it is.
      assert.ok(!response.json.error.includes('secret'));
    }

    assert.equal(backup.tabs.size, 0, 'nothing should have been copied');
  });
});

test('an administrator can take a backup by hand, an operator cannot', async () => {
  await withSheets(async ({ backup }) => {
    await seedRegister();
    process.env.BACKUP_SHEET_ID = BACKUP_SHEET_ID;

    await createUser({ username: 'office', full_name: 'Office', role: 'operator', password: PASSWORD, created_by: 't' });
    await setPassword(await findUserByUsername('office', { fresh: true }), PASSWORD);

    const asOperator = await invoke(loginHandler, { method: 'POST', body: { username: 'office', password: PASSWORD } });
    const refused = await invoke(cronBackup, { cookie: asOperator.cookie });
    assert.equal(refused.status, 403);
    assert.equal(backup.tabs.size, 0);

    const asAdmin = await invoke(loginHandler, { method: 'POST', body: { username: 'bkpal', password: PASSWORD } });
    const allowed = await invoke(cronBackup, { cookie: asAdmin.cookie });
    assert.equal(allowed.status, 200);
    assert.equal(backup.objects(TABS.PAYMENTS).length, 2);
  });
});

test('the endpoint says plainly when no backup spreadsheet is configured', async () => {
  await withSheets(async () => {
    await seedRegister();
    process.env.CRON_SECRET = 'secret';

    const response = await invoke(cronBackup, { headers: { authorization: 'Bearer secret' } });
    assert.equal(response.status, 200);
    assert.equal(response.json.skipped, 'not_configured');
    assert.match(response.json.message, /BACKUP_SHEET_ID/);
  });
});
