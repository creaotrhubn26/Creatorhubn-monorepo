import { describe, expect, it, vi } from "vitest";

import { setupCastingProjectsRoutes } from "./casting-projects-routes.js";

function makeHarness(
  sessionUserId: string,
  canonicalRows: Array<Record<string, unknown>>,
  membership?: { role: string | null; permissions?: Record<string, unknown>; additionalRoles?: string[] },
) {
  const handlers = new Map<string, (req: any, res: any) => any>();
  const app: any = {
    get: (path: string, handler: any) => handlers.set("GET " + path, handler),
    post: (path: string, handler: any) => handlers.set("POST " + path, handler),
    put: (path: string, handler: any) => handlers.set("PUT " + path, handler),
    delete: (path: string, handler: any) => handlers.set("DELETE " + path, handler),
  };
  const store = new Map<string, unknown>();
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("SELECT DISTINCT cp.*")) {
        return { rows: canonicalRows.filter((row) => row.created_by === params[0]) };
      }
      if (sql.includes("SELECT cp.* FROM casting_projects")) {
        return {
          rows: canonicalRows.filter((row) => row.id === params[0] && row.created_by === params[1]),
        };
      }
      if (sql.includes("SELECT created_by FROM casting_projects")) {
        return { rows: canonicalRows.filter((row) => row.id === params[0]).map((row) => ({ created_by: row.created_by })) };
      }
      if (sql.includes("AS project_exists") && sql.includes("member_role")) {
        const project = canonicalRows.find((row) => row.id === params[0]);
        return {
          rows: [{
            project_exists: Boolean(project),
            is_owner: project?.created_by === params[1],
            member_role: membership?.role ?? null,
            member_permissions: membership?.permissions ?? {},
            member_additional_roles: membership?.additionalRoles ?? [],
          }],
        };
      }
      return { rows: [] };
    }),
  };

  setupCastingProjectsRoutes({
    app,
    pool: pool as any,
    requireUserSession: () => ({ userId: sessionUserId }),
    compatStoreGet: async (key: string) => store.get(key) as any ?? null,
    compatStoreSet: async (key: string, value: unknown) => { store.set(key, value); },
    compatStoreDelete: async (key: string) => { store.delete(key); },
    compatStoreDeleteByPrefix: async () => {},
    compatStoreListByPrefix: async (prefix: string) => Array.from(store.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value })) as any,
    compatStoreTransaction: async (callback: any) => callback({
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown) => { store.set(key, value); },
      delete: async (key: string) => { store.delete(key); },
      deleteByPrefix: async () => {},
      listByPrefix: async () => [],
    }),
    manuscriptsService: {} as any,
    liveSetService: {} as any,
    legacyOffersByProject: new Map(),
    legacyContractsByProject: new Map(),
    legacyProjectAgreementsByProject: new Map(),
    dbLegacyOffersKey: (id: string) => "casting:offers:" + id,
    dbLegacyContractsKey: (id: string) => "casting:contracts:" + id,
    dbLegacyProjectAgreementsKey: (id: string) => "casting:agreements:" + id,
    dbLegacyLiveSetSessionsKey: (id: string) => "casting:live-sessions:" + id,
    dbLegacyLiveSetEventsKey: (id: string) => "casting:live-events:" + id,
    findByIdInDbProjectArrays: async () => null,
  });

  return { handlers, pool, store };
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

async function call(handlers: Map<string, any>, key: string, req: any) {
  const res = makeRes();
  await handlers.get(key)(req, res);
  return res;
}

describe("casting project source reconciliation", () => {
  const medside = {
    id: "medside-9873ba5b2f66",
    name: "MedSide — Helsetech kundeprosjekt",
    status: "active",
    created_by: "user-A",
    project_type: "kundeprosjekt",
    metadata: {},
  };

  it("lists canonical projects together with owned compat projects", async () => {
    const { handlers, pool, store } = makeHarness("user-A", [medside]);
    store.set("casting:project:troll-1", { id: "troll-1", name: "TROLL", created_by: "user-A", roles: [{ id: "role-1" }] });
    store.set("casting:project:other", { id: "other", name: "Other", created_by: "user-B" });

    const res = await call(handlers, "GET /api/casting/projects", {});
    expect(res.body.projects.map((project: any) => project.id).sort()).toEqual([
      "medside-9873ba5b2f66",
      "troll-1",
    ]);
    expect(res.body.projects.find((project: any) => project.id === medside.id)).toMatchObject({
      name: medside.name,
      created_by: "user-A",
      projectStorageSource: "casting_projects",
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("cp.created_by = $1"), ["user-A"]);
  });

  it("returns an authorized canonical project even without a compat blob", async () => {
    const { handlers } = makeHarness("user-A", [medside]);
    const res = await call(handlers, "GET /api/casting/projects/:projectId", {
      params: { projectId: medside.id },
    });
    expect(res.body).toMatchObject({
      id: medside.id,
      name: medside.name,
      created_by: "user-A",
      projectStorageSource: "casting_projects",
    });
  });

  it("does not expose a canonical project to another user", async () => {
    const { handlers } = makeHarness("user-B", [medside]);
    const res = await call(handlers, "GET /api/casting/projects/:projectId", {
      params: { projectId: medside.id },
    });
    expect(res.body).toBeNull();
  });
});

describe("casting member project persistence", () => {
  const project = {
    id: "project-casting-1",
    name: "Originalt prosjektnavn",
    created_by: "owner-1",
    metadata: {},
  };

  it("lets a casting director persist only the casting lane and preserves ownership", async () => {
    const { handlers, store } = makeHarness("casting-1", [project], { role: "casting_director" });
    store.set("casting:project:project-casting-1", {
      ...project,
      created_by_email: "owner@example.test",
      crew: [{ id: "crew-1", name: "Behold meg" }],
      roles: [{ id: "old-role" }],
      candidates: [{ id: "old-candidate" }],
      schedules: [{ id: "old-schedule" }],
    });

    const res = await call(handlers, "POST /api/casting/projects", {
      body: {
        id: project.id,
        name: "Forsøk på å endre navn",
        created_by: "casting-1",
        created_by_email: "casting@example.test",
        crew: [],
        roles: [{ id: "role-2", projectId: project.id }],
        candidates: [{ id: "candidate-2", projectId: project.id }],
        schedules: [],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: "Originalt prosjektnavn",
      created_by: "owner-1",
      created_by_email: "owner@example.test",
      crew: [{ id: "crew-1", name: "Behold meg" }],
      roles: [{ id: "role-2", projectId: project.id }],
      candidates: [{ id: "candidate-2", projectId: project.id }],
      schedules: [],
    });
    expect(store.get("casting:project:project-casting-1")).toMatchObject({
      created_by: "owner-1",
      roles: [{ id: "role-2", projectId: project.id }],
    });
  });

  it("unions additional roles when authorizing a casting write", async () => {
    const { handlers, store } = makeHarness("multi-role-1", [project], {
      role: "viewer",
      additionalRoles: ["casting_director"],
    });
    store.set("casting:project:project-casting-1", { ...project, roles: [] });

    const res = await call(handlers, "POST /api/casting/projects", {
      body: { id: project.id, roles: [{ id: "role-1", projectId: project.id }] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.roles).toEqual([{ id: "role-1", projectId: project.id }]);
  });

  it("applies the same field boundary to the legacy PUT contract", async () => {
    const { handlers, store } = makeHarness("casting-1", [project], { role: "casting_director" });
    store.set("casting:project:project-casting-1", {
      ...project,
      crew: [{ id: "crew-1" }],
      schedules: [{ id: "schedule-old" }],
    });

    const res = await call(handlers, "PUT /api/casting/projects/:projectId", {
      params: { projectId: project.id },
      body: {
        id: project.id,
        name: "Skal ignoreres",
        crew: [],
        schedules: [{ id: "schedule-new", projectId: project.id }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: "Originalt prosjektnavn",
      created_by: "owner-1",
      crew: [{ id: "crew-1" }],
      schedules: [{ id: "schedule-new", projectId: project.id }],
    });
  });

  it("denies an ordinary member and leaves the compat project unchanged", async () => {
    const { handlers, store } = makeHarness("viewer-1", [project], { role: "viewer" });
    const original = { ...project, roles: [{ id: "role-1" }] };
    store.set("casting:project:project-casting-1", original);

    const res = await call(handlers, "POST /api/casting/projects", {
      body: { id: project.id, roles: [{ id: "forbidden" }] },
    });

    expect(res.statusCode).toBe(404);
    expect(store.get("casting:project:project-casting-1")).toEqual(original);
  });
});
