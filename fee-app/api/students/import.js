import { clientIp, handler, ok, parse, readBody } from '../_lib/http.js';
import { importStudentsSchema } from '../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../_lib/guards.js';
import { importStudents } from '../_lib/students.js';
import { audit } from '../_lib/audit.js';

/**
 * POST /api/students/import
 *
 * Loads a whole class list at once. Re-importing the same file adds nothing,
 * so a half-finished import can simply be run again.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const user = await requireAdmin(req);
  const input = parse(importStudentsSchema, await readBody(req));

  const { created, skipped } = await importStudents(input.students, {
    academic_year: input.academic_year,
    createdBy: user.username,
  });

  await audit({
    user: user.username,
    action: 'student.import',
    entity_id: input.academic_year,
    after: { created: created.length, skipped: skipped.length },
    ip: clientIp(req),
  });

  return ok(res, {
    created: created.length,
    skipped,
    students: created.map((student) => ({
      student_id: student.student_id,
      student_name: student.student_name,
      class: student.class,
    })),
  });
});
