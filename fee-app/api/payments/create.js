import { clientIp, handler, ok, parse, readBody } from '../_lib/http.js';
import { paymentSchema } from '../_lib/schemas.js';
import { assertSameOrigin, requireAuth } from '../_lib/guards.js';
import { createPayment } from '../_lib/payments.js';
import { createStudent, findStudentById, listStudents } from '../_lib/students.js';
import { audit } from '../_lib/audit.js';
import { monthsOf } from '../../shared/academic-year.js';
import { badRequest } from '../_lib/errors.js';

/**
 * POST /api/payments/create
 *
 * Open to operators as well as admins: recording a payment is the one write
 * everyone needs. Changing one afterwards is admin-only, which is handled
 * elsewhere.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const user = await requireAuth(req);
  const input = parse(paymentSchema, await readBody(req));

  // Every month on a receipt has to belong to the academic year it is filed
  // under, or it would be invisible in that year's class-wise view.
  const valid = new Set(monthsOf(input.academic_year));
  const stray = input.months.map((entry) => entry.month).filter((month) => !valid.has(month));
  if (stray.length > 0) {
    throw badRequest(`${stray.join(', ')} ${stray.length === 1 ? 'is' : 'are'} not part of ${input.academic_year}.`, {
      months: `Choose months between April ${input.academic_year.slice(0, 4)} and March.`,
    });
  }

  // Keep the roster complete: a payment for someone not on it adds them,
  // rather than being refused at the counter.
  let student = input.student_id ? await findStudentById(input.student_id) : null;
  let studentAdded = false;

  if (!student) {
    const roster = await listStudents({
      academic_year: input.academic_year,
      className: input.class,
      activeOnly: false,
    });
    const nameKey = input.student_name.toLowerCase();
    student = roster.find((candidate) => candidate.student_name.toLowerCase() === nameKey) ?? null;

    if (!student) {
      student = await createStudent(
        {
          academic_year: input.academic_year,
          class: input.class,
          student_name: input.student_name,
          parent_name: input.parent_name,
          notes: 'Added automatically when a fee was recorded.',
        },
        user.username
      );
      studentAdded = true;
    }
  }

  const result = await createPayment({ ...input, student_id: student.student_id }, user);

  await audit({
    user: user.username,
    action: 'payment.create',
    entity_id: result.receipt_no,
    after: {
      student: input.student_name,
      class: input.class,
      months: input.months,
      amount: result.total,
      mode: input.payment_mode,
      ...(result.duplicate_of.length > 0 ? { overrode_duplicate: result.duplicate_of } : {}),
    },
    ip: clientIp(req),
  });

  return ok(res, {
    receipt_no: result.receipt_no,
    student_id: student.student_id,
    student_added: studentAdded,
    months: result.rows.map((row) => ({ month: row.month, amount: row.amount })),
    total: result.total,
  });
});
