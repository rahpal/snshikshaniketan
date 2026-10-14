import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeSpreadsheet, installEnv, installFetch } from './helpers/fake-sheets.mjs';
import { invoke } from './helpers/invoke.mjs';

installEnv();

const { appendObjects, findRow, invalidate, readTable, updateRow, verifySchema } = await import(
  '../api/_lib/table.js'
);
const { resetAuthCache } = await import('../api/_lib/google.js');
const { HEADERS, TABS } = await import('../api/_lib/sheet-schema.js');

async function withSheet(sheet, run) {
  const restore = installFetch(sheet);
  invalidate();
  resetAuthCache();
  try {
    return await run(sheet);
  } finally {
    restore();
    invalidate();
  }
}

test('rows round-trip through the table layer', async () => {
  const sheet = new FakeSpreadsheet();
  await withSheet(sheet, async () => {
    await appendObjects(TABS.FEE_STRUCTURE, [
      { academic_year: '2026-27', class: 'V', monthly_fee: 800, effective_from: '2026-04-01', notes: '' },
      { academic_year: '2026-27', class: 'VI', monthly_fee: 850, effective_from: '2026-04-01', notes: 'revised' },
    ]);

    const { rows } = await readTable(TABS.FEE_STRUCTURE);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].class, 'V');
    assert.equal(rows[0].monthly_fee, 800);
    assert.equal(rows[1].notes, 'revised');
    // Row numbers are the spreadsheet's own, counting the header row.
    assert.equal(rows[0]._row, 2);
    assert.equal(rows[1]._row, 3);
  });
});

test('a patch changes only the named fields of one row', async () => {
  const sheet = new FakeSpreadsheet();
  await withSheet(sheet, async () => {
    await appendObjects(TABS.FEE_STRUCTURE, [
      { academic_year: '2026-27', class: 'V', monthly_fee: 800, effective_from: '2026-04-01', notes: 'keep me' },
      { academic_year: '2026-27', class: 'VI', monthly_fee: 850, effective_from: '2026-04-01', notes: 'untouched' },
    ]);

    await updateRow(TABS.FEE_STRUCTURE, 2, { monthly_fee: 900 });

    const rows = sheet.objects(TABS.FEE_STRUCTURE);
    assert.equal(Number(rows[0].monthly_fee), 900);
    assert.equal(rows[0].notes, 'keep me', 'other columns of the same row must survive');
    assert.equal(rows[0].class, 'V');
    assert.equal(Number(rows[1].monthly_fee), 850, 'other rows must not be touched');
    assert.equal(rows[1].notes, 'untouched');
  });
});

test('columns are addressed by name, so reordering them in the sheet is harmless', async () => {
  const sheet = new FakeSpreadsheet({ seedHeaders: false });
  // Someone has inserted a column and moved things around by hand.
  sheet.addTab(TABS.FEE_STRUCTURE, [
    ['notes', 'monthly_fee', 'who_knows', 'class', 'academic_year', 'effective_from'],
  ]);
  for (const [tab, headers] of Object.entries(HEADERS)) {
    if (tab !== TABS.FEE_STRUCTURE) sheet.addTab(tab, [headers]);
  }

  await withSheet(sheet, async () => {
    await appendObjects(TABS.FEE_STRUCTURE, {
      academic_year: '2026-27',
      class: 'VIII',
      monthly_fee: 950,
      effective_from: '2026-04-01',
      notes: 'after reshuffle',
    });

    const row = await findRow(TABS.FEE_STRUCTURE, (candidate) => candidate.class === 'VIII');
    assert.ok(row, 'the row should be found despite the column order');
    assert.equal(row.monthly_fee, 950);
    assert.equal(row.notes, 'after reshuffle');

    // Written into the sheet's own column order, not the app's.
    const raw = sheet.rows(TABS.FEE_STRUCTURE)[1];
    assert.equal(raw[0], 'after reshuffle');
    assert.equal(raw[1], 950);
    assert.equal(raw[3], 'VIII');

    // The unknown column is left alone rather than overwritten.
    assert.equal(raw[2] ?? '', '');

    await updateRow(TABS.FEE_STRUCTURE, 2, { monthly_fee: 1000 });
    assert.equal(sheet.rows(TABS.FEE_STRUCTURE)[1][1], 1000);
    assert.equal(sheet.rows(TABS.FEE_STRUCTURE)[1][0], 'after reshuffle');
  });
});

test('writing a field the tab has no column for is refused loudly', async () => {
  const sheet = new FakeSpreadsheet();
  await withSheet(sheet, async () => {
    await assert.rejects(
      () => appendObjects(TABS.FEE_STRUCTURE, { academic_year: '2026-27', made_up_field: 'x' }),
      /no column\(s\) named: made_up_field/
    );
  });
});

test('a tab with no header row gives an instruction, not a crash', async () => {
  const sheet = new FakeSpreadsheet({ seedHeaders: false });
  sheet.addTab(TABS.USERS, []);
  await withSheet(sheet, async () => {
    await assert.rejects(() => readTable(TABS.USERS), /bootstrap-sheet/);
  });
});

test('schema verification reports exactly what is missing', async () => {
  const sheet = new FakeSpreadsheet({ seedHeaders: false });
  // Users is missing a column, FeeStructure is missing entirely.
  sheet.addTab(TABS.USERS, [HEADERS[TABS.USERS].filter((h) => h !== 'locked_until')]);
  sheet.addTab(TABS.STUDENTS, [HEADERS[TABS.STUDENTS]]);
  sheet.addTab(TABS.PAYMENTS, [HEADERS[TABS.PAYMENTS]]);
  sheet.addTab(TABS.AUDIT_LOG, [HEADERS[TABS.AUDIT_LOG]]);

  await withSheet(sheet, async () => {
    const problems = await verifySchema();
    assert.equal(problems.length, 2);
    assert.ok(problems.some((p) => p.includes('Users') && p.includes('locked_until')));
    assert.ok(problems.some((p) => p.includes('FeeStructure')));
  });

  const healthy = new FakeSpreadsheet();
  await withSheet(healthy, async () => {
    assert.deepEqual(await verifySchema(), []);
  });
});

// ---- the setup path -------------------------------------------------------

test('bootstrap turns an empty spreadsheet into a working one with a usable admin', async () => {
  const sheet = new FakeSpreadsheet({ seedHeaders: false });
  // A brand new spreadsheet: one default tab, nothing else.
  sheet.addTab('Sheet1', []);

  const { ensureTabs, ensureHeaders, ensureFormatting, ensureAdmin } = await import(
    '../scripts/bootstrap-sheet.mjs'
  );
  const { default: loginHandler } = await import('../api/auth/login.js');

  await withSheet(sheet, async () => {
    const sheetIds = await ensureTabs();
    await ensureHeaders();
    await ensureFormatting(sheetIds);

    for (const [tab, headers] of Object.entries(HEADERS)) {
      assert.ok(sheet.tabs.has(tab), `${tab} should have been created`);
      assert.deepEqual(sheet.rows(tab)[0], headers, `${tab} should have its headers`);
    }
    assert.deepEqual(await verifySchema(), []);

    // Header rows are frozen and every tab is protected against hand edits.
    const requests = sheet.batchUpdates.flatMap((update) => update.requests ?? []);
    const frozen = requests.filter((r) => r.updateSheetProperties);
    const protections = requests.filter((r) => r.addProtectedRange);
    assert.equal(frozen.length, 5);
    assert.equal(protections.length, 5);
    assert.ok(protections.every((r) => r.addProtectedRange.protectedRange.warningOnly === true));

    const created = await ensureAdmin({ username: 'rahul', fullName: 'Rahul Pal' });
    assert.ok(created, 'an admin should have been created');
    assert.equal(created.username, 'rahul');

    // The printed temporary password must actually work.
    const login = await invoke(loginHandler, {
      method: 'POST',
      body: { username: 'rahul', password: created.password },
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.user.role, 'admin');
    assert.equal(login.json.must_change_password, true);

    // Running it again must not create a second admin or duplicate headers.
    const secondRun = await ensureTabs();
    await ensureHeaders();
    await ensureFormatting(secondRun);
    assert.equal(await ensureAdmin({ username: 'someone', fullName: 'Some One' }), null);
    assert.equal(sheet.objects(TABS.USERS).length, 1);
    assert.deepEqual(sheet.rows(TABS.USERS)[0], HEADERS[TABS.USERS]);
  });
});

test('bootstrap adds a column that a later version introduced, without disturbing data', async () => {
  const sheet = new FakeSpreadsheet({ seedHeaders: false });
  // An older sheet, created before password_changed_at existed.
  const oldHeaders = HEADERS[TABS.USERS].filter((header) => header !== 'password_changed_at');
  sheet.addTab(TABS.USERS, [oldHeaders, oldHeaders.map((header) => (header === 'username' ? 'existing' : 'x'))]);
  for (const [tab, headers] of Object.entries(HEADERS)) {
    if (tab !== TABS.USERS) sheet.addTab(tab, [headers]);
  }

  const { ensureHeaders } = await import('../scripts/bootstrap-sheet.mjs');
  await withSheet(sheet, async () => {
    await ensureHeaders();

    const headerRow = sheet.rows(TABS.USERS)[0];
    assert.ok(headerRow.includes('password_changed_at'));
    assert.equal(headerRow.at(-1), 'password_changed_at', 'the new column goes on the end');
    // The existing row still lines up with its own values.
    const [row] = sheet.objects(TABS.USERS);
    assert.equal(row.username, 'existing');
    assert.deepEqual(await verifySchema(), []);
  });
});

test('several rows are patched in one request, leaving the rest alone', async () => {
  const sheet = new FakeSpreadsheet();
  const { updateRows } = await import('../api/_lib/table.js');

  await withSheet(sheet, async () => {
    await appendObjects(TABS.FEE_STRUCTURE, [
      { academic_year: '2026-27', class: '5', monthly_fee: 800, effective_from: '2026-04-01', notes: 'keep' },
      { academic_year: '2026-27', class: '6', monthly_fee: 850, effective_from: '2026-04-01', notes: 'keep too' },
      { academic_year: '2026-27', class: '7', monthly_fee: 900, effective_from: '2026-04-01', notes: 'untouched' },
    ]);

    const merged = await updateRows(TABS.FEE_STRUCTURE, [
      { rowNumber: 2, patch: { monthly_fee: 1000 } },
      { rowNumber: 3, patch: { monthly_fee: 1100 } },
    ]);

    assert.equal(merged.length, 2);
    const rows = sheet.objects(TABS.FEE_STRUCTURE);
    assert.equal(Number(rows[0].monthly_fee), 1000);
    assert.equal(rows[0].notes, 'keep', 'other columns of a patched row survive');
    assert.equal(Number(rows[1].monthly_fee), 1100);
    assert.equal(Number(rows[2].monthly_fee), 900, 'rows not named are untouched');

    await assert.rejects(
      () => updateRows(TABS.FEE_STRUCTURE, [{ rowNumber: 99, patch: { monthly_fee: 1 } }]),
      /no row 99/
    );
  });
});
