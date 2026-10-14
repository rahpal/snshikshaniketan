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
