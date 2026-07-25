import { describe, expect, it, vi } from "vitest";

import { createEducationOverviewRouter } from "./role-room-education-overview-routes.js";

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

function makePool() {
  const pool: any = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("INTERVAL '7 days'")) return { rows: [{ n: 3 }] };
      if (sql.includes("status = 'submitted'") && sql.includes("COUNT(*)")) return { rows: [{ n: 7 }] };
      if (sql.includes("sub.id IS NULL")) return { rows: [{ n: 2 }] };
      if (sql.includes("FROM role_room_education_productions WHERE")) return { rows: [{ n: 4 }] };
      if (sql.includes("ORDER BY a.due_at ASC LIMIT")) {
        return { rows: [{ id: "a1", title: "Kortfilm", due_at: new Date(0).toISOString(), cohort_name: "Film 1" }] };
      }
      if (sql.includes("ORDER BY s.submitted_at DESC")) {
        return { rows: [{ id: "s1", student_name: "Kari", assignment_title: "Oppg", cohort_name: "Film 1", submitted_at: new Date(0).toISOString() }] };
      }
      return { rows: [] };
    }),
  };
  return pool;
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationOverviewRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;

describe("education overview route", () => {
  it("aggregerer stats + lister", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "GET", "/education/overview"),
      { headers: { authorization: "Bearer tok-1" }, params: {}, query: {} }, res);
    expect(res.body.stats).toMatchObject({ dueThisWeek: 3, toReview: 7, missingSubmissions: 2, productions: 4 });
    expect(res.body.dueSoon[0]).toMatchObject({ title: "Kortfilm", cohortName: "Film 1" });
    expect(res.body.reviewQueue[0]).toMatchObject({ studentName: "Kari", assignmentTitle: "Oppg" });
  });

  it("uten Bearer → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "GET", "/education/overview"),
      { headers: {}, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("manglende tabell → tom payload", async () => {
    const pool: any = { query: vi.fn(async () => { const e: any = new Error("x"); e.code = "42P01"; throw e; }) };
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/overview"),
      { headers: { authorization: "Bearer tok-1" }, params: {}, query: {} }, res);
    expect(res.body.stats.toReview).toBe(0);
    expect(res.body.dueSoon).toHaveLength(0);
  });
});
