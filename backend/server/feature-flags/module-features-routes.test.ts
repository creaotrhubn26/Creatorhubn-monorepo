import { describe, expect, it, vi } from "vitest";

import { registerModuleFeaturesRoutes } from "./module-features-routes.js";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

function setup(queryImpl?: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>) {
  let handler: Handler | null = null;
  const app = {
    get: (_path: string, h: Handler) => {
      handler = h;
    },
  } as unknown as import("express").Express;

  const pool = {
    query: vi.fn(queryImpl ?? (async () => ({ rows: [] }))),
  } as unknown as import("pg").Pool;

  const activeSessions = new Map([
    ["token-1", { userId: "user-1", email: "a@b.no" }],
  ]);

  registerModuleFeaturesRoutes({ app, pool, activeSessions });
  if (!handler) throw new Error("route not registered");
  return { handler: handler as Handler, pool };
}

function makeReq(params: Record<string, string>, token?: string) {
  return {
    params,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function makeRes() {
  const res: {
    statusCode: number;
    body: unknown;
    status: (n: number) => typeof res;
    json: (b: unknown) => typeof res;
  } = {
    statusCode: 200,
    body: null,
    status(n: number) {
      res.statusCode = n;
      return res;
    },
    json(b: unknown) {
      res.body = b;
      return res;
    },
  };
  return res;
}

describe("GET /api/module-features/:moduleKey/:featureKey", () => {
  it("returns 401 without a valid session", async () => {
    const { handler } = setup();
    const res = makeRes();
    await handler(makeReq({ moduleKey: "leadgrid", featureKey: "core" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects malformed keys", async () => {
    const { handler } = setup();
    const res = makeRes();
    await handler(
      makeReq({ moduleKey: "lead grid;drop", featureKey: "core" }, "token-1"),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("defaults leadgrid:core to enabled when no override rows exist", async () => {
    const { handler } = setup(async () => ({ rows: [] }));
    const res = makeRes();
    await handler(makeReq({ moduleKey: "leadgrid", featureKey: "core" }, "token-1"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      moduleKey: "leadgrid",
      featureKey: "core",
      state: "included",
      enabled: true,
    });
  });

  it("defaults unknown modules to locked when no override rows exist", async () => {
    const { handler } = setup(async () => ({ rows: [] }));
    const res = makeRes();
    await handler(
      makeReq({ moduleKey: "some_future_module", featureKey: "core" }, "token-1"),
      res,
    );
    expect(res.body).toMatchObject({ state: "locked", enabled: false });
  });

  it("returns a locked override from module_feature_entitlements", async () => {
    const { handler } = setup(async (sql: string) => {
      if (sql.includes("module_feature_entitlements")) {
        return { rows: [{ state: "locked", trial_ends_at: null }] };
      }
      return { rows: [] }; // org-resolver-oppslag → solo-fallback
    });
    const res = makeRes();
    await handler(makeReq({ moduleKey: "leadgrid", featureKey: "core" }, "token-1"), res);
    expect(res.body).toMatchObject({ state: "locked", enabled: false });
  });

  it("fails open to the code-default on DB errors", async () => {
    const { handler } = setup(async () => {
      throw new Error("connection refused");
    });
    const res = makeRes();
    await handler(makeReq({ moduleKey: "leadgrid", featureKey: "core" }, "token-1"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ state: "included", enabled: true });
  });
});
