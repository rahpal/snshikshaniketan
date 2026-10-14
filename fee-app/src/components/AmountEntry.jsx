import { monthLabel } from '../../shared/academic-year.js';
import { formatInr, sumAmounts } from '../../shared/money.js';
import { classLabel } from '../../shared/school.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import Field from './ui/Field.jsx';

/**
 * How much was paid, for the months selected.
 *
 * Two modes, because two things are true at once: nearly every receipt is the
 * same figure repeated, and any single month can legitimately differ (an exam
 * month, a part payment, a fee that changed mid-year).
 *
 * The simple mode multiplies - one amount per month, times the months chosen.
 * It never divides a total, because dividing invents per-month figures nobody
 * typed, and those figures are what the class-wise view reports. The total is
 * always the sum of the parts, and is never something to type.
 */
export default function AmountEntry({
  months,
  className,
  perMonth,
  amount,
  amounts,
  usual,
  errors = {},
  onAmountChange,
  onAmountsChange,
  onModeChange,
  disabled = false,
}) {
  const { t } = useLanguage();
  if (months.length === 0) return null;

  const values = perMonth
    ? months.map((month) => Number.parseFloat(amounts[month]) || 0)
    : months.map(() => Number.parseFloat(amount) || 0);
  const total = sumAmounts(values);

  const differs = (value) => usual !== null && value > 0 && value !== usual;
  const anyDiffers = perMonth && values.some(differs);

  return (
    <div className="space-y-3">
      {perMonth ? (
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('collect.amountEach')}
            </span>
            {usual !== null && (
              <button
                type="button"
                className="text-xs text-blue-600 underline hover:no-underline dark:text-blue-400"
                onClick={() =>
                  onAmountsChange(Object.fromEntries(months.map((month) => [month, String(usual)])))
                }
                disabled={disabled}
              >
                {t('collect.setAllTo')} {formatInr(usual)}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {months.map((month) => {
              const value = Number.parseFloat(amounts[month]) || 0;
              const off = differs(value);
              return (
                <div key={month} className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="truncate">{monthLabel(month)}</span>
                    {off && (
                      <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                        {value > usual ? t('collect.moreThanUsual') : t('collect.lessThanUsual')}
                      </span>
                    )}
                  </span>
                  <span className="relative w-40">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.01"
                      aria-label={monthLabel(month)}
                      className={`field-input has-prefix ${off ? 'is-flagged' : ''}`}
                      value={amounts[month] ?? ''}
                      onChange={(event) => onAmountsChange({ ...amounts, [month]: event.target.value })}
                      disabled={disabled}
                    />
                  </span>
                </div>
              );
            })}
          </div>

          {anyDiffers && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('collect.checkAmounts')}</p>
          )}
          {errors.months && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
              {errors.months}
            </p>
          )}
        </div>
      ) : (
        <Field
          label={t('collect.amount')}
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          error={errors.months}
          hint={
            usual !== null
              ? t('collect.usualHint')
                  .replace('{class}', classLabel(className))
                  .replace('{amount}', formatInr(usual))
              : t('collect.amountHint')
          }
          disabled={disabled}
          required
        />
      )}

      <button
        type="button"
        className="text-sm text-blue-600 underline hover:no-underline dark:text-blue-400"
        onClick={() => onModeChange(!perMonth)}
        disabled={disabled}
      >
        {perMonth ? t('collect.sameAmount') : t('collect.differentAmounts')}
      </button>

      {/* The number counted against the cash in hand, and the one printed. */}
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
        <span className="text-sm text-blue-800 dark:text-blue-300">
          {months.length} {months.length === 1 ? t('collect.monthWord') : t('collect.monthsWord')}
          {!perMonth && Number.parseFloat(amount) > 0 && ` × ${formatInr(Number.parseFloat(amount))}`}
        </span>
        <span className="text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-200">
          {formatInr(total)}
        </span>
      </div>
    </div>
  );
}
