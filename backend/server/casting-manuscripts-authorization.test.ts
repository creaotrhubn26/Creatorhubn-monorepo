import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./role-room-tab-access.js", () => ({
  viewerMeetsTabLevel: vi.fn(async () => true),
}));

import { setupCastingManuscriptsRoutes } from "./casting-manuscripts-routes.js";
import { viewerMeetsTabLevel } from "./role-room-tab-access.js";

type Method = "get" | "post" | "put" | "patch" | "delete";

function routeHarness() {
  const handlers = new Map<string, (req: any, res: any) => unknown>();
  const registrations: string[] = [];
  const app: Record<string, unknown> = {};
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    app[method] = (path: string, handler: (req: any, res: any) => unknown) => {
      const routeKey = `${method}:${path}`;
      registrations.push(routeKey);
      handlers.set(routeKey, handler);
      return app;
    };
  }

  return {
    app,
    registrations,
    async dispatch(
      method: Method,
      path: string,
      input: {
        body?: unknown;
        params?: Record<string, string>;
        query?: Record<string, string>;
        headers?: Record<string, string>;
      } = {},
    ) {
      const handler = handlers.get(`${method}:${path}`);
      if (!handler) throw new Error(`missing route ${method}:${path}`);
      const response = { status: 200, body: undefined as unknown };
      const res = {
        status(code: number) {
          response.status = code;
          return res;
        },
        json(value: unknown) {
          response.body = value;
          return res;
        },
        send(value: unknown) {
          response.body = value;
          return res;
        },
        setHeader() {
          return res;
        },
        end() {
          return res;
        },
      };
      await handler(
        {
          body: input.body ?? {},
          params: input.params ?? {},
          query: input.query ?? {},
          headers: input.headers ?? {},
        },
        res,
      );
      return response;
    },
  };
}

function makeHarness(options: {
  userId?: string;
  pool?: { query: ReturnType<typeof vi.fn> };
} = {}) {
  const userId = options.userId ?? "alice";
  const manuscripts = new Map<string, Record<string, unknown>>([
    ["m-alice", { id: "m-alice", projectId: "p-alice", version: 1 }],
    ["m-bob", { id: "m-bob", projectId: "p-bob", version: 1 }],
  ]);
  const mutationSpies = {
    replaceManuscript: vi.fn(),
    clearManuscriptState: vi.fn(),
    acquireLock: vi.fn(async () => ({ ok: true, lock: null })),
    heartbeatLock: vi.fn(async () => ({ ok: true, lock: null })),
    releaseLock: vi.fn(async () => ({ released: true, lock: null })),
    mutateScenes: vi.fn(),
    replaceDialogue: vi.fn(),
    replaceRevisions: vi.fn(),
    replaceActs: vi.fn(),
  };
  const service = {
    getManuscript: vi.fn(async (id: string) => manuscripts.get(id) ?? null),
    listManuscripts: vi.fn(async () => []),
    getLock: vi.fn(async () => null),
    getDialogue: vi.fn(async () => []),
    getRevisions: vi.fn(async () => []),
    getActs: vi.fn(async () => []),
    findDialogueLocation: vi.fn(async (id: string) =>
      id === "dialogue-bob" ? { manuscriptId: "m-bob", index: 0 } : null,
    ),
    findActLocation: vi.fn(async (id: string) =>
      id === "act-bob" ? { manuscriptId: "m-bob", index: 0 } : null,
    ),
    ...mutationSpies,
  };
  const revisionsService = {
    restoreRevision: vi.fn(),
    getRevisionById: vi.fn(),
    diffRevisions: vi.fn(),
  };
  const routes = routeHarness();
  setupCastingManuscriptsRoutes({
    app: routes.app as any,
    requireUserSession: () => ({ userId }),
    compatStoreGet: async <T>(key: string): Promise<T | null> => {
      if (key === "casting:project:p-alice") {
        return { created_by: "alice" } as T;
      }
      if (key === "casting:project:p-bob") {
        return { created_by: "bob" } as T;
      }
      return null;
    },
    manuscriptsService: service as any,
    revisionsService: revisionsService as any,
    pool: options.pool as any,
  });
  return { routes, service, revisionsService, mutationSpies };
}

beforeEach(() => {
  vi.mocked(viewerMeetsTabLevel).mockReset();
  vi.mocked(viewerMeetsTabLevel).mockResolvedValue(true);
});

describe("casting manuscript tenant authorization", () => {
  const foreignMutations: Array<{
    method: Method;
    path: string;
    input: Parameters<ReturnType<typeof routeHarness>["dispatch"]>[2];
  }> = [
    {
      method: "post",
      path: "/api/casting/manuscripts",
      input: { body: { id: "m-bob", projectId: "p-alice" } },
    },
    {
      method: "put",
      path: "/api/casting/manuscripts/:manuscriptId",
      input: { params: { manuscriptId: "m-bob" }, body: { projectId: "p-bob" } },
    },
    {
      method: "delete",
      path: "/api/casting/manuscripts/:manuscriptId",
      input: { params: { manuscriptId: "m-bob" } },
    },
    {
      method: "post",
      path: "/api/casting/manuscripts/:manuscriptId/lock",
      input: { params: { manuscriptId: "m-bob" }, body: { force: true } },
    },
    {
      method: "post",
      path: "/api/casting/manuscripts/:manuscriptId/lock/heartbeat",
      input: { params: { manuscriptId: "m-bob" } },
    },
    {
      method: "delete",
      path: "/api/casting/manuscripts/:manuscriptId/lock",
      input: { params: { manuscriptId: "m-bob" } },
    },
    {
      method: "get",
      path: "/api/casting/manuscripts/:manuscriptId/lock",
      input: { params: { manuscriptId: "m-bob" } },
    },
    {
      method: "post",
      path: "/api/casting/manuscripts/:manuscriptId/presence",
      input: { params: { manuscriptId: "m-bob" }, body: { displayName: "Alice" } },
    },
    {
      method: "get",
      path: "/api/casting/manuscripts/:manuscriptId/presence",
      input: { params: { manuscriptId: "m-bob" } },
    },
    {
      method: "post",
      path: "/api/casting/dialogue",
      input: { body: { manuscriptId: "m-bob", id: "dialogue-new" } },
    },
    {
      method: "delete",
      path: "/api/casting/dialogue/:dialogueId",
      input: {
        params: { dialogueId: "dialogue-bob" },
        query: { manuscriptId: "m-bob" },
      },
    },
    {
      method: "post",
      path: "/api/casting/revisions",
      input: { body: { manuscriptId: "m-bob", id: "revision-new" } },
    },
    {
      method: "post",
      path: "/api/casting/manuscripts/:manuscriptId/restore-revision/:revisionId",
      input: { params: { manuscriptId: "m-bob", revisionId: "revision-bob" } },
    },
    {
      method: "post",
      path: "/api/casting/manuscripts/:manuscriptId/import",
      input: { params: { manuscriptId: "m-bob" }, body: { text: "INT. ROOM" } },
    },
    {
      method: "post",
      path: "/api/casting/acts",
      input: { body: { manuscriptId: "m-bob", id: "act-new" } },
    },
    {
      method: "put",
      path: "/api/casting/acts/:actId",
      input: {
        params: { actId: "act-bob" },
        body: { manuscriptId: "m-bob", title: "stolen" },
      },
    },
    {
      method: "delete",
      path: "/api/casting/acts/:actId",
      input: {
        params: { actId: "act-bob" },
        query: { manuscriptId: "m-bob" },
      },
    },
  ];

  for (const entry of foreignMutations) {
    it(`fails closed without mutation: ${entry.method} ${entry.path}`, async () => {
      const { routes, mutationSpies, revisionsService } = makeHarness();
      const response = await routes.dispatch(entry.method, entry.path, entry.input);

      expect(response).toEqual({ status: 404, body: { error: "not_found" } });
      for (const spy of Object.values(mutationSpies)) {
        expect(spy).not.toHaveBeenCalled();
      }
      expect(revisionsService.restoreRevision).not.toHaveBeenCalled();
    });
  }

  it("rejects project reassignment for a manuscript the user owns", async () => {
    const { routes, mutationSpies } = makeHarness();
    const response = await routes.dispatch(
      "put",
      "/api/casting/manuscripts/:manuscriptId",
      {
        params: { manuscriptId: "m-alice" },
        body: { projectId: "p-bob" },
      },
    );

    expect(response).toEqual({
      status: 409,
      body: { error: "project_reassignment_requires_dedicated_operation" },
    });
    expect(mutationSpies.replaceManuscript).not.toHaveBeenCalled();
  });

  it("rejects a client manuscript id already normalized under another project", async () => {
    const pool = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("FROM casting_projects cp")) {
          return { rows: [{ can_access: true }], rowCount: 1 };
        }
        if (statement.includes("FROM casting_manuscripts")) {
          return { rows: [{ project_id: "p-bob" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const { routes, mutationSpies } = makeHarness({ pool });

    const response = await routes.dispatch("post", "/api/casting/manuscripts", {
      body: { id: "normalized-bob-id", projectId: "p-alice" },
    });

    expect(response).toEqual({
      status: 409,
      body: { error: "manuscript_identity_conflict" },
    });
    expect(mutationSpies.replaceManuscript).not.toHaveBeenCalled();
  });

  it("binds a scene mirror to the manuscript project and rejects payload reassignment", async () => {
    const { routes, mutationSpies } = makeHarness();
    const response = await routes.dispatch("post", "/api/casting/scenes", {
      body: {
        id: "scene-alice",
        manuscriptId: "m-alice",
        projectId: "p-bob",
        storyboardFrames: [{ id: "frame-bob" }],
      },
    });

    expect(response).toEqual({
      status: 409,
      body: { error: "scene_project_mismatch" },
    });
    expect(mutationSpies.mutateScenes).not.toHaveBeenCalled();
  });

  it("rejects a client scene id already bound to another project and manuscript", async () => {
    const pool = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("FROM casting_projects cp")) {
          return { rows: [{ can_access: true }], rowCount: 1 };
        }
        if (statement.includes("FROM casting_scenes")) {
          return {
            rows: [{ project_id: "p-bob", manuscript_id: "m-bob" }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const { routes, mutationSpies } = makeHarness({ pool });

    const response = await routes.dispatch("post", "/api/casting/scenes", {
      body: {
        id: "scene-bob",
        manuscriptId: "m-alice",
        projectId: "p-alice",
      },
    });

    expect(response).toEqual({
      status: 409,
      body: { error: "scene_identity_conflict" },
    });
    expect(mutationSpies.mutateScenes).not.toHaveBeenCalled();
  });

  it("fails closed for a removed or expired canonical project member", async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ can_access: false }],
        rowCount: 1,
      })),
    };
    const { routes } = makeHarness({
      userId: "former-member",
      pool,
    });

    const response = await routes.dispatch(
      "get",
      "/api/casting/manuscripts/:manuscriptId",
      { params: { manuscriptId: "m-bob" } },
    );

    expect(response).toEqual({ status: 404, body: { error: "not_found" } });
    const membershipSQL = String(pool.query.mock.calls[0]?.[0]);
    expect(membershipSQL).toContain("cur.deactivated_at IS NULL");
    expect(membershipSQL).toContain(
      "cur.expires_at IS NULL OR cur.expires_at > NOW()",
    );
    expect(viewerMeetsTabLevel).not.toHaveBeenCalled();
  });

  it("does not fall back to stale compat ownership on a canonical DB failure", async () => {
    const databaseError = Object.assign(new Error("connection lost"), {
      code: "57P01",
    });
    const pool = {
      query: vi.fn(async () => {
        throw databaseError;
      }),
    };
    const { routes } = makeHarness({ userId: "alice", pool });

    const response = await routes.dispatch(
      "get",
      "/api/casting/manuscripts/:manuscriptId",
      { params: { manuscriptId: "m-alice" } },
    );

    expect(response).toEqual({ status: 404, body: { error: "not_found" } });
  });

  it("allows view access but denies mutation when Storyboard RBAC is view-only", async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ project_exists: true, can_access: true }],
        rowCount: 1,
      })),
    };
    vi.mocked(viewerMeetsTabLevel).mockImplementation(
      async (_pool, _projectId, _userId, _tab, need) => need === "view",
    );
    const { routes, mutationSpies } = makeHarness({
      userId: "project-viewer",
      pool,
    });

    const read = await routes.dispatch(
      "get",
      "/api/casting/manuscripts/:manuscriptId",
      { params: { manuscriptId: "m-bob" } },
    );
    const write = await routes.dispatch(
      "put",
      "/api/casting/manuscripts/:manuscriptId",
      { params: { manuscriptId: "m-bob" }, body: { projectId: "p-bob" } },
    );

    expect(read.status).toBe(200);
    expect(write).toEqual({ status: 404, body: { error: "not_found" } });
    expect(mutationSpies.replaceManuscript).not.toHaveBeenCalled();
    expect(viewerMeetsTabLevel).toHaveBeenCalledWith(
      pool,
      "p-bob",
      "project-viewer",
      "storyboard",
      "manage",
    );
  });

  it("registers and dispatches the static revision diff route before the dynamic revision route", async () => {
    const { routes, revisionsService } = makeHarness();
    const diff = { fromRevisionId: "r-1", toRevisionId: "r-2", patch: [] };
    revisionsService.diffRevisions.mockResolvedValue(diff);

    const staticRoute =
      "get:/api/casting/manuscripts/:manuscriptId/revisions/diff";
    const dynamicRoute =
      "get:/api/casting/manuscripts/:manuscriptId/revisions/:revisionId";
    expect(routes.registrations.indexOf(staticRoute)).toBeGreaterThanOrEqual(0);
    expect(routes.registrations.indexOf(staticRoute)).toBeLessThan(
      routes.registrations.indexOf(dynamicRoute),
    );

    const response = await routes.dispatch(
      "get",
      "/api/casting/manuscripts/:manuscriptId/revisions/diff",
      {
        params: { manuscriptId: "m-alice" },
        query: { from: "r-1", to: "r-2" },
      },
    );

    expect(response).toEqual({ status: 200, body: diff });
    expect(revisionsService.diffRevisions).toHaveBeenCalledWith(
      "m-alice",
      "r-1",
      "r-2",
    );
    expect(revisionsService.getRevisionById).not.toHaveBeenCalled();
  });

  it("resolves the literal revision diff URL to the diff handler in Express", async () => {
    const app = express();
    const revisionsService = {
      diffRevisions: vi.fn(async () => ({ patch: [{ op: "replace" }] })),
      getRevisionById: vi.fn(async () => null),
      restoreRevision: vi.fn(),
    };
    setupCastingManuscriptsRoutes({
      app,
      requireUserSession: () => ({ userId: "alice" }),
      compatStoreGet: async <T>(key: string): Promise<T | null> =>
        key === "casting:project:p-alice"
          ? ({ created_by: "alice" } as T)
          : null,
      manuscriptsService: {
        getManuscript: vi.fn(async (id: string) =>
          id === "m-alice"
            ? { id: "m-alice", projectId: "p-alice", version: 1 }
            : null,
        ),
      } as any,
      revisionsService: revisionsService as any,
    });

    const response = await request(app).get(
      "/api/casting/manuscripts/m-alice/revisions/diff?from=r-1&to=r-2",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ patch: [{ op: "replace" }] });
    expect(revisionsService.diffRevisions).toHaveBeenCalledWith(
      "m-alice",
      "r-1",
      "r-2",
    );
    expect(revisionsService.getRevisionById).not.toHaveBeenCalled();
  });

  it.each([
    ["delete", "/api/casting/dialogue/:dialogueId", "dialogueId"],
    ["get", "/api/casting/acts/:actId", "actId"],
    ["delete", "/api/casting/acts/:actId", "actId"],
  ] as const)(
    "requires manuscript scope before %s %s entity lookup",
    async (method, path, parameterName) => {
      const { routes, service, mutationSpies } = makeHarness();
      const response = await routes.dispatch(method, path, {
        params: { [parameterName]: "shared-id" },
      });

      expect(response).toEqual({
        status: 400,
        body: { error: "manuscriptId is required" },
      });
      expect(service.findDialogueLocation).not.toHaveBeenCalled();
      expect(service.findActLocation).not.toHaveBeenCalled();
      expect(service.getDialogue).not.toHaveBeenCalled();
      expect(service.getActs).not.toHaveBeenCalled();
      expect(mutationSpies.replaceDialogue).not.toHaveBeenCalled();
      expect(mutationSpies.replaceActs).not.toHaveBeenCalled();
    },
  );

  it("deletes a colliding dialogue id only inside the authorized manuscript", async () => {
    const { routes, service, mutationSpies } = makeHarness();
    service.findDialogueLocation.mockResolvedValue({
      manuscriptId: "m-bob",
      index: 0,
    });
    service.getDialogue.mockImplementation(async (manuscriptId: string) => [
      { id: "shared-dialogue", manuscriptId },
      { id: `${manuscriptId}-keep`, manuscriptId },
    ]);

    const response = await routes.dispatch(
      "delete",
      "/api/casting/dialogue/:dialogueId",
      {
        params: { dialogueId: "shared-dialogue" },
        query: { manuscriptId: "m-alice" },
      },
    );

    expect(response).toEqual({ status: 200, body: { ok: true } });
    expect(service.findDialogueLocation).not.toHaveBeenCalled();
    expect(service.getDialogue).toHaveBeenCalledWith("m-alice");
    expect(mutationSpies.replaceDialogue).toHaveBeenCalledWith("m-alice", [
      { id: "m-alice-keep", manuscriptId: "m-alice" },
    ]);
  });

  it("updates a colliding act id only inside the authorized manuscript", async () => {
    const { routes, service, mutationSpies } = makeHarness();
    service.findActLocation.mockResolvedValue({ manuscriptId: "m-bob", index: 0 });
    service.getActs.mockImplementation(async (manuscriptId: string) => [
      {
        id: "shared-act",
        manuscriptId,
        title: `${manuscriptId} title`,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await routes.dispatch("put", "/api/casting/acts/:actId", {
      params: { actId: "shared-act" },
      body: { manuscriptId: "m-alice", title: "Alice revised" },
    });

    expect(response.status).toBe(200);
    expect(service.findActLocation).not.toHaveBeenCalled();
    expect(service.getActs).toHaveBeenCalledWith("m-alice");
    expect(mutationSpies.replaceActs).toHaveBeenCalledWith(
      "m-alice",
      expect.arrayContaining([
        expect.objectContaining({
          id: "shared-act",
          manuscriptId: "m-alice",
          manuscript_id: "m-alice",
          title: "Alice revised",
        }),
      ]),
    );
  });

  it("deletes a colliding act id only inside the authorized manuscript", async () => {
    const { routes, service, mutationSpies } = makeHarness();
    service.findActLocation.mockResolvedValue({ manuscriptId: "m-bob", index: 0 });
    service.getActs.mockImplementation(async (manuscriptId: string) => [
      { id: "shared-act", manuscriptId },
      { id: `${manuscriptId}-keep`, manuscriptId },
    ]);

    const response = await routes.dispatch(
      "delete",
      "/api/casting/acts/:actId",
      {
        params: { actId: "shared-act" },
        query: { manuscriptId: "m-alice" },
      },
    );

    expect(response).toEqual({ status: 200, body: { ok: true } });
    expect(service.findActLocation).not.toHaveBeenCalled();
    expect(service.getActs).toHaveBeenCalledWith("m-alice");
    expect(mutationSpies.replaceActs).toHaveBeenCalledWith("m-alice", [
      { id: "m-alice-keep", manuscriptId: "m-alice" },
    ]);
  });
});
