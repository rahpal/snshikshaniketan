import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClassReport } from '../api/_lib/reports.js';

const YEAR = '2026-27';
const TODAY = '2026-10-14'; // arrears: Apr-Oct; ahead: Nov onwards

const student = (id, name, extra = {}) => ({
  student_id: id,
  student_name: name,
  parent_name: `${name.split(' ')[0]}'s parent`,
  contact: '9876543210',
  class: '5',
  ...extra,
});

let rowCounter = 0;
const payment = (studentId, name, month, amount, extra = {}) => ({
  row_id: `row-${(rowCounter += 1)}`,
  receipt_no: extra.receipt_no ?? `SNS-202627-R${month.slice(-2)}`,
  student_id: studentId,
  student_name: name,
  class: '5',
  month,
  amount,
  ...extra,
});

test('paid months, dues and advances are worked out per student', () => {
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma'), student('s2', 'Meera Singh')],
    payments: [
      payment('s1', 'Arjun Verma', '2026-04', 800),
      payment('s1', 'Arjun Verma', '2026-05', 800),
      // Paid ahead, in November.
      payment('s1', 'Arjun Verma', '2026-11', 800),
      payment('s2', 'Meera Singh', '2026-04', 900),
    ],
  });

  const [arjun, meera] = report.students;

  assert.equal(arjun.paid_count, 3);
  assert.equal(arjun.paid_total, 2400);
  assert.equal(arjun.cells['2026-04'].amount, 800);
  // June to October are owed; November is already covered.
  assert.deepEqual(arjun.due_months, ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(arjun.advance_months, ['2026-11']);

  assert.equal(meera.paid_total, 900);
  assert.equal(meera.due_months.length, 6);

  // Months ahead that nobody has paid for are not dues - nothing is owed yet.
  assert.ok(!arjun.due_months.includes('2026-12'));
  assert.ok(!meera.due_months.includes('2027-03'));
});

test('the twelve months run April to March', () => {
  const report = buildClassReport({ academicYear: YEAR, asOf: TODAY, students: [], payments: [] });
  assert.equal(report.months.length, 12);
  assert.equal(report.months[0], '2026-04');
  assert.equal(report.months[11], '2027-03');
  assert.equal(report.as_of, TODAY);
});

test('totals add up across students and months', () => {
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma'), student('s2', 'Meera Singh'), student('s3', 'Kabir Khan')],
    payments: [
      payment('s1', 'Arjun Verma', '2026-04', 800),
      payment('s2', 'Meera Singh', '2026-04', 900),
      payment('s3', 'Kabir Khan', '2026-05', 700),
    ],
  });

  assert.equal(report.totals.students, 3);
  assert.equal(report.totals.collected, 2400);
  assert.equal(report.totals.by_month['2026-04'], 1700);
  assert.equal(report.totals.by_month['2026-05'], 700);
  assert.equal(report.totals.by_month['2026-06'], 0);
  // Every one of them still owes something.
  assert.equal(report.totals.with_dues, 3);
  assert.equal(
    report.totals.due_months,
    report.students.reduce((sum, row) => sum + row.due_months.length, 0)
  );
});

test('a student who has paid everything owed so far is not counted as owing', () => {
  const upToNow = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma')],
    payments: upToNow.map((month) => payment('s1', 'Arjun Verma', month, 800)),
  });

  assert.deepEqual(report.students[0].due_months, []);
  assert.equal(report.totals.with_dues, 0);
  assert.equal(report.students[0].paid_total, 5600);
});

test('a payment with no student id still finds its student by name and class', () => {
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma')],
    payments: [
      // An older row, written before students carried ids.
      payment('', 'arjun   verma', '2026-04', 800),
    ],
  });

  assert.equal(report.students[0].paid_total, 800);
  assert.equal(report.unlisted.length, 0, 'it should not be counted as unlisted');
});

test('money collected for someone no longer on the roster is surfaced, not dropped', () => {
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma')],
    payments: [
      payment('s1', 'Arjun Verma', '2026-04', 800),
      payment('gone', 'Old Student', '2026-04', 650),
      payment('gone', 'Old Student', '2026-05', 650),
    ],
  });

  assert.equal(report.students.length, 1);
  assert.equal(report.unlisted.length, 1);
  assert.equal(report.unlisted[0].student_name, 'Old Student');
  assert.equal(report.unlisted[0].paid_total, 1300);
  // Kept out of the roster totals, reported on its own, so it can be chased up.
  assert.equal(report.totals.collected, 800);
  assert.equal(report.totals.unlisted_collected, 1300);
});

test('two payments landing on one month are added together', () => {
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma')],
    payments: [
      // A part payment, topped up later on a second receipt.
      payment('s1', 'Arjun Verma', '2026-04', 500, { receipt_no: 'SNS-202627-AAA111' }),
      payment('s1', 'Arjun Verma', '2026-04', 300, { receipt_no: 'SNS-202627-BBB222' }),
    ],
  });

  const cell = report.students[0].cells['2026-04'];
  assert.equal(cell.amount, 800);
  assert.deepEqual(cell.receipts, ['SNS-202627-AAA111', 'SNS-202627-BBB222']);
  assert.equal(report.students[0].paid_count, 1, 'it is still one month');
  assert.equal(report.totals.by_month['2026-04'], 800);
});

test('payments from another academic year are ignored', () => {
  const report = buildClassReport({
    academicYear: YEAR,
    asOf: TODAY,
    students: [student('s1', 'Arjun Verma')],
    payments: [
      payment('s1', 'Arjun Verma', '2026-04', 800),
      // Belongs to 2025-26.
      payment('s1', 'Arjun Verma', '2025-04', 800),
    ],
  });

  assert.equal(report.students[0].paid_total, 800);
  assert.equal(report.totals.collected, 800);
  assert.equal(report.unlisted.length, 0);
});

test('an empty class reports zeroes rather than failing', () => {
  const report = buildClassReport({ academicYear: YEAR, asOf: TODAY, students: [], payments: [] });
  assert.equal(report.totals.students, 0);
  assert.equal(report.totals.collected, 0);
  assert.equal(report.totals.with_dues, 0);
  assert.deepEqual(report.unlisted, []);
  assert.equal(report.totals.by_month['2026-04'], 0);
});
