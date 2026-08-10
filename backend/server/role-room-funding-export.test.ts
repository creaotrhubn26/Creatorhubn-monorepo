import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  buildFundingExport, compareToSnapshot, csvField, toCsv, type FundingExport,
} from "./role-room-funding-export.js";

describe("csvField", () => {
  it("lar enkle verdier stå", () => {
    expect(csvField("Regi")).toBe("Regi");
  });

  it("siterer verdier med semikolon — skilletegnet i norsk Excel", () => {
    expect(csvField("Lys; grip")).toBe('"Lys; grip"');
  });

  it("siterer komma og linjeskift", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("a\nb")).toBe('"a\nb"');
  });

  it("dobler anførselstegn inne i verdien", () => {
    expect(csvField('Han sa "hei"')).toBe('"Han sa ""hei"""');
  });

  it("skriver tom streng for null og undefined", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });
});

function stubPool(opts: {
  scheme?: Record<string, unknown> | null;
  mappings?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM role_room_funding_schemes")) {
      const rows = opts.scheme === null ? [] : [opts.scheme ?? {
        id: "sch1", scheme_key: "nfi", name: "NFI", organisation: "Norsk filminstitutt",
        verified: true, source_url: null,
      }];
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("FROM role_room_funding_category_mappings")) {
      const rows = opts.mappings ?? [];
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("FROM role_room_budget_items")) {
      const rows = opts.items ?? [];
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query } as unknown as Pool, query };
}

const mapping = (source: string, code: string, label: string, order = 0) => ({
  source_category: source, target_code: code, target_label: label,
  target_group: "Produksjon", sort_order: order,
});
const item = (category: string, estimate: number, extra: Record<string, unknown> = {}) => ({
  category, currency: "NOK", estimate, approved: 0, actual: 0, ...extra,
});

describe("buildFundingExport", () => {
  it("summerer flere av våre kategorier inn i samme post", async () => {
    const { pool } = stubPool({
      mappings: [mapping("Kamera", "C.1", "Foto", 1), mapping("Lys / Grip", "C.1", "Foto", 2)],
      items: [item("Kamera", 220000), item("Lys / Grip", 80000)],
    });
    const e = await buildFundingExport(pool, "p1", "nfi");
    expect(e.lines).toHaveLength(1);
    expect(e.lines[0].estimate).toBe(300000);
    expect(e.lines[0].sourceCategories).toEqual(["Kamera", "Lys / Grip"]);
  });

  it("tar med poster uten beløp — en tom post viser at den er vurdert", async () => {
    const { pool } = stubPool({
      mappings: [mapping("Kamera", "C.1", "Foto"), mapping("Musikk", "E.5", "Musikk")],
      items: [item("Kamera", 100)],
    });
    const e = await buildFundingExport(pool, "p1", "nfi");
    expect(e.lines).toHaveLength(2);
    expect(e.lines.find((l) => l.targetCode === "E.5")?.estimate).toBe(0);
  });

  it("flagger ukartlagte kategorier framfor å droppe dem stille", async () => {
    // En budsjettpost som forsvinner er verre enn en som havner feil, fordi
    // ingen oppdager den.
    const { pool } = stubPool({
      mappings: [mapping("Kamera", "C.1", "Foto")],
      items: [item("Kamera", 100), item("Drone og spesialutstyr", 35000)],
    });
    const e = await buildFundingExport(pool, "p1", "nfi");
    expect(e.unmapped).toEqual([{ category: "Drone og spesialutstyr", estimate: 35000 }]);
    expect(e.warnings.join(" ")).toMatch(/Drone og spesialutstyr/);
    // Beløpet skal ikke smugles inn i totalen.
    expect(e.totals.estimate).toBe(100);
  });

  it("advarer når oppsettet ikke er kontrollert mot gjeldende mal", async () => {
    const { pool } = stubPool({
      scheme: { id: "s", scheme_key: "nfi", name: "NFI", organisation: null, verified: false, source_url: null },
      mappings: [mapping("Kamera", "C.1", "Foto")],
      items: [item("Kamera", 100)],
    });
    const e = await buildFundingExport(pool, "p1", "nfi");
    expect(e.warnings.join(" ")).toMatch(/IKKE kontrollert/);
  });

  it("advarer ikke om kontrollerte oppsett", async () => {
    const { pool } = stubPool({ mappings: [mapping("Kamera", "C.1", "Foto")], items: [item("Kamera", 100)] });
    expect((await buildFundingExport(pool, "p1", "nfi")).warnings).toEqual([]);
  });

  it("advarer om blandede valutaer framfor å summere dem stille", async () => {
    const { pool } = stubPool({
      mappings: [mapping("Kamera", "C.1", "Foto")],
      items: [item("Kamera", 100), item("Kamera", 200, { currency: "EUR" })],
    });
    const e = await buildFundingExport(pool, "p1", "nfi");
    expect(e.currency).toBe("BLANDET");
    expect(e.warnings.join(" ")).toMatch(/flere valutaer/);
  });

  it("kaster på ukjent oppsett", async () => {
    const { pool } = stubPool({ scheme: null });
    await expect(buildFundingExport(pool, "p1", "finnes-ikke")).rejects.toThrow(/Ukjent budsjettoppsett/);
  });
});

describe("toCsv", () => {
  const base: FundingExport = {
    scheme: { key: "nfi", name: "NFI", organisation: null, verified: false, sourceUrl: null },
    projectId: "p1",
    currency: "NOK",
    lines: [{
      targetCode: "C.1", targetLabel: "Foto", targetGroup: "Produksjon",
      sourceCategories: ["Kamera"], estimate: 300000, approved: 0, actual: 0,
    }],
    totals: { estimate: 300000, approved: 0, actual: 0 },
    unmapped: [{ category: "Drone", estimate: 35000 }],
    warnings: ["Oppsettet er ikke kontrollert."],
  };

  it("starter med BOM så norsk Excel leser æøå riktig", () => {
    expect(toCsv(base).charCodeAt(0)).toBe(0xfeff);
  });

  it("bruker semikolon, som er listeskilletegnet i norsk Excel", () => {
    expect(toCsv(base)).toContain("Gruppe;Post;Betegnelse");
  });

  it("legger advarslene i filen, ikke bare i API-svaret", () => {
    // Den som sender søknaden ser ofte bare filen.
    expect(toCsv(base)).toContain("# ADVARSEL: Oppsettet er ikke kontrollert.");
  });

  it("tar med ukartlagte poster i egen bolk", () => {
    const csv = toCsv(base);
    expect(csv).toContain("IKKE KARTLAGT");
    expect(csv).toContain("Drone;35000");
  });

  it("bruker CRLF, som Excel forventer", () => {
    expect(toCsv(base)).toContain("\r\n");
  });

  it("har med sumlinje", () => {
    expect(toCsv(base)).toContain(";SUM;300000");
  });
});

// ── Innsending og avstemming ────────────────────────────────────────────────


function stubCompare(opts: {
  submitted: Partial<FundingExport>;
  mappings: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM role_room_funding_snapshots")) {
      return {
        rows: [{
          id: "snap1", project_id: "p1", scheme_key: "nfi", label: "Søknad",
          submitted_at: "2027-03-12T10:00:00Z",
          export_payload: {
            lines: [], totals: { estimate: 0, approved: 0, actual: 0 },
            ...opts.submitted,
          },
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM role_room_funding_schemes")) {
      return {
        rows: [{ id: "s", scheme_key: "nfi", name: "NFI", organisation: null, verified: true, source_url: null }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM role_room_funding_category_mappings")) {
      return { rows: opts.mappings, rowCount: opts.mappings.length };
    }
    if (sql.includes("FROM role_room_budget_items")) {
      return { rows: opts.items, rowCount: opts.items.length };
    }
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query } as unknown as Pool };
}

const line = (code: string, label: string, estimate: number) => ({
  targetCode: code, targetLabel: label, targetGroup: "G",
  sourceCategories: [], estimate, approved: 0, actual: 0,
});

describe("compareToSnapshot", () => {
  it("melder ingen avvik når ingenting har endret seg", async () => {
    const { pool } = stubCompare({
      submitted: { lines: [line("C.1", "Foto", 300)], totals: { estimate: 300, approved: 0, actual: 0 } },
      mappings: [mapping("Kamera", "C.1", "Foto")],
      items: [item("Kamera", 300)],
    });
    const d = await compareToSnapshot(pool, "snap1");
    expect(d.changedLines).toEqual([]);
    expect(d.structureChanged).toEqual([]);
    expect(d.warnings).toEqual([]);
  });

  it("rapporterer beløpsendring uten å rope — budsjetter beveger seg", async () => {
    const { pool } = stubCompare({
      submitted: { lines: [line("C.1", "Foto", 300)], totals: { estimate: 300, approved: 0, actual: 0 } },
      mappings: [mapping("Kamera", "C.1", "Foto")],
      items: [item("Kamera", 320)],
    });
    const d = await compareToSnapshot(pool, "snap1");
    expect(d.changedLines).toHaveLength(1);
    expect(d.changedLines[0]).toMatchObject({ submitted: 300, current: 320, difference: 20 });
    // Under 10 % — ingen advarsel.
    expect(d.warnings).toEqual([]);
  });

  it("advarer når kontoplanen er endret etter innsending", async () => {
    // Det farlige tilfellet: regnskapet skal føres etter kontoplanen i det
    // godkjente kalkyleskjemaet, så en endret struktur bryter selve kravet.
    const { pool } = stubCompare({
      submitted: { lines: [line("E.1", "Klipp", 100)], totals: { estimate: 100, approved: 0, actual: 0 } },
      mappings: [mapping("Klipp", "E.9", "Klipp (ny kode)")],
      items: [item("Klipp", 100)],
    });
    const d = await compareToSnapshot(pool, "snap1");
    expect(d.structureChanged).toContain("ny post: E.9");
    expect(d.structureChanged).toContain("borte: E.1");
    expect(d.warnings.join(" ")).toMatch(/kalkyleskjema/);
  });

  it("advarer når totalen har flyttet seg mer enn 10 %", async () => {
    const { pool } = stubCompare({
      submitted: { lines: [line("C.1", "Foto", 100)], totals: { estimate: 100, approved: 0, actual: 0 } },
      mappings: [mapping("Kamera", "C.1", "Foto")],
      items: [item("Kamera", 200)],
    });
    expect((await compareToSnapshot(pool, "snap1")).warnings.join(" ")).toMatch(/mer enn 10 %/);
  });

  it("kaster på ukjent innsending", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    await expect(
      compareToSnapshot({ query } as unknown as Pool, "nope"),
    ).rejects.toThrow(/Ukjent innsending/);
  });
});
