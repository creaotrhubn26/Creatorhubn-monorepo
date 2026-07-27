import { describe, expect, it, vi } from "vitest";
import {
  ROLE_ROOM_CAPABILITIES, listCapabilitiesFor, findCapability, McpToolError,
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
