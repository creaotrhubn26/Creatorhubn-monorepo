import { describe, expect, it, vi } from "vitest";

import { createEducationStudentViewRouter, resolveEducationStudentByUser } from "./role-room-education-student-view-routes.js";

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

function makePool(opts: { studentOwner?: string | null; invite?: any; sessionStudentId?: string | null; rubric?: any[]; assignmentInCohort?: boolean } = {}) {
  const { studentOwner = "inst-1", invite, sessionStudentId, rubric, assignmentInCohort = true } = opts;
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
      if (sql.includes("FROM role_room_education_students s") && sql.includes("JOIN users u")) {
        // resolveEducationStudentByUser: ingen ekte-konto-student-kobling i disse testene.
        return { rows: [] };
      }
      if (sql.includes("FROM role_room_education_students s")) {
        return studentOwner === null
          ? { rows: [] }
          : { rows: [{ id: "st1", name: "Kari", owner_user_id: studentOwner, cohort_id: "c1", cohort_name: "Film 1" }] };
      }
      if (sql.includes("FROM role_room_education_production_members m")) {
        return { rows: [{ id: "ep1", title: "Kortfilm", project_id: "proj-1", project_status: "active", member_role: "lead" }] };
      }
      if (sql.includes("FROM role_room_education_rubric_criteria c")) {
        return { rows: rubric ?? [] };
      }
      if (sql.includes("FROM role_room_education_assignments a") && sql.includes("a.cohort_id = $2")) {
        // Submit-endepunktets oppgave-spørring (m/ koblet produksjon); skilles fra
        // assembleView-spørringen som bruker "a.cohort_id = $1".
        return { rows: assignmentInCohort ? [{ title: "Oppg", production_project_id: null }] : [] };
      }
      if (sql.includes("INSERT INTO role_room_education_submissions")) {
        return { rows: [{ status: "submitted", link: params[4] }] };
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

describe("resolveEducationStudentByUser", () => {
  it("returnerer student-id når users.email = students.email", async () => {
    const pool: any = { query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("FROM role_room_education_students") && sql.includes("users")) {
        // matcher kun for riktig userId
        return params[0] === "u1" ? { rows: [{ id: "stud-1" }] } : { rows: [] };
      }
      return { rows: [] };
    }) };
    expect(await resolveEducationStudentByUser(pool, "u1")).toBe("stud-1");
    expect(await resolveEducationStudentByUser(pool, "u-annen")).toBeNull();
  });
  it("tom userId → null (ingen query)", async () => {
    const pool: any = { query: vi.fn() };
    expect(await resolveEducationStudentByUser(pool, "")).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("education student view + claim routes", () => {
  // ── Preview-vei (Bearer) ─────────────────────────────────────────────────
  it("eier ser studentens visning", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer owner-tok" }, query: { studentId: "st1" }, params: {} }, res);
    expect(res.body.student).toMatchObject({ id: "st1", name: "Kari" });
    expect(res.body.assignments[0]).toMatchObject({ submissionStatus: "submitted", grade: "B" });
  });

  it("rubrikk-nedbrytning vises når scoret (pct fra nivåer)", async () => {
    const res = makeRes();
    const rubric = [
      { assignment_id: "a1", criterion_title: "Manus", sort_order: 0, goal_title: "Fortelling", level: 2, scored: true },
      { assignment_id: "a1", criterion_title: "Casting", sort_order: 1, goal_title: null, level: 1, scored: true },
    ];
    await runChain(H(R(makePool({ rubric }).pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer owner-tok" }, query: { studentId: "st1" }, params: {} }, res);
    expect(res.body.assignments[0].rubric).toMatchObject({ pct: 75 });
    expect(res.body.assignments[0].rubric.criteria).toHaveLength(2);
  });

  it("rubrikk skjules når ikke scoret (null)", async () => {
    const res = makeRes();
    const rubric = [{ assignment_id: "a1", criterion_title: "Manus", sort_order: 0, goal_title: null, level: null, scored: false }];
    await runChain(H(R(makePool({ rubric }).pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer owner-tok" }, query: { studentId: "st1" }, params: {} }, res);
    expect(res.body.assignments[0].rubric).toBeNull();
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

  it("Bearer uten studentId, ikke selv en student → 404 no_student_profile", async () => {
    const res = makeRes();
    await runChain(H(R(makePool().pool), "GET", "/education/student/view"),
      { headers: { authorization: "Bearer owner-tok" }, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("no_student_profile");
  });

  it("Bearer-ekte-konto-student uten studentId → egen visning m/ canOpenProduction=true", async () => {
    const sessions2 = new Map([["bear-1", { userId: "u1", email: "s@moodle.a", name: "", role: "user", loginAt: "" }]]);
    const pool: any = { query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM role_room_education_students") && sql.includes("JOIN users u")) return { rows: [{ id: "stud-1" }] };
      if (sql.includes("FROM role_room_education_students") && sql.includes("WHERE") && !sql.includes("JOIN users")) return { rows: [{ id: "stud-1", name: "Sam", cohort_id: "k1", owner_user_id: "t1", email: "s@moodle.a" }] };
      return { rows: [] };
    }) };
    const rs = mountHandlers(createEducationStudentViewRouter(pool, { activeSessions: sessions2 as any }));
    const res = makeRes();
    await runChain(H(rs, "GET", "/education/student/view"),
      { headers: { authorization: "Bearer bear-1" }, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.canOpenProduction).toBe(true);
  });

  it("x-student-token-vei → canOpenProduction=false", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sessionStudentId: "st1" }).pool), "GET", "/education/student/view"),
      { headers: { "x-student-token": "stok-1" }, query: {}, params: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.canOpenProduction).toBe(false);
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

  it("student leverer lenke → status submitted", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sessionStudentId: "st1" }).pool), "PUT", "/education/student/assignment/:assignmentId/submit"),
      { headers: { "x-student-token": "stok" }, body: { link: "https://vimeo.com/123" }, params: { assignmentId: "a1" }, query: {} }, res);
    expect(res.body).toMatchObject({ status: "submitted", link: "https://vimeo.com/123" });
  });

  it("levering på oppgave utenfor kullet → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sessionStudentId: "st1", assignmentInCohort: false }).pool), "PUT", "/education/student/assignment/:assignmentId/submit"),
      { headers: { "x-student-token": "stok" }, body: { link: "x" }, params: { assignmentId: "a-x" }, query: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("Bearer-student leverer oppgave m/ produksjon → oppretter deliverable + lagrer deliverable_id", async () => {
    const sessions3 = new Map([["bear-1", { userId: "u1", email: "s@moodle.a", name: "Sam", role: "user", loginAt: "" }]]);
    const calls: any[] = [];
    const pool: any = { query: vi.fn(async (sql: string, params: any[]) => {
      calls.push({ sql, params });
      // Bro-rolle (resolveEducationProductionRole) MÅ sjekkes før den generiske
      // "JOIN users u"-sjekken, siden begge spørringene inneholder det mønsteret.
      if (sql.includes("role_room_education_production_members")) return { rows: [{ role: "contributor" }] }; // bro-rolle
      if (sql.includes("JOIN users u")) return { rows: [{ id: "stud-1" }] };            // resolveEducationStudentByUser
      if (sql.includes("FROM role_room_education_students") && sql.includes("cohort_name")) return { rows: [{ id: "stud-1", name: "Sam", cohort_id: "k1", email: "s@moodle.a" }] }; // loadStudent
      if (sql.includes("FROM role_room_education_assignments") && sql.includes("production")) return { rows: [{ ok: 1, production_project_id: "proj-1", title: "Manus" }] }; // oppgave m/ produksjon
      if (sql.includes("FROM role_room_education_assignments")) return { rows: [{ "?column?": 1 }] };
      if (sql.includes("INSERT INTO role_room_deliverables")) return { rows: [{ id: "deliv-1", project_id: "proj-1", title: "Manus" }] };
      if (sql.includes("INSERT INTO role_room_education_submissions")) return { rows: [{ id: "sub-1" }] };
      return { rows: [] };
    }) };
    const rs = mountHandlers(createEducationStudentViewRouter(pool, { activeSessions: sessions3 as any }));
    const res = makeRes();
    await runChain(H(rs, "PUT", "/education/student/assignment/:assignmentId/submit"),
      { headers: { authorization: "Bearer bear-1" }, params: { assignmentId: "a1" }, body: { link: "https://x", note: "ferdig" }, query: {} }, res);
    expect(calls.some((c) => c.sql.includes("INSERT INTO role_room_deliverables"))).toBe(true);
    const subInsert = calls.find((c) => c.sql.includes("INSERT INTO role_room_education_submissions"));
    expect(subInsert.sql).toContain("deliverable_id");
  });

  it("Bearer-student leverer PÅ NYTT (re-submit) → gjenbruker eksisterende deliverable_id, oppretter IKKE ny leveranse", async () => {
    const sessions4 = new Map([["bear-1", { userId: "u1", email: "s@moodle.a", name: "Sam", role: "user", loginAt: "" }]]);
    const calls: any[] = [];
    const pool: any = { query: vi.fn(async (sql: string, params: any[]) => {
      calls.push({ sql, params });
      // Tidligere innsending har allerede en deliverable_id → skal gjenbrukes.
      if (sql.includes("SELECT deliverable_id FROM role_room_education_submissions")) return { rows: [{ deliverable_id: "deliv-existing" }] };
      if (sql.includes("role_room_education_production_members")) return { rows: [{ role: "contributor" }] }; // bro-rolle
      if (sql.includes("JOIN users u")) return { rows: [{ id: "stud-1" }] };            // resolveEducationStudentByUser
      if (sql.includes("FROM role_room_education_students") && sql.includes("cohort_name")) return { rows: [{ id: "stud-1", name: "Sam", cohort_id: "k1", email: "s@moodle.a" }] }; // loadStudent
      if (sql.includes("FROM role_room_education_assignments") && sql.includes("production")) return { rows: [{ ok: 1, production_project_id: "proj-1", title: "Manus" }] }; // oppgave m/ produksjon
      if (sql.includes("FROM role_room_education_assignments")) return { rows: [{ "?column?": 1 }] };
      if (sql.includes("INSERT INTO role_room_deliverables")) return { rows: [{ id: "deliv-NY", project_id: "proj-1", title: "Manus" }] };
      if (sql.includes("INSERT INTO role_room_education_submissions")) return { rows: [{ id: "sub-1" }] };
      return { rows: [] };
    }) };
    const rs = mountHandlers(createEducationStudentViewRouter(pool, { activeSessions: sessions4 as any }));
    const res = makeRes();
    await runChain(H(rs, "PUT", "/education/student/assignment/:assignmentId/submit"),
      { headers: { authorization: "Bearer bear-1" }, params: { assignmentId: "a1" }, body: { link: "https://x-v2", note: "revidert" }, query: {} }, res);
    expect(calls.some((c) => c.sql.includes("INSERT INTO role_room_deliverables"))).toBe(false);
    const subInsert = calls.find((c) => c.sql.includes("INSERT INTO role_room_education_submissions"));
    expect(subInsert.params).toContain("deliv-existing");
  });

  it("levering uten student-token → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makePool({ sessionStudentId: null }).pool), "PUT", "/education/student/assignment/:assignmentId/submit"),
      { headers: { "x-student-token": "bad" }, body: {}, params: { assignmentId: "a1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
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

// ── Produksjons-hub (student-token + RBAC-membership) ──────────────────────
function makeHubPool(opts: { sessionStudentId?: string | null; isMember?: boolean } = {}) {
  const { sessionStudentId = "st1", isMember = true } = opts;
  const pool: any = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("UPDATE role_room_education_student_sessions")) {
        return { rows: sessionStudentId ? [{ student_id: sessionStudentId }] : [] };
      }
      if (sql.includes("SELECT role FROM role_room_education_production_members")) {
        return { rows: isMember ? [{ role: "lead" }] : [] };
      }
      if (sql.includes("JOIN role_room_education_students st")) {
        return { rows: [{ name: "Kari", role: "lead", is_me: true }, { name: "Ola", role: "contributor", is_me: false }] };
      }
      if (sql.includes("FROM role_room_education_productions p")) {
        return { rows: [{ id: "ep1", title: "Kortfilm", project_id: "proj-1", project_name: "Kortfilm-prosjekt", project_status: "active", project_description: "En kortfilm" }] };
      }
      if (sql.includes("FROM role_room_education_assignments a")) {
        return { rows: [{ id: "a1", title: "Oppg", due_at: null, sub_status: "submitted", grade: "B", feedback: "Bra" }] };
      }
      return { rows: [] };
    }),
  };
  return pool;
}

describe("education student production hub", () => {
  it("tildelt student ser hub (prosjekt + rolle + medstudenter + oppgaver)", async () => {
    const res = makeRes();
    await runChain(H(R(makeHubPool()), "GET", "/education/student/production/:productionId"),
      { headers: { "x-student-token": "stok-1" }, params: { productionId: "ep1" }, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.production).toMatchObject({ title: "Kortfilm", myRole: "lead", projectName: "Kortfilm-prosjekt" });
    expect(res.body.teammates).toHaveLength(2);
    expect(res.body.teammates.find((t: any) => t.isMe)).toMatchObject({ name: "Kari" });
    expect(res.body.assignments[0]).toMatchObject({ submissionStatus: "submitted", grade: "B" });
  });

  it("student som IKKE er tildelt → 404", async () => {
    const res = makeRes();
    await runChain(H(R(makeHubPool({ isMember: false })), "GET", "/education/student/production/:productionId"),
      { headers: { "x-student-token": "stok-1" }, params: { productionId: "ep-other" }, query: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it("uten student-token → 401", async () => {
    const res = makeRes();
    await runChain(H(R(makeHubPool()), "GET", "/education/student/production/:productionId"),
      { headers: {}, params: { productionId: "ep1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });
});
