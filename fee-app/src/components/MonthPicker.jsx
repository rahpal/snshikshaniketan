import { Check, Lock } from 'lucide-react';
import { monthLabel, monthStanding, monthsOf } from '../../shared/academic-year.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { formatInr } from '../../shared/money.js';

/**
 * The twelve months of the school year, April first.
 *
 * One deposit often covers both directions at once - arrears for months gone
 * by and an advance for months still to come - so every month wears its
 * standing on it. Without that, April and December look identical in October,
 * and the office cannot see what it is about to record.
 *
 * Months already paid for are locked, which is what stops most double entries
 * before the server has to refuse one.
 */
export default function MonthPicker({
  academicYear,
  paymentDate,
  selected,
  paidMonths = {},
  onChange,
  disabled = false,
}) {
  const { t } = useLanguage();
  const months = monthsOf(academicYear);
  const chosen = new Set(selected);

  const standingOf = (month) => (paidMonths[month] ? 'paid' : monthStanding(month, paymentDate));
  // Everything owed by now: months gone by, and the month the fee is being
  // handed over in. Only the months still ahead are left out.
  const due = months.filter((month) => ['overdue', 'current'].includes(standingOf(month)));

  function toggle(month) {
    if (disabled || paidMonths[month]) return;
    const next = new Set(chosen);
    if (next.has(month)) next.delete(month);
    else next.add(month);
    onChange([...next].sort());
  }

  const TILE = {
    paid: 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    overdue:
      'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
    current:
      'border-slate-400 bg-white text-slate-800 ring-1 ring-slate-300 hover:border-blue-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700',
    advance:
      'border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  };

  return (
    <fieldset disabled={disabled}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('collect.months')}
        </legend>
        {due.length > 0 && (
          <button
            type="button"
            className="text-xs text-blue-600 underline hover:no-underline dark:text-blue-400"
            onClick={() => onChange([...new Set([...chosen, ...due])].sort())}
          >
            {due.length === 1
              ? t('collect.selectOverdueOne')
              : `${t('collect.selectOverdue')} ${due.length} ${t('collect.selectOverdueSuffix')}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => {
          const paid = paidMonths[month];
          const standing = standingOf(month);
          const isChosen = chosen.has(month);

          return (
            <button
              key={month}
              type="button"
              onClick={() => toggle(month)}
              aria-pressed={isChosen}
              disabled={Boolean(paid) || disabled}
              title={paid ? `${t('collect.alreadyPaid')} ${paid.receipt_no}` : undefined}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition
                ${isChosen ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : TILE[standing]}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{monthLabel(month, { short: true })}</span>
                {/* The standing stays readable once the tile turns blue, so the
                    selection never hides what is being paid. */}
                <span className={`block truncate text-[11px] ${isChosen ? 'text-blue-100' : 'opacity-75'}`}>
                  {paid ? `${t('month.paid')} · ${formatInr(paid.amount)}` : t(`month.${standing}`)}
                </span>
              </span>
              {paid ? (
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : isChosen ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('collect.yearNote')}</p>
    </fieldset>
  );
}
