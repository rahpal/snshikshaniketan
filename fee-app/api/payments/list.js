import { handler, ok, parse } from '../_lib/http.js';
import { listQuerySchema } from '../_lib/schemas.js';
import { requireAuth } from '../_lib/guards.js';
import { findReceipt, listPayments } from '../_lib/payments.js';

/**
 * GET /api/payments/list?academic_year=2026-27&class=5&student_id=...
 * GET /api/payments/list?receipt_no=SNS-2627-ABC123
 *
 * Viewing is allowed for both roles.
 */
export default handler('GET', async (req, res) => {
  await requireAuth(req);
  const url = new URL(req.url, 'http://localhost');

  const receiptNo = url.searchParams.get('receipt_no');
  if (receiptNo) {
    const receipt = await findReceipt(receiptNo);
    return ok(res, { receipt });
  }

  const query = parse(listQuerySchema, {
    academic_year: url.searchParams.get('academic_year') ?? undefined,
    class: url.searchParams.get('class') ?? undefined,
    student_id: url.searchParams.get('student_id') ?? undefined,
  });

  const payments = await listPayments({
    academic_year: query.academic_year,
    className: query.class,
    student_id: query.student_id,
    includeVoided: url.searchParams.get('include_voided') === 'true',
  });

  return ok(res, { payments });
});
