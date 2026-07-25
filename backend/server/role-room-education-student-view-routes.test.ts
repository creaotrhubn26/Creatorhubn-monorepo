import { describe, expect, it, vi } from "vitest";

import { createEducationStudentViewRouter } from "./role-room-education-student-view-routes.js";

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

function makePool(opts: { studentOwner?: string | null; invite?: any; sessionStudentId?: string | null } = {}) {
  const { studentOwner = "inst-1", invite, sessionStudentId } = opts;
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("FROM role_room_education_student_invites")) {
        return { rows: invite ? [invite] : [] };
      }
      if (sql.includes("UPDATE role_room_education_student_invites")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO role_room_education_student_sessions")) {
        inserts.push({ token: params[0], student_id: params[1], owner: params[2] });
        return { rows: [] };
      }
      if (sql.includes("UPDATE role_room_education_student_sessions")) {
        return { rows: sessionStudentId ? [{ student_id: sessionStudentId }] : [] };
      }
      if (sql.includes("FROM role_room_education_students s")) {
        return studentOwner === null
          ? { rows: [] }
          : { rows: [{ id: "st1", name: "Kari", owner_user_id: studentOwner, cohort_id: "c1", cohort_name: "Film 1" }] };
      }
      if (sql.includes("FROM role_room_education_productions p")) {
        return { rows: [{ id: "ep1", title: "Kortfilm", project_id: "proj-1", project_status: "active" }] };
      }
      if (sql.includes("FROM role_room_education_assignments a")) {
        return { rows: [{ id: "a1", title: "Oppg", brief: null, learning_goals: null, due_at: null, status: "published", production_title: "Kortfilm", production_project_id: "proj-1", sub_status: "submitted", grade: "B", feedback: "Bra", submitted_at: new Date(0).toISOString(), reviewed_at: null }] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map<string, any>([
  ["owner-tok", { userId: "inst-1", email: "larer@skole.no", name: "", role: "user", loginAt: "" }],
  ["admin-tok", { userId: "admin-1", email: "daniel@creatorhubn.com", name: "", role: "user", loginAt: "" }],
  ["other-tok", { userId: "other-1", email: "x@y.no", name: "", role: "user", loginAt: "" }],
]);
const R = (pool: any) => mountHandlers(createEducationStudentViewRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;

describe("education student view + claim routes", () => {
  // ── Preview-vei (Bearer) ─────────────────────────────────────────────────
  it("eier ser studentens visning", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer owner-tok" }, query: { studentId: "st1" }, params: {} }, res);
    expect(res.body.student).toMatchObject({ id: "st1", name: "Kari" });
    expect(res.body.assignments[0]).toMatchObject({ submissionStatus: "submitted", grade: "B" });
  });

  it("super admin ser fremmed student", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer admin-tok" }, query: { studentId: "st1" }, params: {} }, res);
    expect(res.statusCode).toBe(200);
  });

  it("annen bruker → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer other-tok" }, query: { studentId: "st1" }, params: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("Bearer uten studentId → 400", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer owner-tok" }, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  it("ingen auth → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: {}, query: { studentId: "st1" }, params: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  // ── Studentsesjon-vei (x-student-token) ──────────────────────────────────
  it("gyldig studentsesjon → egen visning (ignorerer studentId)", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sessionStudentId: "st1" }).pool), "GET", "/education/student/view"),
      { headers: { "x-student-token": "stok-1" }, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.student.id).toBe("st1");
  });

  it("ugyldig/utløpt studentsesjon → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sessionStudentId: null }).pool), "GET", "/education/student/view"),
      { headers: { "x-student-token": "bad" }, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  // ── Claim ────────────────────────────────────────────────────────────────
  it("claim med gyldig invitasjon → 201 + sesjonstoken", async () => {
    const { pool, inserts } = makePool({ invite: { id: "i1", student_id: "st1", owner_user_id: "inst-1", status: "pending" } });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/student/claim"),
      { headers: {}, body: { token: "invite-abc" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(201);
    expect(typeof res.body.sessionToken).toBe("string");
    expect(res.body.student).toMatchObject({ id: "st1", name: "Kari" });
    expect(inserts[0].student_id).toBe("st1");
  });

  it("claim med ukjent token → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ invite: null }).pool), "POST", "/education/student/claim"),
      { headers: {}, body: { token: "nope" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("claim på tilbaketrukket invitasjon → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ invite: { id: "i1", student_id: "st1", owner_user_id: "inst-1", status: "revoked" } }).pool), "POST", "/education/student/claim"),
      { headers: {}, body: { token: "revoked-tok" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("claim uten token → 400", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "POST", "/education/student/claim"),
      { headers: {}, body: {}, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(400);
  });
});
