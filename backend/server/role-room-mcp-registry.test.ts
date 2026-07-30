import { describe, expect, it, vi } from "vitest";
import {
  ROLE_ROOM_CAPABILITIES, listCapabilitiesFor, findCapability, McpToolError,
  readPageArgs, buildPageInfo, paginateArray, isDraftEntityType,
  type McpCallContext,
} from "./role-room-mcp-registry.js";
import { extractApiKey } from "./role-room-mcp-routes.js";

describe("extractApiKey (Bearer eller x-api-key)", () => {
  const mk = (headers: Record<string, string>) => ({ headers } as any);
  it("leser Authorization: Bearer rri_…", () => {
    expect(extractApiKey(mk({ authorization: "Bearer rri_abc" }))).toBe("rri_abc");
    expect(extractApiKey(mk({ authorization: "bearer rri_xyz" }))).toBe("rri_xyz");
  });
  it("faller tilbake til x-api-key", () => {
    expect(extractApiKey(mk({ "x-api-key": "rri_k" }))).toBe("rri_k");
  });
  it("uten noe → undefined", () => {
    expect(extractApiKey(mk({}))).toBeUndefined();
  });
});

const CTX: McpCallContext = { userId: "u1", scopes: ["projects.read"], apiKeyId: "k1" };

/** Fake pool: styr svar per SQL-fragment. */
function makePool(handlers: Array<{ match: RegExp; rows: unknown[] }>) {
  return {
    query: vi.fn(async (sql: string) => {
      for (const h of handlers) if (h.match.test(sql)) return { rows: h.rows, rowCount: h.rows.length };
      return { rows: [], rowCount: 0 };
    }),
  } as any;
}

describe("listCapabilitiesFor (scope + modus-filter)", () => {
  it("uten projects.read → ingen verktøy", () => {
    expect(listCapabilitiesFor([])).toHaveLength(0);
  });
  it("med projects.read → alle lese-verktøy (ikke utkast/skriv)", () => {
    const readOnly = ROLE_ROOM_CAPABILITIES.filter((c) => c.scope === "projects.read");
    expect(listCapabilitiesFor(["projects.read"]).length).toBe(readOnly.length);
    expect(listCapabilitiesFor(["projects.read"]).map((c) => c.name)).not.toContain("rr_draft_task");
  });
  it("admin arver alt inkl. skrive-verktøy (scope-hierarki)", () => {
    expect(listCapabilitiesFor(["admin"]).length).toBe(ROLE_ROOM_CAPABILITIES.length);
  });
  it("projects.write ser BÅDE lese- og utkast-verktøy", () => {
    const names = listCapabilitiesFor(["projects.write"]).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["rr_list_projects", "rr_draft_task", "rr_draft_budget_item"]));
  });
  it("modus-filter «education» → kun utdannings-verktøy + globale (*)", () => {
    const names = listCapabilitiesFor(["projects.read"], "education").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["rr_list_cohorts", "rr_list_assignments", "rr_list_courses", "rr_list_projects"]));
    expect(names).not.toContain("rr_list_auditions"); // kun PROD_MODES
    expect(names).not.toContain("rr_list_roles");
  });
  it("modus-filter «production» → casting/produksjon/producer, ikke utdanning", () => {
    const names = listCapabilitiesFor(["projects.read"], "production").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["rr_list_auditions", "rr_list_roles", "rr_list_timeline", "rr_list_budget_items", "rr_list_offers"]));
    expect(names).not.toContain("rr_list_cohorts");
    expect(names).not.toContain("rr_list_assignments");
    expect(names).not.toContain("rr_list_dance_pieces");
  });
  it("modus-filter «dance_studio» → dans-verktøy, ikke casting/utdanning", () => {
    const names = listCapabilitiesFor(["projects.read"], "dance_studio").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["rr_list_dance_pieces", "rr_list_dance_classes", "rr_list_dance_instructors"]));
    expect(names).not.toContain("rr_list_roles");
    expect(names).not.toContain("rr_list_assignments");
  });
  it("modus-filter «dance_freelance» → kun frilans-relevant dans (ikke klasser/instruktører)", () => {
    const names = listCapabilitiesFor(["projects.read"], "dance_freelance").map((c) => c.name);
    expect(names).toContain("rr_list_dance_pieces");
    expect(names).toContain("rr_list_dance_performances");
    expect(names).not.toContain("rr_list_dance_classes");
  });
});

describe("prosjekt-tilgang (fail-closed)", () => {
  it("rr_get_project uten tilgang → -32004", async () => {
    const pool = makePool([{ match: /casting_projects WHERE id = \$1 AND created_by/, rows: [] }]);
    const cap = findCapability("rr_get_project")!;
    await expect(cap.handler(pool, CTX, { projectId: "p1" })).rejects.toBeInstanceOf(McpToolError);
  });
  it("rr_get_project uten projectId → -32602", async () => {
    const cap = findCapability("rr_get_project")!;
    await expect(cap.handler(makePool([]), CTX, {})).rejects.toMatchObject({ code: -32602 });
  });
  it("rr_get_project med tilgang → returnerer prosjekt", async () => {
    const pool = makePool([
      { match: /UNION[\s\S]*casting_user_roles/, rows: [{ "?column?": 1 }] }, // access-sjekk
      { match: /SELECT id, name, description, status, project_type/, rows: [{ id: "p1", name: "Kortfilm" }] },
    ]);
    const cap = findCapability("rr_get_project")!;
    const out = await cap.handler(pool, CTX, { projectId: "p1" }) as { project: { name: string } };
    expect(out.project.name).toBe("Kortfilm");
  });
});

describe("rr_list_projects", () => {
  it("returnerer eide/medlems-prosjekter", async () => {
    const pool = makePool([{ match: /FROM casting_projects p/, rows: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] }]);
    const cap = findCapability("rr_list_projects")!;
    const out = await cap.handler(pool, CTX, {}) as { projects: unknown[] };
    expect(out.projects).toHaveLength(2);
  });
});

describe("rr_list_students (eier-sjekk på kull)", () => {
  it("ikke-eid kull → -32004", async () => {
    const pool = makePool([{ match: /role_room_education_cohorts WHERE id = \$1 AND owner_user_id/, rows: [] }]);
    const cap = findCapability("rr_list_students")!;
    await expect(cap.handler(pool, CTX, { cohortId: "c1" })).rejects.toMatchObject({ code: -32004 });
  });
});

describe("Fase 2 utkast-verktøy (skriver kun upubliserte utkast)", () => {
  const WRITE_CTX: McpCallContext = { userId: "u1", scopes: ["projects.write"], apiKeyId: "k1" };
  it("rr_draft_task er merket mutates (→ readOnlyHint false)", () => {
    expect(findCapability("rr_draft_task")!.mutates).toBe(true);
    expect(findCapability("rr_list_projects")!.mutates).toBeFalsy();
  });
  it("rr_draft_task uten title → -32602", async () => {
    const pool = makePool([{ match: /UNION[\s\S]*casting_user_roles/, rows: [{ "?column?": 1 }] }]);
    await expect(findCapability("rr_draft_task")!.handler(pool, WRITE_CTX, { projectId: "p1" })).rejects.toMatchObject({ code: -32602 });
  });
  it("rr_draft_task oppretter draft (status=draft, RETURNING id)", async () => {
    const pool = makePool([
      { match: /UNION[\s\S]*casting_user_roles/, rows: [{ "?column?": 1 }] },
      { match: /INSERT INTO role_room_phase_timeline_items/, rows: [{ id: "new-id" }] },
    ]);
    const out = await findCapability("rr_draft_task")!.handler(pool, WRITE_CTX, { projectId: "p1", title: "Oppgave" }) as { status: string; id: string };
    expect(out).toMatchObject({ status: "draft", id: "new-id" });
  });
});

describe("rr_search_talents (byrå-scopet, samtykke-gated PII)", () => {
  it("er read-only, byrå-scopet (ikke prosjekt-scopet), i produksjons-moduser", () => {
    const cap = findCapability("rr_search_talents")!;
    expect(cap.mutates).toBeFalsy();
    expect(cap.projectScoped).toBe(false);
    expect(cap.scope).toBe("projects.read");
    expect(cap.modes).toContain("production");
  });
  it("bruker uten byrå → -32004 (fetchAgencyForUser → ingen rad)", async () => {
    const pool = makePool([{ match: /agency_orgs/, rows: [] }]);
    await expect(findCapability("rr_search_talents")!.handler(pool, CTX, {})).rejects.toMatchObject({ code: -32004 });
  });
  it("byrå-bruker → maskerte, consent-gatede treff (gjenbruker maskByScopes)", async () => {
    const pool = makePool([
      { match: /agency_orgs/, rows: [{ id: "ag1", type: "stella_casting", name: "Stella" }] },
      { match: /talent_consent_registry/, rows: [
        { id: "t1", granted_scopes: ["basic_profile"], display_name: "Kari", showreel_url: "http://x" },
      ] },
    ]);
    const out = await findCapability("rr_search_talents")!.handler(pool, CTX, { limit: 10 }) as {
      agency: { name: string }; count: number; talents: Array<Record<string, unknown>>;
    };
    expect(out.agency.name).toBe("Stella");
    expect(out.count).toBe(1);
    // basic_profile delt → navn eksponert; media_portfolio IKKE delt → showreel maskert bort
    expect(out.talents[0].display_name).toBe("Kari");
    expect(out.talents[0].has_showreel).toBeUndefined();
    expect(out.talents[0].availability_visible).toBe(false);
  });
});

// ── Del A punkt 140: total + paginering ──────────────────────────────────────

describe("readPageArgs", () => {
  it("bruker defaults når ingenting er oppgitt", () => {
    expect(readPageArgs({}, 50, 200)).toEqual({ limit: 50, offset: 0 });
  });
  it("klipper limit mot maks", () => {
    expect(readPageArgs({ limit: 9999 }, 50, 200).limit).toBe(200);
  });
  it("faller tilbake til default ved ugyldig limit framfor å feile", () => {
    expect(readPageArgs({ limit: 0 }, 50, 200).limit).toBe(50);
    expect(readPageArgs({ limit: -5 }, 50, 200).limit).toBe(50);
    expect(readPageArgs({ limit: "mange" }, 50, 200).limit).toBe(50);
  });
  it("avrunder desimaler ned", () => {
    expect(readPageArgs({ limit: 10.9, offset: 5.7 }, 50, 200)).toEqual({ limit: 10, offset: 5 });
  });
  it("negativ offset behandles som 0", () => {
    expect(readPageArgs({ offset: -3 }, 50, 200).offset).toBe(0);
  });
});

describe("buildPageInfo", () => {
  it("hasMore er true når det gjenstår rader", () => {
    expect(buildPageInfo(54, { limit: 50, offset: 0 })).toEqual({
      total: 54, limit: 50, offset: 0, hasMore: true,
    });
  });
  it("hasMore er false på siste side", () => {
    expect(buildPageInfo(54, { limit: 50, offset: 50 }).hasMore).toBe(false);
  });
  it("hasMore er false når totalen får plass på én side", () => {
    expect(buildPageInfo(50, { limit: 50, offset: 0 }).hasMore).toBe(false);
  });
});

describe("paginateArray (JSONB-blob-listene)", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ i }));
  it("skjærer riktig vindu og oppgir total", () => {
    const out = paginateArray("offers", items, { limit: 5, offset: 5 }) as {
      offers: unknown[]; pagination: { total: number; hasMore: boolean };
    };
    expect(out.offers).toHaveLength(5);
    expect(out.offers[0]).toEqual({ i: 5 });
    expect(out.pagination.total).toBe(12);
    expect(out.pagination.hasMore).toBe(true);
  });
  it("tom liste gir total 0 og hasMore false", () => {
    const out = paginateArray("offers", [], {}) as { pagination: { total: number; hasMore: boolean } };
    expect(out.pagination).toMatchObject({ total: 0, hasMore: false });
  });
});

describe("list-verktøy returnerer pagination", () => {
  it("rr_list_projects oppgir total fra COUNT, ikke antall rader på siden", async () => {
    const pool = makePool([
      { match: /COUNT\(DISTINCT p\.id\)/, rows: [{ total: 54 }] },
      { match: /FROM casting_projects p/, rows: [{ id: "p1" }, { id: "p2" }] },
    ]);
    const out = await findCapability("rr_list_projects")!.handler(pool, CTX, { limit: 50 }) as {
      projects: unknown[]; pagination: { total: number; hasMore: boolean };
    };
    expect(out.projects).toHaveLength(2);
    // Nettopp diskrepansen punkt 140 handler om: siden viser 2, totalen er 54.
    expect(out.pagination.total).toBe(54);
    expect(out.pagination.hasMore).toBe(true);
  });

  it("alle list-verktøy tar limit/offset i skjemaet", () => {
    const listTools = ROLE_ROOM_CAPABILITIES.filter(
      (c) => c.name.startsWith("rr_list_") && c.name !== "rr_list_drafts",
    );
    expect(listTools.length).toBeGreaterThan(15);
    for (const t of listTools) {
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(props, `${t.name} mangler limit`).toHaveProperty("limit");
      expect(props, `${t.name} mangler offset`).toHaveProperty("offset");
    }
  });
});

// ── Del A punkt 141: list / hent / slett utkast ──────────────────────────────

describe("utkast-forvaltning", () => {
  const WRITE_CTX: McpCallContext = { userId: "u1", scopes: ["projects.write"], apiKeyId: "k1" };
  const ACCESS = { match: /UNION[\s\S]*casting_user_roles/, rows: [{ "?column?": 1 }] };

  it("verktøyene finnes og rr_delete_draft er merket mutates", () => {
    expect(findCapability("rr_list_drafts")).toBeDefined();
    expect(findCapability("rr_get_draft")).toBeDefined();
    expect(findCapability("rr_delete_draft")!.mutates).toBe(true);
    // Lesing skal ikke være merket som skriving.
    expect(findCapability("rr_list_drafts")!.mutates).toBeFalsy();
  });

  it("isDraftEntityType godtar kjente typer og avviser ukjente", () => {
    expect(isDraftEntityType("task")).toBe(true);
    expect(isDraftEntityType("budget_item")).toBe(true);
    expect(isDraftEntityType("casting_candidates")).toBe(false);
    expect(isDraftEntityType("")).toBe(false);
  });

  it("ukjent entityType → -32602", async () => {
    const pool = makePool([ACCESS]);
    await expect(
      findCapability("rr_delete_draft")!.handler(pool, WRITE_CTX, {
        projectId: "p1", entityType: "casting_candidates", draftId: "x",
      }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it("sletting krever agent-markør, utkast-status og upublisert", async () => {
    const pool = makePool([ACCESS, { match: /DELETE FROM/, rows: [{ id: "d1" }] }]);
    await findCapability("rr_delete_draft")!.handler(pool, WRITE_CTX, {
      projectId: "p1", entityType: "task", draftId: "d1",
    });
    const sql = (pool.query as unknown as { mock: { calls: string[][] } }).mock.calls
      .map((c) => c[0]).find((s) => s.includes("DELETE FROM"))!;
    expect(sql).toContain("metadata->>'source' = 'mcp'");
    expect(sql).toContain("status IN ('draft')");
    expect(sql).toContain("published_at IS NULL");
    expect(sql).toContain("project_id = $2");
  });

  it("sletting av noe som ikke er et agent-utkast → -32004", async () => {
    const pool = makePool([ACCESS, { match: /DELETE FROM/, rows: [] }]);
    await expect(
      findCapability("rr_delete_draft")!.handler(pool, WRITE_CTX, {
        projectId: "p1", entityType: "task", draftId: "publisert-rad",
      }),
    ).rejects.toMatchObject({ code: -32004 });
  });

  it("review-utkast vokter på status pending, ikke draft", async () => {
    const pool = makePool([ACCESS, { match: /DELETE FROM/, rows: [{ id: "r1" }] }]);
    await findCapability("rr_delete_draft")!.handler(pool, WRITE_CTX, {
      projectId: "p1", entityType: "review", draftId: "r1",
    });
    const sql = (pool.query as unknown as { mock: { calls: string[][] } }).mock.calls
      .map((c) => c[0]).find((s) => s.includes("DELETE FROM"))!;
    expect(sql).toContain("status IN ('pending')");
  });

  it("rr_list_drafts spør bare etter MCP-merkede rader", async () => {
    const pool = makePool([
      ACCESS,
      { match: /COUNT\(\*\)/, rows: [{ total: 3 }] },
      { match: /UNION ALL/, rows: [{ entity_type: "task", id: "d1" }] },
    ]);
    const out = await findCapability("rr_list_drafts")!.handler(pool, CTX, { projectId: "p1" }) as {
      drafts: unknown[]; pagination: { total: number };
    };
    expect(out.pagination.total).toBe(3);
    const sql = (pool.query as unknown as { mock: { calls: string[][] } }).mock.calls
      .map((c) => c[0]).find((s) => s.includes("UNION ALL"))!;
    expect(sql).toContain("metadata->>'source' = 'mcp'");
  });
});
