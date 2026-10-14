import { getEnv } from './env.js';
import { appendValues, getValues, updateValues } from './google.js';
import { HEADERS } from './sheet-schema.js';

/**
 * A thin table layer over a spreadsheet tab.
 *
 * Rows are addressed by header NAME, never by column position, so someone
 * inserting a column in the sheet cannot silently shift every field by one.
 * Every value is written as text or a number (never a Sheets date serial), so
 * what the app reads back is exactly what it wrote.
 */

const cache = new Map(); // tab -> { at, headers, rows }

export function invalidate(tab) {
  if (tab) cache.delete(tab);
  else cache.clear();
}

export function columnLetter(indexZeroBased) {
  let n = indexZeroBased + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * Reads an entire tab into objects. `_row` on each object is its 1-based
 * spreadsheet row number, which is what updates are addressed by.
 */
export async function readTable(tab, { fresh = false } = {}) {
  const ttl = getEnv().cacheTtlMs;
  const hit = cache.get(tab);
  if (!fresh && hit && ttl > 0 && Date.now() - hit.at < ttl) return hit;

  const values = await getValues(tab);
  if (values.length === 0) {
    // An empty tab means the sheet was never bootstrapped, or someone cleared it.
    throw new Error(`Sheet tab "${tab}" is empty - it has no header row. Run: npm run bootstrap-sheet`);
  }

  const headers = values[0].map((header) => String(header).trim());
  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const raw = values[i];
    // Trailing empty cells are omitted by the API, so a short array is normal.
    if (raw.every((cell) => cell === '' || cell === null || cell === undefined)) continue;

    const row = { _row: i + 1 };
    headers.forEach((header, index) => {
      row[header] = raw[index] ?? '';
    });
    rows.push(row);
  }

  const entry = { at: Date.now(), headers, rows };
  cache.set(tab, entry);
  return entry;
}

export async function findRow(tab, predicate) {
  const { rows } = await readTable(tab);
  return rows.find(predicate) ?? null;
}

export async function findRows(tab, predicate) {
  const { rows } = await readTable(tab);
  return rows.filter(predicate);
}

function toRowArray(headers, object) {
  return headers.map((header) => {
    const value = object[header];
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return value;
  });
}

/** Appends one or more objects, filling only the columns the tab declares. */
export async function appendObjects(tab, objects) {
  const list = Array.isArray(objects) ? objects : [objects];
  if (list.length === 0) return;

  const { headers } = await readTable(tab);
  const unknown = new Set();
  for (const object of list) {
    for (const key of Object.keys(object)) {
      if (key !== '_row' && !headers.includes(key)) unknown.add(key);
    }
  }
  if (unknown.size > 0) {
    throw new Error(`Tab "${tab}" has no column(s) named: ${[...unknown].join(', ')}`);
  }

  await appendValues(`${tab}!A1`, list.map((object) => toRowArray(headers, object)));
  invalidate(tab);
}

/**
 * Patches named fields on one row, leaving every other column as it is.
 * Writes the whole row back, so a concurrent edit to a different column of the
 * same row within the same second could be lost - acceptable here because rows
 * are owned by one student/receipt and are not edited concurrently in practice.
 */
export async function updateRow(tab, rowNumber, patch) {
  const { headers, rows } = await readTable(tab, { fresh: true });
  const existing = rows.find((row) => row._row === rowNumber);
  if (!existing) throw new Error(`Tab "${tab}" has no row ${rowNumber} to update.`);

  const merged = { ...existing, ...patch };
  const lastColumn = columnLetter(headers.length - 1);
  await updateValues(`${tab}!A${rowNumber}:${lastColumn}${rowNumber}`, [toRowArray(headers, merged)]);
  invalidate(tab);
  return merged;
}

/** Confirms every declared tab exists with the headers the app expects. */
export async function verifySchema() {
  const problems = [];
  for (const [tab, expected] of Object.entries(HEADERS)) {
    try {
      const { headers } = await readTable(tab, { fresh: true });
      const missing = expected.filter((header) => !headers.includes(header));
      if (missing.length > 0) problems.push(`${tab}: missing column(s) ${missing.join(', ')}`);
    } catch (error) {
      problems.push(`${tab}: ${error.message}`);
    }
  }
  return problems;
}

// ---- value coercion -------------------------------------------------------
// Sheets hands back '', 'TRUE', true, 0 or '0' depending on how a cell was
// written, so every read of a typed field goes through one of these.

export function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === '' || value === null || value === undefined) return fallback;
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === 'yes' || text === '1';
}

export function asNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
