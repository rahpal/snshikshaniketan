/**
 * Money handling. Amounts are rupees, but arithmetic happens in paise: a
 * receipt for three months at 1/3 of 1000 must still add back up to exactly
 * 1000, which floating-point rupees do not guarantee.
 */

/**
 * Splits a receipt total across its months. Earlier months absorb the
 * remainder, so the parts always sum to the total exactly.
 */
export function allocateAmount(total, count) {
  if (!Number.isFinite(total)) throw new Error('allocateAmount needs a finite total');
  if (!Number.isInteger(count) || count < 1) throw new Error('allocateAmount needs at least one part');

  const totalPaise = Math.round(total * 100);
  const basePaise = Math.floor(totalPaise / count);
  let remainder = totalPaise - basePaise * count;

  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return (basePaise + extra) / 100;
  });
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "₹1,250" - Indian digit grouping, and no trailing ".00" on whole rupees. */
export function formatInr(amount) {
  return INR.format(Number(amount) || 0);
}

const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "14 Oct 2026" rather than "2026-10-14". The stored form stays ISO so it
 * sorts; this is only for reading, above all on a printed receipt.
 */
export function formatDate(isoDate) {
  const text = String(isoDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // Parsed as parts, not via Date(string), which would shift by timezone.
  const [year, month, day] = text.split('-').map(Number);
  return DAY.format(new Date(year, month - 1, day));
}
