import { batchUpdate, clearValues, getSpreadsheet, getValues, updateValues } from './google.js';
import { HEADERS, TABS } from './sheet-schema.js';
import { columnLetter } from './table.js';

/**
 * Copies the whole register into a second spreadsheet that the school also
 * owns.
 *
 * One backup file, overwritten each run, rather than a growing pile of dated
 * copies: Google keeps its own version history for that file, so the time
 * machine is already there and does not need reinventing. What this adds is
 * what version history cannot - a copy that survives the live file being
 * deleted, cleared, or shared with the wrong person.
 */

const SNAPSHOT_TAB = 'Snapshot';

async function ensureTabs(spreadsheetId, titles) {
  const meta = await getSpreadsheet('sheets.properties.title', { spreadsheetId });
  const existing = new Set((meta.sheets ?? []).map((sheet) => sheet.properties.title));
  const missing = titles.filter((title) => !existing.has(title));
  if (missing.length > 0) {
    await batchUpdate(
      missing.map((title) => ({ addSheet: { properties: { title } } })),
      { spreadsheetId }
    );
  }
}

export async function runBackup({ backupSheetId, now = new Date() } = {}) {
  if (!backupSheetId) return { ok: true, skipped: 'not_configured' };

  const tabs = Object.values(TABS);
  await ensureTabs(backupSheetId, [...tabs, SNAPSHOT_TAB]);

  const copied = [];
  for (const tab of tabs) {
    const values = await getValues(tab);
    // Cleared first, or a shorter table would leave the tail of the last copy
    // behind and the backup would read as more data than exists.
    await clearValues(tab, { spreadsheetId: backupSheetId });
    if (values.length > 0) {
      const width = Math.max(...values.map((row) => row.length), HEADERS[tab]?.length ?? 1);
      await updateValues(
        `${tab}!A1:${columnLetter(width - 1)}${values.length}`,
        values,
        { spreadsheetId: backupSheetId }
      );
    }
    copied.push({ tab, rows: Math.max(values.length - 1, 0) });
  }

  const at = now.toISOString();
  await clearValues(SNAPSHOT_TAB, { spreadsheetId: backupSheetId });
  await updateValues(
    `${SNAPSHOT_TAB}!A1:B${copied.length + 2}`,
    [
      ['Backed up at', at],
      ['Tab', 'Rows'],
      ...copied.map((entry) => [entry.tab, entry.rows]),
    ],
    { spreadsheetId: backupSheetId }
  );

  return { ok: true, at, tabs: copied };
}
