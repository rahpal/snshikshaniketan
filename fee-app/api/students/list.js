import { handler, ok, parse } from '../_lib/http.js';
import { listQuerySchema } from '../_lib/schemas.js';
import { requireAuth } from '../_lib/guards.js';
import { listStudents } from '../_lib/students.js';

/** GET /api/students/list?academic_year=2026-27&class=5 */
export default handler('GET', async (req, res) => {
  await requireAuth(req);
  const url = new URL(req.url, 'http://localhost');

  const query = parse(listQuerySchema, {
    academic_year: url.searchParams.get('academic_year') ?? undefined,
    class: url.searchParams.get('class') ?? undefined,
  });

  const students = await listStudents({
    academic_year: query.academic_year,
    className: query.class,
    activeOnly: url.searchParams.get('include_inactive') !== 'true',
  });

  return ok(res, { students });
});
