import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../lib/api.js';
import { monthLabel, monthStanding } from '../../shared/academic-year.js';
import { PAYMENT_MODE_LABELS, classLabel } from '../../shared/school.js';
import { formatDate, formatInr } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';

function Line({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-900 dark:text-slate-100">{children}</span>
    </div>
  );
}

/**
 * The parent's copy. Laid out to print on a half sheet, with the navigation and
 * buttons dropping away via the no-print class.
 */
export default function Receipt() {
  const { receiptNo } = useParams();
  const location = useLocation();
  const { t } = useLanguage();
  const [state, setState] = useState({ status: 'loading' });

  const justCreated = Boolean(location.state?.justCreated);
  const studentAdded = Boolean(location.state?.studentAdded);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get(`/api/payments/list?receipt_no=${encodeURIComponent(receiptNo)}`);
        if (!cancelled) setState({ status: 'done', receipt: data.receipt });
      } catch (caught) {
        if (!cancelled) setState({ status: 'error', message: caught.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptNo]);

  if (state.status === 'loading') return <Spinner label={t('common.loading')} className="py-12" />;
  if (state.status === 'error') return <Alert tone="error">{state.message}</Alert>;
  if (!state.receipt) return <Alert tone="warning">{t('receipt.notFound')}</Alert>;

  const { receipt } = state;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {justCreated && (
        <Alert tone="success" className="no-print">
          {t('receipt.saved')}
          {studentAdded && ` ${t('receipt.studentAdded')}`}
        </Alert>
      )}
      {receipt.status === 'void' && <Alert tone="error">{t('receipt.void')}</Alert>}

      <div className="card p-6 print:border-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <img src="/sn_logo.jpeg" alt="" className="h-12 w-12 rounded-full object-cover" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{t('app.school')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('receipt.title')}</p>
          </div>
          <span className="ml-auto text-right">
            <span className="block text-xs text-slate-500 dark:text-slate-400">{t('receipt.number')}</span>
            <span className="block font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {receipt.receipt_no}
            </span>
          </span>
        </div>

        <div className="divide-y divide-slate-100 py-2 dark:divide-slate-800">
          <Line label={t('receipt.student')}>{receipt.student_name}</Line>
          <Line label={t('receipt.parent')}>{receipt.parent_name}</Line>
          <Line label={t('receipt.class')}>{classLabel(receipt.class)}</Line>
          <Line label={t('receipt.year')}>{receipt.academic_year}</Line>
          <Line label={t('receipt.date')}>{formatDate(receipt.payment_date)}</Line>
          <Line label={t('receipt.mode')}>
            {PAYMENT_MODE_LABELS[receipt.payment_mode] ?? receipt.payment_mode}
          </Line>
          {receipt.remarks && <Line label={t('receipt.remarks')}>{receipt.remarks}</Line>}
        </div>

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="py-2 font-medium">{t('receipt.months')}</th>
              <th scope="col" className="py-2 text-right font-medium">{t('receipt.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {receipt.months.map((entry) => (
              <tr key={entry.month}>
                <td className="py-2 text-slate-700 dark:text-slate-300">
                  {monthLabel(entry.month)}
                  {/* Worked out from the month and the payment date, so the
                      parent's copy shows what they have paid ahead for. */}
                  {monthStanding(entry.month, receipt.payment_date) === 'advance' && (
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                      ({t('receipt.advance')})
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                  {formatInr(entry.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-700">
              <th scope="row" className="py-2 text-left font-semibold text-slate-900 dark:text-slate-100">
                {t('receipt.total')}
              </th>
              <td className="py-2 text-right text-base font-bold text-slate-900 dark:text-slate-100">
                {formatInr(receipt.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {t('receipt.enteredBy')}: {receipt.entered_by}
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t('receipt.print')}
        </Button>
        <Link to="/collect">
          <Button variant="secondary">{t('receipt.another')}</Button>
        </Link>
      </div>
    </div>
  );
}
