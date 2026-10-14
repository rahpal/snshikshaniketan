import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BanknoteArrowUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError, api } from '../lib/api.js';
import {
  academicYearOf,
  academicYearOptions,
  earliestPaymentDateFor,
  monthLabel,
  monthStanding,
  monthsOf,
  todayAtSchool,
} from '../../shared/academic-year.js';
import { CLASSES, PAYMENT_MODE_LABELS, classLabel } from '../../shared/school.js';
import { formatInr, usualMonthlyAmount } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import AmountEntry from '../components/AmountEntry.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import Spinner from '../components/ui/Spinner.jsx';

const NEW_STUDENT = '__new__';

export default function CollectPayment() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [academicYear, setAcademicYear] = useState(academicYearOf());
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [months, setMonths] = useState([]);
  const [amount, setAmount] = useState('');
  // Whether the amount on screen is the class's usual figure or one someone
  // typed. Without this, clearing the box would snap the pre-fill back.
  const [amountTouched, setAmountTouched] = useState(false);
  const [perMonth, setPerMonth] = useState(false);
  const [amounts, setAmounts] = useState({});
  const [paymentDate, setPaymentDate] = useState(todayAtSchool);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [remarks, setRemarks] = useState('');

  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingClass, setLoadingClass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicate, setDuplicate] = useState(null);

  const isNewStudent = studentId === NEW_STUDENT;

  // The class list and its payments, reloaded whenever the class changes.
  // Nothing clears the previous class's data: changeClass() resets the fields
  // that depend on it, and the student picker stays hidden until the new list
  // has arrived, so stale rows are never on screen.
  useEffect(() => {
    if (!className) return undefined;

    let cancelled = false;
    (async () => {
      setLoadingClass(true);
      const query = `academic_year=${encodeURIComponent(academicYear)}&class=${encodeURIComponent(className)}`;
      try {
        const [roster, paid] = await Promise.all([
          api.get(`/api/students/list?${query}`),
          api.get(`/api/payments/list?${query}`),
        ]);
        if (cancelled) return;
        setStudents(roster.students);
        setPayments(paid.payments);
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoadingClass(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [academicYear, className]);

  const selectedStudent = students.find((student) => student.student_id === studentId) ?? null;

  /** Months this student has already been recorded as paying for. */
  const paidMonths = useMemo(() => {
    if (!studentId || isNewStudent) return {};
    const nameKey = selectedStudent?.student_name?.toLowerCase() ?? '';
    const map = {};
    for (const payment of payments) {
      const matches = payment.student_id
        ? payment.student_id === studentId
        : payment.student_name.toLowerCase() === nameKey;
      if (matches) map[payment.month] = { receipt_no: payment.receipt_no, amount: payment.amount };
    }
    return map;
  }, [payments, studentId, isNewStudent, selectedStudent]);

  /**
   * Months already gone by that this student has neither paid nor been
   * selected for. Worth raising only when the receipt is paying ahead: taking
   * an advance while an earlier month is still open is the combination that
   * tends to be a mistake at the counter.
   */
  const unpaidArrears = useMemo(() => {
    if (!studentId) return [];
    return monthsOf(academicYear).filter(
      (month) =>
        !paidMonths[month] &&
        !months.includes(month) &&
        monthStanding(month, paymentDate) !== 'advance'
    );
  }, [academicYear, paidMonths, months, paymentDate, studentId]);

  const payingAhead = months.some((month) => monthStanding(month, paymentDate) === 'advance');
  const showArrears = payingAhead && unpaidArrears.length > 0;

  /** What this class usually pays, taken from what has actually been collected. */
  const usual = useMemo(() => usualMonthlyAmount(payments), [payments]);

  // The pre-fill is derived, not stored: until someone types, the box shows the
  // class's usual figure, and each class brings its own.
  const shownAmount = amountTouched ? amount : usual !== null ? String(usual) : '';

  function changeAmount(value) {
    setAmountTouched(true);
    setAmount(value);
  }

  /** Switching to per-month seeds every month with whatever is already shown. */
  function changeMode(next) {
    if (next) {
      setAmounts(Object.fromEntries(months.map((month) => [month, amounts[month] ?? shownAmount])));
    }
    setPerMonth(next);
  }

  /** The months and amounts exactly as they will be stored. */
  function monthsWithAmounts() {
    return months.map((month) => ({
      month,
      amount: Number.parseFloat(perMonth ? amounts[month] : shownAmount),
    }));
  }

  function chooseStudent(value) {
    setStudentId(value);
    setMonths([]);
    setAmounts({});
    setDuplicate(null);
    const student = students.find((candidate) => candidate.student_id === value);
    setStudentName(student?.student_name ?? '');
    setParentName(student?.parent_name ?? '');
  }

  function changeClass(value) {
    setClassName(value);
    setStudentId('');
    setStudentName('');
    setParentName('');
    setMonths([]);
    setAmounts({});
    // A new class has its own usual figure, so let it pre-fill again.
    setAmount('');
    setAmountTouched(false);
    setDuplicate(null);
  }

  async function submit({ allowDuplicate = false } = {}) {
    setError(null);
    setFieldErrors({});

    if (months.length === 0) {
      setFieldErrors({ months: t('collect.monthsRequired') });
      return;
    }

    const entries = monthsWithAmounts();
    if (entries.some((entry) => !Number.isFinite(entry.amount) || entry.amount <= 0)) {
      setFieldErrors({ months: t('collect.amountRequired') });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post('/api/payments/create', {
        academic_year: academicYear,
        class: className,
        student_id: isNewStudent ? '' : studentId,
        student_name: studentName,
        parent_name: parentName,
        months: entries,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        remarks,
        allow_duplicate: allowDuplicate,
      });

      navigate(`/receipt/${result.receipt_no}`, {
        state: { justCreated: true, studentAdded: result.student_added },
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'conflict') {
        setDuplicate(caught.details?.already_paid ?? []);
      } else if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.details ?? {});
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('collect.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('collect.intro')}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {duplicate && (
        <Alert tone="warning" title={t('collect.duplicateTitle')}>
          <ul className="mt-1 list-inside list-disc">
            {duplicate.map((entry) => (
              <li key={entry.month}>
                {monthLabel(entry.month)} — {formatInr(entry.amount)} ({entry.receipt_no})
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" onClick={() => submit({ allowDuplicate: true })} disabled={submitting}>
              {t('collect.recordAnyway')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDuplicate(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Alert>
      )}

      <form
        className="card space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('collect.year')}
            as="select"
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            error={fieldErrors.academic_year}
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
            onChange={(event) => changeClass(event.target.value)}
            error={fieldErrors.class}
            required
          >
            <option value="">{t('collect.selectClass')}</option>
            {CLASSES.map((name) => (
              <option key={name} value={name}>
                {classLabel(name)}
              </option>
            ))}
          </Field>
        </div>

        {loadingClass && <Spinner label={t('collect.loadingStudents')} />}

        {className && !loadingClass && (
          <>
            <Field
              label={t('collect.student')}
              as="select"
              value={studentId}
              onChange={(event) => chooseStudent(event.target.value)}
              error={fieldErrors.student_name}
              required
            >
              <option value="">{t('collect.chooseStudent')}</option>
              {students.map((student) => (
                <option key={student.student_id} value={student.student_id}>
                  {student.student_name}
                  {student.parent_name ? ` — ${student.parent_name}` : ''}
                </option>
              ))}
              <option value={NEW_STUDENT}>{t('collect.newStudent')}</option>
            </Field>

            {students.length === 0 && <Alert tone="info">{t('collect.noStudents')}</Alert>}

            {isNewStudent && (
              <Field
                label={t('collect.studentName')}
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                error={fieldErrors.student_name}
                required
                autoFocus
              />
            )}

            {studentId && (
              <Field
                label={t('collect.parent')}
                value={parentName}
                onChange={(event) => setParentName(event.target.value)}
                error={fieldErrors.parent_name}
                required
              />
            )}
          </>
        )}

        {studentId && (
          <>
            <div>
              <MonthPicker
                academicYear={academicYear}
                paymentDate={paymentDate}
                selected={months}
                paidMonths={paidMonths}
                onChange={(next) => {
                  setMonths(next);
                  setDuplicate(null);
                  if (perMonth) {
                    setAmounts(Object.fromEntries(next.map((month) => [month, amounts[month] ?? shownAmount])));
                  }
                }}
                disabled={submitting}
              />
              {fieldErrors.months && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldErrors.months}
                </p>
              )}
            </div>

            {showArrears && (
              <Alert tone="warning" title={t('collect.earlierUnpaid')}>
                <p>{unpaidArrears.map((month) => monthLabel(month)).join(', ')}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    const next = [...new Set([...months, ...unpaidArrears])].sort();
                    setMonths(next);
                    if (perMonth) {
                      setAmounts(
                        Object.fromEntries(next.map((month) => [month, amounts[month] ?? shownAmount]))
                      );
                    }
                  }}
                >
                  {t('collect.addThem')}
                </Button>
              </Alert>
            )}

            <AmountEntry
              months={months}
              className={className}
              paymentDate={paymentDate}
              perMonth={perMonth}
              amount={shownAmount}
              amounts={amounts}
              usual={usual}
              errors={fieldErrors}
              onAmountChange={changeAmount}
              onAmountsChange={setAmounts}
              onModeChange={changeMode}
              disabled={submitting}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('collect.date')}
                type="date"
                min={earliestPaymentDateFor(academicYear)}
                max={todayAtSchool()}
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                error={fieldErrors.payment_date}
                required
              />
              <Field
                label={t('collect.mode')}
                as="select"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                error={fieldErrors.payment_mode}
              >
                {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Field>
            </div>

            <Field
              label={t('collect.remarks')}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              error={fieldErrors.remarks}
              hint={t('collect.remarksHint')}
            />

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              <BanknoteArrowUp className="h-4 w-4" aria-hidden="true" />
              {submitting ? t('collect.submitting') : t('collect.submit')}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
