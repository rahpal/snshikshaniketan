import { PAYMENT_STATUS, TABS } from './sheet-schema.js';
import { appendObjects, asNumber, asText, readTable, updateRows } from './table.js';
import { shortId, ulid } from './ulid.js';
import { conflict, notFound } from './errors.js';

const TAB = TABS.PAYMENTS;

function hydrate(row) {
  return {
    _row: row._row,
    row_id: asText(row.row_id),
    receipt_no: asText(row.receipt_no),
    academic_year: asText(row.academic_year),
    class: asText(row.class).toUpperCase(),
    section: asText(row.section),
    student_id: asText(row.student_id),
    student_name: asText(row.student_name),
    parent_name: asText(row.parent_name),
    month: asText(row.month),
    amount: asNumber(row.amount, 0),
    receipt_total: asNumber(row.receipt_total, 0),
    payment_date: asText(row.payment_date),
    payment_mode: asText(row.payment_mode),
    remarks: asText(row.remarks),
    entered_by: asText(row.entered_by),
    entered_at: asText(row.entered_at),
    status: asText(row.status) || PAYMENT_STATUS.ACTIVE,
    voided_by: asText(row.voided_by),
    voided_at: asText(row.voided_at),
    void_reason: asText(row.void_reason),
  };
}

export async function listPayments({
  academic_year,
  className,
  student_id,
  receipt_no,
  includeVoided = false,
  fresh = false,
} = {}) {
  const { rows } = await readTable(TAB, { fresh });
  return rows
    .map(hydrate)
    .filter((payment) => payment.receipt_no)
    .filter((payment) => (academic_year ? payment.academic_year === academic_year : true))
    .filter((payment) => (className ? payment.class === String(className).toUpperCase() : true))
    .filter((payment) => (student_id ? payment.student_id === student_id : true))
    .filter((payment) => (receipt_no ? payment.receipt_no === receipt_no : true))
    .filter((payment) => (includeVoided ? true : payment.status === PAYMENT_STATUS.ACTIVE));
}

/** The rows of one receipt, grouped back into the thing the user submitted. */
export async function findReceipt(receiptNo, options = {}) {
  const rows = await listPayments({ receipt_no: receiptNo, includeVoided: true, ...options });
  if (rows.length === 0) return null;

  const [first] = rows;
  return {
    receipt_no: first.receipt_no,
    academic_year: first.academic_year,
    class: first.class,
    section: first.section,
    student_id: first.student_id,
    student_name: first.student_name,
    parent_name: first.parent_name,
    payment_date: first.payment_date,
    payment_mode: first.payment_mode,
    remarks: first.remarks,
    entered_by: first.entered_by,
    entered_at: first.entered_at,
    status: first.status,
    voided_by: first.voided_by,
    voided_at: first.voided_at,
    void_reason: first.void_reason,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    months: rows
      .map((row) => ({ month: row.month, amount: row.amount }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/** Receipts are numbered SNS-2627-XXXXXX: unique without a shared counter. */
function buildReceiptNumber(academicYear, taken) {
  const suffix = academicYear.replace('-', '');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `SNS-${suffix}-${shortId(6)}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not allocate an unused receipt number.');
}

/**
 * Which of the requested months this student has already paid for.
 *
 * Matched on the student's id where there is one, and on name within the class
 * otherwise, so a payment recorded before the student was on the list is still
 * recognised.
 */
export function findAlreadyPaid(existing, { student_id, student_name, className, months }) {
  const wanted = new Set(months);
  const nameKey = String(student_name).trim().toLowerCase().replace(/\s+/g, ' ');

  return existing
    .filter((payment) => {
      if (!wanted.has(payment.month)) return false;
      if (student_id && payment.student_id) return payment.student_id === student_id;
      return (
        payment.class === String(className).toUpperCase() &&
        payment.student_name.toLowerCase().replace(/\s+/g, ' ') === nameKey
      );
    })
    .map((payment) => ({ month: payment.month, receipt_no: payment.receipt_no, amount: payment.amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Records a payment as one row per month, all sharing a receipt number.
 *
 * Each month carries the amount that was entered against it, so a month that
 * cost more or was part-paid is stored as what it actually was. The receipt
 * total is the sum of the months - never the other way round, because dividing
 * a total would fabricate per-month figures.
 */
export async function createPayment(input, user) {
  const existing = await listPayments({ academic_year: input.academic_year, fresh: true });

  const alreadyPaid = findAlreadyPaid(existing, {
    student_id: input.student_id,
    student_name: input.student_name,
    className: input.class,
    months: input.months.map((entry) => entry.month),
  });

  if (alreadyPaid.length > 0 && !input.allow_duplicate) {
    throw conflict(
      `${input.student_name} already has a payment recorded for ${alreadyPaid.length === 1 ? 'this month' : 'these months'}.`,
      { already_paid: alreadyPaid }
    );
  }

  const receiptNo = buildReceiptNumber(
    input.academic_year,
    new Set(existing.map((payment) => payment.receipt_no))
  );

  const months = [...input.months].sort((a, b) => a.month.localeCompare(b.month));
  const total = Math.round(months.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  const enteredAt = new Date().toISOString();

  const rows = months.map((entry) => ({
    row_id: ulid(),
    receipt_no: receiptNo,
    academic_year: input.academic_year,
    class: String(input.class).toUpperCase(),
    section: input.section ?? '',
    student_id: input.student_id ?? '',
    student_name: input.student_name,
    parent_name: input.parent_name,
    month: entry.month,
    amount: entry.amount,
    receipt_total: total,
    payment_date: input.payment_date,
    payment_mode: input.payment_mode,
    remarks: input.remarks ?? '',
    entered_by: user.username,
    entered_at: enteredAt,
    status: PAYMENT_STATUS.ACTIVE,
    voided_by: '',
    voided_at: '',
    void_reason: '',
  }));

  await appendObjects(TAB, rows);

  return {
    receipt_no: receiptNo,
    rows,
    total,
    duplicate_of: alreadyPaid,
  };
}

/** Every stored row of one receipt, for a change that must cover all of them. */
async function receiptRows(receiptNo) {
  const rows = await listPayments({ receipt_no: receiptNo, includeVoided: true, fresh: true });
  if (rows.length === 0) throw notFound(`No receipt numbered ${receiptNo}.`);
  return rows;
}

/**
 * Cancels a receipt, every month of it, with a reason.
 *
 * Nothing is deleted. A void and its replacement both stay in the register, so
 * the money that was taken and the correction that followed can both be seen -
 * which is the point of keeping a register at all.
 */
export async function voidReceipt(receiptNo, { reason, by }) {
  const rows = await receiptRows(receiptNo);
  if (rows.every((row) => row.status === PAYMENT_STATUS.VOID)) {
    throw conflict(`Receipt ${receiptNo} has already been cancelled.`);
  }

  const voidedAt = new Date().toISOString();
  await updateRows(
    TAB,
    rows.map((row) => ({
      rowNumber: row._row,
      patch: {
        status: PAYMENT_STATUS.VOID,
        voided_by: by,
        voided_at: voidedAt,
        void_reason: reason,
      },
    }))
  );

  return {
    receipt_no: receiptNo,
    months: rows.map((row) => row.month).sort(),
    total: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}

/**
 * Corrects the details around a payment - when it was handed over, how, and
 * the remarks. The amounts and months are deliberately not touchable here.
 */
export async function updateReceiptDetails(receiptNo, patch) {
  const rows = await receiptRows(receiptNo);
  if (rows.every((row) => row.status === PAYMENT_STATUS.VOID)) {
    throw conflict(`Receipt ${receiptNo} has been cancelled and can no longer be changed.`);
  }

  const fields = {};
  if (patch.payment_date !== undefined) fields.payment_date = patch.payment_date;
  if (patch.payment_mode !== undefined) fields.payment_mode = patch.payment_mode;
  if (patch.remarks !== undefined) fields.remarks = patch.remarks;

  const before = {
    payment_date: rows[0].payment_date,
    payment_mode: rows[0].payment_mode,
    remarks: rows[0].remarks,
  };

  await updateRows(TAB, rows.map((row) => ({ rowNumber: row._row, patch: fields })));
  return { academic_year: rows[0].academic_year, before, after: { ...before, ...fields } };
}
