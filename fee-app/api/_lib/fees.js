import { TABS } from './sheet-schema.js';
import { appendObjects, asNumber, asText, readTable, updateRow } from './table.js';

const TAB = TABS.FEE_STRUCTURE;

/**
 * The monthly fee per class, where the school has chosen to set one.
 *
 * Optional by design: with nothing configured the entry form falls back to the
 * amount a class most commonly pays, so the register works from day one and a
 * fee table can be filled in later, or never.
 */
export async function listFees({ academic_year, fresh = false } = {}) {
  const { rows } = await readTable(TAB, { fresh });
  return rows
    .map((row) => ({
      _row: row._row,
      academic_year: asText(row.academic_year),
      class: asText(row.class).toUpperCase(),
      monthly_fee: asNumber(row.monthly_fee, 0),
      effective_from: asText(row.effective_from),
      notes: asText(row.notes),
    }))
    .filter((fee) => fee.class && fee.monthly_fee > 0)
    .filter((fee) => (academic_year ? fee.academic_year === academic_year : true));
}

/** Sets a class's monthly fee, replacing any figure already there. */
export async function setFee({ academic_year, class: className, monthly_fee, notes }, by) {
  const existing = await listFees({ academic_year, fresh: true });
  const match = existing.find((fee) => fee.class === String(className).toUpperCase());

  const fields = {
    academic_year,
    class: String(className).toUpperCase(),
    monthly_fee,
    effective_from: `${academic_year.slice(0, 4)}-04-01`,
    notes: notes ?? `Set by ${by}`,
  };

  if (match) {
    await updateRow(TAB, match._row, fields);
    return { ...fields, previous: match.monthly_fee };
  }

  await appendObjects(TAB, fields);
  return { ...fields, previous: null };
}
