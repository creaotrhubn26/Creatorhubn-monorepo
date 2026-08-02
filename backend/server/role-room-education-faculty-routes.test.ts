import { describe, expect, it, vi } from "vitest";

import { createEducationFacultyRouter } from "./role-room-education-faculty-routes.js";

function mountHandlers(router: any) {
  const out: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) out.push({ method: Object.keys(layer.route.methods)[0].toUpperCase(), path: layer.route.path, stack: layer.route.stack.map((s: any) => s.handle) });
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
  for (const h of stack) { let n = false; await h(req, res, () => { n = true; }); if (!n) break; }
}

function makePool(opts: { ownsFaculty?: boolean; ownsCohort?: boolean; faculty?: any[]; updated?: boolean } = {}) {
  const { ownsFaculty = true, ownsCohort = true, faculty, updated = true } = opts;
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT 1 FROM role_room_education_faculty WHERE id")) return { rows: ownsFaculty ? [{ n: 1 }] : [] };
      if (sql.includes("SELECT 1 FROM role_room_education_cohorts")) return { rows: ownsCohort ? [{ n: 1 }] : [] };
      if (sql.includes("FROM role_room_education_faculty f")) return { rows: faculty ?? [] };
      if (sql.includes("INSERT INTO role_room_education_faculty ")) {
        const [id, owner, name, email, role] = params;
        return { rows: [{ id, owner_user_id: owner, name, email, role }] };
      }
      if (sql.includes("UPDATE role_room_education_faculty")) {
        return updated ? { rows: [{ id: params[0], name: "Anne", email: null, role: "lead" }] } : { rows: [] };
      }
      if (sql.includes("DELETE FROM role_room_education_faculty WHERE")) return updated ? { rows: [{ id: params[0] }] } : { rows: [] };
      if (sql.includes("INSERT INTO role_room_education_faculty_cohorts")) { inserts.push(params); return { rows: [] }; }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationFacultyRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any) => ({ headers: { authorization: "Bearer tok-1" }, body: body ?? {}, params: params ?? {}, query: {} });

describe("education faculty routes", () => {
  it("POST oppretter (default role teacher, ugyldig → teacher)", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "POST", "/education/faculty"), authed({ name: "Anne", role: "tull" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.faculty).toMatchObject({ name: "Anne", role: "teacher" });
  });

  it("POST beholder gyldig rolle", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "POST", "/education/faculty"), authed({ name: "Anne", role: "lead" }), res);
    expect(res.body.faculty.role).toBe("lead");
  });

  it("POST uten navn → 400", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "POST", "/education/faculty"), authed({}), res);
    expect(res.statusCode).toBe(400);
  });

  it("GET lister fakultet m/ kull-ids", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ faculty: [{ id: "f1", name: "Anne", email: null, role: "lead", cohort_ids: ["c1", "c2"] }] }).pool), "GET", "/education/faculty"), authed(), res);
    expect(res.body.faculty[0]).toMatchObject({ name: "Anne", role: "lead", cohortIds: ["c1", "c2"] });
  });

  it("PATCH rolle på eid → ok; ikke eid → 404", async () => {
    const ok = makeRes();
    await runChain(H(R(makePool().pool), "PATCH", "/education/faculty/:id"), authed({ role: "lead" }, { id: "f1" }), ok);
    expect(ok.body.faculty.role).toBe("lead");
    const no = makeRes();
    await runChain(H(R(makePool({ updated: false }).pool), "PATCH", "/education/faculty/:id"), authed({ role: "lead" }, { id: "f-x" }), no);
    expect(no.statusCode).toBe(404);
  });

  it("PUT cohorts — eid fakultet, kun eide kull tildeles", async () => {
    const { pool, inserts } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/faculty/:id/cohorts"), authed({ cohortIds: ["c1", "c2"] }, { id: "f1" }), res);
    expect(res.body.success).toBe(true);
    expect(inserts).toHaveLength(2);
  });

  it("PUT cohorts — ikke eid fakultet → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ ownsFaculty: false }).pool), "PUT", "/education/faculty/:id/cohorts"), authed({ cohortIds: ["c1"] }, { id: "f-x" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("uten Bearer → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/faculty"), { headers: {}, body: {}, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });
});
