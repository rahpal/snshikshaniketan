import test from 'node:test';
import assert from 'node:assert/strict';

import { formatInr, sumAmounts, usualMonthlyAmount } from '../shared/money.js';
import { parseCsv, parseCsvRecords } from '../shared/csv.js';
import { CLASSES, classLabel, isKnownClass } from '../shared/school.js';

test('the class list is the school\'s own, in register order', () => {
  assert.deepEqual(CLASSES, ['NUR', 'KG', '1', '2', '3', '4', '5', '6', '7', '8']);
  assert.equal(classLabel('NUR'), 'Nursery');
  assert.equal(classLabel('KG'), 'KG');
  assert.equal(classLabel('5'), 'Class 5');
  assert.ok(isKnownClass('nur'), 'matching should not depend on case');
  assert.ok(!isKnownClass('IX'));
  assert.ok(!isKnownClass(''));
});

test('month amounts sum without floating-point dust', () => {
  assert.equal(sumAmounts([800, 800, 800]), 2400);
  assert.equal(sumAmounts([333.33, 333.33, 333.34]), 1000);
  // Adding these as plain floats gives 999.9899999999999.
  assert.equal(sumAmounts([333.33, 333.33, 333.33]), 999.99);
  assert.equal(sumAmounts([]), 0);
  assert.equal(sumAmounts([0.1, 0.2]), 0.3);
  assert.equal(sumAmounts([800, '', null]), 800);
});

test('the usual monthly amount is the one a class pays most often', () => {
  const payments = [
    { amount: 800, entered_at: '2026-04-05T10:00:00Z' },
    { amount: 800, entered_at: '2026-05-05T10:00:00Z' },
    // One exam month must not become everyone's default.
    { amount: 1200, entered_at: '2026-06-05T10:00:00Z' },
  ];
  assert.equal(usualMonthlyAmount(payments), 800);

  // A tie goes to whichever was collected most recently, so a fee rise takes
  // over once it is as common as the old figure.
  assert.equal(
    usualMonthlyAmount([
      { amount: 800, entered_at: '2026-04-05T10:00:00Z' },
      { amount: 900, entered_at: '2026-07-05T10:00:00Z' },
    ]),
    900
  );

  // Nothing to go on, or nothing usable, means no pre-fill rather than a guess.
  assert.equal(usualMonthlyAmount([]), null);
  assert.equal(usualMonthlyAmount(undefined), null);
  assert.equal(usualMonthlyAmount([{ amount: 0 }, { amount: '' }, { amount: -5 }]), null);
});

test('amounts are shown in Indian digit grouping', () => {
  // Lakh grouping, not thousands: 1,25,000 rather than 125,000.
  assert.match(formatInr(125000), /1,25,000/);
  assert.match(formatInr(800), /800/);
  assert.ok(formatInr(800).startsWith('₹'));
});

test('CSV parsing copes with what a spreadsheet export actually produces', () => {
  const rows = parseCsv('name,class\r\nArjun Verma,5\r\n"Verma, Sunita",KG\r\n');
  assert.deepEqual(rows, [
    ['name', 'class'],
    ['Arjun Verma', '5'],
    ['Verma, Sunita', 'KG'],
  ]);

  // Quoted newlines, doubled quotes, a byte-order mark, and blank lines.
  const tricky = parseCsv('﻿a,b\n"line one\nline two","say ""hi"""\n\n');
  assert.deepEqual(tricky, [
    ['a', 'b'],
    ['line one\nline two', 'say "hi"'],
  ]);

  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('\n\n'), []);
});

test('import headings are matched however the school wrote them', () => {
  const aliases = {
    student_name: ['student_name', 'student name', 'name', 'student'],
    class: ['class', 'grade'],
    parent_name: ['parent_name', 'parent name', 'father name', "father's name", 'guardian'],
    contact: ['contact', 'phone', 'mobile'],
  };

  const { records, unmatched } = parseCsvRecords(
    "Student Name,Class,Father's Name,Mobile,Remarks\nArjun Verma,5,Rakesh Verma,9876543210,new\n",
    aliases
  );

  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0], 'Remarks');
  assert.equal(records.length, 1);
  assert.equal(records[0].student_name, 'Arjun Verma');
  assert.equal(records[0].class, '5');
  assert.equal(records[0].parent_name, 'Rakesh Verma');
  assert.equal(records[0].contact, '9876543210');
  // Line numbers point at the file, so a problem can be reported usefully.
  assert.equal(records[0]._line, 2);
});

test('every interface string exists in both languages', async () => {
  const { strings } = await import('../src/i18n/strings.js');
  const en = Object.keys(strings.en);
  const hi = Object.keys(strings.hi);

  // A key present in one language but not the other shows as a raw key name
  // the moment someone uses the toggle.
  assert.deepEqual(en.filter((key) => !hi.includes(key)), [], 'keys missing from Hindi');
  assert.deepEqual(hi.filter((key) => !en.includes(key)), [], 'keys missing from English');
  assert.ok(en.length > 100);
});

test('dates are shown the way a receipt should read, without timezone drift', async () => {
  const { formatDate } = await import('../shared/money.js');
  assert.equal(formatDate('2026-10-14'), '14 Oct 2026');
  assert.equal(formatDate('2026-04-01'), '1 Apr 2026');
  // A date at the start of the day must not slip to the previous one.
  assert.equal(formatDate('2027-01-01'), '1 Jan 2027');
  // Anything that is not a plain date is passed through untouched.
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('not a date'), 'not a date');
});

test('a month is read as arrears, current or advance against the payment date', async () => {
  const { monthKeyOf, monthStanding } = await import('../shared/academic-year.js');

  // A parent paying in October: April is arrears, October is this month,
  // January is an advance - all on one receipt.
  assert.equal(monthStanding('2026-04', '2026-10-14'), 'overdue');
  assert.equal(monthStanding('2026-09', '2026-10-14'), 'overdue');
  assert.equal(monthStanding('2026-10', '2026-10-14'), 'current');
  assert.equal(monthStanding('2026-11', '2026-10-14'), 'advance');
  assert.equal(monthStanding('2027-01', '2026-10-14'), 'advance');

  // The day within the month does not matter, only the month.
  assert.equal(monthStanding('2026-10', '2026-10-01'), 'current');
  assert.equal(monthStanding('2026-10', '2026-10-31'), 'current');

  // Across the calendar year boundary, which an April-March year crosses.
  assert.equal(monthStanding('2026-12', '2027-02-10'), 'overdue');
  assert.equal(monthStanding('2027-03', '2027-02-10'), 'advance');

  // Measured against the payment date, not today: a receipt written for an
  // earlier date still reads the same way afterwards.
  assert.equal(monthStanding('2026-06', '2026-05-20'), 'advance');

  // A missing or malformed date falls back to the current month rather than
  // throwing in the middle of someone's data entry.
  assert.equal(monthStanding(monthKeyOf(), ''), 'current');
  assert.equal(monthStanding(monthKeyOf(), undefined), 'current');
  assert.equal(monthStanding('1999-01', 'not a date'), 'overdue');

  assert.equal(monthKeyOf(new Date(2026, 9, 14)), '2026-10');
  assert.equal(monthKeyOf(new Date(2027, 0, 3)), '2027-01');
});

test("the school's today is the school's, not the server's", async () => {
  const { todayAtSchool } = await import('../shared/academic-year.js');

  assert.match(todayAtSchool(), /^\d{4}-\d{2}-\d{2}$/);
  // 20:30 UTC is already the next day in Kolkata. A server comparing against
  // its own UTC day would refuse an ordinary evening entry.
  assert.equal(todayAtSchool(new Date('2026-10-14T20:30:00Z')), '2026-10-15');
  assert.equal(todayAtSchool(new Date('2026-10-14T04:30:00Z')), '2026-10-14');
  // Just before midnight IST is still the same day there.
  assert.equal(todayAtSchool(new Date('2026-10-14T18:29:00Z')), '2026-10-14');
});

test('a payment may not predate the academic year it is filed under', async () => {
  const { earliestPaymentDateFor } = await import('../shared/academic-year.js');

  // One month before the April start, so fees collected just before the
  // session begins are still accepted.
  assert.equal(earliestPaymentDateFor('2026-27'), '2026-03-01');
  assert.equal(earliestPaymentDateFor('2025-26'), '2025-03-01');
  assert.throws(() => earliestPaymentDateFor('2026'));
});
