/**
 * leadgrid-industries.test.ts
 *
 * Unit-tester for industries-systemet (mig 329).
 *
 * Dekker:
 *   1. Industry-classify helper (NACE-direct, NACE-suffix, trigram, no-match)
 *   2. Lead-routing helper (primary > expert > specialist + round-robin)
 *   3. replaceMemberIndustries (one-primary-constraint, validation)
 *   4. Sanitizers (color, icon)
 *
 * Pool-er er mockede — vi kjører ikke faktiske SQL-spørringer her.
 */
import { describe, expect, it, vi } from "vitest";
import type { Pool, QueryResult, QueryResultRow } from "pg";

import { __test as industriesTest } from "../leadgrid-industries-routes";
import { __test as classifyTest } from "../leadgrid-industry-classify";
import { __test as routingTest } from "../leadgrid-lead-routing-service";

const { classifyIndustryForLead } = classifyTest;
const { routeLeadByIndustry } = routingTest;
const { sanitizeColorHex, sanitizeIcon, replaceMemberIndustries } = industriesTest;

// ---------------------------------------------------------------------
// Helpers for å bygge en mock Pool som returnerer scripted responses.
// ---------------------------------------------------------------------

interface QueryScript {
  matcher: RegExp | ((sql: string) => boolean);
  rows: QueryResultRow[];
}

function mockPool(scripts: QueryScript[]): Pool {
  let callIdx = 0;
  const pool = {
    query: vi.fn(async (sql: string) => {
      // Finn første matching script
      for (let i = callIdx; i < scripts.length; i++) {
        const s = scripts[i];
        const match =
          typeof s.matcher === "function" ? s.matcher(sql) : s.matcher.test(sql);
        if (match) {
          callIdx = i + 1;
          return {
            rows: s.rows,
            rowCount: s.rows.length,
            command: "SELECT",
            oid: 0,
            fields: [],
          } satisfies QueryResult<QueryResultRow>;
        }
      }
      return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
    }),
    connect: vi.fn(),
  } as unknown as Pool;
  return pool;
}

function mockPoolWithClient(
  scripts: QueryScript[],
  clientScripts: QueryScript[] = [],
): Pool {
  let callIdx = 0;
  let clientCallIdx = 0;
  const client = {
    query: vi.fn(async (sql: string) => {
      for (let i = clientCallIdx; i < clientScripts.length; i++) {
        const s = clientScripts[i];
        const match =
          typeof s.matcher === "function" ? s.matcher(sql) : s.matcher.test(sql);
        if (match) {
          clientCallIdx = i + 1;
          return {
            rows: s.rows,
            rowCount: s.rows.length,
            command: "SELECT",
            oid: 0,
            fields: [],
          };
        }
      }
      return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
    }),
    release: vi.fn(),
  };
  return {
    query: vi.fn(async (sql: string) => {
      for (let i = callIdx; i < scripts.length; i++) {
        const s = scripts[i];
        const match =
          typeof s.matcher === "function" ? s.matcher(sql) : s.matcher.test(sql);
        if (match) {
          callIdx = i + 1;
          return {
            rows: s.rows,
            rowCount: s.rows.length,
            command: "SELECT",
            oid: 0,
            fields: [],
          };
        }
      }
      return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
    }),
    connect: vi.fn(async () => client),
  } as unknown as Pool;
}

// ---------------------------------------------------------------------
// Industry classification
// ---------------------------------------------------------------------

describe("classifyIndustryForLead", () => {
  it("matcher NACE-kode direkte (nace_full)", async () => {
    const pool = mockPool([
      {
        matcher: /code = ANY/,
        rows: [{ id: "00000000-0000-0000-0000-000000000001", code: "NACE.47.11", name_no: "Butikker — bredt vareutvalg" }],
      },
    ]);
    const r = await classifyIndustryForLead(pool, {
      naceCode: "47.11",
      naceDescription: null,
      companyIndustryText: null,
      companySummary: null,
    });
    expect(r.industryId).toBe("00000000-0000-0000-0000-000000000001");
    expect(r.source).toBe("nace_full");
  });

  it("faller til nace_short når full sti ikke finnes", async () => {
    const pool = mockPool([
      { matcher: /code = ANY/, rows: [] }, // full match feiler
      {
        matcher: /LIKE \$1 OR code LIKE \$2/,
        rows: [{ id: "uuid-2", code: "NACE.G.47.11", name_no: "Butikker" }],
      },
    ]);
    const r = await classifyIndustryForLead(pool, {
      naceCode: "47.11",
      naceDescription: null,
      companyIndustryText: null,
      companySummary: null,
    });
    expect(r.source).toBe("nace_short");
    expect(r.matchedIndustryCode).toBe("NACE.G.47.11");
  });

  it("faller til trigram-match på companyIndustryText", async () => {
    const pool = mockPool([
      // ingen NACE-kode → ingen NACE-spørringer.
      // Første trigram-kjøring (companyIndustryText)
      {
        matcher: /similarity/,
        rows: [{ id: "uuid-3", code: "CUSTOM.WEDDING_VENUE", name_no: "Bryllupslokale", sim: 0.78 }],
      },
    ]);
    const r = await classifyIndustryForLead(pool, {
      naceCode: null,
      naceDescription: null,
      companyIndustryText: "Bryllupslokaler i Oslo",
      companySummary: null,
    });
    expect(r.source).toBe("trigram");
    expect(r.industryId).toBe("uuid-3");
  });

  it("returnerer null når ingenting matcher", async () => {
    const pool = mockPool([
      { matcher: /similarity/, rows: [] },
      { matcher: /similarity/, rows: [] },
      { matcher: /similarity/, rows: [] },
    ]);
    const r = await classifyIndustryForLead(pool, {
      naceCode: null,
      naceDescription: null,
      companyIndustryText: "X", // for kort, hoppes over
      companySummary: "Vi gjør ting",
    });
    expect(r.industryId).toBeNull();
    expect(r.source).toBeNull();
  });

  it("ignorerer trigram-treff under threshold", async () => {
    const pool = mockPool([
      // Lav similarity → 0.2 — skal IKKE returneres
      {
        matcher: /similarity/,
        rows: [{ id: "uuid-x", code: "NACE.I.56", name_no: "Serveringsvirksomhet", sim: 0.2 }],
      },
    ]);
    const r = await classifyIndustryForLead(pool, {
      naceCode: null,
      naceDescription: null,
      companyIndustryText: "Helt urelatert tekst om romfart",
      companySummary: null,
    });
    expect(r.industryId).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Lead routing
// ---------------------------------------------------------------------

describe("routeLeadByIndustry", () => {
  it("returnerer no_industry når industry_id mangler", async () => {
    const pool = mockPool([]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: null,
      currentOwnerUserId: "owner-1",
    });
    expect(r.reason).toBe("no_industry");
    expect(r.userId).toBe("owner-1");
  });

  it("velger primary over expert", async () => {
    const pool = mockPool([
      {
        matcher: /organization_member_industries/,
        rows: [
          { user_id: "user-A", expertise_level: "expert", is_primary: false, open_lead_count: 0 },
          { user_id: "user-B", expertise_level: "general", is_primary: true, open_lead_count: 5 },
          { user_id: "user-C", expertise_level: "expert", is_primary: false, open_lead_count: 1 },
        ],
      },
    ]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: "ind-1",
    });
    expect(r.reason).toBe("primary");
    expect(r.userId).toBe("user-B");
  });

  it("velger expert med færrest åpne leads (round-robin)", async () => {
    const pool = mockPool([
      {
        matcher: /organization_member_industries/,
        rows: [
          { user_id: "user-A", expertise_level: "expert", is_primary: false, open_lead_count: 10 },
          { user_id: "user-B", expertise_level: "expert", is_primary: false, open_lead_count: 3 },
          { user_id: "user-C", expertise_level: "expert", is_primary: false, open_lead_count: 7 },
        ],
      },
    ]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: "ind-1",
    });
    expect(r.reason).toBe("expert");
    expect(r.userId).toBe("user-B"); // færrest open leads
  });

  it("velger specialist hvis ingen expert finnes", async () => {
    const pool = mockPool([
      {
        matcher: /organization_member_industries/,
        rows: [
          { user_id: "user-A", expertise_level: "general", is_primary: false, open_lead_count: 0 },
          { user_id: "user-B", expertise_level: "specialist", is_primary: false, open_lead_count: 2 },
        ],
      },
    ]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: "ind-1",
    });
    expect(r.reason).toBe("specialist");
    expect(r.userId).toBe("user-B");
  });

  it("returnerer no_change når kun general-medlemmer finnes", async () => {
    const pool = mockPool([
      {
        matcher: /organization_member_industries/,
        rows: [
          { user_id: "user-A", expertise_level: "general", is_primary: false, open_lead_count: 0 },
        ],
      },
    ]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: "ind-1",
      currentOwnerUserId: "current-owner",
    });
    expect(r.reason).toBe("no_change");
    expect(r.userId).toBe("current-owner");
    expect(r.candidatesConsidered).toBe(1);
  });

  it("returnerer no_candidates når ingen medlemmer har bransjen", async () => {
    const pool = mockPool([{ matcher: /organization_member_industries/, rows: [] }]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: "ind-1",
      currentOwnerUserId: "owner-1",
    });
    expect(r.reason).toBe("no_candidates");
    expect(r.userId).toBe("owner-1");
  });

  it("er deterministisk på tie-break (user_id-lexicographic)", async () => {
    const pool = mockPool([
      {
        matcher: /organization_member_industries/,
        rows: [
          { user_id: "user-Z", expertise_level: "expert", is_primary: false, open_lead_count: 2 },
          { user_id: "user-A", expertise_level: "expert", is_primary: false, open_lead_count: 2 },
          { user_id: "user-M", expertise_level: "expert", is_primary: false, open_lead_count: 2 },
        ],
      },
    ]);
    const r = await routeLeadByIndustry(pool, {
      organizationId: "org-1",
      industryId: "ind-1",
    });
    expect(r.userId).toBe("user-A"); // lex-min
  });
});

// ---------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------

describe("sanitizeColorHex", () => {
  it("aksepterer gyldig #RRGGBB", () => {
    expect(sanitizeColorHex("#9333ea")).toBe("#9333ea");
    expect(sanitizeColorHex("#AABBCC")).toBe("#AABBCC");
  });
  it("avviser ugyldige inputs", () => {
    expect(sanitizeColorHex("9333ea")).toBeNull();
    expect(sanitizeColorHex("#xyz")).toBeNull();
    expect(sanitizeColorHex("")).toBeNull();
    expect(sanitizeColorHex(null)).toBeNull();
    expect(sanitizeColorHex(123)).toBeNull();
  });
});

describe("sanitizeIcon", () => {
  it("trimmer og kapper på 60 tegn", () => {
    expect(sanitizeIcon("fork.knife")).toBe("fork.knife");
    expect(sanitizeIcon("  pawprint.fill  ")).toBe("pawprint.fill");
    const long = "x".repeat(100);
    expect(sanitizeIcon(long)?.length).toBe(60);
  });
  it("avviser tomme/ikke-string", () => {
    expect(sanitizeIcon("")).toBeNull();
    expect(sanitizeIcon("   ")).toBeNull();
    expect(sanitizeIcon(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------
// replaceMemberIndustries
// ---------------------------------------------------------------------

describe("replaceMemberIndustries", () => {
  it("avviser maks-1-primary regel", async () => {
    const pool = mockPoolWithClient([]);
    await expect(
      replaceMemberIndustries(pool, "org-1", "user-1", [
        { industryId: "ind-1", isPrimary: true },
        { industryId: "ind-2", isPrimary: true },
      ]),
    ).rejects.toThrow(/maks 1/i);
  });

  it("avviser når industryId mangler", async () => {
    const pool = mockPoolWithClient([]);
    await expect(
      replaceMemberIndustries(pool, "org-1", "user-1", [{ expertiseLevel: "expert" }]),
    ).rejects.toThrow(/industryId mangler/);
  });

  it("kjører DELETE + INSERT i transaksjon (1 expert + 1 specialist)", async () => {
    const inserted: unknown[] = [];
    const pool = mockPoolWithClient(
      // pool-spørringer
      [
        {
          matcher: /SELECT organization_id::text/,
          rows: [
            {
              organization_id: "org-1",
              user_id: "user-1",
              industry_id: "ind-1",
              expertise_level: "expert",
              is_primary: true,
              notes: null,
              created_at: "2026-06-26",
              updated_at: "2026-06-26",
            },
          ],
        },
      ],
      // client-spørringer (BEGIN/DELETE/INSERT*N/COMMIT)
      [
        { matcher: /BEGIN/, rows: [] },
        { matcher: /DELETE FROM organization_member_industries/, rows: [] },
        { matcher: /INSERT INTO organization_member_industries/, rows: [] },
        { matcher: /INSERT INTO organization_member_industries/, rows: [] },
        { matcher: /COMMIT/, rows: [] },
      ],
    );
    const result = await replaceMemberIndustries(pool, "org-1", "user-1", [
      { industryId: "ind-1", expertiseLevel: "expert", isPrimary: true },
      { industryId: "ind-2", expertiseLevel: "specialist" },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].industry_id).toBe("ind-1");
  });
});
