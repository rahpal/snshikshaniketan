import { handler, ok, parse } from '../_lib/http.js';
import { listQuerySchema } from '../_lib/schemas.js';
import { requireAuth } from '../_lib/guards.js';
import { listFees } from '../_lib/fees.js';
import { academicYearOf } from '../../shared/academic-year.js';

/**
 * GET /api/fees/list?academic_year=2026-27
 *
 * Readable by anyone signed in: the entry form uses it to pre-fill the amount.
 */
export default handler('GET', async (req, res) => {
  await requireAuth(req);
  const url = new URL(req.url, 'http://localhost');
  const query = parse(listQuerySchema, {
    academic_year: url.searchParams.get('academic_year') ?? undefined,
  });

  const fees = await listFees({ academic_year: query.academic_year ?? academicYearOf() });
  return ok(res, { fees });
});
