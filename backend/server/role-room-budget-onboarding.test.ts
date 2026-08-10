import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  applyBudgetTemplate,
  getBudgetOnboardingState,
  listBudgetTemplates,
} from "./role-room-budget-onboarding.js";

/** Pool-stubb som svarer per SQL-fragment. */
function stubPool(opts: {
  projectType?: string | null;
  itemCount?: number;
  totalEstimate?: number;
  roles?: number;
  candidates?: number;
  days?: number;
  templates?: Array<Record<string, unknown>>;
}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT project_type")) {
      return { rows: [{ project_type: opts.projectType ?? null }], rowCount: 1 };
    }
    if (sql.includes("FROM role_room_budget_items")) {
      return {
        rows: [{ n: String(opts.itemCount ?? 0), total: String(opts.totalEstimate ?? 0) }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM casting_roles WHERE project_id")) {
      return {
        rows: [{ roles: opts.roles ?? 0, candidates: opts.candidates ?? 0, days: opts.days ?? 0 }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM role_room_budget_templates")) {
      return { rows: opts.templates ?? [], rowCount: (opts.templates ?? []).length };
    }
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("getBudgetOnboardingState", () => {
  it("maser ikke på et nytt prosjekt uten aktivitet", async () => {
    // Tomt budsjett er forventet her — en nudge ville bare vært støy.
    const { pool } = stubPool({ itemCount: 0 });
    const s = await getBudgetOnboardingState(pool, "p1");
    expect(s.needsOnboarding).toBe(false);
  });

  it("nudger når prosjektet er i gang men budsjettet er tomt", async () => {
    // Nøyaktig det QA fant: 0/0/0 på et aktivt prosjekt.
    const { pool } = stubPool({ itemCount: 0, roles: 4 });
    const s = await getBudgetOnboardingState(pool, "p1");
    expect(s.needsOnboarding).toBe(true);
    expect(s.reason).toMatch(/i gang/i);
  });

  it("regner kandidater og opptaksdager som aktivitet, ikke bare roller", async () => {
    expect((await getBudgetOnboardingState(stubPool({ candidates: 3 }).pool, "p1")).needsOnboarding).toBe(true);
    expect((await getBudgetOnboardingState(stubPool({ days: 2 }).pool, "p1")).needsOnboarding).toBe(true);
  });

  it("nudger når linjer finnes men ingen beløp er fylt inn", async () => {
    const { pool } = stubPool({ itemCount: 24, totalEstimate: 0, roles: 4 });
    const s = await getBudgetOnboardingState(pool, "p1");
    expect(s.needsOnboarding).toBe(true);
    expect(s.reason).toMatch(/beløp/i);
  });

  it("er fornøyd når budsjettet faktisk er i bruk", async () => {
    const { pool } = stubPool({ itemCount: 24, totalEstimate: 250000, roles: 4 });
    const s = await getBudgetOnboardingState(pool, "p1");
    expect(s.needsOnboarding).toBe(false);
  });
});

describe("listBudgetTemplates", () => {
  const templates = [
    { id: "1", template_key: "reklamefilm", name: "Reklamefilm", description: null, project_types: ["commercial"], line_count: 24 },
    { id: "2", template_key: "dokumentar", name: "Dokumentar", description: null, project_types: ["documentary"], line_count: 12 },
  ];

  it("sorterer anbefalte maler først", async () => {
    const { pool } = stubPool({ templates });
    const out = await listBudgetTemplates(pool, "documentary");
    expect(out[0].templateKey).toBe("dokumentar");
    expect(out[0].recommended).toBe(true);
  });

  it("returnerer alle maler, ikke bare de anbefalte", async () => {
    // Å skjule en mal ville gjort produktet gjettende framfor hjelpsomt.
    const { pool } = stubPool({ templates });
    expect(await listBudgetTemplates(pool, "documentary")).toHaveLength(2);
  });

  it("takler prosjekt uten type", async () => {
    const { pool } = stubPool({ templates });
    const out = await listBudgetTemplates(pool, null);
    expect(out.every((t) => !t.recommended)).toBe(true);
  });
});

describe("applyBudgetTemplate", () => {
  function stubClient(existingLines: number[] = []) {
    const queries: string[] = [];
    let lineIndex = -1;
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("FROM role_room_budget_templates")) {
          return { rows: [{ id: "t1" }], rowCount: 1 };
        }
        if (sql.includes("FROM role_room_budget_template_lines")) {
          return {
            rows: [0, 1, 2].map((i) => ({
              phase: "production", category: "Kamera", item_name: `Linje ${i}`,
              description: null, default_estimate: 0, sort_order: i,
            })),
            rowCount: 3,
          };
        }
        if (sql.includes("SELECT 1 FROM role_room_budget_items")) {
          lineIndex += 1;
          return existingLines.includes(lineIndex)
            ? { rows: [{ "?column?": 1 }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    return { pool: { connect: async () => client } as unknown as Pool, client, queries };
  }

  it("setter inn alle linjer på et tomt budsjett", async () => {
    const { pool } = stubClient();
    const out = await applyBudgetTemplate(pool, { projectId: "p1", templateKey: "reklamefilm", userId: "u1" });
    expect(out).toMatchObject({ created: 3, skipped: 0 });
  });

  it("hopper over linjer som allerede finnes, så den er trygg å kjøre igjen", async () => {
    const { pool } = stubClient([0, 1, 2]);
    const out = await applyBudgetTemplate(pool, { projectId: "p1", templateKey: "reklamefilm", userId: "u1" });
    expect(out).toMatchObject({ created: 0, skipped: 3 });
  });

  it("setter beløp til 0 — malen sier hva, ikke hvor mye", async () => {
    const { pool, queries } = stubClient();
    await applyBudgetTemplate(pool, { projectId: "p1", templateKey: "reklamefilm", userId: "u1" });
    const insert = queries.find((q) => q.includes("INSERT INTO role_room_budget_items"))!;
    // Estimatet kommer fra malens default (alltid 0), ikke fra et gjett.
    expect(insert).toContain("$6");
    expect(insert).toContain("'draft'");
  });

  it("merker linjene med hvilken mal de kom fra", async () => {
    const { pool, queries } = stubClient();
    await applyBudgetTemplate(pool, { projectId: "p1", templateKey: "reklamefilm", userId: "u1" });
    expect(queries.find((q) => q.includes("INSERT INTO role_room_budget_items"))).toContain("templateKey");
  });

  it("ruller tilbake ved ukjent mal", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM role_room_budget_templates")) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: async () => client } as unknown as Pool;
    await expect(
      applyBudgetTemplate(pool, { projectId: "p1", templateKey: "finnes-ikke", userId: "u1" }),
    ).rejects.toThrow(/Ukjent budsjettmal/);
    expect(client.query.mock.calls.some((c) => String(c[0]).includes("ROLLBACK"))).toBe(true);
  });
});
