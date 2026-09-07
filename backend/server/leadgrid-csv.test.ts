import { describe, expect, it } from "vitest";
import {
  buildCsvDocument,
  encodeCsvCell,
  encodeCsvRow,
} from "./leadgrid-csv.js";

describe("Leadgrid CSV policy", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\t=1+1", "\r=1+1"])(
    "neutralizes spreadsheet formula prefix %j",
    (value) => {
      expect(encodeCsvCell(value)).toContain(`'${value}`);
    },
  );

  it("quotes the selected delimiter, quotes and embedded line breaks", () => {
    expect(encodeCsvCell('Dentum; "Oslo"\nVest')).toBe(
      '"Dentum; ""Oslo""\nVest"',
    );
    expect(encodeCsvCell("Oslo,Vest", { delimiter: "," })).toBe('"Oslo,Vest"');
    expect(encodeCsvCell("Oslo,Vest", { delimiter: ";" })).toBe("Oslo,Vest");
  });

  it("uses one delimiter consistently for rows and emits BOM plus CRLF", () => {
    expect(encodeCsvRow(["A", "B,C"], { delimiter: "," })).toBe('A,"B,C"');
    expect(
      buildCsvDocument(
        ["name", "note"],
        [["Dentum", '=HYPERLINK("https://invalid")']],
        { delimiter: "," },
      ),
    ).toBe('\uFEFFname,note\r\nDentum,"\'=HYPERLINK(""https://invalid"")"');
  });
});
