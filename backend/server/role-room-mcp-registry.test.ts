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
    expect(names).not.toContain("rr_get_story_graph");
  });
  it("modus-filter «game_studio» → Story Graph-verktøy + globale, ikke casting/dans", () => {
    const names = listCapabilitiesFor(["projects.read"], "game_studio").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["rr_get_story_graph", "rr_list_story_components", "rr_validate_story_graph", "rr_export_story_graph", "rr_list_game_scenes", "rr_game_scene_review_status", "rr_list_projects"]));
    expect(listCapabilitiesFor(["projects.read"], "production").map((c) => c.name)).not.toContain("rr_list_game_scenes");
    expect(names).not.toContain("rr_list_auditions");
    expect(names).not.toContain("rr_list_dance_pieces");
    expect(names).not.toContain("rr_list_cohorts");
    expect(names).not.toContain("rr_draft_element"); // krever projects.write
    expect(listCapabilitiesFor(["projects.write"], "game_studio").map((c) => c.name)).toContain("rr_draft_element");
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

describe("Fase 3 Story Graph-verktøy (eksport + utkast-element)", () => {
  const WRITE_CTX: McpCallContext = { userId: "u1", scopes: ["projects.write"], apiKeyId: "k1" };
  const access = { match: /UNION[\s\S]*casting_user_roles/, rows: [{ "?column?": 1 }] };
  const graphRows = [
    { match: /FROM narrative_settings WHERE project_id/, rows: [{ project_id: "p1", title: "Demo", starting_element_id: "nel_1", cover_asset_id: null, schema_version: 1, updated_at: null }] },
    { match: /FROM narrative_boards WHERE project_id/, rows: [{ id: "nbd_1", project_id: "p1", name: "Akt 1", custom_id: null, folder_path: "", sort_order: 0, viewport: {}, created_at: new Date(), updated_at: new Date() }] },
    { match: /FROM narrative_elements WHERE project_id/, rows: [{ id: "nel_1", project_id: "p1", board_id: "nbd_1", kind: "element", title_html: "<p>Start</p>", content_html: "<p>Hei</p>", x: 0, y: 0, width: 260, height: 120, theme: "default", cover_asset_id: null, custom_id: "start", jumper_target_id: null, branch_conditions: [], version: 1, sort_order: 0, created_at: new Date(), updated_at: new Date() }] },
  ];
  it("rr_export_story_graph → Arcweave project.json med strippede ider", async () => {
    const out = await findCapability("rr_export_story_graph")!.handler(makePool([access, ...graphRows]), CTX, { projectId: "p1" }) as { format: string; project: { name: string; startingElement: string; elements: Record<string, { title: string }> } };
    expect(out.format).toBe("arcweave");
    expect(out.project.name).toBe("Demo");
    const [eid] = Object.keys(out.project.elements);
    expect(out.project.startingElement).toBe(eid);
    expect(out.project.elements[eid].title).toBe("<p>Start</p>");
  });
  it("rr_export_story_graph format=csv", async () => {
    const out = await findCapability("rr_export_story_graph")!.handler(makePool([access, ...graphRows]), CTX, { projectId: "p1", format: "csv" }) as { format: string; csv: string };
    expect(out.format).toBe("csv");
    expect(out.csv.startsWith("\uFEFFBrett;")).toBe(true);
  });

  it("rr_export_story_graph format=markdown", async () => {
    const out = await findCapability("rr_export_story_graph")!.handler(makePool([access, ...graphRows]), CTX, { projectId: "p1", format: "markdown" }) as { format: string; markdown: string };
    expect(out.format).toBe("markdown");
    expect(out.markdown).toContain("# Demo");
    expect(out.markdown).toContain("### Start `start` ▶");
  });
  it("rr_draft_element er mutates og oppretter brettet «KI-utkast» ved behov + ukoblet element", async () => {
    const cap = findCapability("rr_draft_element")!;
    expect(cap.mutates).toBe(true);
    expect(cap.modes).toEqual(["game_studio"]);
    const pool = makePool([
      access,
      { match: /SELECT id FROM narrative_boards WHERE project_id = \$1 AND name = 'KI-utkast'/, rows: [] },
      { match: /INSERT INTO narrative_boards/, rows: [{ id: "nbd_draft", project_id: "p1", name: "KI-utkast", custom_id: null, folder_path: "Utkast", sort_order: 0, viewport: {}, created_at: new Date(), updated_at: new Date() }] },
      { match: /SELECT COUNT\(\*\)::int AS n FROM narrative_elements/, rows: [{ n: 2 }] },
      { match: /INSERT INTO narrative_elements/, rows: [{ id: "nel_new", project_id: "p1", board_id: "nbd_draft", kind: "element", title_html: "<p>Utkast</p>", content_html: "<p>Tekst</p>", x: 680, y: 40, width: 260, height: 120, theme: "amber", cover_asset_id: null, custom_id: null, jumper_target_id: null, branch_conditions: [], version: 1, sort_order: 0, created_at: new Date(), updated_at: new Date() }] },
    ]);
    const out = await cap.handler(pool, WRITE_CTX, { projectId: "p1", title: "Utkast", content: "Tekst\n\n> gold += 1" }) as { ok: boolean; id: string; boardId: string; status: string };
    expect(out).toMatchObject({ ok: true, id: "nel_new", boardId: "nbd_draft", status: "draft" });
    const insertCall = (pool.query as any).mock.calls.find((c: unknown[]) => /INSERT INTO narrative_elements/.test(String(c[0])));
    expect(insertCall[1][2]).toBe("nbd_draft");
    expect(insertCall[1][5]).toBe("<p>Tekst</p><pre><code>gold += 1</code></pre>");
  });
  it("rr_draft_element uten title → -32602", async () => {
    await expect(findCapability("rr_draft_element")!.handler(makePool([access]), WRITE_CTX, { projectId: "p1" })).rejects.toMatchObject({ code: -32602 });
  });
});

describe("Fase 6: scene-verktøy (game_studio)", () => {
  const access = { match: /UNION[\s\S]*casting_user_roles/, rows: [{ "?column?": 1 }] };
  const sceneRow = { id: "nsc_1", project_id: "p1", code: "S1", title: "Skogpassasjen", subtitle: "", location: "Skogen", challenge: "", gameplay_mechanic: "", environment: "", status: "in_review", assignee_user_id: "u2", due_at: null, hero_asset_id: null, sort_order: 0, created_by: "u1", created_at: new Date(), updated_at: new Date() };
  it("rr_list_game_scenes → kode/status/siste runde, filtrerbar på status", async () => {
    const pool = makePool([access,
      { match: /FROM narrative_scenes WHERE project_id = \$1 ORDER BY/, rows: [sceneRow, { ...sceneRow, id: "nsc_2", code: "S2", status: "idea" }] },
      { match: /DISTINCT ON \(scene_id\)/, rows: [{ id: "nsr_1", scene_id: "nsc_1", round: 1, status: "in_review", requested_at: new Date(), decided_at: null }] },
    ]);
    const all = await findCapability("rr_list_game_scenes")!.handler(pool, CTX, { projectId: "p1" }) as { scenes: Array<{ code: string; latestReview: { round: number } | null }> };
    expect(all.scenes.map((s) => s.code)).toEqual(["S1", "S2"]);
    expect(all.scenes[0].latestReview).toMatchObject({ round: 1 });
    const filtered = await findCapability("rr_list_game_scenes")!.handler(pool, CTX, { projectId: "p1", status: "idea" }) as { scenes: unknown[] };
    expect(filtered.scenes).toHaveLength(1);
  });
  it("rr_game_scene_review_status → åpen runde markeres stale når hash avviker", async () => {
    const pool = makePool([access,
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [sceneRow] },
      { match: /FROM narrative_scene_reviews WHERE scene_id/, rows: [{ id: "nsr_1", scene_id: "nsc_1", project_id: "p1", round: 1, status: "in_review", requested_by: "u1", requested_at: new Date(), request_note: null, decided_by_user_id: null, decided_by_label: null, decided_at: null, decision_note: null, snapshot_hash: "f".repeat(64) }] },
    ]);
    const out = await findCapability("rr_game_scene_review_status")!.handler(pool, CTX, { projectId: "p1", sceneId: "nsc_1" }) as { openRound: { round: number; stale: boolean } | null; rounds: unknown[] };
    expect(out.openRound).toMatchObject({ round: 1, stale: true });
    expect(out.rounds).toHaveLength(1);
  });
});
