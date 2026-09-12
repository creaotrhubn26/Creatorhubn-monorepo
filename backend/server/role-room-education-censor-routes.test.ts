import { describe, expect, it, vi } from "vitest";

import { createEducationCensorRouter } from "./role-room-education-censor-routes.js";

function mountHandlers(router: any) {
  const out: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) {
      out.push({ method: Object.keys(layer.route.methods)[0].toUpperCase(), path: layer.route.path, stack: layer.route.stack.map((s: any) => s.handle) });
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

const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

function makePool(opts: { ownsCohort?: boolean; invite?: any; sess?: any; scopeOk?: boolean } = {}) {
  const { ownsCohort = true, invite, sess, scopeOk = true } = opts;
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT 1 FROM role_room_education_cohorts")) return { rows: ownsCohort ? [{ n: 1 }] : [] };
      if (sql.includes("INSERT INTO role_room_education_censor_invites")) {
        const [id, owner, cohortId] = params;
        return { rows: [{ id, owner_user_id: owner, cohort_id: cohortId, name: "Sensor Hansen", email: null, token: "tok-x", status: "pending", expires_at: FUTURE }] };
      }
      if (sql.includes("FROM role_room_education_censor_invites ci")) return { rows: invite ? [invite] : [] };
      if (sql.includes("UPDATE role_room_education_censor_invites SET status = 'accepted'")) return { rows: [] };
      if (sql.includes("INSERT INTO role_room_education_censor_sessions")) { inserts.push({ session: params }); return { rows: [] }; }
      if (sql.includes("UPDATE role_room_education_censor_sessions")) {
        return { rows: sess ? [sess] : [] };
      }
      if (sql.includes("SELECT name FROM role_room_education_cohorts")) return { rows: [{ name: "Film 1" }] };
      if (sql.includes("FROM role_room_education_students WHERE cohort_id")) return { rows: [{ id: "st1", name: "Kari" }] };
      if (sql.includes("FROM role_room_education_assignments WHERE cohort_id")) return { rows: [{ id: "a1", title: "Kortfilm" }] };
      if (sql.includes("FROM role_room_education_submissions s")) return { rows: [{ student_id: "st1", assignment_id: "a1", status: "reviewed", grade: "B", feedback: "Bra" }] };
      if (sql.includes("FROM role_room_education_censor_grades WHERE invite_id")) return { rows: [] };
      if (sql.includes("FROM role_room_education_students st, role_room_education_assignments a")) return { rows: scopeOk ? [{ n: 1 }] : [] };
      if (sql.includes("INSERT INTO role_room_education_censor_grades")) { inserts.push({ grade: params }); return { rows: [] }; }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationCensorRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any) => ({ headers: { authorization: "Bearer tok-1" }, body: body ?? {}, params: params ?? {}, query: {} });
const SESS = { invite_id: "i1", owner_user_id: "inst-1", cohort_id: "c1" };

describe("education censor routes", () => {
  it("POST invite for eid kull → 201 + token", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "POST", "/education/censor/invites"), authed({ cohortId: "c1", name: "Sensor Hansen" }), res);
    expect(res.statusCode).toBe(201);
    expect(typeof res.body.invite.token).toBe("string");
  });

  it("POST invite for kull man ikke eier → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ ownsCohort: false }).pool), "POST", "/education/censor/invites"), authed({ cohortId: "c-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("claim med gyldig invitasjon → 201 + sesjonstoken", async () => {
    const { pool, inserts } = makePool({ invite: { id: "i1", owner_user_id: "inst-1", cohort_id: "c1", status: "pending", expires_at: FUTURE, cohort_name: "Film 1" } });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/censor/claim"), { headers: {}, body: { token: "abc" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(201);
    expect(typeof res.body.sessionToken).toBe("string");
    expect(res.body.cohortName).toBe("Film 1");
    expect(inserts[0].session).toBeTruthy();
  });

  it("claim på utløpt invitasjon → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ invite: { id: "i1", owner_user_id: "inst-1", cohort_id: "c1", status: "pending", expires_at: PAST } }).pool), "POST", "/education/censor/claim"),
      { headers: {}, body: { token: "abc" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("GET view m/ sensor-sesjon → kull + studenter + faglærer-vurdering", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sess: SESS }).pool), "GET", "/education/censor/view"),
      { headers: { "x-censor-token": "stok" }, body: {}, params: {}, query: {} }, res);
    expect(res.body.cohortName).toBe("Film 1");
    expect(res.body.students[0].assignments[0]).toMatchObject({ teacherGrade: "B", submissionStatus: "reviewed" });
  });

  it("GET view uten sensor-token → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sess: null }).pool), "GET", "/education/censor/view"),
      { headers: { "x-censor-token": "bad" }, body: {}, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("PUT grade i sesjonens kull → success", async () => {
    const { pool, inserts } = makePool({ sess: SESS });
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/censor/grade"),
      { headers: { "x-censor-token": "stok" }, body: { studentId: "st1", assignmentId: "a1", grade: "A", feedback: "Sterkt" }, params: {}, query: {} }, res);
    expect(res.body.success).toBe(true);
    expect(inserts.find((x) => x.grade)).toBeTruthy();
  });

  it("PUT grade for student utenfor kullet → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sess: SESS, scopeOk: false }).pool), "PUT", "/education/censor/grade"),
      { headers: { "x-censor-token": "stok" }, body: { studentId: "s-x", assignmentId: "a-x", grade: "A" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("DELETE invite (revoke) → success", async () => {
    // reuse: DELETE matcher via UPDATE ... status='revoked' RETURNING id
    const pool: any = { query: vi.fn(async (sql: string) => sql.includes("SET status = 'revoked'") ? { rows: [{ id: "i1" }] } : { rows: [] }) };
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/censor/invites/:id"), authed({}, { id: "i1" }), res);
    expect(res.body.success).toBe(true);
  });
});
