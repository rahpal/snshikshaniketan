/**
 * A small CSV reader for the student-list import.
 *
 * Handles what a real export from Excel or Google Sheets produces: quoted
 * fields, commas and newlines inside quotes, doubled quotes, CRLF line endings
 * and a UTF-8 byte-order mark. Nothing more - this is not a general CSV
 * library, and it does not need to be.
 */

export function parseCsv(text) {
  const input = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = '';
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    // Skip rows that are entirely empty, which trailing newlines produce.
    if (row.some((cell) => cell !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\n') {
      endRow();
    } else if (char === '\r') {
      // Part of CRLF; the \n that follows ends the row.
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Reads a CSV into objects, matching the header row against known field names.
 *
 * `aliases` maps a field to the headings people actually use, so a file with
 * "Student Name" or "Father's Name" imports without anyone having to rename
 * columns first.
 */
export function parseCsvRecords(text, aliases) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [], unmatched: [] };

  const normalise = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const lookup = new Map();
  for (const [field, names] of Object.entries(aliases)) {
    for (const name of names) lookup.set(normalise(name), field);
  }

  const headers = rows[0];
  const mapped = headers.map((header) => lookup.get(normalise(header)) ?? null);
  const unmatched = headers.filter((header, index) => mapped[index] === null);

  const records = rows.slice(1).map((row, index) => {
    const record = { _line: index + 2 };
    mapped.forEach((field, column) => {
      if (field) record[field] = (row[column] ?? '').trim();
    });
    return record;
  });

  return { headers, records, unmatched };
}
