import { describe, expect, it, vi } from "vitest";

import { createEducationCohortsRouter } from "./role-room-education-cohorts-routes.js";

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

// Fake pool: styr eierskaps-sjekker + fang inserts.
function makePool(opts: { owns?: boolean; cohorts?: any[] } = {}) {
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("INSERT INTO role_room_education_cohorts")) {
        const [id, owner, name, program, term] = params;
        const row = { id, owner_user_id: owner, name, program, term, archived: false, student_count: 0, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() };
        inserts.push({ type: "cohort", row });
        return { rows: [row] };
      }
      if (sql.includes("SELECT c.*, COUNT")) {
        return { rows: opts.cohorts ?? [] };
      }
      if (sql.includes("SELECT 1 FROM role_room_education_cohorts WHERE id")) {
        return { rows: opts.owns ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("INSERT INTO role_room_education_students")) {
        const [id, cohortId, owner, name, email] = params;
        const row = { id, cohort_id: cohortId, owner_user_id: owner, name, email, student_number: null, status: "active", created_at: new Date(0).toISOString() };
        inserts.push({ type: "student", row });
        return { rows: [row] };
      }
      if (sql.includes("DELETE FROM role_room_education_cohorts")) {
        return { rows: opts.owns ? [{ id: params[0] }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationCohortsRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any) => ({ headers: { authorization: "Bearer tok-1" }, body, params: params ?? {}, query: {} });

describe("education cohorts routes", () => {
  it("POST /education/cohorts oppretter (owner=inst-1)", async () => {
    const { pool, inserts } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/cohorts"), authed({ name: "Film 1. år", program: "Film" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.cohort).toMatchObject({ name: "Film 1. år", program: "Film", studentCount: 0 });
    expect(inserts[0].row.owner_user_id).toBe("inst-1");
  });

  it("POST /education/cohorts uten navn → 400", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/cohorts"), authed({}), res);
    expect(res.statusCode).toBe(400);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/cohorts"), { headers: {}, body: { name: "X" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET /education/cohorts lister kun egne (via SQL owner-filter)", async () => {
    const { pool } = makePool({ cohorts: [{ id: "c1", name: "A", owner_user_id: "inst-1", archived: false, student_count: 3, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/cohorts"), authed(), res);
    expect(res.body.cohorts).toHaveLength(1);
    expect(res.body.cohorts[0].studentCount).toBe(3);
  });

  it("POST student til eget kull → 201; til ikke-eid → 404", async () => {
    // eier
    const owned = makePool({ owns: true });
    const r1 = makeRes();
    await runChain(H(R(owned.pool), "POST", "/education/cohorts/:id/students"), authed({ name: "Kari" }, { id: "c1" }), r1);
    expect(r1.statusCode).toBe(201);
    expect(r1.body.student).toMatchObject({ name: "Kari", cohortId: "c1" });

    // ikke eier
    const notOwned = makePool({ owns: false });
    const r2 = makeRes();
    await runChain(H(R(notOwned.pool), "POST", "/education/cohorts/:id/students"), authed({ name: "Kari" }, { id: "c-other" }), r2);
    expect(r2.statusCode).toBe(404);
  });

  it("DELETE /education/cohorts/:id — ikke eid → 404", async () => {
    const { pool } = makePool({ owns: false });
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/cohorts/:id"), authed(undefined, { id: "c-other" }), res);
    expect(res.statusCode).toBe(404);
  });
});
