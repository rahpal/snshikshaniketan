import { handler, ok } from './_lib/http.js';
import { verifySchema } from './_lib/table.js';
import { requireAdmin } from './_lib/guards.js';

/**
 * GET /api/health
 *
 * Confirms the function can reach the spreadsheet. Anyone may ask whether it is
 * reachable; only an admin is told what is wrong with it, since the detail
 * names tabs and columns.
 */
export default handler('GET', async (req, res) => {
  let isAdmin = false;
  try {
    await requireAdmin(req);
    isAdmin = true;
  } catch {
    isAdmin = false;
  }

  let problems;
  try {
    problems = await verifySchema();
  } catch (error) {
    if (!isAdmin) return ok(res, { ok: false, sheet: 'unreachable' });
    return ok(res, { ok: false, sheet: 'unreachable', detail: error.message });
  }

  const healthy = problems.length === 0;
  if (!isAdmin) return ok(res, { ok: healthy, sheet: healthy ? 'ready' : 'misconfigured' });
  return ok(res, { ok: healthy, sheet: healthy ? 'ready' : 'misconfigured', problems });
});
