import { Check, Lock } from 'lucide-react';
import { monthLabel, monthsOf } from '../../shared/academic-year.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { formatInr } from '../../shared/money.js';

/**
 * The twelve months of the school year, April first.
 *
 * Months already paid for are shown as paid and cannot be selected, which is
 * what stops most double entries before the server has to refuse one.
 */
export default function MonthPicker({ academicYear, selected, paidMonths = {}, onChange, disabled = false }) {
  const { t } = useLanguage();
  const months = monthsOf(academicYear);
  const chosen = new Set(selected);

  function toggle(month) {
    if (disabled || paidMonths[month]) return;
    const next = new Set(chosen);
    if (next.has(month)) next.delete(month);
    else next.add(month);
    onChange([...next].sort());
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        {t('collect.months')}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => {
          const paid = paidMonths[month];
          const isChosen = chosen.has(month);
          return (
            <button
              key={month}
              type="button"
              onClick={() => toggle(month)}
              aria-pressed={isChosen}
              disabled={Boolean(paid) || disabled}
              title={paid ? `${t('collect.alreadyPaid')} ${paid.receipt_no}` : undefined}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition
                ${
                  paid
                    ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : isChosen
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
            >
              <span className="truncate">{monthLabel(month, { short: true })}</span>
              {paid ? (
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : isChosen ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {Object.keys(paidMonths).length > 0 && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          {t('collect.lockedNote')}{' '}
          {Object.entries(paidMonths)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, info]) => `${monthLabel(month, { short: true })} (${formatInr(info.amount)})`)
            .join(', ')}
        </p>
      )}
    </fieldset>
  );
}
