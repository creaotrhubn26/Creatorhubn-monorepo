import { describe, expect, it, vi } from "vitest";

import { createEducationAssignmentsRouter } from "./role-room-education-assignments-routes.js";

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

// Fake pool: styr eierskap + fang inserts.
function makePool(opts: { ownsAssignment?: boolean; ownsStudent?: boolean; assignments?: any[] } = {}) {
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("INSERT INTO role_room_education_assignments")) {
        const [id, owner, cohortId, productionId, title] = params;
        const row = { id, owner_user_id: owner, cohort_id: cohortId, production_id: productionId, title, brief: null, learning_goals: null, due_at: null, status: "draft", submitted_count: 0, reviewed_count: 0, production_title: null, production_project_id: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() };
        inserts.push({ type: "assignment", row });
        return { rows: [row] };
      }
      if (sql.includes("FROM role_room_education_assignments a")) {
        return { rows: opts.assignments ?? [] };
      }
      // ownedAssignment-sjekk
      if (sql.includes("SELECT * FROM role_room_education_assignments WHERE id")) {
        return { rows: opts.ownsAssignment ? [{ id: params[0], owner_user_id: params[1], cohort_id: "c1" }] : [] };
      }
      if (sql.includes("SELECT 1 FROM role_room_education_students WHERE id")) {
        return { rows: opts.ownsStudent ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("INSERT INTO role_room_education_submissions")) {
        const [id, assignmentId, studentId, owner, status] = params;
        const row = { id, assignment_id: assignmentId, student_id: studentId, owner_user_id: owner, status, note: null, submitted_at: status === "not_started" ? null : new Date(0).toISOString() };
        inserts.push({ type: "submission", row });
        return { rows: [row] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationAssignmentsRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any, query?: any) => ({ headers: { authorization: "Bearer tok-1" }, body, params: params ?? {}, query: query ?? {} });

describe("education assignments routes", () => {
  it("POST /education/assignments oppretter (owner=inst-1, default draft)", async () => {
    const { pool, inserts } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/assignments"), authed({ title: "Kortfilm", cohortId: "c1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.assignment).toMatchObject({ title: "Kortfilm", cohortId: "c1", status: "draft" });
    expect(inserts[0].row.owner_user_id).toBe("inst-1");
  });

  it("POST /education/assignments uten tittel → 400", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/assignments"), authed({}), res);
    expect(res.statusCode).toBe(400);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/assignments"), { headers: {}, body: { title: "X" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET /education/assignments lister med teller", async () => {
    const { pool } = makePool({ assignments: [{ id: "a1", title: "A", cohort_id: "c1", owner_user_id: "inst-1", status: "published", submitted_count: 2, reviewed_count: 1, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/assignments"), authed(), res);
    expect(res.body.assignments).toHaveLength(1);
    expect(res.body.assignments[0]).toMatchObject({ submittedCount: 2, reviewedCount: 1 });
  });

  it("PUT submission på egen oppgave+student → 200; ugyldig status → 400", async () => {
    const owned = makePool({ ownsAssignment: true, ownsStudent: true });
    const r1 = makeRes();
    await runChain(H(R(owned.pool), "PUT", "/education/assignments/:id/submissions"), authed({ studentId: "s1", status: "submitted" }, { id: "a1" }), r1);
    expect(r1.statusCode).toBe(200);
    expect(r1.body.submission).toMatchObject({ studentId: "s1", status: "submitted" });

    const bad = makePool({ ownsAssignment: true, ownsStudent: true });
    const r2 = makeRes();
    await runChain(H(R(bad.pool), "PUT", "/education/assignments/:id/submissions"), authed({ studentId: "s1", status: "bogus" }, { id: "a1" }), r2);
    expect(r2.statusCode).toBe(400);
  });

  it("PUT submission på oppgave man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsAssignment: false });
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/assignments/:id/submissions"), authed({ studentId: "s1", status: "submitted" }, { id: "a-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /education/assignments/:id — ikke eid → 404", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/assignments/:id"), authed(undefined, { id: "a-other" }), res);
    expect(res.statusCode).toBe(404);
  });
});
