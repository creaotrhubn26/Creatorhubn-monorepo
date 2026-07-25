import { describe, expect, it, vi } from "vitest";

import { createEducationRubricRouter } from "./role-room-education-rubric-routes.js";

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

function makePool(opts: { ownsAssignment?: boolean; ownsCriterion?: boolean; criteria?: any[]; scores?: any[] } = {}) {
  const { ownsAssignment = true, ownsCriterion = true, criteria, scores } = opts;
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT 1 FROM role_room_education_assignments")) {
        return { rows: ownsAssignment ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("SELECT 1 FROM role_room_education_rubric_criteria WHERE id")) {
        return { rows: ownsCriterion ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("FROM role_room_education_rubric_criteria") && sql.includes("ORDER BY sort_order")) {
        return { rows: criteria ?? [] };
      }
      if (sql.includes("INSERT INTO role_room_education_rubric_criteria")) {
        const [id, assignmentId, owner, title] = params;
        const row = { id, assignment_id: assignmentId, owner_user_id: owner, title, learning_goal: null, sort_order: 0 };
        inserts.push(row);
        return { rows: [row] };
      }
      if (sql.includes("FROM role_room_education_rubric_scores rs")) {
        return { rows: scores ?? [] };
      }
      if (sql.includes("INSERT INTO role_room_education_rubric_scores")) {
        inserts.push({ score: params });
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM role_room_education_rubric_criteria")) {
        return { rows: ownsCriterion ? [{ id: params[0] }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationRubricRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any, query?: any) => ({ headers: { authorization: "Bearer tok-1" }, body: body ?? {}, params: params ?? {}, query: query ?? {} });

describe("education rubric routes", () => {
  it("POST kriterium på eid oppgave → 201", async () => {
    const { pool, inserts } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/assignments/:id/rubric/criteria"), authed({ title: "Manus/story", learningGoal: "Fortelling" }, { id: "a1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.criterion).toMatchObject({ title: "Manus/story" });
    expect(inserts[0].owner_user_id).toBe("inst-1");
  });

  it("POST kriterium på oppgave man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsAssignment: false });
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/assignments/:id/rubric/criteria"), authed({ title: "X" }, { id: "a-other" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("POST uten tittel → 400", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/assignments/:id/rubric/criteria"), authed({}, { id: "a1" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("GET rubric lister kriterier", async () => {
    const { pool } = makePool({ criteria: [{ id: "c1", title: "Manus", learning_goal: "Mål", sort_order: 0 }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/assignments/:id/rubric"), authed({}, { id: "a1" }), res);
    expect(res.body.criteria).toHaveLength(1);
    expect(res.body.criteria[0]).toMatchObject({ title: "Manus", learningGoal: "Mål" });
  });

  it("GET scores → kriterier + score-map", async () => {
    const { pool } = makePool({ criteria: [{ id: "c1", title: "Manus", learning_goal: null, sort_order: 0 }], scores: [{ criterion_id: "c1", level: 2 }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/assignments/:id/rubric/scores"), authed({}, { id: "a1" }, { studentId: "s1" }), res);
    expect(res.body.criteria).toHaveLength(1);
    expect(res.body.scores).toMatchObject({ c1: 2 });
  });

  it("PUT score gyldig nivå → success", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/rubric/scores"), authed({ criterionId: "c1", studentId: "s1", level: 1 }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.level).toBe(1);
  });

  it("PUT score ugyldig nivå (3) → 400", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/rubric/scores"), authed({ criterionId: "c1", studentId: "s1", level: 3 }), res);
    expect(res.statusCode).toBe(400);
  });

  it("PUT score på kriterium man ikke eier → 404", async () => {
    const { pool } = makePool({ ownsCriterion: false });
    const res = makeRes();
    await runChain(H(R(pool), "PUT", "/education/rubric/scores"), authed({ criterionId: "c-other", studentId: "s1", level: 1 }), res);
    expect(res.statusCode).toBe(404);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/assignments/:id/rubric"), { headers: {}, body: {}, params: { id: "a1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });
});
