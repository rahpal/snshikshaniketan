import { clientIp, handler, ok, parse, readBody } from '../_lib/http.js';
import { voidPaymentSchema } from '../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../_lib/guards.js';
import { voidReceipt } from '../_lib/payments.js';
import { audit } from '../_lib/audit.js';

/**
 * POST /api/payments/void
 *
 * Admin only. This is the operator/admin line the school asked for: anyone may
 * record a payment, but only an administrator may undo one.
 */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const actor = await requireAdmin(req);
  const { receipt_no: receiptNo, reason } = parse(voidPaymentSchema, await readBody(req));

  const voided = await voidReceipt(receiptNo, { reason, by: actor.username });

  await audit({
    user: actor.username,
    action: 'payment.void',
    entity_id: receiptNo,
    before: { months: voided.months, total: voided.total },
    after: { reason },
    ip: clientIp(req),
  });

  return ok(res, { receipt_no: receiptNo, months: voided.months, total: voided.total });
});
