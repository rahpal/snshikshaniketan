import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../lib/api.js';
import { academicYearOf, academicYearOptions } from '../../shared/academic-year.js';
import { CLASSES, classLabel } from '../../shared/school.js';
import { formatDate, formatInr } from '../../shared/money.js';
import { classReportToCsv, downloadCsv } from '../lib/reportCsv.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import ClassGrid from '../components/ClassGrid.jsx';
import Field from '../components/ui/Field.jsx';
import Spinner from '../components/ui/Spinner.jsx';

function Stat({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-slate-900 dark:text-slate-100',
    good: 'text-emerald-700 dark:text-emerald-400',
    warn: 'text-red-700 dark:text-red-400',
  };
  return (
    <div className="card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Legend() {
  const { t } = useLanguage();
  // The third swatch is nearly the page's own colour, so it needs an outline to
  // be visible at all.
  const items = [
    ['bg-emerald-100 dark:bg-emerald-900', t('grid.legendPaid')],
    ['bg-red-100 dark:bg-red-900', t('grid.legendDue')],
    ['bg-white ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600', t('grid.legendAhead')],
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
      {items.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function ClassWise() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [academicYear, setAcademicYear] = useState(academicYearOf());
  const [className, setClassName] = useState(CLASSES[0]);
  const [counts, setCounts] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(
          `/api/reports/classwise?academic_year=${encodeURIComponent(academicYear)}&class=${encodeURIComponent(className)}`
        );
        if (cancelled) return;
        setCounts(data.class_counts ?? {});
        setReport(data);

        // Landing on an empty register says nothing useful. If this class has
        // nobody but another does, show that one instead.
        if (data.students.length === 0) {
          const firstWithStudents = CLASSES.find((name) => (data.class_counts?.[name] ?? 0) > 0);
          if (firstWithStudents && firstWithStudents !== className) setClassName(firstWithStudents);
        }
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear, className]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('grid.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('grid.intro')}</p>
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
          label={t('collect.class')}
          as="select"
          value={className}
          onChange={(event) => setClassName(event.target.value)}
          className="w-44"
        >
          {CLASSES.map((name) => (
            <option key={name} value={name}>
              {classLabel(name)} ({counts[name] ?? 0})
            </option>
          ))}
        </Field>
        {isAdmin && report && report.students.length > 0 && (
          <div className="pb-0.5">
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(`fees-${className}-${academicYear}.csv`, classReportToCsv(report, { t }))
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('grid.export')}
            </Button>
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && <Spinner label={t('common.loading')} className="py-10" />}

      {!loading && report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('grid.collected')} value={formatInr(report.totals.collected)} tone="good" />
            <Stat label={t('grid.studentsCount')} value={report.totals.students} />
            <Stat
              label={t('grid.withDues')}
              value={report.totals.with_dues}
              tone={report.totals.with_dues > 0 ? 'warn' : 'good'}
            />
            <Stat
              label={t('grid.dueMonths')}
              value={report.totals.due_months}
              tone={report.totals.due_months > 0 ? 'warn' : 'good'}
            />
          </div>

          {report.students.length === 0 ? (
            <Alert tone="info">{t('grid.empty')}</Alert>
          ) : (
            <>
              <ClassGrid report={report} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Legend />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('grid.asOf')} {formatDate(report.as_of)}
                </p>
              </div>
            </>
          )}

          {report.unlisted.length > 0 && (
            <Alert tone="warning" title={t('grid.unlisted')}>
              <p>{t('grid.unlistedNote')}</p>
              <ul className="mt-1 list-inside list-disc">
                {report.unlisted.map((entry) => (
                  <li key={`${entry.class}-${entry.student_name}`}>
                    {entry.student_name} ({classLabel(entry.class)}) — {formatInr(entry.paid_total)}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
