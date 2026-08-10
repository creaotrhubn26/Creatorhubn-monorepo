import { describe, expect, it, vi } from "vitest";

import { createEducationProductionsRouter } from "./role-room-education-productions-routes.js";

function mountHandlers(router: any) {
  const out: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) {
      out.push({
        method: Object.keys(layer.route.methods)[0].toUpperCase(),
        path: layer.route.path,
        stack: layer.route.stack.map((s: any) => s.handle),
      });
    }
  }
  return out;
}
function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}
async function runChain(stack: any[], req: any, res: any) {
  for (const h of stack) {
    let nextCalled = false;
    await h(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
}

// Fake pool: ownsProject styrer casting_projects-eierskaps-sjekken.
function makePool(opts: { ownsProject?: boolean; productions?: any[] } = {}) {
  const inserts: any[] = [];
  const compatStoreWrites: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT 1 FROM casting_projects WHERE id")) {
        return { rows: opts.ownsProject ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("INSERT INTO legacy_compat_store")) {
        const [storeKey, storeValueJson] = params;
        compatStoreWrites.push({ storeKey, project: JSON.parse(storeValueJson) });
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO role_room_education_productions")) {
        const [id, owner, cohortId, projectId, title] = params;
        const row = { id, owner_user_id: owner, cohort_id: cohortId, project_id: projectId, title, assignment_count: 0, project_status: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() };
        inserts.push(row);
        return { rows: [row] };
      }
      if (sql.includes("FROM role_room_education_productions p")) {
        return { rows: opts.productions ?? [] };
      }
      if (sql.includes("DELETE FROM role_room_education_productions")) {
        return { rows: opts.ownsProject ? [{ id: params[0] }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts, compatStoreWrites };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationProductionsRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any, query?: any) => ({ headers: { authorization: "Bearer tok-1" }, body, params: params ?? {}, query: query ?? {} });

describe("education productions routes", () => {
  it("POST kobler kull til eget prosjekt → 201", async () => {
    const { pool, inserts, compatStoreWrites } = makePool({ ownsProject: true });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/productions"), authed({ title: "Kortfilm A", cohortId: "c1", projectId: "proj-1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.production).toMatchObject({ title: "Kortfilm A", cohortId: "c1", projectId: "proj-1" });
    expect(inserts[0].owner_user_id).toBe("inst-1");
    // Gjenbruk av eksisterende prosjekt (projectId gitt) → INGEN ny
    // compat-store-skriving (prosjektet finnes der fra før).
    expect(compatStoreWrites).toHaveLength(0);
  });

  it("POST med prosjekt man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsProject: false });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/productions"), authed({ title: "X", projectId: "proj-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("POST uten projectId → oppretter EKTE casting_project (bro, 201)", async () => {
    // «Ny produksjon»-broen: mangler projectId → opprett et ekte casting_projects
    // for faglæreren og koble produksjonen til det (ikke lenger 400).
    const { pool, inserts, compatStoreWrites } = makePool({ ownsProject: true });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/productions"), authed({ title: "X" }), res);
    expect(res.statusCode).toBe(201);
    expect(inserts[0]?.project_id).toBeTruthy();
    // Nytt casting_projects-prosjekt → må OGSÅ skrives til legacy
    // compat-store (casting:project:<id>), ellers finner ikke
    // produksjonsmodus-UI-et (GET /api/casting/projects) det —
    // regresjonstest for 2026-08-10-fiksen.
    expect(compatStoreWrites).toHaveLength(1);
    const [write] = compatStoreWrites;
    expect(write.storeKey).toBe(`casting:project:${inserts[0].project_id}`);
    expect(write.project).toMatchObject({
      id: inserts[0].project_id, name: "X", status: "active",
      ownerId: "inst-1", owner_id: "inst-1",
      createdBy: "inst-1", created_by: "inst-1",
    });
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/productions"), { headers: {}, body: { title: "X", projectId: "p" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET lister egne produksjoner med teller", async () => {
    const { pool } = makePool({ productions: [{ id: "ep1", title: "A", cohort_id: "c1", project_id: "proj-1", project_status: "active", assignment_count: 2, owner_user_id: "inst-1", created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/productions"), authed(), res);
    expect(res.body.productions).toHaveLength(1);
    expect(res.body.productions[0]).toMatchObject({ projectId: "proj-1", projectStatus: "active", assignmentCount: 2 });
  });

  it("DELETE ikke-eid → 404", async () => {
    const { pool } = makePool({ ownsProject: false });
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/productions/:id"), authed(undefined, { id: "ep-other" }), res);
    expect(res.statusCode).toBe(404);
  });
});
