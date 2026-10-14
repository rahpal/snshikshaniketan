import { TABS } from './sheet-schema.js';
import { appendObjects, asBool, asNumber, asText, readTable, updateRow } from './table.js';
import { ulid } from './ulid.js';
import { conflict, notFound } from './errors.js';

const TAB = TABS.STUDENTS;

function hydrate(row) {
  return {
    _row: row._row,
    student_id: asText(row.student_id),
    academic_year: asText(row.academic_year),
    class: asText(row.class).toUpperCase(),
    section: asText(row.section),
    student_name: asText(row.student_name),
    parent_name: asText(row.parent_name),
    contact: asText(row.contact),
    admission_date: asText(row.admission_date),
    active: asBool(row.active, true),
    concession_pct: asNumber(row.concession_pct, 0),
    notes: asText(row.notes),
    created_at: asText(row.created_at),
    created_by: asText(row.created_by),
  };
}

/** Two students are "the same" if the name and class match within one year. */
function identityKey(student) {
  return [
    asText(student.academic_year),
    asText(student.class).toUpperCase(),
    asText(student.student_name).toLowerCase().replace(/\s+/g, ' '),
  ].join('|');
}

export async function listStudents({ academic_year, className, activeOnly = true, fresh = false } = {}) {
  const { rows } = await readTable(TAB, { fresh });
  return rows
    .map(hydrate)
    .filter((student) => student.student_name)
    .filter((student) => (academic_year ? student.academic_year === academic_year : true))
    .filter((student) => (className ? student.class === String(className).toUpperCase() : true))
    .filter((student) => (activeOnly ? student.active : true))
    .sort((a, b) => a.student_name.localeCompare(b.student_name, 'en'));
}

export async function findStudentById(studentId, { fresh = false } = {}) {
  if (!studentId) return null;
  const { rows } = await readTable(TAB, { fresh });
  const match = rows.map(hydrate).find((student) => student.student_id === studentId);
  return match ?? null;
}

function buildStudent(input, createdBy) {
  return {
    student_id: ulid(),
    academic_year: asText(input.academic_year),
    class: asText(input.class).toUpperCase(),
    section: asText(input.section),
    student_name: asText(input.student_name).replace(/\s+/g, ' '),
    parent_name: asText(input.parent_name).replace(/\s+/g, ' '),
    contact: asText(input.contact),
    admission_date: asText(input.admission_date),
    active: true,
    concession_pct: asNumber(input.concession_pct, 0),
    notes: asText(input.notes),
    created_at: new Date().toISOString(),
    created_by: createdBy,
  };
}

export async function createStudent(input, createdBy) {
  const student = buildStudent(input, createdBy);
  const existing = await listStudents({
    academic_year: student.academic_year,
    className: student.class,
    activeOnly: false,
    fresh: true,
  });

  if (existing.some((candidate) => identityKey(candidate) === identityKey(student))) {
    throw conflict(`${student.student_name} is already on the list for ${student.class}.`);
  }

  await appendObjects(TAB, student);
  return student;
}

/**
 * Loads a list of students in one go, skipping any that are already there.
 *
 * Importing the same file twice must not double the roster, so each record is
 * matched against both the existing rows and the rest of the batch.
 */
export async function importStudents(records, { academic_year, createdBy }) {
  const existing = await listStudents({ academic_year, activeOnly: false, fresh: true });
  const seen = new Set(existing.map(identityKey));

  const toCreate = [];
  const skipped = [];

  for (const record of records) {
    const student = buildStudent({ ...record, academic_year }, createdBy);
    const key = identityKey(student);
    if (seen.has(key)) {
      skipped.push({ student_name: student.student_name, class: student.class, reason: 'already on the list' });
      continue;
    }
    seen.add(key);
    toCreate.push(student);
  }

  if (toCreate.length > 0) await appendObjects(TAB, toCreate);
  return { created: toCreate, skipped };
}

export async function updateStudent(studentId, patch) {
  const student = await findStudentById(studentId, { fresh: true });
  if (!student) throw notFound('That student is not on the list.');
  return hydrate(await updateRow(TAB, student._row, patch));
}
