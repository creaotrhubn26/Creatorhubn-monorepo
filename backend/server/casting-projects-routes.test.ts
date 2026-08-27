import { describe, expect, it, vi } from "vitest";

import { setupCastingProjectsRoutes } from "./casting-projects-routes.js";

function makeHarness(sessionUserId: string, canonicalRows: Array<Record<string, unknown>>) {
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
