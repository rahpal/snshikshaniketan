import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError, api } from '../lib/api.js';
import { academicYearOf, academicYearOptions } from '../../shared/academic-year.js';
import { CLASSES, classLabel } from '../../shared/school.js';
import { formatInr } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/**
 * Optional by design. With nothing set here the entry form falls back to
 * whatever a class most often pays, so the register works without this screen
 * ever being opened.
 */
export default function FeeStructure() {
  const { t } = useLanguage();
  const [academicYear, setAcademicYear] = useState(academicYearOf());
  const [fees, setFees] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingClass, setSavingClass] = useState(null);
  const [savedClass, setSavedClass] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/api/fees/list?academic_year=${encodeURIComponent(academicYear)}`);
        if (cancelled) return;
        const byClass = Object.fromEntries(data.fees.map((fee) => [fee.class, fee.monthly_fee]));
        setFees(byClass);
        setDrafts(Object.fromEntries(CLASSES.map((name) => [name, byClass[name] ? String(byClass[name]) : ''])));
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

  async function save(className) {
    const value = Number.parseFloat(drafts[className]);
    if (!Number.isFinite(value) || value <= 0) return;

    setError(null);
    setSavingClass(className);
    try {
      await api.post('/api/admin/fees/set', {
        academic_year: academicYear,
        class: className,
        monthly_fee: value,
      });
      setFees((current) => ({ ...current, [className]: value }));
      setSavedClass(className);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save. Please try again.');
    } finally {
      setSavingClass(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('fees.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('fees.intro')}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

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

      {loading ? (
        <Spinner label={t('common.loading')} className="py-10" />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {CLASSES.map((name) => {
            const current = fees[name];
            const draft = drafts[name] ?? '';
            const changed = draft !== '' && Number.parseFloat(draft) !== current;
            return (
              <div key={name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-28 font-medium text-slate-900 dark:text-slate-100">{classLabel(name)}</span>
                <span className="w-32 text-xs text-slate-500 dark:text-slate-400">
                  {current ? formatInr(current) : t('fees.notSet')}
                </span>
                <span className="relative w-36">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="1"
                    aria-label={`${t('fees.monthly')} ${classLabel(name)}`}
                    className="field-input has-prefix"
                    value={draft}
                    onChange={(event) => {
                      setSavedClass(null);
                      setDrafts((current2) => ({ ...current2, [name]: event.target.value }));
                    }}
                  />
                </span>
                <Button size="sm" disabled={!changed || savingClass === name} onClick={() => save(name)}>
                  {savingClass === name ? t('fees.saving') : t('fees.save')}
                </Button>
                {savedClass === name && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">{t('fees.saved')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
