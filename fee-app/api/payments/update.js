import { clientIp, handler, ok, parse, readBody } from '../_lib/http.js';
import { updatePaymentSchema } from '../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../_lib/guards.js';
import { updateReceiptDetails } from '../_lib/payments.js';
import { findReceipt } from '../_lib/payments.js';
import { paymentDateProblem } from '../../shared/academic-year.js';
import { badRequest } from '../_lib/errors.js';
import { audit } from '../_lib/audit.js';

/**
 * POST /api/payments/update
 *
 * Corrects the details around a payment: the date it was handed over, how it
 * was paid, and the remarks. The amounts and the months are not changeable -
 * those are what the money was, and putting them right means voiding the
 * receipt and recording it again, so both halves stay visible.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const actor = await requireAdmin(req);
  const patch = parse(updatePaymentSchema, await readBody(req));

  if (patch.payment_date !== undefined) {
    const receipt = await findReceipt(patch.receipt_no, { fresh: true });
    if (!receipt) throw badRequest(`No receipt numbered ${patch.receipt_no}.`);
    // The same rules as recording one: never in the future, never before the
    // academic year it is filed under.
    const problem = paymentDateProblem(patch.payment_date, receipt.academic_year);
    if (problem) throw badRequest(problem, { payment_date: problem });
  }

  const { before, after } = await updateReceiptDetails(patch.receipt_no, patch);

  await audit({
    user: actor.username,
    action: 'payment.update',
    entity_id: patch.receipt_no,
    before,
    after,
    ip: clientIp(req),
  });

  return ok(res, { receipt_no: patch.receipt_no, ...after });
});
