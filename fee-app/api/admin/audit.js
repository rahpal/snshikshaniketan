import { handler, ok } from '../_lib/http.js';
import { requireAdmin } from '../_lib/guards.js';
import { readTable, asText } from '../_lib/table.js';
import { TABS } from '../_lib/sheet-schema.js';

const MAX_ENTRIES = 500;

/**
 * GET /api/admin/audit?limit=200
 *
 * Newest first. Capped rather than paged: the log is for answering "who
 * changed this, and when", and a spreadsheet is the place to go for the full
 * history.
 */
export default handler('GET', async (req, res) => {
  await requireAdmin(req);
  const url = new URL(req.url, 'http://localhost');

  const requested = Number.parseInt(url.searchParams.get('limit') ?? '200', 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_ENTRIES) : 200;

  const { rows } = await readTable(TABS.AUDIT_LOG, { fresh: true });
  const entries = rows
    .map((row) => ({
      timestamp: asText(row.timestamp),
      user: asText(row.user),
      action: asText(row.action),
      entity_id: asText(row.entity_id),
      before: asText(row.before),
      after: asText(row.after),
      ip: asText(row.ip),
    }))
    .filter((entry) => entry.action)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);

  return ok(res, { entries, limit, truncated: rows.length > entries.length });
});
