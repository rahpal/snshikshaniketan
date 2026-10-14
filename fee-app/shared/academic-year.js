/**
 * The school year runs April to March, so "2026-27" starts in April 2026 and
 * its months must be ordered Apr -> Mar. Treating the year as Jan-Dec would
 * misreport every year-end.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-27" for any date from April 2026 to March 2027. */
export function academicYearOf(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function isAcademicYear(value) {
  return /^\d{4}-\d{2}$/.test(String(value ?? ''));
}

export function academicYearStartYear(academicYear) {
  if (!isAcademicYear(academicYear)) throw new Error(`Not an academic year: ${academicYear}`);
  return Number.parseInt(String(academicYear).slice(0, 4), 10);
}

/** The twelve month keys of an academic year, in school order: 2026-04 .. 2027-03. */
export function monthsOf(academicYear) {
  const startYear = academicYearStartYear(academicYear);
  const months = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const monthIndex = (3 + offset) % 12; // 3 = April
    const year = monthIndex >= 3 ? startYear : startYear + 1;
    months.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}`);
  }
  return months;
}

export function monthLabel(monthKey, { short = false } = {}) {
  const [year, month] = String(monthKey).split('-');
  const name = MONTH_NAMES[Number.parseInt(month, 10) - 1] ?? monthKey;
  const display = short ? name.slice(0, 3) : name;
  return `${display} ${year}`;
}

export function isMonthKey(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''));
}

/** A list of academic years to offer in dropdowns: a few back, one ahead. */
export function academicYearOptions(date = new Date(), back = 3, forward = 1) {
  const current = academicYearStartYear(academicYearOf(date));
  const options = [];
  for (let year = current + forward; year >= current - back; year -= 1) {
    options.push(`${year}-${String((year + 1) % 100).padStart(2, '0')}`);
  }
  return options;
}
