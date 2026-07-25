import { describe, expect, it, vi } from "vitest";

import { createEducationProductionMembersRouter } from "./role-room-education-production-members-routes.js";

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

function makePool(opts: { ownsProduction?: boolean; cohortId?: string | null; ownsStudent?: boolean; members?: any[]; removed?: boolean } = {}) {
  const { ownsProduction = true, cohortId = "c1", ownsStudent = true, members, removed = true } = opts;
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT cohort_id FROM role_room_education_productions")) {
        return ownsProduction ? { rows: [{ cohort_id: cohortId }] } : { rows: [] };
      }
      if (sql.includes("SELECT 1 FROM role_room_education_students")) {
        return ownsStudent ? { rows: [{ "?column?": 1 }] } : { rows: [] };
      }
      if (sql.includes("FROM role_room_education_students st")) {
        return { rows: members ?? [] };
      }
      if (sql.includes("INSERT INTO role_room_education_production_members")) {
        inserts.push({ productionId: params[1], studentId: params[2], role: params[4] });
        return { rows: [{ student_id: params[2], role: params[4] }] };
      }
      if (sql.includes("DELETE FROM role_room_education_production_members")) {
        return { rows: removed ? [{ id: "m1" }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationProductionMembersRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any) => ({ headers: { authorization: "Bearer tok-1" }, body: body ?? {}, params: params ?? {}, query: {} });

describe("education production members routes (skole-styrt RBAC)", () => {
  it("GET members — kullets studenter m/ assigned-flagg", async () => {
    const { pool } = makePool({ members: [
      { student_id: "s1", student_name: "Kari", role: "lead", assigned: true },
      { student_id: "s2", student_name: "Ola", role: null, assigned: false },
    ] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/productions/:id/members"), authed({}, { id: "ep1" }), res);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0]).toMatchObject({ studentId: "s1", role: "lead", assigned: true });
    expect(res.body.members[1]).toMatchObject({ studentId: "s2", assigned: false });
  });

  it("PUT — tildeler student m/ rolle → 201", async () => {
    const { pool, inserts } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/productions/:id/members"), authed({ studentId: "s1", role: "lead" }, { id: "ep1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.member).toMatchObject({ studentId: "s1", role: "lead", assigned: true });
    expect(inserts[0].role).toBe("lead");
  });

  it("PUT — ugyldig rolle faller til contributor", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/productions/:id/members"), authed({ studentId: "s1", role: "hacker" }, { id: "ep1" }), res);
    expect(res.body.member.role).toBe("contributor");
  });

  it("PUT — produksjon man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsProduction: false });
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/productions/:id/members"), authed({ studentId: "s1" }, { id: "ep-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("PUT — student man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsStudent: false });
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/productions/:id/members"), authed({ studentId: "s-other" }, { id: "ep1" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("PUT — uten studentId → 400", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/productions/:id/members"), authed({}, { id: "ep1" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/productions/:id/members"), { headers: {}, body: { studentId: "s1" }, params: { id: "ep1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("DELETE — fjerner tildeling → success", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/productions/:id/members/:studentId"), authed({}, { id: "ep1", studentId: "s1" }), res);
    expect(res.body.success).toBe(true);
  });

  it("DELETE — ikke tildelt → 404", async () => {
    const { pool } = makePool({ removed: false });
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/productions/:id/members/:studentId"), authed({}, { id: "ep1", studentId: "s-x" }), res);
    expect(res.statusCode).toBe(404);
  });
});
