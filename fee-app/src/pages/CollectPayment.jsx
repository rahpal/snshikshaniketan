import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BanknoteArrowUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError, api } from '../lib/api.js';
import { academicYearOf, academicYearOptions, monthLabel } from '../../shared/academic-year.js';
import { CLASSES, PAYMENT_MODE_LABELS, classLabel } from '../../shared/school.js';
import { allocateAmount, formatInr } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import Spinner from '../components/ui/Spinner.jsx';

const NEW_STUDENT = '__new__';

/** Today in the local timezone, as the date input wants it. */
function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

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
  const [paymentDate, setPaymentDate] = useState(todayIso);
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

  const split = useMemo(() => {
    const total = Number.parseFloat(amount);
    if (!Number.isFinite(total) || total <= 0 || months.length < 2) return null;
    return allocateAmount(total, months.length);
  }, [amount, months.length]);

  function chooseStudent(value) {
    setStudentId(value);
    setMonths([]);
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
    setDuplicate(null);
  }

  async function submit({ allowDuplicate = false } = {}) {
    setError(null);
    setFieldErrors({});

    if (months.length === 0) {
      setFieldErrors({ months: t('collect.monthsRequired') });
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
        months,
        amount: Number.parseFloat(amount),
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
                selected={months}
                paidMonths={paidMonths}
                onChange={(next) => {
                  setMonths(next);
                  setDuplicate(null);
                }}
                disabled={submitting}
              />
              {fieldErrors.months && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldErrors.months}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('collect.amount')}
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                error={fieldErrors.amount}
                hint={
                  split
                    ? `${t('collect.perMonth')} ${split.map((part) => formatInr(part)).join(' + ')}`
                    : t('collect.amountHint')
                }
                required
              />
              <Field
                label={t('collect.date')}
                type="date"
                max={todayIso()}
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                error={fieldErrors.payment_date}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field
                label={t('collect.remarks')}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                error={fieldErrors.remarks}
                hint={t('collect.remarksHint')}
              />
            </div>

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
