const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export interface CsvCellOptions {
  delimiter?: string;
}

/**
 * Encodes one CSV cell and neutralizes values that spreadsheet programs can
 * interpret as formulas. The apostrophe is intentionally part of the exported
 * value; Excel and compatible tools display the remainder as literal text.
 */
export function encodeCsvCell(
  value: unknown,
  options: CsvCellOptions = {},
): string {
  if (value === null || value === undefined) return "";

  const delimiter = options.delimiter ?? ";";
  const raw = String(value);
  const safe = SPREADSHEET_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  const mustQuote =
    safe.includes(delimiter) ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r");

  return mustQuote ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function encodeCsvRow(
  values: readonly unknown[],
  options: CsvCellOptions = {},
): string {
  const delimiter = options.delimiter ?? ";";
  return values
    .map((value) => encodeCsvCell(value, { delimiter }))
    .join(delimiter);
}

export function buildCsvDocument(
  headers: readonly unknown[],
  rows: readonly (readonly unknown[])[],
  options: CsvCellOptions & { bom?: boolean; lineEnding?: string } = {},
): string {
  const delimiter = options.delimiter ?? ";";
  const lineEnding = options.lineEnding ?? "\r\n";
  const lines = [
    encodeCsvRow(headers, { delimiter }),
    ...rows.map((row) => encodeCsvRow(row, { delimiter })),
  ];
  return `${options.bom === false ? "" : "\uFEFF"}${lines.join(lineEnding)}`;
}
