import { describe, expect, it } from "vitest";

import { setupCastingPoolsRoutes } from "./casting-pools-routes.js";

// Lettvekts-harness: fanger route-handlere + fake compatStore/session, så vi kan
// invokere audition-pool-handlerne direkte uten en ekte Express-server.
function harness(session: { userId: string } | null) {
  const handlers = new Map<string, (req: any, res: any) => any>();
  const app: any = {
    get: (p: string, h: any) => handlers.set(`GET ${p}`, h),
    post: (p: string, h: any) => handlers.set(`POST ${p}`, h),
    delete: (p: string, h: any) => handlers.set(`DELETE ${p}`, h),
    put: (p: string, h: any) => handlers.set(`PUT ${p}`, h),
    patch: (p: string, h: any) => handlers.set(`PATCH ${p}`, h),
  };
  const store = new Map<string, unknown>();
  setupCastingPoolsRoutes({
    app,
    requireUserSession: () => session,
    compatStoreGet: async (k: string) => (store.has(k) ? store.get(k) : null) as any,
    compatStoreSet: async (k: string, v: unknown) => {
      store.set(k, v);
    },
    compatStoreDelete: async (k: string) => {
      store.delete(k);
    },
    compatStoreListByPrefix: async (prefix: string) =>
      Array.from(store.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([key, value]) => ({ key, value })) as any,
  });
  return { handlers, store };
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b: unknown) => {
    res.body = b;
    return res;
  };
  return res;
}

async function call(
  handlers: Map<string, any>,
  key: string,
  req: any,
): Promise<any> {
  const res = makeRes();
  await handlers.get(key)!(req, res);
  return res;
}

describe("audition-pool routes", () => {
  it("save → list → delete round-trip (owner-scopet)", async () => {
    const { handlers } = harness({ userId: "user-A" });

    // Lagre
    const saved = await call(handlers, "POST /api/casting/audition-pool", {
      body: { title: "Callback dag 1", durationMinutes: 45, tags: ["callback"] },
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.body.success).toBe(true);
    const auditionId = saved.body.auditionId;
    expect(typeof auditionId).toBe("string");
    expect(saved.body.audition.ownerUserId).toBe("user-A");

    // List
    const listed = await call(handlers, "GET /api/casting/audition-pool", {});
    expect(listed.body.success).toBe(true);
    expect(listed.body.auditions).toHaveLength(1);
    expect(listed.body.auditions[0].title).toBe("Callback dag 1");

    // Slett
    const del = await call(handlers, "DELETE /api/casting/audition-pool/:auditionId", {
      params: { auditionId },
    });
    expect(del.body.success).toBe(true);

    const empty = await call(handlers, "GET /api/casting/audition-pool", {});
    expect(empty.body.auditions).toHaveLength(0);
  });

  it("defaulter manglende felt (tittel/varighet/tags/requirements)", async () => {
    const { handlers } = harness({ userId: "user-A" });
    const saved = await call(handlers, "POST /api/casting/audition-pool", { body: {} });
    expect(saved.body.audition).toMatchObject({
      title: "Uten tittel",
      durationMinutes: 30,
      requirements: {},
      tags: [],
    });
  });

  it("owner-scoping: bruker B ser IKKE bruker As audition", async () => {
    const shared = harness({ userId: "user-A" });
    await call(shared.handlers, "POST /api/casting/audition-pool", { body: { title: "As" } });

    // Ny harness for bruker B, men DELT store (samme compatStore-innhold).
    const handlersB = new Map<string, any>();
    const appB: any = {
      get: (p: string, h: any) => handlersB.set(`GET ${p}`, h),
      post: () => {}, delete: () => {}, put: () => {}, patch: () => {},
    };
    setupCastingPoolsRoutes({
      app: appB,
      requireUserSession: () => ({ userId: "user-B" }),
      compatStoreGet: async (k: string) => (shared.store.has(k) ? shared.store.get(k) : null) as any,
      compatStoreSet: async () => {},
      compatStoreDelete: async () => {},
      compatStoreListByPrefix: async (prefix: string) =>
        Array.from(shared.store.entries()).filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })) as any,
    });
    const listB = await call(handlersB, "GET /api/casting/audition-pool", {});
    expect(listB.body.auditions).toHaveLength(0);
  });

  it("import-to-project: gyldig → scheduleId; ugyldig → 400", async () => {
    const { handlers } = harness({ userId: "user-A" });
    const saved = await call(handlers, "POST /api/casting/audition-pool", { body: { title: "X" } });
    const poolAuditionId = saved.body.auditionId;

    const ok = await call(handlers, "POST /api/casting/audition-pool/import-to-project", {
      body: { poolAuditionId, targetProjectId: "proj-1" },
    });
    expect(ok.statusCode).toBe(201);
    expect(typeof ok.body.scheduleId).toBe("string");

    const bad = await call(handlers, "POST /api/casting/audition-pool/import-to-project", {
      body: { poolAuditionId: "nope", targetProjectId: "" },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.success).toBe(false);
  });

  it("schedules/save-to-pool: scheduleId → poolAuditionId; mangler → 400", async () => {
    const { handlers } = harness({ userId: "user-A" });
    const ok = await call(handlers, "POST /api/casting/schedules/save-to-pool", {
      body: { scheduleId: "sched-9", title: "Fra schedule" },
    });
    expect(ok.statusCode).toBe(201);
    expect(typeof ok.body.poolAuditionId).toBe("string");
    // Round-trips inn i listen
    const listed = await call(handlers, "GET /api/casting/audition-pool", {});
    expect(listed.body.auditions[0]).toMatchObject({ title: "Fra schedule", sourceScheduleId: "sched-9" });

    const bad = await call(handlers, "POST /api/casting/schedules/save-to-pool", { body: {} });
    expect(bad.statusCode).toBe(400);
  });

  it("uten session → handler svarer ikke success (401-gate)", async () => {
    const { handlers } = harness(null);
    const res = await call(handlers, "GET /api/casting/audition-pool", {});
    expect(res.body).toBeUndefined(); // requireUserSession returnerte null → tidlig return
  });
});
