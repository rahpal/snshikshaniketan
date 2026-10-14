import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, UserPlus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError, api } from '../lib/api.js';
import { academicYearOf, academicYearOptions } from '../../shared/academic-year.js';
import { CLASSES, classLabel, isKnownClass } from '../../shared/school.js';
import { parseCsvRecords } from '../../shared/csv.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/** The headings schools actually use, so nobody has to rename columns first. */
const CSV_ALIASES = {
  student_name: ['student_name', 'student name', 'name', 'student', 'child name', 'pupil'],
  class: ['class', 'grade', 'standard', 'std'],
  parent_name: ['parent_name', 'parent name', 'parent', 'father name', "father's name", 'father', 'guardian', 'mother name'],
  contact: ['contact', 'contact no', 'phone', 'phone no', 'mobile', 'mobile no', 'number'],
  admission_date: ['admission_date', 'admission date', 'doa', 'date of admission'],
  notes: ['notes', 'remarks', 'note'],
};

function ImportPanel({ academicYear, onImported }) {
  const { t } = useLanguage();
  const fileInput = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [problem, setProblem] = useState(null);
  const [importing, setImporting] = useState(false);

  async function readFile(file) {
    setProblem(null);
    setParsed(null);
    if (!file) return;

    const text = await file.text();
    const { records, unmatched } = parseCsvRecords(text, CSV_ALIASES);

    if (records.length === 0) return setProblem(t('roster.csvEmpty'));
    if (!('student_name' in (records[0] ?? {}))) return setProblem(t('roster.csvNoName'));
    if (!('class' in (records[0] ?? {}))) return setProblem(t('roster.csvNoClass'));

    // Split into what can be imported and what cannot, so the office sees the
    // problems before anything is written rather than after.
    const good = [];
    const bad = [];
    for (const record of records) {
      const name = (record.student_name ?? '').trim();
      const className = (record.class ?? '').trim().toUpperCase();
      if (name.length < 2) bad.push({ line: record._line, reason: t('collect.studentName') });
      else if (!isKnownClass(className)) bad.push({ line: record._line, reason: `${t('collect.class')}: "${record.class}"` });
      else good.push({ ...record, student_name: name, class: className });
    }

    setParsed({ good, bad, unmatched });
    return undefined;
  }

  async function confirm() {
    setImporting(true);
    setProblem(null);
    try {
      const result = await api.post('/api/students/import', {
        academic_year: academicYear,
        students: parsed.good.map(({ _line, ...student }) => student),
      });
      setParsed(null);
      if (fileInput.current) fileInput.current.value = '';
      onImported(result);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
        <Upload className="h-4 w-4" aria-hidden="true" />
        {t('roster.import')}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('roster.importHelp')}</p>

      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => readFile(event.target.files?.[0])}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 dark:text-slate-300"
      />

      {problem && <Alert tone="error">{problem}</Alert>}

      {parsed && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('roster.preview')}</p>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <li>
              <strong className="text-slate-900 dark:text-slate-100">{parsed.good.length}</strong>{' '}
              {t('roster.willImport')}
            </li>
            {parsed.bad.length > 0 && (
              <li className="text-amber-700 dark:text-amber-400">
                <strong>{parsed.bad.length}</strong> {t('roster.rowProblems')} —{' '}
                {parsed.bad
                  .slice(0, 5)
                  .map((row) => `${t('roster.badRow')} ${row.line} (${row.reason})`)
                  .join(', ')}
                {parsed.bad.length > 5 ? '…' : ''}
              </li>
            )}
            {parsed.unmatched.length > 0 && (
              <li className="text-slate-500 dark:text-slate-400">
                {t('roster.unmatched')} {parsed.unmatched.join(', ')}
              </li>
            )}
          </ul>
          <Button onClick={confirm} disabled={importing || parsed.good.length === 0}>
            {importing ? t('roster.importing') : t('roster.confirmImport')}
          </Button>
        </div>
      )}
    </div>
  );
}

function AddStudentPanel({ academicYear, onAdded }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  async function save(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await api.post('/api/students/create', {
        academic_year: academicYear,
        class: className,
        student_name: studentName,
        parent_name: parentName,
        contact,
      });
      setStudentName('');
      setParentName('');
      setContact('');
      onAdded();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.details ?? {});
      } else {
        setError('Could not add the student. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t('roster.add')}
      </Button>
    );
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5" noValidate>
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('roster.add')}</h2>
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('collect.class')}
          as="select"
          value={className}
          onChange={(event) => setClassName(event.target.value)}
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
        <Field
          label={t('collect.studentName')}
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
          error={fieldErrors.student_name}
          required
        />
        <Field
          label={t('collect.parent')}
          value={parentName}
          onChange={(event) => setParentName(event.target.value)}
          error={fieldErrors.parent_name}
        />
        <Field
          label={t('roster.contact')}
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          error={fieldErrors.contact}
          hint={t('common.optional')}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t('roster.adding') : t('roster.add')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export default function Roster() {
  const { t } = useLanguage();
  const [academicYear, setAcademicYear] = useState(academicYearOf());
  const [filterClass, setFilterClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/students/list?academic_year=${encodeURIComponent(academicYear)}`);
        if (!cancelled) setStudents(data.students);
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear, reloadToken]);

  const reload = () => setReloadToken((token) => token + 1);

  const shown = useMemo(
    () => (filterClass ? students.filter((student) => student.class === filterClass) : students),
    [students, filterClass]
  );

  const byClass = useMemo(() => {
    const counts = new Map();
    for (const student of students) counts.set(student.class, (counts.get(student.class) ?? 0) + 1);
    return counts;
  }, [students]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('roster.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('roster.intro')}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && (
        <Alert tone="success">
          {t('roster.imported')} {notice.created} {t('roster.willImport')}
          {notice.skipped.length > 0 && `, ${notice.skipped.length} ${t('roster.willSkip')}`}
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
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
          className="w-48"
        >
          <option value="">
            {t('roster.allClasses')} ({students.length})
          </option>
          {CLASSES.map((name) => (
            <option key={name} value={name}>
              {classLabel(name)} ({byClass.get(name) ?? 0})
            </option>
          ))}
        </Field>
        <div className="pb-0.5">
          <AddStudentPanel
            academicYear={academicYear}
            onAdded={() => {
              reload();
              setNotice(null);
            }}
          />
        </div>
      </div>

      <ImportPanel
        academicYear={academicYear}
        onImported={(result) => {
          setNotice(result);
          reload();
        }}
      />

      {loading ? (
        <Spinner label={t('common.loading')} className="py-10" />
      ) : shown.length === 0 ? (
        <Alert tone="info">{t('roster.empty')}</Alert>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('collect.studentName')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('collect.class')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('collect.parent')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('roster.contact')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.map((student) => (
                <tr key={student.student_id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    {student.student_name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{classLabel(student.class)}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{student.parent_name || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{student.contact || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {shown.length} {t('roster.count')}
          </p>
        </div>
      )}
    </div>
  );
}
