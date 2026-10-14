#!/usr/bin/env node
/**
 * Prepares the fee spreadsheet and creates the first administrator.
 *
 * Run it with the env file so it picks up the same credentials the deployed
 * functions use:
 *
 *   npm run bootstrap-sheet -- --admin-username rahul --admin-name "Rahul Pal"
 *   npm run bootstrap-sheet -- --check
 *
 * Safe to run more than once: existing tabs, headers and users are left alone.
 */

import { getEnv } from '../api/_lib/env.js';
import { batchUpdate, getSpreadsheet, getValues, updateValues } from '../api/_lib/google.js';
import { HEADERS, ROLES, TABS } from '../api/_lib/sheet-schema.js';
import { columnLetter, verifySchema } from '../api/_lib/table.js';
import { createUser, listUsers } from '../api/_lib/users.js';
import { generateTempPassword } from '../api/_lib/password.js';
import { academicYearOf } from '../api/_lib/academic-year.js';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const log = (...parts) => console.log(...parts);
const step = (message) => log(`\n== ${message}`);

export async function ensureTabs() {
  step('Checking tabs');
  const meta = await getSpreadsheet();
  log(`   Spreadsheet: ${meta.properties?.title ?? '(untitled)'}`);

  const existing = new Map(
    (meta.sheets ?? []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId])
  );

  const wanted = Object.values(TABS);
  const missing = wanted.filter((tab) => !existing.has(tab));

  if (missing.length === 0) {
    log(`   All ${wanted.length} tabs already present.`);
  } else {
    log(`   Creating: ${missing.join(', ')}`);
    await batchUpdate(
      missing.map((title) => ({
        addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
      }))
    );
  }

  // Re-read so newly created tabs have their numeric ids.
  const after = await getSpreadsheet();
  return new Map((after.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId]));
}

export async function ensureHeaders() {
  step('Checking header rows');
  for (const [tab, headers] of Object.entries(HEADERS)) {
    const current = await getValues(`${tab}!1:1`);
    const row = current[0] ?? [];
    const present = row.map((cell) => String(cell).trim()).filter(Boolean);

    if (present.length === 0) {
      await updateValues(`${tab}!A1:${columnLetter(headers.length - 1)}1`, [headers]);
      log(`   ${tab}: wrote ${headers.length} headers.`);
      continue;
    }

    const missing = headers.filter((header) => !present.includes(header));
    if (missing.length === 0) {
      log(`   ${tab}: headers OK.`);
      continue;
    }

    // Append the new columns after whatever is already there, so existing data
    // keeps lining up with its own columns.
    const startIndex = present.length;
    await updateValues(
      `${tab}!${columnLetter(startIndex)}1:${columnLetter(startIndex + missing.length - 1)}1`,
      [missing]
    );
    log(`   ${tab}: added missing column(s) ${missing.join(', ')}.`);
  }
}

export async function ensureFormatting(sheetIds) {
  step('Formatting and protecting tabs');
  const meta = await getSpreadsheet('sheets.properties,sheets.protectedRanges');
  const protectedBySheet = new Map(
    (meta.sheets ?? []).map((sheet) => [
      sheet.properties.sheetId,
      (sheet.protectedRanges ?? []).map((range) => range.description ?? ''),
    ])
  );

  const requests = [];
  for (const tab of Object.values(TABS)) {
    const sheetId = sheetIds.get(tab);
    if (sheetId === undefined) continue;

    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.93, green: 0.95, blue: 0.99 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    });

    // warningOnly protection: a person editing by hand gets "are you sure?",
    // while the service account keeps writing without being listed as an editor.
    const description = `Managed by the fee app - edit via the app, not by hand (${tab})`;
    const already = protectedBySheet.get(sheetId) ?? [];
    if (!already.includes(description)) {
      requests.push({
        addProtectedRange: {
          protectedRange: { range: { sheetId }, description, warningOnly: true },
        },
      });
    }
  }

  if (requests.length > 0) await batchUpdate(requests);
  log(`   Applied ${requests.length} formatting/protection change(s).`);
}

export async function ensureAdmin({ username, fullName }) {
  step('Checking for an administrator');
  const users = await listUsers({ fresh: true });
  const admins = users.filter((user) => user.role === ROLES.ADMIN && user.active);

  if (admins.length > 0) {
    log(`   ${admins.length} active admin(s) already exist: ${admins.map((a) => a.username).join(', ')}`);
    log('   Skipping admin creation. Use the app\'s Users screen to add more.');
    return null;
  }

  if (!username || !fullName) {
    log('   No admin exists yet and none was requested.');
    log('   Re-run with:  npm run bootstrap-sheet -- --admin-username <name> --admin-name "Full Name"');
    return null;
  }

  const password = generateTempPassword();
  const user = await createUser({
    username,
    full_name: fullName,
    role: ROLES.ADMIN,
    password,
    created_by: 'bootstrap-script',
  });

  log(`   Created admin "${user.username}".`);
  return { username: user.username, password };
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));

  log('S.N.S. Shiksha Niketan - fee spreadsheet bootstrap');
  const env = getEnv();
  log(`   Sheet id:        ${env.sheetId}`);
  log(`   Service account: ${env.serviceAccountEmail}`);
  log(`   Academic year:   ${academicYearOf()}`);

  if (args.check) {
    step('Verifying schema only (--check)');
    const problems = await verifySchema();
    if (problems.length === 0) {
      log('   Schema OK. Every tab and column the app needs is present.');
      return;
    }
    log('   Problems found:');
    for (const problem of problems) log(`     - ${problem}`);
    process.exitCode = 1;
    return;
  }

  const sheetIds = await ensureTabs();
  await ensureHeaders();
  await ensureFormatting(sheetIds);

  step('Verifying schema');
  const problems = await verifySchema();
  if (problems.length > 0) {
    log('   Problems remain:');
    for (const problem of problems) log(`     - ${problem}`);
    process.exitCode = 1;
    return;
  }
  log('   Schema OK.');

  const created = await ensureAdmin({
    username: typeof args['admin-username'] === 'string' ? args['admin-username'] : null,
    fullName: typeof args['admin-name'] === 'string' ? args['admin-name'] : null,
  });

  log('\nDone.');
  if (created) {
    log('\n--------------------------------------------------------------');
    log('  FIRST ADMIN - hand these over in person, then delete them.');
    log(`  Username:           ${created.username}`);
    log(`  Temporary password: ${created.password}`);
    log('  They will be required to set a new password at first sign-in.');
    log('  This password is not stored anywhere and cannot be shown again.');
    log('--------------------------------------------------------------');
  }
}

// Only run when invoked as a command, so tests can import the steps above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\nFailed: ${error.message}`);
    if (process.env.DEBUG) console.error(error);
    process.exitCode = 1;
  });
}
