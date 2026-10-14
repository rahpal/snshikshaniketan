import { clientIp, handler, ok, parse, readBody } from '../_lib/http.js';
import { createStudentSchema } from '../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../_lib/guards.js';
import { createStudent } from '../_lib/students.js';
import { audit } from '../_lib/audit.js';

/**
 * POST /api/students/create
 *
 * Admin only. Operators do not manage the roster, but a payment they record for
 * an unknown student still adds that student - see payments/create.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const user = await requireAdmin(req);
  const input = parse(createStudentSchema, await readBody(req));

  const student = await createStudent(input, user.username);

  await audit({
    user: user.username,
    action: 'student.create',
    entity_id: student.student_id,
    after: { student_name: student.student_name, class: student.class },
    ip: clientIp(req),
  });

  return ok(res, { student });
});
