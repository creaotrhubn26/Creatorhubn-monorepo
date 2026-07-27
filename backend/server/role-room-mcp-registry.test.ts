import { describe, expect, it, vi } from "vitest";
import {
  ROLE_ROOM_CAPABILITIES, listCapabilitiesFor, findCapability, McpToolError,
  type McpCallContext,
} from "./role-room-mcp-registry.js";

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
  it("med projects.read → alle lese-verktøy", () => {
    expect(listCapabilitiesFor(["projects.read"]).length).toBe(ROLE_ROOM_CAPABILITIES.length);
  });
  it("admin arver projects.read (scope-hierarki)", () => {
    expect(listCapabilitiesFor(["admin"]).length).toBe(ROLE_ROOM_CAPABILITIES.length);
  });
  it("modus-filter «education» → kun utdannings-verktøy + globale (*)", () => {
    const names = listCapabilitiesFor(["projects.read"], "education").map((c) => c.name);
    expect(names).toContain("rr_list_cohorts");
    expect(names).toContain("rr_list_projects"); // modes:"*"
    expect(names).not.toContain("rr_list_auditions"); // kun PROD_MODES
  });
  it("modus-filter «production» → casting/produksjon, ikke utdanning", () => {
    const names = listCapabilitiesFor(["projects.read"], "production").map((c) => c.name);
    expect(names).toContain("rr_list_auditions");
    expect(names).not.toContain("rr_list_cohorts");
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
