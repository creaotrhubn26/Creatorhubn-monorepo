import { describe, expect, it, vi } from "vitest";

import { createEducationStudentInvitesRouter } from "./role-room-education-student-invites-routes.js";

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

function makePool(opts: { ownsStudent?: boolean; ownsCohort?: boolean; invites?: any[] } = {}) {
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT id, email FROM role_room_education_students")) {
        return { rows: opts.ownsStudent ? [{ id: params[0], email: "kari@skole.no" }] : [] };
      }
      if (sql.includes("SELECT 1 FROM role_room_education_cohorts")) {
        return { rows: opts.ownsCohort ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("INSERT INTO role_room_education_student_invites")) {
        const [id, owner, studentId, token] = params;
        const row = { id, owner_user_id: owner, student_id: studentId, token, status: "pending", email: "kari@skole.no", accepted_at: null, created_at: new Date(0).toISOString() };
        inserts.push(row);
        return { rows: [row] };
      }
      if (sql.includes("FROM role_room_education_students st")) {
        return { rows: opts.invites ?? [] };
      }
      if (sql.includes("DELETE FROM role_room_education_student_invites")) {
        return { rows: opts.invites && opts.invites.length ? [{ id: "x" }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationStudentInvitesRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (params?: any) => ({ headers: { authorization: "Bearer tok-1" }, body: {}, params: params ?? {}, query: {} });

describe("education student invites routes", () => {
  it("POST invite for eid student → 201 + token", async () => {
    const { pool, inserts } = makePool({ ownsStudent: true });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/students/:id/invite"), authed({ id: "s1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.invite).toMatchObject({ studentId: "s1", status: "pending" });
    expect(typeof res.body.invite.token).toBe("string");
    expect(res.body.invite.token.length).toBeGreaterThan(20);
    expect(inserts[0].owner_user_id).toBe("inst-1");
  });

  it("POST invite for student man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsStudent: false });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/students/:id/invite"), authed({ id: "s-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool({ ownsStudent: true });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/students/:id/invite"), { headers: {}, body: {}, params: { id: "s1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET cohort invites — eid kull lister status per student", async () => {
    const { pool } = makePool({ ownsCohort: true, invites: [{ student_id: "s1", status: "accepted", token: "t", accepted_at: new Date(0).toISOString(), created_at: new Date(0).toISOString() }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/cohorts/:id/invites"), authed({ id: "c1" }), res);
    expect(res.body.invites).toHaveLength(1);
    expect(res.body.invites[0]).toMatchObject({ studentId: "s1", status: "accepted" });
  });

  it("GET cohort invites — ikke eid kull → 404", async () => {
    const { pool } = makePool({ ownsCohort: false });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/cohorts/:id/invites"), authed({ id: "c-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("DELETE invite — eid student, finnes → success", async () => {
    const { pool } = makePool({ ownsStudent: true, invites: [{ id: "i1" }] });
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/students/:id/invite"), authed({ id: "s1" }), res);
    expect(res.body.success).toBe(true);
  });
});
