import { clientIp, handler, ok, parse, readBody } from '../../_lib/http.js';
import { setFeeSchema } from '../../_lib/schemas.js';
import { assertSameOrigin, requireAdmin } from '../../_lib/guards.js';
import { setFee } from '../../_lib/fees.js';
import { audit } from '../../_lib/audit.js';

/** POST /api/admin/fees/set */
export default handler('POST', async (req, res) => {
  assertSameOrigin(req);
  const actor = await requireAdmin(req);
  const input = parse(setFeeSchema, await readBody(req));

  const fee = await setFee(input, actor.username);

  await audit({
    user: actor.username,
    action: 'fee.set',
    entity_id: `${input.academic_year}/${input.class}`,
    before: fee.previous === null ? null : { monthly_fee: fee.previous },
    after: { monthly_fee: fee.monthly_fee },
    ip: clientIp(req),
  });

  return ok(res, { fee });
});
