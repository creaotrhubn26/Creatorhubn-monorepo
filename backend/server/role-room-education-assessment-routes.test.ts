import { describe, expect, it, vi } from "vitest";

import { createEducationAssessmentRouter } from "./role-room-education-assessment-routes.js";

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
  const res: any = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; return res; };
  res.send = (b: unknown) => { res.body = b; return res; };
  return res;
}
async function runChain(stack: any[], req: any, res: any) {
  for (const h of stack) {
    let nextCalled = false;
    await h(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
}

const QUEUE_ROW = {
  submission_id: "s1", assignment_id: "a1", student_id: "st1", status: "submitted",
  grade: null, feedback: null, submitted_at: new Date(0).toISOString(), reviewed_at: null,
  student_name: "Kari, Nordmann", assignment_title: 'Kortfilm "A"', learning_goals: "Mål 1\nMål 2",
  cohort_id: "c1", cohort_name: "Film 1", production_project_id: "proj-1",
};

function makePool(rows: any[] = [QUEUE_ROW]) {
  const pool: any = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM role_room_education_submissions s")) return { rows };
      return { rows: [] };
    }),
  };
  return pool;
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationAssessmentRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (query?: any) => ({ headers: { authorization: "Bearer tok-1" }, query: query ?? {}, params: {} });

describe("education assessment routes", () => {
  it("GET queue lister levert/vurdert med produksjonskobling", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "GET", "/education/assessment/queue"), authed(), res);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ studentName: "Kari, Nordmann", productionProjectId: "proj-1", status: "submitted" });
  });

  it("GET queue uten Bearer → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "GET", "/education/assessment/queue"), { headers: {}, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET export gir CSV med header, BOM og escapet komma", async () => {
    const res = makeRes();
    await runChain(H(R(makePool()), "GET", "/education/assessment/export"), authed(), res);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    expect(res.headers["Content-Disposition"]).toContain("vurdering.csv");
    const csv = res.body as string;
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Kull,Oppgave,Student");
    // Navn med komma + tittel med anførsel skal quotes-escapes.
    expect(csv).toContain('"Kari, Nordmann"');
    expect(csv).toContain('"Kortfilm ""A"""');
  });

  it("GET export tom kø → kun header", async () => {
    const res = makeRes();
    await runChain(H(R(makePool([])), "GET", "/education/assessment/export"), authed(), res);
    const csv = res.body as string;
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
