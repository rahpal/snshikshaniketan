/**
 * An in-memory stand-in for the Google Sheets REST API.
 *
 * It replaces globalThis.fetch, so the code under test goes through its real
 * request building, range construction and response parsing - the parts most
 * likely to be wrong - without touching a real spreadsheet or the network.
 *
 * The token endpoint is faked too, which is why a throwaway RSA key is
 * generated: the client signs a real RS256 assertion before asking for a token,
 * so the key has to be a usable one.
 */

import { generateKeyPairSync } from 'node:crypto';
import { HEADERS } from '../../api/_lib/sheet-schema.js';

const SHEET_ID = 'fake-sheet-id';

function generateServiceAccountKey() {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  // Env vars hold the key with escaped newlines, exactly as Vercel stores it.
  return privateKey.replace(/\n/g, '\\n');
}

export function installEnv() {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'fee-app-test@example.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = generateServiceAccountKey();
  process.env.FEES_SHEET_ID = SHEET_ID;
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
  // Caching would hide writes between steps of a test.
  process.env.SHEET_CACHE_TTL_SECONDS = '0';
}

function columnToIndex(letters) {
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

/** Parses "Tab", "Tab!1:1", "Tab!A1", "Tab!A2:T2" the way the Sheets API does. */
function parseRange(range) {
  const bang = range.indexOf('!');
  if (bang === -1) return { tab: range, whole: true };

  const tab = range.slice(0, bang).replace(/^'|'$/g, '');
  const ref = range.slice(bang + 1);

  let match = ref.match(/^(\d+):(\d+)$/);
  if (match) {
    return { tab, startRow: Number(match[1]) - 1, endRow: Number(match[2]) - 1, startCol: 0, endCol: null };
  }

  match = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (match) {
    return {
      tab,
      startRow: Number(match[2]) - 1,
      endRow: Number(match[4]) - 1,
      startCol: columnToIndex(match[1]),
      endCol: columnToIndex(match[3]),
    };
  }

  match = ref.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const row = Number(match[2]) - 1;
    const col = columnToIndex(match[1]);
    return { tab, startRow: row, endRow: row, startCol: col, endCol: col };
  }

  throw new Error(`fake-sheets cannot parse range: ${range}`);
}

export class FakeSpreadsheet {
  constructor({ seedHeaders = true } = {}) {
    this.title = 'SNS Fee Register (test)';
    /** tab name -> array of rows, each an array of cell values */
    this.tabs = new Map();
    this.nextSheetId = 100;
    this.sheetIds = new Map();
    this.batchUpdates = [];

    if (seedHeaders) {
      for (const [tab, headers] of Object.entries(HEADERS)) this.addTab(tab, [headers]);
    }
  }

  addTab(name, rows = []) {
    this.tabs.set(name, rows.map((row) => [...row]));
    this.sheetIds.set(name, this.nextSheetId);
    this.nextSheetId += 1;
  }

  rows(tab) {
    if (!this.tabs.has(tab)) throw new Error(`fake-sheets: no such tab "${tab}"`);
    return this.tabs.get(tab);
  }

  /** Rows of a tab as objects keyed by its header row - for assertions. */
  objects(tab) {
    const rows = this.rows(tab);
    const headers = rows[0] ?? [];
    return rows.slice(1).map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row[index] ?? '';
      });
      return object;
    });
  }

  // ---- request handling ---------------------------------------------------

  meta() {
    return {
      spreadsheetId: SHEET_ID,
      properties: { title: this.title },
      sheets: [...this.tabs.keys()].map((title) => ({
        properties: { title, sheetId: this.sheetIds.get(title) },
        protectedRanges: [],
      })),
    };
  }

  getValues(range) {
    const parsed = parseRange(range);
    if (!this.tabs.has(parsed.tab)) {
      const error = new Error(`Unable to parse range: ${range}`);
      error.status = 400;
      throw error;
    }
    const all = this.rows(parsed.tab);

    const slice = parsed.whole
      ? all
      : all.slice(parsed.startRow, parsed.endRow + 1).map((row) => {
          const from = parsed.startCol;
          const to = parsed.endCol === null ? row.length : parsed.endCol + 1;
          return row.slice(from, to);
        });

    // Sheets omits trailing empty cells and trailing empty rows.
    const trimmed = slice
      .map((row) => {
        const copy = [...row];
        while (copy.length > 0 && (copy.at(-1) === '' || copy.at(-1) === undefined)) copy.pop();
        return copy;
      })
      .filter((row, index, rows) => row.length > 0 || index < rows.length - 1);

    return { range, majorDimension: 'ROWS', values: trimmed };
  }

  append(range, values) {
    const parsed = parseRange(range);
    const rows = this.rows(parsed.tab);
    for (const row of values) rows.push([...row]);
    return { spreadsheetId: SHEET_ID, updates: { updatedRows: values.length } };
  }

  update(range, values) {
    const parsed = parseRange(range);
    const rows = this.rows(parsed.tab);
    values.forEach((value, offset) => {
      const rowIndex = parsed.startRow + offset;
      while (rows.length <= rowIndex) rows.push([]);
      const row = rows[rowIndex];
      value.forEach((cell, cellOffset) => {
        row[parsed.startCol + cellOffset] = cell;
      });
    });
    return { spreadsheetId: SHEET_ID, updatedRows: values.length };
  }

  batchUpdate(body) {
    this.batchUpdates.push(body);
    for (const request of body.requests ?? []) {
      if (request.addSheet) this.addTab(request.addSheet.properties.title, []);
    }
    return { spreadsheetId: SHEET_ID, replies: (body.requests ?? []).map(() => ({})) };
  }
}

/**
 * Points global fetch at the fake. Returns a restore function; call it in a
 * test teardown so one test cannot leak its stub into the next.
 */
export function installFetch(spreadsheet) {
  const original = globalThis.fetch;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init.method ?? 'GET').toUpperCase();
    // The token request is form-encoded; everything else is JSON.
    const isJson = typeof init.body === 'string';
    const body = isJson ? JSON.parse(init.body) : null;

    const reply = (status, payload) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return reply(200, { access_token: 'fake-access-token', expires_in: 3600, token_type: 'Bearer' });
      }

      if (!url.startsWith(base)) {
        throw new Error(`fake-sheets: unexpected request to ${url}`);
      }

      const path = url.slice(base.length);

      if (method === 'GET' && (path === '' || path.startsWith('?'))) {
        return reply(200, spreadsheet.meta());
      }
      if (method === 'POST' && path.startsWith(':batchUpdate')) {
        return reply(200, spreadsheet.batchUpdate(body));
      }

      const valuesMatch = path.match(/^\/values\/([^?:]+)(:append)?/);
      if (valuesMatch) {
        const range = decodeURIComponent(valuesMatch[1]);
        if (method === 'GET') return reply(200, spreadsheet.getValues(range));
        if (method === 'POST') return reply(200, spreadsheet.append(range, body.values));
        if (method === 'PUT') return reply(200, spreadsheet.update(range, body.values));
      }

      throw new Error(`fake-sheets: unhandled ${method} ${path}`);
    } catch (error) {
      return reply(error.status ?? 500, { error: { message: error.message } });
    }
  };

  return () => {
    globalThis.fetch = original;
  };
}
