/**
 * Facts about this school that both the browser and the API need to agree on.
 *
 * Shared rather than duplicated: if the class list in the form ever disagreed
 * with the one the server validates against, entries would be rejected for no
 * visible reason.
 */

/** In the order they appear on a register, not alphabetical. */
export const CLASSES = ['NUR', 'KG', '1', '2', '3', '4', '5', '6', '7', '8'];

export const CLASS_LABELS = {
  NUR: 'Nursery',
  KG: 'KG',
};

export function classLabel(name) {
  return CLASS_LABELS[name] ?? `Class ${name}`;
}

export function isKnownClass(name) {
  return CLASSES.includes(String(name ?? '').trim().toUpperCase());
}

/**
 * The school does not run sections. The column stays in the spreadsheet so
 * sections can be introduced later without migrating existing rows, but the
 * forms neither show nor send it.
 */
export const SECTIONS_ENABLED = false;

export const PAYMENT_MODE_LABELS = {
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
  bank: 'Bank transfer',
};
