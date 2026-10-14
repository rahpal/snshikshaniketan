import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../lib/api.js';
import { academicYearOf, academicYearOptions, monthLabel } from '../../shared/academic-year.js';
import { CLASSES, classLabel } from '../../shared/school.js';
import { formatDate, formatInr } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/**
 * The list the office actually prints: who owes something, how much is
 * outstanding, and the number to ring.
 */
export default function Pending() {
  const { t } = useLanguage();
  const [academicYear, setAcademicYear] = useState(academicYearOf());
  const [filterClass, setFilterClass] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/api/reports/classwise?academic_year=${encodeURIComponent(academicYear)}`);
        if (!cancelled) setReport(data);
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear]);

  const owing = useMemo(() => {
    if (!report) return [];
    return report.students
      .filter((student) => student.due_months.length > 0)
      .filter((student) => (filterClass ? student.class === filterClass : true))
      // Worst first: the longest-standing dues are the ones to chase.
      .sort(
        (a, b) =>
          b.due_months.length - a.due_months.length ||
          a.class.localeCompare(b.class) ||
          a.student_name.localeCompare(b.student_name)
      );
  }, [report, filterClass]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('pending.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('pending.intro')}</p>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3">
        <Field
          label={t('collect.year')}
          as="select"
          value={academicYear}
          onChange={(event) => setAcademicYear(event.target.value)}
          className="w-40"
        >
          {academicYearOptions().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Field>
        <Field
          label={t('roster.filterClass')}
          as="select"
          value={filterClass}
          onChange={(event) => setFilterClass(event.target.value)}
          className="w-44"
        >
          <option value="">{t('roster.allClasses')}</option>
          {CLASSES.map((name) => (
            <option key={name} value={name}>
              {classLabel(name)}
            </option>
          ))}
        </Field>
        {owing.length > 0 && (
          <div className="pb-0.5">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t('pending.print')}
            </Button>
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && <Spinner label={t('common.loading')} className="py-10" />}

      {!loading && report && (
        owing.length === 0 ? (
          <Alert tone="success">{t('pending.none')}</Alert>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">{owing.length}</strong>{' '}
              {t('pending.studentsOwing')} · {t('grid.asOf')} {formatDate(report.as_of)}
            </p>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t('grid.student')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('collect.class')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('collect.parent')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('pending.contact')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('pending.months')}</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">{t('pending.paidSoFar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {owing.map((student) => (
                    <tr key={student.student_id}>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        <Link
                          to={`/students/${student.student_id}`}
                          className="hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                        >
                          {student.student_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{classLabel(student.class)}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{student.parent_name || '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                        {student.contact || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-red-700 dark:text-red-400">
                          {student.due_months.length}
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          {student.due_months.map((month) => monthLabel(month, { short: true }).split(' ')[0]).join(', ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatInr(student.paid_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  );
}
