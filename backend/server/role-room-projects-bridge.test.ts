import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool, PoolClient } from "pg";
import { createRoleRoomRouter } from "./role-room-routes.js";

// ─────────────────────────────────────────────────────────
// Education-bro-tilgang for GET /projects/:id og GET /projects.
// En "bro-student" har ingen rad i casting_user_roles og er ikke
// cp.created_by — tilgangen kommer utelukkende fra
// resolveEducationProductionRole/listEducationProductionProjectIds
// (role_room_education_productions → ...members → ...students → users).
// ─────────────────────────────────────────────────────────

type QueryResponder = (sql: string, params: unknown[]) => { rows: unknown[]; rowCount: number };

interface MockPool {
  pool: Pool;
  setResponder(matcher: RegExp, responder: QueryResponder): void;
  transcript: Array<{ sql: string; params: unknown[] }>;
}

function makeMockPool(): MockPool {
  const responders: Array<{ matcher: RegExp; responder: QueryResponder }> = [];
  const transcript: Array<{ sql: string; params: unknown[] }> = [];

  function runQuery(sql: string, params: unknown[] = []) {
    transcript.push({ sql, params });
    for (const { matcher, responder } of responders) {
      if (matcher.test(sql)) return responder(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }

  const client: Partial<PoolClient> = {
    query: (async (sql: string, params?: unknown[]) => runQuery(sql, params ?? [])) as PoolClient["query"],
    release: () => undefined,
  };

  const pool = {
    query: (async (sql: string, params?: unknown[]) => runQuery(sql, params ?? [])) as Pool["query"],
    connect: (async () => client as PoolClient) as Pool["connect"],
  } as unknown as Pool;

  return {
    pool,
    setResponder(matcher, responder) {
      // Sist registrert = høyest prioritet (matcher spesifikke mønstre før generiske).
      responders.unshift({ matcher, responder });
    },
    transcript,
  };
}

function makeApp(pool: Pool) {
  const app = express();
  app.use(express.json());
  app.use("/api/role-room", createRoleRoomRouter(pool));
  return app;
}

// Egen bruker (ikke admin, ikke talent) — treffer standard eier/medlem-gren.
const STUDENT_ID = "student-1";
const OTHER_ID = "outsider-1";
const OWNER_ID = "owner-1";

const authHeaders = (userId: string) => ({ "x-user-id": userId, "x-user-role": "user" });

function projectRow(id: string, createdBy: string) {
  return {
    id,
    name: `Prosjekt ${id}`,
    description: null,
    status: "active",
    created_by: createdBy,
    created_by_label: createdBy,
    genre: null,
    project_type: null,
    start_date: null,
    end_date: null,
    budget: null,
    currency: "NOK",
    settings: {},
    metadata: {},
    creatorhub_project_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// Sub-entitetsspørringene GET /projects/:id alltid gjør etter treff.
function stubSubEntities(mock: MockPool) {
  for (const table of [
    "casting_roles",
    "casting_candidates",
    "casting_crew",
    "casting_schedules",
    "casting_locations",
    "casting_props",
    "casting_shot_lists",
    "casting_user_roles",
  ]) {
    mock.setResponder(new RegExp(`SELECT \\* FROM ${table} WHERE project_id`), () => ({ rows: [], rowCount: 0 }));
  }
}

describe("GET /projects/:id — education-bro", () => {
  let mock: MockPool;

  beforeEach(() => {
    mock = makeMockPool();
  });

  it("bro-student (eier/medlem-miss, bro → contributor) får 200 med prosjektet, ikke 404", async () => {
    // Eier/admin/medlem-spørringen: ingen treff.
    mock.setResponder(/WHERE cp\.id = \$1 AND \(\$3::boolean OR cp\.created_by = \$2 OR cur\.user_id IS NOT NULL\)/, () => ({
      rows: [],
      rowCount: 0,
    }));
    // Bro-resolver: contributor-rolle.
    mock.setResponder(/FROM role_room_education_productions p/, () => ({
      rows: [{ role: "contributor" }],
      rowCount: 1,
    }));
    // Bro-detalj-select (uten cur-join, kun WHERE cp.id = $1).
    mock.setResponder(/FROM casting_projects cp\s+LEFT JOIN users u ON CAST\(u\.id AS TEXT\)[\s\S]*WHERE cp\.id = \$1\s*$/, () => ({
      rows: [projectRow("bridge-proj", "someone-else")],
      rowCount: 1,
    }));
    stubSubEntities(mock);

    const res = await request(makeApp(mock.pool))
      .get("/api/role-room/projects/bridge-proj")
      .set(authHeaders(STUDENT_ID));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("bridge-proj");
    expect(res.body.projectId).toBe("bridge-proj");
  });

  it("ikke-bro, ikke-eier (bro → null) er fortsatt 404", async () => {
    mock.setResponder(/WHERE cp\.id = \$1 AND \(\$3::boolean OR cp\.created_by = \$2 OR cur\.user_id IS NOT NULL\)/, () => ({
      rows: [],
      rowCount: 0,
    }));
    mock.setResponder(/FROM role_room_education_productions p/, () => ({ rows: [], rowCount: 0 }));

    const res = await request(makeApp(mock.pool))
      .get("/api/role-room/projects/no-access-proj")
      .set(authHeaders(OTHER_ID));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Prosjekt ikke funnet");
  });

  it("eier/medlem-oppførsel er uendret (kontroll — broen konsulteres ikke)", async () => {
    mock.setResponder(/WHERE cp\.id = \$1 AND \(\$3::boolean OR cp\.created_by = \$2 OR cur\.user_id IS NOT NULL\)/, () => ({
      rows: [projectRow("owned-proj", OWNER_ID)],
      rowCount: 1,
    }));
    stubSubEntities(mock);

    const res = await request(makeApp(mock.pool))
      .get("/api/role-room/projects/owned-proj")
      .set(authHeaders(OWNER_ID));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("owned-proj");
    // Bro-resolveren skal aldri bli spurt når eier/medlem-sjekken allerede traff.
    expect(mock.transcript.some((t) => /FROM role_room_education_productions p/.test(t.sql))).toBe(false);
  });
});

describe("GET /projects (liste) — education-bro", () => {
  let mock: MockPool;

  beforeEach(() => {
    mock = makeMockPool();
  });

  it("inkluderer bro-prosjektet uten å duplisere et eid prosjekt", async () => {
    // Eid/medlems-liste: én rad brukeren allerede eier.
    mock.setResponder(/WHERE cp\.created_by = \$1 OR cur\.user_id IS NOT NULL/, () => ({
      rows: [projectRow("owned-1", STUDENT_ID)],
      rowCount: 1,
    }));
    // Bro-prosjekt-id-liste: owned-1 (allerede med) + bridge-1 (nytt).
    mock.setResponder(/SELECT DISTINCT p\.project_id/, () => ({
      rows: [{ project_id: "owned-1" }, { project_id: "bridge-1" }],
      rowCount: 2,
    }));
    // Bro-prosjekt-rader for de manglende id-ene.
    mock.setResponder(/WHERE cp\.id = ANY\(\$1::text\[\]\)/, (_sql, params) => {
      const ids = params[0] as string[];
      expect(ids).toEqual(["bridge-1"]); // owned-1 filtrert ut (dedup)
      return { rows: [projectRow("bridge-1", "someone-else")], rowCount: 1 };
    });

    const res = await request(makeApp(mock.pool))
      .get("/api/role-room/projects")
      .set(authHeaders(STUDENT_ID));

    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((p) => p.id);
    expect(ids.sort()).toEqual(["bridge-1", "owned-1"]);
    expect(new Set(ids).size).toBe(ids.length); // ingen duplikater
  });

  it("bruker uten eide/medlems- eller bro-prosjekter får tom liste", async () => {
    mock.setResponder(/WHERE cp\.created_by = \$1 OR cur\.user_id IS NOT NULL/, () => ({ rows: [], rowCount: 0 }));
    mock.setResponder(/SELECT DISTINCT p\.project_id/, () => ({ rows: [], rowCount: 0 }));

    const res = await request(makeApp(mock.pool))
      .get("/api/role-room/projects")
      .set(authHeaders(OTHER_ID));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
