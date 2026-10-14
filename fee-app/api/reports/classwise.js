import { handler, ok, parse } from '../_lib/http.js';
import { listQuerySchema } from '../_lib/schemas.js';
import { requireAuth } from '../_lib/guards.js';
import { listStudents } from '../_lib/students.js';
import { listPayments } from '../_lib/payments.js';
import { buildClassReport } from '../_lib/reports.js';
import { academicYearOf } from '../../shared/academic-year.js';

/**
 * GET /api/reports/classwise?academic_year=2026-27[&class=5]
 *
 * The class-wise, month-wise picture. Joined here rather than in the browser so
 * a phone receives a compact summary instead of every payment row of the year.
 *
 * Viewing is open to both roles - an operator needs to see who has paid in
 * order to answer a parent at the counter.
 */
export default handler('GET', async (req, res) => {
  await requireAuth(req);
  const url = new URL(req.url, 'http://localhost');

  const query = parse(listQuerySchema, {
    academic_year: url.searchParams.get('academic_year') ?? undefined,
    class: url.searchParams.get('class') ?? undefined,
  });
  const academicYear = query.academic_year ?? academicYearOf();

  const [allStudents, allPayments] = await Promise.all([
    listStudents({ academic_year: academicYear }),
    listPayments({ academic_year: academicYear }),
  ]);

  // How many students each class has, whichever class was asked for. The
  // spreadsheet read is of the whole tab either way, so this costs nothing and
  // saves the caller a second request just to find out where the students are.
  const classCounts = {};
  for (const student of allStudents) {
    classCounts[student.class] = (classCounts[student.class] ?? 0) + 1;
  }

  const wanted = query.class;
  const students = wanted ? allStudents.filter((student) => student.class === wanted) : allStudents;
  const payments = wanted ? allPayments.filter((payment) => payment.class === wanted) : allPayments;

  const report = buildClassReport({ students, payments, academicYear });
  return ok(res, { ...report, class: wanted ?? null, class_counts: classCounts });
});
