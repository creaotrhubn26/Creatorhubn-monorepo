/**
 * leadgrid-import.test.ts
 *
 * Unit-tester for CSV/Excel-parsing, URL-normalisering, brand-kit-summary-
 * transformasjon og dedup-spørringer (mig 328).
 *
 * URL-research-flyten gjenbruker eksisterende `runBrandScan()` +
 * `createMarketScan()` — vi tester ikke disse her (de har egne suiter).
 * Vi verifiserer kun at vår thin orchestration kaller dem riktig.
 *
 * Pool-er er mockede — vi kjører ikke faktiske SQL-spørringer her.
 */
import { describe, expect, it, vi } from "vitest";
import { __test } from "../leadgrid-import-routes";

const {
  parseSpreadsheetBuffer,
  findDuplicate,
  normalizeUrl,
  brandKitToSummary,
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
// Dedup (oppdatert: drafts ekskluderes fra dedup)
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

  it("ekskluderer drafts fra dedup-spørring", async () => {
    const pool = mockPool([]);
    await findDuplicate(pool, {
      ownerUserId: "user-1",
      organizationId: "org-1",
      strategy: "email",
      lead: { email: "x@y.no", phone: null, name: "X", city: null },
    });
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    const sql = String(calls[0][0]);
    // Bare 'lead'-rader skal telles som duplikater — drafts/rejected ignoreres
    expect(sql).toContain("draft_status");
    expect(sql).toContain("'lead'");
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
// URL-normalisering (preflight før vi sender til runBrandScan)
// ---------------------------------------------------------------------

describe("normalizeUrl", () => {
  it("legger til https:// hvis ingen protocol", () => {
    expect(normalizeUrl("acme.no")).toBe("https://acme.no/");
    expect(normalizeUrl("www.acme.no/contact")).toBe("https://www.acme.no/contact");
  });

  it("beholder http:// og https:// uforandret (modulo trailing-slash)", () => {
    expect(normalizeUrl("http://acme.no")).toBe("http://acme.no/");
    expect(normalizeUrl("https://acme.no/path")).toBe("https://acme.no/path");
  });

  it("trimmer whitespace", () => {
    expect(normalizeUrl("  https://acme.no  ")).toBe("https://acme.no/");
  });

  it("returnerer null for tomt eller ugyldig input", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("not a url at all !@#$")).toBeNull();
  });

  it("avviser ikke-http(s)-protokoller", () => {
    expect(normalizeUrl("ftp://acme.no")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// brandKitToSummary — speil av brand-kit.effective for klient-preview
// ---------------------------------------------------------------------

describe("brandKitToSummary", () => {
  it("plukker effective-felter og normaliserer formen (kanonisk array-shape)", () => {
    const fakeBk = {
      id: "bk-1",
      sourceUrl: "https://acme.no",
      lastScannedAt: "2026-06-26T10:00:00Z",
      effective: {
        businessName: "Acme AS",
        tagline: "Norges beste",
        description: "Vi gjør X",
        industry: "Software",
        targetAudience: "B2B SaaS",
        toneOfVoice: "professional",
        usps: ["raskt", "norsk support"],
        primaryCTA: "Bestill demo",
        logoUrl: "https://acme.no/logo.png",
        colors: { primary: "#7c3aed", accent: "#10b981", secondary: "#f3f0fa" },
        fonts: { heading: "Inter", body: "Inter" },
        // Kanonisk shape: array<{platform,url}> fra role-room-website-analyzer
        socialLinks: [
          { platform: "linkedin", url: "https://linkedin.com/company/acme" },
          { platform: "instagram", url: "https://instagram.com/acme" },
        ],
        productCategories: [],
      },
    } as unknown as Parameters<typeof brandKitToSummary>[0];

    const sum = brandKitToSummary(fakeBk);
    expect(sum.id).toBe("bk-1");
    expect(sum.business_name).toBe("Acme AS");
    expect(sum.tagline).toBe("Norges beste");
    expect(sum.industry).toBe("Software");
    expect(sum.usps).toEqual(["raskt", "norsk support"]);
    expect(sum.colors.primary).toBe("#7c3aed");
    expect(sum.colors.secondary).toBe("#f3f0fa");
    expect(sum.social_links.linkedin).toBe("https://linkedin.com/company/acme");
    expect(sum.social_links.instagram).toBe("https://instagram.com/acme");
    expect(sum.social_links.facebook).toBeNull();
    expect(sum.logo_url).toBe("https://acme.no/logo.png");
  });

  it("støtter legacy object-shape for socialLinks", () => {
    const fakeBk = {
      id: "bk-3",
      sourceUrl: "https://x.no",
      lastScannedAt: "2026-06-26T10:00:00Z",
      effective: {
        businessName: "X",
        socialLinks: {
          linkedin: "https://linkedin.com/company/x",
          instagram: null,
          facebook: null,
        },
        colors: {},
        fonts: {},
      },
    } as unknown as Parameters<typeof brandKitToSummary>[0];

    const sum = brandKitToSummary(fakeBk);
    expect(sum.social_links.linkedin).toBe("https://linkedin.com/company/x");
    expect(sum.social_links.instagram).toBeNull();
  });

  it("håndterer manglende felter (null/undefined) trygt", () => {
    const fakeBk = {
      id: "bk-2",
      sourceUrl: "https://x.no",
      lastScannedAt: "2026-06-26T10:00:00Z",
      effective: {
        businessName: "",
        tagline: undefined,
        description: undefined,
        industry: "",
        targetAudience: "",
        toneOfVoice: undefined,
        usps: undefined,
        primaryCTA: undefined,
        logoUrl: undefined,
        colors: {},
        fonts: {},
        socialLinks: {},
      },
    } as unknown as Parameters<typeof brandKitToSummary>[0];

    const sum = brandKitToSummary(fakeBk);
    expect(sum.business_name).toBe(""); // tom streng er OK (klient håndterer)
    expect(sum.usps).toEqual([]); // ALDRI null på array-felter
    expect(sum.colors.primary).toBeNull();
    expect(sum.social_links.linkedin).toBeNull();
  });
});
