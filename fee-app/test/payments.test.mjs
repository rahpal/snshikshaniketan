import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeSpreadsheet, installEnv, installFetch } from './helpers/fake-sheets.mjs';
import { invoke } from './helpers/invoke.mjs';

installEnv();

const { default: createPayment } = await import('../api/payments/create.js');
const { default: listPayments } = await import('../api/payments/list.js');
const { default: listStudents } = await import('../api/students/list.js');
const { default: createStudent } = await import('../api/students/create.js');
const { default: importStudents } = await import('../api/students/import.js');
const { default: loginHandler } = await import('../api/auth/login.js');
const { createUser, setPassword, findUserByUsername } = await import('../api/_lib/users.js');
const { invalidate } = await import('../api/_lib/table.js');
const { resetAuthCache } = await import('../api/_lib/google.js');
const { TABS } = await import('../api/_lib/sheet-schema.js');

const PASSWORD = 'SchoolFee2026';
const YEAR = '2026-27';

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

/** A signed-in user of the given role, past the forced password change. */
async function signedIn(role = 'operator', username = role) {
  await createUser({ username, full_name: `${username} user`, role, password: PASSWORD, created_by: 'test' });
  await setPassword(await findUserByUsername(username, { fresh: true }), PASSWORD);
  const login = await invoke(loginHandler, { method: 'POST', body: { username, password: PASSWORD } });
  assert.equal(login.status, 200, 'test sign-in should succeed');
  return login.cookie;
}

const BASE_PAYMENT = {
  academic_year: YEAR,
  class: '5',
  student_name: 'Arjun Verma',
  parent_name: 'Rakesh Verma',
  months: [
    { month: '2026-04', amount: 800 },
    { month: '2026-05', amount: 800 },
    { month: '2026-06', amount: 800 },
  ],
  payment_date: '2026-06-10',
  payment_mode: 'upi',
  remarks: 'paid at office',
};

const pay = (cookie, overrides = {}) =>
  invoke(createPayment, { method: 'POST', cookie, body: { ...BASE_PAYMENT, ...overrides } });

// ---- recording a payment --------------------------------------------------

test('an operator can record a payment covering several months', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn('operator');
    const response = await pay(cookie);

    assert.equal(response.status, 200);
    assert.match(response.json.receipt_no, /^SNS-202627-[0-9A-Z]{6}$/);
    assert.equal(response.json.total, 2400);

    // One row per month, all under one receipt number.
    const rows = sheet.objects(TABS.PAYMENTS);
    assert.equal(rows.length, 3);
    assert.equal(new Set(rows.map((row) => row.receipt_no)).size, 1);
    assert.deepEqual(rows.map((row) => row.month).sort(), ['2026-04', '2026-05', '2026-06']);
    assert.equal(rows.reduce((sum, row) => sum + Number(row.amount), 0), 2400);

    const [first] = rows;
    assert.equal(first.student_name, 'Arjun Verma');
    assert.equal(first.parent_name, 'Rakesh Verma');
    assert.equal(first.class, '5');
    assert.equal(Number(first.receipt_total), 2400);
    assert.equal(first.payment_mode, 'upi');
    assert.equal(first.remarks, 'paid at office');
    assert.equal(first.status, 'active');
    // Who recorded it comes from the session, never from the form.
    assert.equal(first.entered_by, 'operator');
    assert.ok(first.entered_at);
  });
});

test('each month keeps the amount entered against it', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();
    // June costs more (an exam month); July is a part payment.
    const response = await pay(cookie, {
      months: [
        { month: '2026-05', amount: 800 },
        { month: '2026-06', amount: 1200 },
        { month: '2026-07', amount: 500 },
      ],
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.total, 2500);

    const byMonth = Object.fromEntries(
      sheet.objects(TABS.PAYMENTS).map((row) => [row.month, Number(row.amount)])
    );
    assert.deepEqual(byMonth, { '2026-05': 800, '2026-06': 1200, '2026-07': 500 });

    // Every row carries the same receipt total: the sum of the months.
    const totals = sheet.objects(TABS.PAYMENTS).map((row) => Number(row.receipt_total));
    assert.deepEqual(totals, [2500, 2500, 2500]);
  });
});

test('amounts that do not add up neatly are stored exactly as entered', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();
    const response = await pay(cookie, {
      months: [
        { month: '2026-04', amount: 333.33 },
        { month: '2026-05', amount: 333.33 },
        { month: '2026-06', amount: 333.34 },
      ],
    });

    assert.equal(response.json.total, 1000);
    const amounts = sheet.objects(TABS.PAYMENTS).map((row) => Number(row.amount));
    assert.deepEqual(amounts.sort(), [333.33, 333.33, 333.34]);
  });
});

test('a month with no amount, or a zero amount, is refused', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();

    const missing = await pay(cookie, { months: [{ month: '2026-04' }] });
    assert.equal(missing.status, 400);

    const zero = await pay(cookie, { months: [{ month: '2026-04', amount: 0 }] });
    assert.equal(zero.status, 400);

    const negative = await pay(cookie, { months: [{ month: '2026-04', amount: -800 }] });
    assert.equal(negative.status, 400);
  });
});

test('recording a payment for someone not on the list adds them to it', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();
    const first = await pay(cookie);

    assert.equal(first.json.student_added, true);
    const roster = sheet.objects(TABS.STUDENTS);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].student_name, 'Arjun Verma');
    assert.equal(roster[0].class, '5');
    assert.equal(roster[0].academic_year, YEAR);

    // A second payment for the same child reuses that record rather than
    // creating a duplicate student.
    const second = await pay(cookie, { months: [{ month: '2026-07', amount: 800 }] });
    assert.equal(second.status, 200);
    assert.equal(second.json.student_added, false);
    assert.equal(second.json.student_id, first.json.student_id);
    assert.equal(sheet.objects(TABS.STUDENTS).length, 1);
  });
});

test('paying a month twice is refused, and says which months and receipts clash', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    const first = await pay(cookie);

    const clash = await pay(cookie, {
      months: [
        { month: '2026-06', amount: 800 },
        { month: '2026-07', amount: 800 },
      ],
    });
    assert.equal(clash.status, 409);
    assert.equal(clash.json.code, 'conflict');
    assert.equal(clash.json.details.already_paid.length, 1);
    assert.equal(clash.json.details.already_paid[0].month, '2026-06');
    assert.equal(clash.json.details.already_paid[0].receipt_no, first.json.receipt_no);
  });
});

test('the duplicate warning can be overridden deliberately, and the override is logged', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();
    await pay(cookie);

    const forced = await pay(cookie, { months: [{ month: '2026-06', amount: 800 }], allow_duplicate: true });
    assert.equal(forced.status, 200);
    assert.equal(sheet.objects(TABS.PAYMENTS).length, 4);

    const entry = sheet
      .objects(TABS.AUDIT_LOG)
      .filter((row) => row.action === 'payment.create')
      .at(-1);
    assert.ok(entry.after.includes('overrode_duplicate'), 'the override should be visible in the audit log');
  });
});

test('a different child in the same class is not treated as a duplicate', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    await pay(cookie);
    const other = await pay(cookie, { student_name: 'Meera Singh', parent_name: 'Anil Singh' });
    assert.equal(other.status, 200);
  });
});

test('months outside the academic year are refused', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    // March 2026 belongs to 2025-26, not 2026-27.
    const response = await pay(cookie, { months: [{ month: '2026-03', amount: 800 }] });
    assert.equal(response.status, 400);
    assert.match(response.json.error, /not part of 2026-27/);
  });
});

test('a class the school does not have is refused', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    const response = await pay(cookie, { class: '11' });
    assert.equal(response.status, 400);
    assert.ok(response.json.details.class);
  });
});

test('recording a payment needs a session', async () => {
  await withSheet(async () => {
    const response = await invoke(createPayment, { method: 'POST', body: BASE_PAYMENT });
    assert.equal(response.status, 401);
  });
});

// ---- reading payments back ------------------------------------------------

test('payments can be listed by class and read back as a receipt', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    const created = await pay(cookie);
    await pay(cookie, {
      class: '6',
      student_name: 'Meera Singh',
      months: [{ month: '2026-04', amount: 900 }],
    });

    const classFive = await invoke(listPayments, { cookie, url: `/api/payments/list?academic_year=${YEAR}&class=5` });
    assert.equal(classFive.status, 200);
    assert.equal(classFive.json.payments.length, 3);
    assert.ok(classFive.json.payments.every((payment) => payment.class === '5'));

    const receipt = await invoke(listPayments, {
      cookie,
      url: `/api/payments/list?receipt_no=${created.json.receipt_no}`,
    });
    // The rows come back grouped into the one thing the user submitted.
    assert.equal(receipt.json.receipt.total, 2400);
    assert.equal(receipt.json.receipt.months.length, 3);
    assert.equal(receipt.json.receipt.student_name, 'Arjun Verma');
    assert.deepEqual(
      receipt.json.receipt.months.map((month) => month.month),
      ['2026-04', '2026-05', '2026-06']
    );
  });
});

test('an unknown receipt number reads as nothing, not as an error', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    const response = await invoke(listPayments, { cookie, url: '/api/payments/list?receipt_no=SNS-202627-NOPE11' });
    assert.equal(response.status, 200);
    assert.equal(response.json.receipt, null);
  });
});

// ---- the student list -----------------------------------------------------

test('a class list imports, and importing it twice does not double it', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn('admin');
    const students = [
      { student_name: 'Arjun Verma', class: '5', parent_name: 'Rakesh Verma', contact: '9876543210' },
      { student_name: 'Meera Singh', class: '5', parent_name: 'Anil Singh' },
      { student_name: 'Kabir Khan', class: 'NUR', parent_name: 'Imran Khan' },
    ];

    const first = await invoke(importStudents, {
      method: 'POST',
      cookie,
      body: { academic_year: YEAR, students },
    });
    assert.equal(first.status, 200);
    assert.equal(first.json.created, 3);
    assert.equal(first.json.skipped.length, 0);
    assert.equal(sheet.objects(TABS.STUDENTS).length, 3);

    const again = await invoke(importStudents, {
      method: 'POST',
      cookie,
      body: { academic_year: YEAR, students },
    });
    assert.equal(again.json.created, 0);
    assert.equal(again.json.skipped.length, 3);
    assert.equal(sheet.objects(TABS.STUDENTS).length, 3, 'the roster must not double');
  });
});

test('a duplicate inside one import file is caught too', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn('admin');
    const response = await invoke(importStudents, {
      method: 'POST',
      cookie,
      body: {
        academic_year: YEAR,
        students: [
          { student_name: 'Arjun Verma', class: '5' },
          { student_name: 'arjun   verma', class: '5' },
        ],
      },
    });
    assert.equal(response.json.created, 1);
    assert.equal(response.json.skipped.length, 1);
    assert.equal(sheet.objects(TABS.STUDENTS).length, 1);
  });
});

test('the same name in two classes is two different students', async () => {
  await withSheet(async () => {
    const cookie = await signedIn('admin');
    const response = await invoke(importStudents, {
      method: 'POST',
      cookie,
      body: {
        academic_year: YEAR,
        students: [
          { student_name: 'Arjun Verma', class: '5' },
          { student_name: 'Arjun Verma', class: '6' },
        ],
      },
    });
    assert.equal(response.json.created, 2);
  });
});

test('only an admin may manage the roster, but anyone signed in may read it', async () => {
  await withSheet(async () => {
    const operator = await signedIn('operator');

    const blocked = await invoke(createStudent, {
      method: 'POST',
      cookie: operator,
      body: { academic_year: YEAR, class: '5', student_name: 'Arjun Verma' },
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.code, 'admin_only');

    const blockedImport = await invoke(importStudents, {
      method: 'POST',
      cookie: operator,
      body: { academic_year: YEAR, students: [{ student_name: 'Arjun Verma', class: '5' }] },
    });
    assert.equal(blockedImport.status, 403);

    const admin = await signedIn('admin');
    const created = await invoke(createStudent, {
      method: 'POST',
      cookie: admin,
      body: { academic_year: YEAR, class: '5', student_name: 'Arjun Verma', parent_name: 'Rakesh Verma' },
    });
    assert.equal(created.status, 200);

    // Reading is open to the operator.
    const listed = await invoke(listStudents, { cookie: operator, url: `/api/students/list?academic_year=${YEAR}` });
    assert.equal(listed.status, 200);
    assert.equal(listed.json.students.length, 1);
  });
});

test('the same student cannot be added to the roster twice', async () => {
  await withSheet(async () => {
    const cookie = await signedIn('admin');
    const body = { academic_year: YEAR, class: '5', student_name: 'Arjun Verma' };
    assert.equal((await invoke(createStudent, { method: 'POST', cookie, body })).status, 200);

    const again = await invoke(createStudent, { method: 'POST', cookie, body });
    assert.equal(again.status, 409);
    assert.match(again.json.error, /already on the list/);
  });
});

test('students are listed by class, in name order', async () => {
  await withSheet(async () => {
    const cookie = await signedIn('admin');
    await invoke(importStudents, {
      method: 'POST',
      cookie,
      body: {
        academic_year: YEAR,
        students: [
          { student_name: 'Meera Singh', class: '5' },
          { student_name: 'Arjun Verma', class: '5' },
          { student_name: 'Kabir Khan', class: 'NUR' },
        ],
      },
    });

    const classFive = await invoke(listStudents, {
      cookie,
      url: `/api/students/list?academic_year=${YEAR}&class=5`,
    });
    assert.deepEqual(
      classFive.json.students.map((student) => student.student_name),
      ['Arjun Verma', 'Meera Singh']
    );
  });
});

test('a payment cannot be dated in the future, whatever the browser allowed', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();
    const { todayAtSchool } = await import('../shared/academic-year.js');

    const today = todayAtSchool();
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // The form caps the date, so this is someone bypassing it.
    const future = await pay(cookie, { payment_date: tomorrow.toISOString().slice(0, 10) });
    assert.equal(future.status, 400);
    assert.match(future.json.details.payment_date, /future/);
    assert.equal(sheet.objects(TABS.PAYMENTS).length, 0, 'nothing should have been written');

    // Today is fine, and so is a date in the past: the office often records a
    // payment a day or two after it was handed over.
    assert.equal((await pay(cookie, { payment_date: today })).status, 200);
    assert.equal((await pay(cookie, { months: [{ month: '2026-07', amount: 800 }], payment_date: '2026-06-10' })).status, 200);
  });
});

test('the entry timestamp is the server\'s and ignores anything sent for it', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();
    const before = new Date().toISOString();

    // A client trying to dictate when the row was written gets nowhere: the
    // field is not part of the accepted input at all.
    await pay(cookie, { entered_at: '2020-01-01T00:00:00.000Z', entered_by: 'someone-else' });

    const [row] = sheet.objects(TABS.PAYMENTS);
    assert.ok(row.entered_at >= before, 'entered_at should be set when the row was written');
    assert.ok(row.entered_at <= new Date().toISOString());
    assert.equal(row.entered_by, 'operator', 'entered_by comes from the session');
    // The payment date is the one the form sent; the two are separate records.
    assert.equal(row.payment_date, '2026-06-10');
  });
});

test('a payment dated before the academic year it is filed under is refused', async () => {
  await withSheet(async (sheet) => {
    const cookie = await signedIn();

    // The year typed a digit out: a 2026-27 receipt dated 2025.
    const mistyped = await pay(cookie, { payment_date: '2025-06-10' });
    assert.equal(mistyped.status, 400);
    assert.match(mistyped.json.details.payment_date, /cannot be dated before March 2026/);
    // The message points at both fields, since either could be the mistake.
    assert.match(mistyped.json.details.payment_date, /academic year/);
    assert.equal(sheet.objects(TABS.PAYMENTS).length, 0, 'nothing should have been written');

    assert.equal((await pay(cookie, { payment_date: '2026-02-28' })).status, 400);
  });
});

test('fees collected just before the session starts are still accepted', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();

    // A parent paying April's fee in March, before the session begins.
    const early = await pay(cookie, { payment_date: '2026-03-15' });
    assert.equal(early.status, 200);

    const onTheDay = await pay(cookie, {
      months: [{ month: '2026-07', amount: 800 }],
      payment_date: '2026-03-01',
    });
    assert.equal(onTheDay.status, 200);

    const sessionStart = await pay(cookie, {
      months: [{ month: '2026-08', amount: 800 }],
      payment_date: '2026-04-01',
    });
    assert.equal(sessionStart.status, 200);
  });
});

test('a late arrears payment for an earlier academic year is still allowed', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    // Clearing 2025-26 dues during 2026-27 is normal and must not be blocked.
    const response = await pay(cookie, {
      academic_year: '2025-26',
      months: [{ month: '2025-04', amount: 800 }],
      payment_date: '2026-06-10',
    });
    assert.equal(response.status, 200);
  });
});

test('a malformed academic year is a field error, not a server error', async () => {
  await withSheet(async () => {
    const cookie = await signedIn();
    // The date rule is cross-field, so it must not blow up when the year it
    // depends on is itself invalid.
    const response = await pay(cookie, { academic_year: '2026' });
    assert.equal(response.status, 400, 'should be a validation failure, not a 500');
    assert.equal(response.json.code, 'validation_failed');
    assert.ok(response.json.details.academic_year);
  });
});

// ---- the class-wise report ------------------------------------------------

test('the class-wise report joins the roster to the payments', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    await invoke(importStudents, {
      method: 'POST',
      cookie: admin,
      body: {
        academic_year: YEAR,
        students: [
          { student_name: 'Arjun Verma', class: '5', parent_name: 'Rakesh Verma', contact: '98765' },
          { student_name: 'Meera Singh', class: '5', parent_name: 'Anil Singh' },
          { student_name: 'Kabir Khan', class: 'NUR' },
        ],
      },
    });

    const operator = await signedIn('operator');
    await pay(operator, { payment_date: '2026-06-10' });

    const { default: classwise } = await import('../api/reports/classwise.js');
    const response = await invoke(classwise, {
      cookie: operator,
      url: `/api/reports/classwise?academic_year=${YEAR}&class=5`,
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.months.length, 12);
    assert.equal(response.json.students.length, 2, 'only class 5');
    assert.equal(response.json.totals.collected, 2400);

    const arjun = response.json.students.find((s) => s.student_name === 'Arjun Verma');
    assert.equal(arjun.paid_count, 3);
    assert.equal(arjun.cells['2026-04'].amount, 800);
    assert.equal(arjun.parent_name, 'Rakesh Verma');
    assert.ok(arjun.due_months.length > 0, 'later months are still owed');

    const meera = response.json.students.find((s) => s.student_name === 'Meera Singh');
    assert.equal(meera.paid_total, 0);
    assert.equal(response.json.totals.with_dues, 2);
  });
});

test('the report covers every class when no class is given', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    await invoke(importStudents, {
      method: 'POST',
      cookie: admin,
      body: {
        academic_year: YEAR,
        students: [
          { student_name: 'Arjun Verma', class: '5' },
          { student_name: 'Kabir Khan', class: 'NUR' },
        ],
      },
    });

    const { default: classwise } = await import('../api/reports/classwise.js');
    const response = await invoke(classwise, { cookie: admin, url: `/api/reports/classwise?academic_year=${YEAR}` });

    assert.equal(response.json.students.length, 2);
    assert.equal(response.json.class, null);
    assert.deepEqual(
      response.json.students.map((s) => s.class).sort(),
      ['5', 'NUR']
    );
  });
});

test('the report needs a session', async () => {
  await withSheet(async () => {
    const { default: classwise } = await import('../api/reports/classwise.js');
    const response = await invoke(classwise, { url: `/api/reports/classwise?academic_year=${YEAR}` });
    assert.equal(response.status, 401);
  });
});

test('one student can be looked up by id for their ledger', async () => {
  await withSheet(async () => {
    const cookie = await signedIn('operator');
    const created = await pay(cookie);

    const response = await invoke(listStudents, {
      cookie,
      url: `/api/students/list?academic_year=${YEAR}&student_id=${created.json.student_id}`,
    });
    assert.equal(response.json.students.length, 1);
    assert.equal(response.json.students[0].student_name, 'Arjun Verma');
  });
});

// ---- correcting a payment -------------------------------------------------

test('an admin can cancel a receipt, with a reason, and it leaves the totals', async () => {
  await withSheet(async (sheet) => {
    const operator = await signedIn('operator');
    const created = await pay(operator);
    const admin = await signedIn('admin');

    const { default: voidPayment } = await import('../api/payments/void.js');
    const response = await invoke(voidPayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, reason: 'Entered twice by mistake' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.total, 2400);

    // Every month of the receipt is cancelled, and nothing is deleted.
    const rows = sheet.objects(TABS.PAYMENTS);
    assert.equal(rows.length, 3, 'the rows stay in the register');
    assert.ok(rows.every((row) => row.status === 'void'));
    assert.ok(rows.every((row) => row.void_reason === 'Entered twice by mistake'));
    assert.ok(rows.every((row) => row.voided_by === 'admin'));
    assert.ok(rows.every((row) => row.voided_at));

    // It no longer counts as paid, so the months are owed again.
    const listed = await invoke(listPayments, { cookie: admin, url: `/api/payments/list?academic_year=${YEAR}` });
    assert.equal(listed.json.payments.length, 0);

    const { default: classwise } = await import('../api/reports/classwise.js');
    const report = await invoke(classwise, { cookie: admin, url: `/api/reports/classwise?academic_year=${YEAR}` });
    assert.equal(report.json.totals.collected, 0);
  });
});

test('a cancelled month can be recorded again without a duplicate warning', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const created = await pay(admin);

    const { default: voidPayment } = await import('../api/payments/void.js');
    await invoke(voidPayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, reason: 'Wrong amount entered' },
    });

    // The correction path: void, then record it properly.
    const again = await pay(admin, {
      months: [
        { month: '2026-04', amount: 900 },
        { month: '2026-05', amount: 900 },
        { month: '2026-06', amount: 900 },
      ],
    });
    assert.equal(again.status, 200, 'the cancelled months must not block the re-entry');
    assert.equal(again.json.total, 2700);
  });
});

test('an operator cannot cancel or change a payment', async () => {
  await withSheet(async () => {
    const operator = await signedIn('operator');
    const created = await pay(operator);

    const { default: voidPayment } = await import('../api/payments/void.js');
    const { default: updatePayment } = await import('../api/payments/update.js');

    const voided = await invoke(voidPayment, {
      method: 'POST',
      cookie: operator,
      body: { receipt_no: created.json.receipt_no, reason: 'Changed my mind' },
    });
    assert.equal(voided.status, 403);
    assert.equal(voided.json.code, 'admin_only');

    const changed = await invoke(updatePayment, {
      method: 'POST',
      cookie: operator,
      body: { receipt_no: created.json.receipt_no, remarks: 'edited' },
    });
    assert.equal(changed.status, 403);
  });
});

test('a void needs a real reason, and cannot be done twice', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const created = await pay(admin);
    const { default: voidPayment } = await import('../api/payments/void.js');

    const noReason = await invoke(voidPayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, reason: 'x' },
    });
    assert.equal(noReason.status, 400);
    assert.ok(noReason.json.details.reason);

    const missing = await invoke(voidPayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: 'SNS-202627-NOPE11', reason: 'Does not exist' },
    });
    assert.equal(missing.status, 404);

    const body = { receipt_no: created.json.receipt_no, reason: 'Entered twice' };
    assert.equal((await invoke(voidPayment, { method: 'POST', cookie: admin, body })).status, 200);
    const again = await invoke(voidPayment, { method: 'POST', cookie: admin, body });
    assert.equal(again.status, 409);
  });
});

test('the details around a payment can be corrected, but never the money', async () => {
  await withSheet(async (sheet) => {
    const admin = await signedIn('admin');
    const created = await pay(admin);
    const { default: updatePayment } = await import('../api/payments/update.js');

    const response = await invoke(updatePayment, {
      method: 'POST',
      cookie: admin,
      body: {
        receipt_no: created.json.receipt_no,
        payment_date: '2026-06-12',
        payment_mode: 'cheque',
        remarks: 'cheque no. 112233',
        // Sent in the hope of changing the money. The schema does not take it.
        amount: 99999,
        months: [{ month: '2026-12', amount: 99999 }],
      },
    });

    assert.equal(response.status, 200);
    const rows = sheet.objects(TABS.PAYMENTS);
    assert.ok(rows.every((row) => row.payment_date === '2026-06-12'));
    assert.ok(rows.every((row) => row.payment_mode === 'cheque'));
    assert.ok(rows.every((row) => row.remarks === 'cheque no. 112233'));

    // The money and the months are exactly as recorded.
    assert.deepEqual(rows.map((row) => Number(row.amount)), [800, 800, 800]);
    assert.deepEqual(rows.map((row) => row.month).sort(), ['2026-04', '2026-05', '2026-06']);
    assert.ok(rows.every((row) => Number(row.receipt_total) === 2400));
  });
});

test('a corrected date obeys the same rules as a recorded one', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const created = await pay(admin);
    const { default: updatePayment } = await import('../api/payments/update.js');

    const change = (payment_date) =>
      invoke(updatePayment, {
        method: 'POST',
        cookie: admin,
        body: { receipt_no: created.json.receipt_no, payment_date },
      });

    // Before the academic year, and in the future, are refused here too.
    assert.equal((await change('2025-06-10')).status, 400);
    assert.equal((await change('2030-01-01')).status, 400);
    assert.equal((await change('2026-05-05')).status, 200);
  });
});

test('a cancelled receipt cannot then be edited', async () => {
  await withSheet(async () => {
    const admin = await signedIn('admin');
    const created = await pay(admin);
    const { default: voidPayment } = await import('../api/payments/void.js');
    const { default: updatePayment } = await import('../api/payments/update.js');

    await invoke(voidPayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, reason: 'Entered twice' },
    });

    const response = await invoke(updatePayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, remarks: 'still fiddling' },
    });
    assert.equal(response.status, 409);
  });
});

test('cancelling and correcting are both written to the audit log', async () => {
  await withSheet(async (sheet) => {
    const admin = await signedIn('admin');
    const created = await pay(admin);
    const { default: voidPayment } = await import('../api/payments/void.js');
    const { default: updatePayment } = await import('../api/payments/update.js');

    await invoke(updatePayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, remarks: 'corrected' },
    });
    await invoke(voidPayment, {
      method: 'POST',
      cookie: admin,
      body: { receipt_no: created.json.receipt_no, reason: 'Recorded against the wrong child' },
    });

    const entries = sheet.objects(TABS.AUDIT_LOG);
    const update = entries.find((entry) => entry.action === 'payment.update');
    const voided = entries.find((entry) => entry.action === 'payment.void');

    assert.ok(update, 'the correction should be logged');
    assert.ok(update.before.includes('paid at office'), 'what it was');
    assert.ok(update.after.includes('corrected'), 'what it became');

    assert.ok(voided, 'the cancellation should be logged');
    assert.equal(voided.entity_id, created.json.receipt_no);
    assert.ok(voided.after.includes('wrong child'));
  });
});
