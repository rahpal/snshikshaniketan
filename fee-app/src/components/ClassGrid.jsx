import { Link } from 'react-router-dom';
import { monthLabel, monthStanding } from '../../shared/academic-year.js';
import { formatInr } from '../../shared/money.js';
import { useLanguage } from '../context/LanguageContext.jsx';

/**
 * The register: a row per student, a column per month.
 *
 * The distinction that makes it readable is between a month that is owed and a
 * month that simply has not come round yet. Painting every unpaid month red
 * would show half the year in alarm from April onwards and teach everyone to
 * ignore the colour.
 */
export default function ClassGrid({ report }) {
  const { t } = useLanguage();
  const { months, students, as_of: asOf } = report;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            >
              {t('grid.student')}
            </th>
            {months.map((month) => (
              <th
                key={month}
                scope="col"
                className="px-1 py-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                {monthLabel(month, { short: true }).split(' ')[0]}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('grid.total')}
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {students.map((student) => (
            <tr key={student.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-slate-900 dark:bg-slate-900 dark:text-slate-100"
              >
                <Link
                  to={`/students/${student.student_id}`}
                  className="hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                  title={t('grid.openLedger')}
                >
                  {student.student_name}
                </Link>
                <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  {student.paid_count}/{months.length} · {formatInr(student.paid_total)}
                </span>
              </th>

              {months.map((month) => {
                const cell = student.cells[month];
                const owed = !cell && monthStanding(month, asOf) !== 'advance';
                return (
                  <td
                    key={month}
                    title={cell ? `${monthLabel(month)} · ${cell.receipt_no}` : monthLabel(month)}
                    className={`px-1 py-2 text-center text-[11px] tabular-nums ${
                      cell
                        ? 'bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : owed
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'text-slate-300 dark:text-slate-700'
                    }`}
                  >
                    {cell ? Math.round(cell.amount) : owed ? '—' : '·'}
                  </td>
                );
              })}

              <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {formatInr(student.paid_total)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {t('grid.total')}
            </th>
            {months.map((month) => (
              <td key={month} className="px-1 py-2 text-center text-[11px] font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {report.totals.by_month[month] ? Math.round(report.totals.by_month[month]) : ''}
              </td>
            ))}
            <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatInr(report.totals.collected)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
