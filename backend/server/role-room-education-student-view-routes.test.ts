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

function makePool(studentOwner: string | null) {
  const pool: any = {
    query: vi.fn(async (sql: string) => {
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
  return pool;
}

const sessions = new Map<string, any>([
  ["owner-tok", { userId: "inst-1", email: "larer@skole.no", name: "", role: "user", loginAt: "" }],
  ["admin-tok", { userId: "admin-1", email: "daniel@creatorhubn.com", name: "", role: "user", loginAt: "" }],
  ["other-tok", { userId: "other-1", email: "x@y.no", name: "", role: "user", loginAt: "" }],
]);
const R = (pool: any) => mountHandlers(createEducationStudentViewRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (tok: string, studentId?: string) => ({ headers: { authorization: `Bearer ${tok}` }, query: studentId ? { studentId } : {}, params: {} });

describe("education student view routes", () => {
  it("eier ser studentens visning (produksjoner + oppgaver m/ innlevering)", async () => {
    const res = makeRes();
    await runChain(H(R(makePool("inst-1")), "GET", "/education/student/view"), authed("owner-tok", "st1"), res);
    expect(res.body.student).toMatchObject({ id: "st1", name: "Kari", cohortName: "Film 1" });
    expect(res.body.productions).toHaveLength(1);
    expect(res.body.assignments[0]).toMatchObject({ submissionStatus: "submitted", grade: "B" });
  });

  it("super admin ser en student de IKKE eier", async () => {
    const res = makeRes();
    await runChain(H(R(makePool("inst-1")), "GET", "/education/student/view"), authed("admin-tok", "st1"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.student.id).toBe("st1");
  });

  it("annen bruker (ikke eier, ikke admin) → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool("inst-1")), "GET", "/education/student/view"), authed("other-tok", "st1"), res);
    expect(res.statusCode).toBe(404);
  });

  it("uten studentId → 400", async () => {
    const res = makeRes();
    await runChain(H(R(makePool("inst-1")), "GET", "/education/student/view"), authed("owner-tok"), res);
    expect(res.statusCode).toBe(400);
  });

  it("uten Bearer → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool("inst-1")), "GET", "/education/student/view"), { headers: {}, query: { studentId: "st1" }, params: {} }, res);
    expect(res.statusCode).toBe(401);
  });
});
