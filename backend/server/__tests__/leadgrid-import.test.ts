/**
 * leadgrid-import.test.ts
 *
 * Unit-tester for CSV/Excel-parsing og dedup-spørringer (mig 328).
 * URL-Research-stien har egen test-fil (`leadgrid-url-research.test.ts`).
 *
 * Pool-er er mockede — vi kjører ikke faktiske SQL-spørringer her.
 */
import { describe, expect, it, vi } from "vitest";
import { __test } from "../leadgrid-import-routes";

const { parseSpreadsheetBuffer, findDuplicate } = __test;

// ---------------------------------------------------------------------
// CSV / XLSX
// ---------------------------------------------------------------------

describe("parseSpreadsheetBuffer (CSV)", () => {
  it("parses a basic CSV with headers", () => {
    const csv = `Bedrift,E-post,Telefon,By
Acme AS,kontakt@acme.no,12345678,Oslo
BetaCo,beta@beta.no,98765432,Bergen`;
    const out = parseSpreadsheetBuffer(Buffer.from(csv, "utf-8"), "leads.csv");
    expect(out.columns).toEqual(["Bedrift", "E-post", "Telefon", "By"]);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toEqual({
      Bedrift: "Acme AS",
      "E-post": "kontakt@acme.no",
      Telefon: "12345678",
      By: "Oslo",
    });
    expect(out.rows[1].By).toBe("Bergen");
  });

  it("handles BOM + Windows-style line endings", () => {
    const csv = "﻿Name,Email\r\nAlpha,a@x.no\r\nBeta,b@x.no\r\n";
    const out = parseSpreadsheetBuffer(Buffer.from(csv, "utf-8"), "leads.csv");
    expect(out.columns).toEqual(["Name", "Email"]);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0].Name).toBe("Alpha");
  });

  it("skips empty rows", () => {
    const csv = `Name,Email
Acme,a@b.no

,
Beta,c@d.no`;
    const out = parseSpreadsheetBuffer(Buffer.from(csv, "utf-8"), "leads.csv");
    expect(out.rows.length).toBe(2);
    expect(out.rows.map((r) => r.Name)).toEqual(["Acme", "Beta"]);
  });

  it("trims whitespace in cells", () => {
    const csv = `Name,City
"  Acme  "," Oslo "`;
    const out = parseSpreadsheetBuffer(Buffer.from(csv, "utf-8"), "leads.csv");
    expect(out.rows[0].Name).toBe("Acme");
    expect(out.rows[0].City).toBe("Oslo");
  });

  it("returns empty result for empty buffer", () => {
    const out = parseSpreadsheetBuffer(Buffer.from("", "utf-8"), "empty.csv");
    expect(out.columns).toEqual([]);
    expect(out.rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------

describe("findDuplicate", () => {
  function mockPool(rows: { id: string }[]) {
    return {
      query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
    } as unknown as Parameters<typeof findDuplicate>[0];
  }

  it("matches on lowercased email when strategy='email'", async () => {
    const pool = mockPool([{ id: "existing-uuid" }]);
    const result = await findDuplicate(pool, {
      ownerUserId: "user-1",
      organizationId: "org-1",
      strategy: "email",
      lead: { email: "  KONTAKT@Acme.NO ", phone: null, name: "Acme", city: null },
    });
    expect(result).toBe("existing-uuid");
    // Verifiser at vi normaliserte e-posten i SQL-parametrene
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1][0]).toBe("kontakt@acme.no");
  });

  it("returns null for strategy='email' when email is missing", async () => {
    const pool = mockPool([]);
    const result = await findDuplicate(pool, {
      ownerUserId: "user-1",
      organizationId: null,
      strategy: "email",
      lead: { email: null, phone: null, name: "X", city: null },
    });
    expect(result).toBeNull();
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("normalizes phone — strips non-digits, matches last-8-digits", async () => {
    const pool = mockPool([{ id: "dup-123" }]);
    await findDuplicate(pool, {
      ownerUserId: "user-1",
      organizationId: "org-1",
      strategy: "phone",
      lead: { email: null, phone: "+47 123 45 678", name: "Acme", city: null },
    });
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    // Telefonen normalisert til '+4712345678', tail-match '%12345678'.
    expect(calls[0][1][0]).toBe("%12345678");
  });

  it("returns null when strategy='none'", async () => {
    const pool = mockPool([{ id: "x" }]);
    const result = await findDuplicate(pool, {
      ownerUserId: "user-1",
      organizationId: "org-1",
      strategy: "none",
      lead: { email: "a@b.no", phone: null, name: "Acme", city: null },
    });
    expect(result).toBeNull();
  });

  it("includes city in WHERE for strategy='name+city'", async () => {
    const pool = mockPool([]);
    await findDuplicate(pool, {
      ownerUserId: "user-1",
      organizationId: "org-1",
      strategy: "name+city",
      lead: { email: null, phone: null, name: "  Acme  AS ", city: "OSLO" },
    });
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1][0]).toBe("acme as"); // lower+collapsed
    expect(calls[0][1][1]).toBe("oslo");
  });
});

