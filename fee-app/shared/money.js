/**
 * Money handling. Totals are summed in paise, because adding rupees as floats
 * leaves a receipt for 3 x 333.33 reading 999.9899999999999.
 */

/** Sums month amounts without floating-point dust. */
export function sumAmounts(amounts) {
  const paise = amounts.reduce((total, amount) => total + Math.round((Number(amount) || 0) * 100), 0);
  return paise / 100;
}

/**
 * What this class usually pays in a month, worked out from what has actually
 * been collected.
 *
 * It pre-fills the amount on the form, which gives the convenience of a
 * fee-per-class table with nothing to set up or keep in step - and it follows
 * the fee by itself when it changes. The most common figure wins rather than
 * the most recent, so one unusual month (an exam, a part payment) does not
 * become everybody's default; the newest wins a tie.
 */
export function usualMonthlyAmount(payments) {
  const seen = new Map();

  for (const payment of payments ?? []) {
    const amount = Number(payment?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const entry = seen.get(amount) ?? { count: 0, latest: '' };
    const at = String(payment.entered_at ?? '');
    seen.set(amount, { count: entry.count + 1, latest: at > entry.latest ? at : entry.latest });
  }

  if (seen.size === 0) return null;

  return [...seen.entries()].sort(
    ([, a], [, b]) => b.count - a.count || b.latest.localeCompare(a.latest)
  )[0][0];
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
