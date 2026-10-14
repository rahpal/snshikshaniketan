import { monthLabel } from '../../shared/academic-year.js';
import { classLabel } from '../../shared/school.js';

/** Quotes a field only when it needs it, so the file stays readable. */
function cell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The class-wise grid as a CSV, laid out exactly as it is on screen so the two
 * can be read against each other.
 */
export function classReportToCsv(report, { t }) {
  const header = [
    t('grid.student'),
    t('collect.class'),
    t('collect.parent'),
    t('roster.contact'),
    ...report.months.map((month) => monthLabel(month, { short: true })),
    t('grid.paidCount'),
    t('grid.total'),
    t('grid.dueMonths'),
  ];

  const rows = report.students.map((student) => [
    student.student_name,
    classLabel(student.class),
    student.parent_name,
    student.contact,
    ...report.months.map((month) => student.cells[month]?.amount ?? ''),
    student.paid_count,
    student.paid_total,
    student.due_months.map((month) => monthLabel(month, { short: true })).join(' '),
  ]);

  const totals = [
    t('grid.total'),
    '',
    '',
    '',
    ...report.months.map((month) => report.totals.by_month[month] ?? 0),
    '',
    report.totals.collected,
    report.totals.due_months,
  ];

  return [header, ...rows, totals].map((row) => row.map(cell).join(',')).join('\n');
}

/** Hands the file to the browser without a round trip to the server. */
export function downloadCsv(filename, csv) {
  // The BOM is what makes Excel open a UTF-8 CSV without mangling Hindi.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
