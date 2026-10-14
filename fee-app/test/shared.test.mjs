import test from 'node:test';
import assert from 'node:assert/strict';

import { allocateAmount, formatInr } from '../shared/money.js';
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

test('a receipt total splits across months and always adds back up', () => {
  assert.deepEqual(allocateAmount(2400, 3), [800, 800, 800]);
  assert.deepEqual(allocateAmount(1000, 3), [333.34, 333.33, 333.33]);
  assert.deepEqual(allocateAmount(500, 1), [500]);

  // Whatever the split, the parts must sum to exactly what was collected.
  for (const total of [1000, 1234.56, 999.99, 7, 0.03]) {
    for (let count = 1; count <= 12; count += 1) {
      const parts = allocateAmount(total, count);
      assert.equal(parts.length, count);
      const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
      assert.equal(sum, total, `${total} over ${count} months summed to ${sum}`);
    }
  }

  assert.throws(() => allocateAmount(100, 0));
  assert.throws(() => allocateAmount(Number.NaN, 2));
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
