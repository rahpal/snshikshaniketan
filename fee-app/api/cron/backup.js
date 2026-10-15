import { handler, ok } from '../_lib/http.js';
import { requireAdmin } from '../_lib/guards.js';
import { runBackup } from '../_lib/backup.js';
import { forbidden } from '../_lib/errors.js';

/**
 * GET /api/cron/backup
 *
 * Run weekly by Vercel's scheduler, and by an administrator on demand.
 *
 * Vercel sends the CRON_SECRET as a bearer token when one is configured; an
 * admin session is accepted too, so the backup can be taken by hand before
 * something risky. Anything else is refused: this reads the whole register.
 */
export default handler('GET', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const presented = String(req.headers.authorization ?? '');
  const fromScheduler = Boolean(secret) && presented === `Bearer ${secret}`;

  if (!fromScheduler) {
    try {
      await requireAdmin(req);
    } catch {
      // Says nothing about whether a secret is configured or what it is.
      throw forbidden('This endpoint is not available.', 'not_permitted');
    }
  }

  const result = await runBackup({ backupSheetId: process.env.BACKUP_SHEET_ID });
  if (result.skipped) {
    return ok(res, {
      ok: true,
      skipped: result.skipped,
      message: 'No backup spreadsheet is configured. Set BACKUP_SHEET_ID to turn this on.',
    });
  }
  return ok(res, result);
});
