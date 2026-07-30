import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  applyChecklistTemplate,
  computeDueDate,
  listChecklistTemplates,
} from "./role-room-checklist-templates.js";

describe("computeDueDate", () => {
  it("regner bakover fra opptaksstart", () => {
    // -30 dager fra 1. september = 2. august.
    expect(computeDueDate("2026-09-01", -30)?.slice(0, 10)).toBe("2026-08-02");
  });

  it("regner framover for etterarbeid", () => {
    expect(computeDueDate("2026-09-01", 7)?.slice(0, 10)).toBe("2026-09-08");
  });

  it("gir opptaksdagen selv ved offset 0", () => {
    expect(computeDueDate("2026-09-01", 0)?.slice(0, 10)).toBe("2026-09-01");
  });

  it("returnerer null uten opptaksdato — en feil frist er verre enn ingen", () => {
    expect(computeDueDate(null, -30)).toBeNull();
  });

  it("returnerer null når malpunktet ikke har offset", () => {
    expect(computeDueDate("2026-09-01", null)).toBeNull();
  });

  it("krysser månedsskifte riktig", () => {
    expect(computeDueDate("2026-03-01", -1)?.slice(0, 10)).toBe("2026-02-28");
  });

  it("krysser skuddår riktig", () => {
    expect(computeDueDate("2028-03-01", -1)?.slice(0, 10)).toBe("2028-02-29");
  });

  it("krysser årsskifte riktig", () => {
    expect(computeDueDate("2027-01-05", -10)?.slice(0, 10)).toBe("2026-12-26");
  });

  it("flytter seg ikke over sommertidsskiftet", () => {
    // Norsk sommertid slutter siste søndag i oktober. Datoregning på lokale
    // komponenter kunne bommet med én dag her.
    expect(computeDueDate("2026-10-26", -1)?.slice(0, 10)).toBe("2026-10-25");
    expect(computeDueDate("2026-03-30", -1)?.slice(0, 10)).toBe("2026-03-29");
  });

  it("takler Date-objekt som utgangspunkt", () => {
    expect(computeDueDate(new Date(2026, 8, 1), -30)?.slice(0, 10)).toBe("2026-08-02");
  });
});

function stubTemplates(rows: Array<Record<string, unknown>>) {
  return { query: vi.fn(async () => ({ rows, rowCount: rows.length })) } as unknown as Pool;
}

describe("listChecklistTemplates", () => {
  const rows = [
    { id: "1", template_key: "reklame-standard", name: "Reklame", description: null, project_types: ["commercial"], item_count: 18 },
    { id: "2", template_key: "drama-standard", name: "Drama", description: null, project_types: ["video"], item_count: 18 },
  ];

  it("sorterer anbefalte først", async () => {
    const out = await listChecklistTemplates(stubTemplates(rows), "video");
    expect(out[0].templateKey).toBe("drama-standard");
    expect(out[0].recommended).toBe(true);
  });

  it("returnerer alle maler uansett", async () => {
    expect(await listChecklistTemplates(stubTemplates(rows), "video")).toHaveLength(2);
  });

  it("markerer ingen som anbefalt uten prosjekttype", async () => {
    const out = await listChecklistTemplates(stubTemplates(rows), null);
    expect(out.every((t) => !t.recommended)).toBe(true);
  });
});

describe("applyChecklistTemplate", () => {
  function stubClient(opts: { anchor?: string | null; existing?: number[] } = {}) {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    let idx = -1;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes("FROM role_room_checklist_templates")) return { rows: [{ id: "t1" }], rowCount: 1 };
        if (sql.includes("MIN(date)")) {
          return { rows: [{ first_day: opts.anchor === undefined ? "2026-09-01" : opts.anchor }], rowCount: 1 };
        }
        if (sql.includes("FROM role_room_checklist_template_items")) {
          return {
            rows: [
              { phase: "preproduction", title: "Bekreft brief", description: null, day_offset: -30, sort_order: 1 },
              { phase: "production", title: "Opptak", description: null, day_offset: 0, sort_order: 2 },
              { phase: "postproduction", title: "Lever", description: null, day_offset: 7, sort_order: 3 },
            ],
            rowCount: 3,
          };
        }
        if (sql.includes("SELECT 1 FROM role_room_phase_timeline_items")) {
          idx += 1;
          return (opts.existing ?? []).includes(idx)
            ? { rows: [{ "?column?": 1 }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    return { pool: { connect: async () => client } as unknown as Pool, client, queries };
  }

  it("oppretter alle punkter på tom tidslinje", async () => {
    const { pool } = stubClient();
    const out = await applyChecklistTemplate(pool, { projectId: "p1", templateKey: "reklame-standard", userId: "u1" });
    expect(out).toMatchObject({ created: 3, skipped: 0, anchorDate: "2026-09-01" });
  });

  it("hopper over punkter som allerede finnes", async () => {
    const { pool } = stubClient({ existing: [0, 2] });
    const out = await applyChecklistTemplate(pool, { projectId: "p1", templateKey: "reklame-standard", userId: "u1" });
    expect(out).toMatchObject({ created: 1, skipped: 2 });
  });

  it("regner frister fra første opptaksdag", async () => {
    const { pool, queries } = stubClient({ anchor: "2026-09-01" });
    await applyChecklistTemplate(pool, { projectId: "p1", templateKey: "reklame-standard", userId: "u1" });
    const inserts = queries.filter((q) => q.sql.includes("INSERT INTO role_room_phase_timeline_items"));
    expect(String(inserts[0].params[4]).slice(0, 10)).toBe("2026-08-02"); // -30
    expect(String(inserts[2].params[4]).slice(0, 10)).toBe("2026-09-08"); // +7
  });

  it("lar frister stå tomme når prosjektet ikke har opptaksdager", async () => {
    const { pool, queries } = stubClient({ anchor: null });
    const out = await applyChecklistTemplate(pool, { projectId: "p1", templateKey: "reklame-standard", userId: "u1" });
    expect(out.anchorDate).toBeNull();
    const inserts = queries.filter((q) => q.sql.includes("INSERT INTO role_room_phase_timeline_items"));
    expect(inserts.every((i) => i.params[4] === null)).toBe(true);
  });

  it("merker punktene med hvilken mal de kom fra", async () => {
    const { pool, queries } = stubClient();
    await applyChecklistTemplate(pool, { projectId: "p1", templateKey: "reklame-standard", userId: "u1" });
    expect(queries.find((q) => q.sql.includes("INSERT INTO role_room_phase_timeline_items"))!.sql)
      .toContain("templateKey");
  });

  it("ruller tilbake ved ukjent mal", async () => {
    const client = {
      query: vi.fn(async (sql: string) => ({ rows: [], rowCount: 0 })),
      release: vi.fn(),
    };
    const pool = { connect: async () => client } as unknown as Pool;
    await expect(
      applyChecklistTemplate(pool, { projectId: "p1", templateKey: "nope", userId: "u1" }),
    ).rejects.toThrow(/Ukjent sjekkliste-mal/);
    expect(client.query.mock.calls.some((c) => String(c[0]).includes("ROLLBACK"))).toBe(true);
  });
});
