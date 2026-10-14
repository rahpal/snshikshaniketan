import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BanknoteArrowUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../lib/api.js';
import { academicYearOf, academicYearOptions, monthLabel, monthStanding } from '../../shared/academic-year.js';
import { PAYMENT_MODE_LABELS, classLabel } from '../../shared/school.js';
import { formatDate, formatInr, sumAmounts } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/** Groups the per-month rows back into the receipts they were written as. */
function toReceipts(payments) {
  const byReceipt = new Map();
  for (const payment of payments) {
    if (!byReceipt.has(payment.receipt_no)) {
      byReceipt.set(payment.receipt_no, {
        receipt_no: payment.receipt_no,
        payment_date: payment.payment_date,
        payment_mode: payment.payment_mode,
        remarks: payment.remarks,
        entered_by: payment.entered_by,
        months: [],
      });
    }
    byReceipt.get(payment.receipt_no).months.push({ month: payment.month, amount: payment.amount });
  }

  return [...byReceipt.values()]
    .map((receipt) => ({
      ...receipt,
      months: receipt.months.sort((a, b) => a.month.localeCompare(b.month)),
      total: sumAmounts(receipt.months.map((entry) => entry.amount)),
    }))
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export default function StudentLedger() {
  const { studentId } = useParams();
  const { t } = useLanguage();
  const [academicYear, setAcademicYear] = useState(academicYearOf());
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const query = `academic_year=${encodeURIComponent(academicYear)}&student_id=${encodeURIComponent(studentId)}`;
        const [roster, paid] = await Promise.all([
          api.get(`/api/students/list?${query}&include_inactive=true`),
          api.get(`/api/payments/list?${query}`),
        ]);
        if (cancelled) return;
        setState({ status: 'done', student: roster.students[0] ?? null, payments: paid.payments });
      } catch (caught) {
        if (!cancelled) setState({ status: 'error', message: caught.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, academicYear]);

  if (state.status === 'loading') return <Spinner label={t('common.loading')} className="py-12" />;
  if (state.status === 'error') return <Alert tone="error">{state.message}</Alert>;

  const { student, payments } = state;
  const receipts = toReceipts(payments);
  const paidMonths = new Set(payments.map((payment) => payment.month));
  const total = sumAmounts(payments.map((payment) => payment.amount));
  const today = academicYearOf() === academicYear ? undefined : `${academicYear.slice(0, 4)}-12-31`;
  const dueCount = student
    ? Array.from({ length: 12 }, (_, index) => {
        const startYear = Number.parseInt(academicYear.slice(0, 4), 10);
        const monthIndex = (3 + index) % 12;
        const year = monthIndex >= 3 ? startYear : startYear + 1;
        return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      }).filter((month) => !paidMonths.has(month) && monthStanding(month, today) !== 'advance').length
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {student ? student.student_name : t('ledger.title')}
          </h1>
          {student && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {classLabel(student.class)}
              {student.parent_name ? ` · ${student.parent_name}` : ''}
              {student.contact ? ` · ${student.contact}` : ''}
            </p>
          )}
        </div>
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
      </div>

      {!student && <Alert tone="warning">{t('ledger.notFound')}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('ledger.paidTotal')}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatInr(total)}
          </p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('ledger.monthsPaid')}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {paidMonths.size}/12
          </p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('ledger.monthsDue')}</p>
          <p
            className={`mt-0.5 text-xl font-semibold tabular-nums ${
              dueCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {dueCount}
          </p>
        </div>
      </div>

      {receipts.length === 0 ? (
        <Alert tone="info">{t('ledger.noPayments')}</Alert>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('ledger.receipts')}</h2>
          {receipts.map((receipt) => (
            <div key={receipt.receipt_no} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to={`/receipt/${receipt.receipt_no}`}
                  className="font-mono text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {receipt.receipt_no}
                </Link>
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatInr(receipt.total)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatDate(receipt.payment_date)} ·{' '}
                {PAYMENT_MODE_LABELS[receipt.payment_mode] ?? receipt.payment_mode} · {receipt.entered_by}
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                {receipt.months
                  .map((entry) => `${monthLabel(entry.month, { short: true })} ${formatInr(entry.amount)}`)
                  .join(' · ')}
              </p>
              {receipt.remarks && (
                <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{receipt.remarks}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <Link to="/collect">
          <Button>
            <BanknoteArrowUp className="h-4 w-4" aria-hidden="true" />
            {t('ledger.recordPayment')}
          </Button>
        </Link>
        <Link to="/classwise">
          <Button variant="secondary">{t('ledger.back')}</Button>
        </Link>
      </div>
    </div>
  );
}
