/**
 * leadgrid-import.test.ts
 *
 * Unit-tester for CSV/Excel-parsing, URL→meta-ekstraksjon, Claude-JSON-
 * parsing og dedup-spørringer (mig 328).
 *
 * Pool-er er mockede — vi kjører ikke faktiske SQL-spørringer her.
 */
import { describe, expect, it, vi } from "vitest";
import { __test } from "../leadgrid-import-routes";

const {
  parseSpreadsheetBuffer,
  findDuplicate,
  extractMetaFromHtml,
  parseScrapedJson,
  scrapedLeadToMapped,
} = __test;

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

// ---------------------------------------------------------------------
// URL-extract: HTML→meta
// ---------------------------------------------------------------------

describe("extractMetaFromHtml", () => {
  it("ekstraherer OG-meta + body-tekst", () => {
    const html = `
      <html>
        <head>
          <title>Acme — Norges beste</title>
          <meta property="og:title" content="Acme AS">
          <meta property="og:description" content="Vi leverer kvalitet siden 1999">
          <meta property="og:image" content="https://example.com/logo.png">
        </head>
        <body>
          <script>alert('skip');</script>
          <h1>Velkommen</h1>
          <p>Ring oss på 12345678</p>
        </body>
      </html>`;
    const meta = extractMetaFromHtml(html, "https://acme.no");
    expect(meta.og_title).toBe("Acme AS");
    expect(meta.og_description).toBe("Vi leverer kvalitet siden 1999");
    expect(meta.og_image).toBe("https://example.com/logo.png");
    expect(meta.title).toBe("Acme — Norges beste");
    // Script-tag fjernet
    expect(meta.body_text).not.toContain("alert");
    expect(meta.body_text).toContain("Velkommen");
    expect(meta.body_text).toContain("12345678");
    // URL inkludert i prefix
    expect(meta.body_text).toContain("URL: https://acme.no");
  });

  it("faller tilbake til <meta name=description> når og:description mangler", () => {
    const html = `<html><head><meta name="description" content="Fallback"></head><body></body></html>`;
    const meta = extractMetaFromHtml(html, "https://x.no");
    expect(meta.og_description).toBe("Fallback");
  });
});

// ---------------------------------------------------------------------
// Claude JSON-parsing
// ---------------------------------------------------------------------

describe("parseScrapedJson (Claude output)", () => {
  it("parses a clean JSON object", () => {
    const text = `{"company_name":"Acme AS","industry":"Software","country":"NO","city":"Oslo","email":"a@b.no","phone":null,"address":null,"website":"https://acme.no","linkedin_url":null,"instagram_url":null,"facebook_url":null,"employee_count_estimate":42,"lead_quality_score":80,"company_description":"Test"}`;
    const lead = parseScrapedJson(text);
    expect(lead).not.toBeNull();
    expect(lead?.company_name).toBe("Acme AS");
    expect(lead?.country).toBe("NO");
    expect(lead?.employee_count_estimate).toBe(42);
    expect(lead?.lead_quality_score).toBe(80);
  });

  it("strips markdown fence around JSON", () => {
    const text =
      "```json\n" +
      JSON.stringify({ company_name: "Beta", lead_quality_score: 50 }) +
      "\n```";
    const lead = parseScrapedJson(text);
    expect(lead?.company_name).toBe("Beta");
    expect(lead?.lead_quality_score).toBe(50);
  });

  it("returns null for invalid JSON", () => {
    expect(parseScrapedJson("not json at all")).toBeNull();
    expect(parseScrapedJson("")).toBeNull();
  });

  it("nuller ut felter som mangler", () => {
    const lead = parseScrapedJson(`{"company_name":"X"}`);
    expect(lead?.company_name).toBe("X");
    expect(lead?.email).toBeNull();
    expect(lead?.employee_count_estimate).toBeNull();
    expect(lead?.lead_quality_score).toBeNull();
  });
});

describe("scrapedLeadToMapped", () => {
  it("flytter Claude-output til MappedLead-form og setter notes=description", () => {
    const m = scrapedLeadToMapped(
      "https://acme.no",
      {
        company_name: "Acme AS",
        company_description: "Vi gjør X",
        industry: "Software",
        country: "NO",
        city: "Oslo",
        address: "Karl Johans gate 1",
        phone: "12345678",
        email: "kontakt@acme.no",
        website: "https://acme.no",
        linkedin_url: "https://linkedin.com/company/acme",
        instagram_url: null,
        facebook_url: null,
        employee_count_estimate: 50,
        lead_quality_score: 85,
      },
      { url: "https://acme.no" },
    );
    expect(m.name).toBe("Acme AS");
    expect(m.notes).toBe("Vi gjør X");
    expect(m.linkedin_url).toBe("https://linkedin.com/company/acme");
    expect(m.lead_quality_score).toBe(85);
    expect(m.website_url).toBe("https://acme.no");
    expect(m.company).toBe("Acme AS");
  });

  it("faller tilbake til source-url når Claude ikke gir website", () => {
    const m = scrapedLeadToMapped(
      "https://acme.no/kontakt",
      {
        company_name: "X",
        company_description: null,
        industry: null,
        country: null,
        city: null,
        address: null,
        phone: null,
        email: null,
        website: null,
        linkedin_url: null,
        instagram_url: null,
        facebook_url: null,
        employee_count_estimate: null,
        lead_quality_score: null,
      },
      {},
    );
    expect(m.website_url).toBe("https://acme.no/kontakt");
  });
});
