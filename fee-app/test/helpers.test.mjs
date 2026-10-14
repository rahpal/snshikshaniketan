import test from 'node:test';
import assert from 'node:assert/strict';

import {
  academicYearOf,
  academicYearOptions,
  isAcademicYear,
  isMonthKey,
  monthLabel,
  monthsOf,
} from '../shared/academic-year.js';
import { columnLetter, asBool, asNumber, asText } from '../api/_lib/table.js';
import { shortId, ulid } from '../api/_lib/ulid.js';
import { describePasswordProblem, generateTempPassword } from '../api/_lib/password.js';
import { paymentSchema, loginSchema, createUserSchema } from '../api/_lib/schemas.js';

test('academic year runs April to March', () => {
  assert.equal(academicYearOf(new Date('2026-04-01T00:00:00')), '2026-27');
  assert.equal(academicYearOf(new Date('2027-03-31T00:00:00')), '2026-27');
  // A January date belongs to the year that started the previous April.
  assert.equal(academicYearOf(new Date('2027-01-15T00:00:00')), '2026-27');
  assert.equal(academicYearOf(new Date('2026-03-31T00:00:00')), '2025-26');
  // Crossing a century boundary must not produce "2099-100".
  assert.equal(academicYearOf(new Date('2099-05-01T00:00:00')), '2099-00');
});

test('months of an academic year are ordered April first and cross the calendar year', () => {
  const months = monthsOf('2026-27');
  assert.equal(months.length, 12);
  assert.equal(months[0], '2026-04');
  assert.equal(months[8], '2026-12');
  assert.equal(months[9], '2027-01');
  assert.equal(months[11], '2027-03');
  assert.equal(new Set(months).size, 12);
});

test('academic year and month keys are validated', () => {
  assert.ok(isAcademicYear('2026-27'));
  assert.ok(!isAcademicYear('2026'));
  assert.ok(!isAcademicYear('2026-2027'));
  assert.ok(isMonthKey('2026-04'));
  assert.ok(!isMonthKey('2026-13'));
  assert.ok(!isMonthKey('2026-4'));
});

test('month labels read as a person would say them', () => {
  assert.equal(monthLabel('2026-04'), 'April 2026');
  assert.equal(monthLabel('2027-01', { short: true }), 'Jan 2027');
});

test('academic year options are newest first and include next year', () => {
  const options = academicYearOptions(new Date('2026-06-01T00:00:00'), 2, 1);
  assert.deepEqual(options, ['2027-28', '2026-27', '2025-26', '2024-25']);
});

test('column letters cover the whole sheet width', () => {
  assert.equal(columnLetter(0), 'A');
  assert.equal(columnLetter(19), 'T');
  assert.equal(columnLetter(25), 'Z');
  assert.equal(columnLetter(26), 'AA');
  assert.equal(columnLetter(51), 'AZ');
  assert.equal(columnLetter(52), 'BA');
});

test('sheet values coerce whichever way the cell was written', () => {
  assert.equal(asBool('TRUE'), true);
  assert.equal(asBool(true), true);
  assert.equal(asBool('yes'), true);
  assert.equal(asBool('FALSE'), false);
  assert.equal(asBool(''), false);
  assert.equal(asBool('', true), true);

  assert.equal(asNumber('1,250'), 1250);
  assert.equal(asNumber(1250), 1250);
  assert.equal(asNumber(''), 0);
  assert.equal(asNumber('abc', -1), -1);

  assert.equal(asText('  spaced  '), 'spaced');
  assert.equal(asText(null), '');
});

test('ulids are unique and sort by creation time', () => {
  const ids = new Set();
  for (let i = 0; i < 2000; i += 1) ids.add(ulid());
  assert.equal(ids.size, 2000);

  const earlier = ulid(1700000000000);
  const later = ulid(1800000000000);
  assert.ok(earlier < later);
  assert.equal(ulid().length, 26);
  assert.equal(shortId(6).length, 6);
  // No characters that get misread when written down.
  assert.ok(!/[ILOU]/.test(shortId(40)));
});

test('password policy rejects the obvious and accepts the reasonable', () => {
  assert.match(describePasswordProblem('short1'), /at least 8/);
  assert.match(describePasswordProblem('alllettersonly'), /one number/);
  assert.match(describePasswordProblem('12345678'), /one letter/);
  assert.match(describePasswordProblem('rahul1234', { username: 'rahul' }), /username/);
  assert.equal(describePasswordProblem('SchoolFee2026'), null);
});

test('generated temporary passwords satisfy the policy they will be checked against', () => {
  for (let i = 0; i < 200; i += 1) {
    const password = generateTempPassword();
    assert.equal(describePasswordProblem(password), null, `rejected: ${password}`);
    // The characters that get misread when handed over on paper.
    assert.ok(!/[01IlO]/.test(password), `ambiguous character in: ${password}`);
    assert.equal(password.length, 12);
  }
});

test('login input is normalised and required', () => {
  const parsed = loginSchema.parse({ username: '  Rahul  ', password: 'secret' });
  assert.equal(parsed.username, 'rahul');
  assert.ok(!loginSchema.safeParse({ username: '', password: 'x' }).success);
  assert.ok(!loginSchema.safeParse({ username: 'rahul' }).success);
});

test('new users must have a valid username and a real role', () => {
  assert.ok(createUserSchema.safeParse({ username: 'office.1', full_name: 'Office Staff', role: 'operator' }).success);
  assert.ok(!createUserSchema.safeParse({ username: 'has space', full_name: 'X Y', role: 'operator' }).success);
  assert.ok(!createUserSchema.safeParse({ username: 'ok', full_name: 'X Y', role: 'superuser' }).success);
});

test('payment input carries an amount per month and rejects nonsense', () => {
  const base = {
    academic_year: '2026-27',
    class: '5',
    student_name: 'Arjun Verma',
    parent_name: 'Sunita Verma',
    months: [
      { month: '2026-04', amount: 800 },
      { month: '2026-05', amount: 800 },
      // Months genuinely differ - an exam month, or a part payment.
      { month: '2026-06', amount: 1200 },
    ],
    payment_date: '2026-06-10',
    payment_mode: 'upi',
  };

  const parsed = paymentSchema.parse(base);
  assert.equal(parsed.months.length, 3);
  assert.equal(parsed.months[2].amount, 1200);
  assert.equal(parsed.remarks, '');
  assert.equal(parsed.allow_duplicate, false);

  assert.ok(!paymentSchema.safeParse({ ...base, months: [] }).success);

  const duplicated = paymentSchema.safeParse({
    ...base,
    months: [
      { month: '2026-04', amount: 800 },
      { month: '2026-04', amount: 800 },
    ],
  });
  assert.ok(!duplicated.success);
  assert.match(duplicated.error.issues[0].message, /same month/);

  // Every month needs its own amount, and it has to be a real one.
  assert.ok(!paymentSchema.safeParse({ ...base, months: [{ month: '2026-04' }] }).success);
  assert.ok(!paymentSchema.safeParse({ ...base, months: [{ month: '2026-04', amount: 0 }] }).success);
  assert.ok(!paymentSchema.safeParse({ ...base, months: [{ month: '2026-04', amount: -100 }] }).success);
  assert.ok(!paymentSchema.safeParse({ ...base, months: [{ month: '2026-13', amount: 800 }] }).success);

  assert.ok(!paymentSchema.safeParse({ ...base, payment_date: '10-06-2026' }).success);
  assert.ok(!paymentSchema.safeParse({ ...base, payment_mode: 'crypto' }).success);
  assert.ok(!paymentSchema.safeParse({ ...base, academic_year: '2026' }).success);
  // The class list is the school's own, so a class that does not exist is refused.
  assert.ok(!paymentSchema.safeParse({ ...base, class: 'XI' }).success);
  assert.equal(paymentSchema.parse({ ...base, class: 'nur' }).class, 'NUR');
});
