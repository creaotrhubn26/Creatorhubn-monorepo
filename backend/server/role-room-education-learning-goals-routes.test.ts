import { describe, expect, it, vi } from "vitest";

import { createEducationLearningGoalsRouter } from "./role-room-education-learning-goals-routes.js";

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

function makePool(opts: { ownsCohort?: boolean; goals?: any[]; attainment?: any[] } = {}) {
  const { ownsCohort = true, goals, attainment } = opts;
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT 1 FROM role_room_education_cohorts")) return { rows: ownsCohort ? [{ n: 1 }] : [] };
      if (sql.includes("INSERT INTO role_room_education_learning_goals")) {
        const [id, owner, cohortId, code, title] = params;
        return { rows: [{ id, owner_user_id: owner, cohort_id: cohortId, code, title, description: null, sort_order: 0 }] };
      }
      if (sql.includes("FROM role_room_education_learning_goals WHERE cohort_id")) return { rows: goals ?? [] };
      if (sql.includes("FROM role_room_education_learning_goals g")) return { rows: attainment ?? [] };
      if (sql.includes("DELETE FROM role_room_education_learning_goals")) return { rows: [{ id: params[0] }] };
      return { rows: [] };
    }),
  };
  return pool;
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationLearningGoalsRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any) => ({ headers: { authorization: "Bearer tok-1" }, body: body ?? {}, params: params ?? {}, query: {} });

describe("education learning goals routes", () => {
  it("POST læringsmål på eid kull → 201", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "POST", "/education/cohorts/:id/learning-goals"), authed({ code: "LM1", title: "Fortelling" }, { id: "c1" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.goal).toMatchObject({ code: "LM1", title: "Fortelling" });
  });

  it("POST på kull man ikke eier → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ ownsCohort: false })), "POST", "/education/cohorts/:id/learning-goals"), authed({ title: "X" }, { id: "c-x" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("POST uten tittel → 400", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "POST", "/education/cohorts/:id/learning-goals"), authed({}, { id: "c1" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("GET lister læringsmål", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ goals: [{ id: "g1", code: "LM1", title: "Fortelling", description: null, sort_order: 0 }] })), "GET", "/education/cohorts/:id/learning-goals"), authed({}, { id: "c1" }), res);
    expect(res.body.goals[0]).toMatchObject({ code: "LM1", title: "Fortelling" });
  });

  it("GET attainment → prosent fra avg-nivå", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ attainment: [{ id: "g1", code: "LM1", title: "Fortelling", criteria_count: 2, score_count: 6, avg_level: 1.5 }] })), "GET", "/education/cohorts/:id/attainment"), authed({}, { id: "c1" }), res);
    expect(res.body.attainment[0]).toMatchObject({ goalId: "g1", criteriaCount: 2, scoreCount: 6, pct: 75 });
  });

  it("DELETE → success", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "DELETE", "/education/learning-goals/:id"), authed({}, { id: "g1" }), res);
    expect(res.body.success).toBe(true);
  });

  it("uten Bearer → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "GET", "/education/cohorts/:id/attainment"), { headers: {}, body: {}, params: { id: "c1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });
});
