import { monthStanding, monthsOf, todayAtSchool } from '../../shared/academic-year.js';
import { sumAmounts } from '../../shared/money.js';

/**
 * Turns a roster and a year's payments into the class-wise, month-wise picture:
 * who has paid for which month, and what is still owed.
 *
 * Kept free of HTTP and of the spreadsheet so the arithmetic that the whole
 * report rests on can be tested directly.
 */

/** Students are matched on name within a class when a payment has no id on it. */
const nameKey = (name) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const fallbackKey = (className, name) => `${String(className ?? '').toUpperCase()}|${nameKey(name)}`;

export function buildClassReport({ students, payments, academicYear, asOf } = {}) {
  const months = monthsOf(academicYear);
  const today = asOf ?? todayAtSchool();
  const monthSet = new Set(months);

  // Index the payments once, by id and by name, so the join below is a lookup
  // rather than a scan per student.
  const byId = new Map();
  const byName = new Map();
  for (const payment of payments ?? []) {
    if (!monthSet.has(payment.month)) continue;
    if (payment.student_id) {
      if (!byId.has(payment.student_id)) byId.set(payment.student_id, []);
      byId.get(payment.student_id).push(payment);
    }
    const key = fallbackKey(payment.class, payment.student_name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(payment);
  }

  const claimed = new Set();
  const rows = (students ?? []).map((student) => {
    const own = byId.get(student.student_id) ?? byName.get(fallbackKey(student.class, student.student_name)) ?? [];
    for (const payment of own) claimed.add(payment.row_id);

    const cells = {};
    for (const payment of own) {
      const existing = cells[payment.month];
      // More than one payment can land on a month when a duplicate was
      // deliberately allowed, or a part payment was topped up later.
      cells[payment.month] = existing
        ? {
            amount: sumAmounts([existing.amount, payment.amount]),
            receipt_no: existing.receipt_no,
            receipts: [...(existing.receipts ?? [existing.receipt_no]), payment.receipt_no],
          }
        : { amount: payment.amount, receipt_no: payment.receipt_no };
    }

    const dueMonths = [];
    const advanceMonths = [];
    for (const month of months) {
      const paid = Boolean(cells[month]);
      const standing = monthStanding(month, today);
      if (!paid && standing !== 'advance') dueMonths.push(month);
      if (paid && standing === 'advance') advanceMonths.push(month);
    }

    return {
      student_id: student.student_id,
      student_name: student.student_name,
      parent_name: student.parent_name,
      contact: student.contact,
      class: student.class,
      cells,
      paid_count: Object.keys(cells).length,
      paid_total: sumAmounts(Object.values(cells).map((cell) => cell.amount)),
      due_months: dueMonths,
      advance_months: advanceMonths,
    };
  });

  // Payments whose student is no longer on the roster. Shown rather than
  // dropped: money that has been collected must never vanish from a report.
  const unlisted = [];
  const unlistedSeen = new Map();
  for (const payment of payments ?? []) {
    if (!monthSet.has(payment.month) || claimed.has(payment.row_id)) continue;
    const key = fallbackKey(payment.class, payment.student_name);
    if (!unlistedSeen.has(key)) {
      unlistedSeen.set(key, {
        student_name: payment.student_name,
        class: payment.class,
        paid_total: 0,
        months: [],
      });
      unlisted.push(unlistedSeen.get(key));
    }
    const entry = unlistedSeen.get(key);
    entry.paid_total = sumAmounts([entry.paid_total, payment.amount]);
    entry.months.push(payment.month);
  }

  const byMonth = {};
  for (const month of months) {
    byMonth[month] = sumAmounts(rows.map((row) => row.cells[month]?.amount ?? 0));
  }

  return {
    academic_year: academicYear,
    months,
    as_of: today,
    students: rows,
    unlisted,
    totals: {
      students: rows.length,
      collected: sumAmounts(rows.map((row) => row.paid_total)),
      by_month: byMonth,
      with_dues: rows.filter((row) => row.due_months.length > 0).length,
      due_months: rows.reduce((count, row) => count + row.due_months.length, 0),
      unlisted_collected: sumAmounts(unlisted.map((entry) => entry.paid_total)),
    },
  };
}
