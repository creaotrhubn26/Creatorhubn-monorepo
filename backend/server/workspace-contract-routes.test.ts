import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupPresenceHeartbeatRoutes } from "./presence-heartbeat-routes";
import { setupProjectTeamRoutes } from "./project-team-routes";
import { setupProjectWorkspaceRoutes } from "./project-workspace-routes";
import { setupProjectsOutliersRoutes } from "./projects-outliers-routes";
import { invalidateGenSettings } from "./generative-media";
import { tickLegacyGenerativeAiBillingSettlements } from "./storyboard-ai-video-durability";

const milestoneRow = {
  id: "milestone-1",
  project_id: "project-1",
  title: "Opptaksdag",
  description: null,
  category: "Produksjon",
  type: "milestone",
  due_date: "2026-09-14",
  scheduled_date: null,
  status: "planned",
  progress: 0,
  priority: "medium",
  location: "Oslo",
  internal_notes: null,
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

function milestoneApp() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT 1 WHERE EXISTS")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT role, permissions")) {
        const userId = String(params[1]);
        const canEdit = userId === "editor-user";
        return {
          rows: [{ role: canEdit ? "member" : "viewer", permissions: { canRead: true, canEdit } }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE project_milestones")) {
        return { rows: [{ ...milestoneRow, status: "completed", progress: 100 }], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM project_milestones")) {
        return { rows: [{ id: milestoneRow.id }], rowCount: 1 };
      }
      if (sql.includes("SELECT * FROM project_milestones")) {
        return { rows: [milestoneRow], rowCount: 1 };
      }
      // Runtime team-schema bootstrap and unrelated registered routes.
      return { rows: [], rowCount: 0 };
    },
  };
  const app = express();
  app.use(express.json());
  setupProjectsOutliersRoutes({
    app,
    pool: pool as any,
    db: {} as any,
    requireUserSession: (req: express.Request, res: express.Response) => {
      const userId = String(req.headers["x-test-user"] || "");
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return null;
      }
      return { userId, email: `${userId}@example.test`, name: userId, role: "user" };
    },
  });
  return { app, queries };
}

describe("workspace milestone contract", () => {
  it("lets a viewer read the canonical milestone response", async () => {
    const { app } = milestoneApp();
    const response = await request(app)
      .get("/api/projects/project-1/milestones")
      .set("x-test-user", "viewer-user");

    expect(response.status).toBe(200);
    expect(response.body.milestones).toEqual([
      expect.objectContaining({ id: "milestone-1", dueDate: "2026-09-14", progress: 0 }),
    ]);
  });

  it("blocks a viewer from milestone mutations", async () => {
    const { app, queries } = milestoneApp();
    const response = await request(app)
      .patch("/api/projects/project-1/milestones/milestone-1")
      .set("x-test-user", "viewer-user")
      .send({ status: "completed" });

    expect(response.status).toBe(404);
    expect(queries.some((q) => q.sql.includes("UPDATE project_milestones"))).toBe(false);
  });

  it("lets an editor patch and delete a milestone scoped to the project", async () => {
    const { app, queries } = milestoneApp();
    const patchResponse = await request(app)
      .patch("/api/projects/project-1/milestones/milestone-1")
      .set("x-test-user", "editor-user")
      .send({ status: "completed", progress: 100 });
    const deleteResponse = await request(app)
      .delete("/api/projects/project-1/milestones/milestone-1")
      .set("x-test-user", "editor-user");

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toEqual(expect.objectContaining({ status: "completed", progress: 100 }));
    expect(deleteResponse.status).toBe(200);
    const update = queries.find((q) => q.sql.includes("UPDATE project_milestones"));
    expect(update?.sql).toContain("project_id");
    expect(update?.params).toContain("project-1");
  });
});

describe("presence heartbeat contract", () => {
  it("persists route and accepts the legacy currentRoute key during rollout", async () => {
    const calls: unknown[][] = [];
    const app = express();
    app.use(express.json());
    setupPresenceHeartbeatRoutes({
      app,
      pool: { query: async (_sql: string, params: unknown[]) => { calls.push(params); return { rows: [] }; } } as any,
      getActiveSessionFromRequest: () => ({ userId: "user-1" } as any),
    });

    expect((await request(app).post("/api/presence/heartbeat").send({ route: "/workspace/p/photo-room" })).status).toBe(200);
    expect((await request(app).post("/api/presence/heartbeat").send({ currentRoute: "/workspace/p/video-room" })).status).toBe(200);
    expect(calls[0][1]).toBe("/workspace/p/photo-room");
    expect(calls[1][1]).toBe("/workspace/p/video-room");
  });
});

describe("team presence response", () => {
  it("counts the owner and exposes each active participant's current route", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("SELECT 1 WHERE EXISTS")) return { rows: [{ ok: 1 }], rowCount: 1 };
        if (sql.includes("WITH participants AS")) {
          return {
            rows: [
              {
                user_id: "owner-user",
                email: "owner@example.test",
                name: "Owner",
                crew_role: null,
                online: true,
                current_route: "/workspace/project-1/photo-room",
              },
              {
                user_id: "editor-user",
                email: "editor@example.test",
                name: "Editor",
                crew_role: "editor",
                online: true,
                current_route: "/workspace/project-1/video-room",
              },
            ],
            rowCount: 2,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const app = express();
    setupProjectTeamRoutes({
      app,
      pool,
      requireUserSession: () => ({
        userId: "owner-user",
        email: "owner@example.test",
        name: "Owner",
        role: "user",
      }),
      escapeHtml: (value) => value,
    });

    const response = await request(app).get("/api/projects/project-1/team/presence");
    expect(response.status).toBe(200);
    expect(response.body.online).toBe(2);
    expect(response.body.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "owner-user", currentRoute: "/workspace/project-1/photo-room" }),
      expect.objectContaining({ userId: "editor-user", currentRoute: "/workspace/project-1/video-room" }),
    ]));
  });
});

describe("workspace mutation guard", () => {
  it("allows a viewer to read but rejects project-content mutations", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("SELECT 1 WHERE EXISTS")) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT role, permissions")) {
          return {
            rows: [{ role: "viewer", permissions: { canRead: true, canEdit: false } }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const app = express();
    app.use(express.json());
    setupProjectWorkspaceRoutes({
      app,
      pool,
      requireUserSession: () => ({
        userId: "viewer-user",
        email: "viewer@example.test",
        name: "Viewer",
        role: "user",
      }),
    });

    const response = await request(app)
      .post("/api/projects/project-1/board-tasks")
      .send({ title: "Skal ikke lagres" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "read_only_access" });
  });
});

function imageToVideoApp(options: { assetProjectId?: string } = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT 1 WHERE EXISTS")) return { rows: [{ ok: 1 }], rowCount: 1 };
      if (sql.includes("SELECT email, role FROM users")) {
        return { rows: [{ email: "owner@example.test", role: "super_admin" }], rowCount: 1 };
      }
      if (sql.includes("SELECT * FROM generative_ai_settings")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT consented FROM project_ai_consent")) {
        return { rows: [{ consented: true }], rowCount: 1 };
      }
      if (sql.includes("COALESCE(SUM(est_cost_usd),0)")) return { rows: [{ s: 0 }], rowCount: 1 };
      if (sql.includes("FROM capture_assets a")
          && sql.includes("a.full_key")
          && params[1] === (options.assetProjectId ?? "project-1")) {
        return { rows: [{ full_key: "capture/project-1/full.jpg", preview_key: "capture/project-1/preview.jpg" }], rowCount: 1 };
      }
      return { rows: [], rowCount: sql.includes("INSERT INTO generative_ai_jobs") ? 1 : 0 };
    },
  };
  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool,
    requireUserSession: () => ({
      userId: "owner-user",
      email: "owner@example.test",
      name: "Owner",
      role: "super_admin",
    }),
  });
  return { app, queries };
}

describe("legacy workspace image-to-video safety contract", () => {
  it("replays the legacy billing due index after lazy table creation", async () => {
    const { app, queries } = imageToVideoApp();

    const response = await request(app)
      .post("/api/projects/project-1/ai/image-to-video")
      .send({ model: "higgsfield-dop-i2v", assetId: "asset-1", prompt: "Slow push in" });

    expect(response.status).toBe(409);
    const tablePosition = queries.findIndex((call) =>
      call.sql.includes("CREATE TABLE IF NOT EXISTS generative_ai_jobs"));
    const indexPosition = queries.findIndex((call) =>
      call.sql.includes("generative_ai_jobs_legacy_billing_due_idx"));
    expect(tablePosition).toBeGreaterThanOrEqual(0);
    expect(indexPosition).toBeGreaterThan(tablePosition);
    expect(queries[indexPosition]?.sql).toContain(
      "(input #>> '{legacyBilling,nextAttemptAt}')",
    );
    expect(queries[indexPosition]?.sql).toContain(
      "IN ('pending','retry_wait','delivering')",
    );
  });

  it("blocks Higgsfield before asset lookup, durable-job insertion, or provider I/O", async () => {
    const { app, queries } = imageToVideoApp();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const response = await request(app)
        .post("/api/projects/project-1/ai/image-to-video")
        .send({ model: "higgsfield-dop-i2v", assetId: "asset-1", prompt: "Slow push in" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: "higgsfield_requires_durable_job",
        status: "blocked",
        message: "Higgsfield-generering må startes fra Storyboard Room mens denne arbeidsflyten oppgraderes.",
      });
      expect(queries.some((call) => call.sql.includes("FROM capture_assets a"))).toBe(false);
      expect(queries.some((call) => call.sql.includes("INSERT INTO generative_ai_jobs"))).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("preserves the existing Seedance/FAL submission and durable job insert", async () => {
    const envKeys = [
      "FAL_KEY", "CAPTURE_R2_ENDPOINT", "CAPTURE_R2_BUCKET",
      "CAPTURE_R2_ACCESS_KEY_ID", "CAPTURE_R2_SECRET_ACCESS_KEY",
    ] as const;
    const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    process.env.FAL_KEY = "fal-test-key";
    process.env.CAPTURE_R2_ENDPOINT = "https://r2.example.test";
    process.env.CAPTURE_R2_BUCKET = "capture-test";
    process.env.CAPTURE_R2_ACCESS_KEY_ID = "r2-test-key";
    process.env.CAPTURE_R2_SECRET_ACCESS_KEY = "r2-test-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      request_id: "fal-request-1",
      response_url: "https://queue.fal.run/requests/fal-request-1/status",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    try {
      const { app, queries } = imageToVideoApp();
      const response = await request(app)
        .post("/api/projects/project-1/ai/image-to-video")
        .send({ model: "seedance-2-i2v", assetId: "asset-1", prompt: "Slow push in", duration: 5 });

      expect(response.status).toBe(202);
      expect(response.body).toEqual(expect.objectContaining({ status: "queued", estCostUsd: 0.5 }));
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://queue.fal.run/bytedance/seedance-2.0/image-to-video");
      const assetLookup = queries.find((call) =>
        call.sql.includes("FROM capture_assets a") && call.sql.includes("a.full_key"));
      expect(assetLookup?.sql).toContain("JOIN capture_sessions s ON s.id = a.session_id");
      expect(assetLookup?.sql).toContain("s.project_id = $2");
      expect(assetLookup?.params).toEqual(["asset-1", "project-1"]);
      const insert = queries.find((call) => call.sql.includes("INSERT INTO generative_ai_jobs"));
      expect(insert?.params).toEqual(expect.arrayContaining([
        "project-1", "owner-user", "seedance-2-i2v", "image-to-video",
        "bytedance", "fal-request-1", "asset-1",
      ]));
      expect(JSON.parse(String(insert?.params[9]))).toEqual(expect.objectContaining({
        prompt: "Slow push in",
        billingModeAtSubmit: "free_whitelist",
      }));
    } finally {
      fetchMock.mockRestore();
      for (const key of envKeys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });

  it("rejects a capture asset from another project before FAL or job creation", async () => {
    const previousFalKey = process.env.FAL_KEY;
    process.env.FAL_KEY = "fal-test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const { app, queries } = imageToVideoApp({ assetProjectId: "project-2" });
      const response = await request(app)
        .post("/api/projects/project-1/ai/image-to-video")
        .send({
          model: "seedance-2-i2v",
          assetId: "asset-from-project-2",
          prompt: "Slow push in",
          duration: 5,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "asset_not_found" });
      const assetLookup = queries.find((call) =>
        call.sql.includes("FROM capture_assets a") && call.sql.includes("a.full_key"));
      expect(assetLookup?.params).toEqual([
        "asset-from-project-2",
        "project-1",
      ]);
      expect(queries.some((call) =>
        call.sql.includes("INSERT INTO generative_ai_jobs"))).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      if (previousFalKey === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previousFalKey;
    }
  });

  it.each([
    ["image-edit", { assetId: "asset-from-project-2", prompt: "Lift shadows" }],
    ["suggest", { assetId: "asset-from-project-2", mode: "motion" }],
  ])("rejects cross-project assets in the %s workflow", async (route, body) => {
    const previousFalKey = process.env.FAL_KEY;
    process.env.FAL_KEY = "fal-test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const { app, queries } = imageToVideoApp({ assetProjectId: "project-2" });
      const response = await request(app)
        .post(`/api/projects/project-1/ai/${route}`)
        .send(body);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "asset_not_found" });
      const assetLookup = queries.find((call) =>
        call.sql.includes("FROM capture_assets a"));
      expect(assetLookup?.sql).toContain(
        "JOIN capture_sessions s ON s.id = a.session_id",
      );
      expect(assetLookup?.params).toEqual([
        "asset-from-project-2",
        "project-1",
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      if (previousFalKey === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previousFalKey;
    }
  });
});

function legacyAiJobPollApp(
  outputUrl: string,
  options: {
    sourceAssetId?: string;
    assetProjectId?: string;
    billingMode?: "free_whitelist" | "metered" | "credits";
    legacyBillingIntent?: boolean;
  } = {},
) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const state = {
    completionWins: 0,
    job: {
      id: "job-1",
      project_id: "project-1",
      user_id: "owner-user",
      model: "seedance-2-i2v",
      kind: "image-to-video",
      status: "running",
      provider: "bytedance",
      fal_request_id: "fal-request-1",
      response_url: "https://queue.fal.run/requests/fal-request-1",
      input: {
        prompt: "Slow push in",
        ...(options.legacyBillingIntent ? {
          legacyBilling: {
            status: "pending",
            mode: "metered",
            amountUsd: 1.5,
            userId: "owner-user",
            model: "seedance-2-i2v",
            externalRef: "legacy-generative-ai-meter:job-1",
            meterEventIdentifier: "legacy-generative-ai-job-1",
            deadlineAt: new Date(
              Date.now() + 20 * 60 * 60 * 1_000,
            ).toISOString(),
            nextAttemptAt: null,
            attempts: 0,
          },
        } : {}),
      } as Record<string, any>,
      source_asset_id: options.sourceAssetId ?? null,
      est_cost_usd: 0.5,
      output_b2_key: null as string | null,
      output_url_temp: null as string | null,
      error: null as string | null,
    },
  };
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT 1 WHERE EXISTS")) {
        return { rows: [{ ok: 1 }], rowCount: 1 };
      }
      if (sql.includes("SELECT * FROM generative_ai_jobs")) {
        return { rows: [{ ...state.job }], rowCount: 1 };
      }
      if (sql.includes("SELECT * FROM generative_ai_settings")) {
        return options.billingMode
          ? {
            rows: [{
              enabled: true,
              billing_mode: options.billingMode,
              daily_cap_usd: 20,
              whitelist: [],
              included_quota: 0,
              markup_multiplier: 3,
              credit_packs: null,
            }],
            rowCount: 1,
          }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM capture_assets a")) {
        return params[1] === (options.assetProjectId ?? "project-1")
          ? {
            rows: [{
              preview_key: "capture/project-1/preview.jpg",
              full_key: "capture/project-1/full.jpg",
            }],
            rowCount: 1,
          }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("SET status='completed'") && sql.includes("RETURNING id")) {
        if (!["queued", "running", "processing"].includes(state.job.status)) {
          return { rows: [], rowCount: 0 };
        }
        state.completionWins += 1;
        state.job.status = "completed";
        state.job.output_b2_key = params[0] as string | null;
        state.job.output_url_temp = params[1] as string | null;
        return { rows: [{ id: state.job.id }], rowCount: 1 };
      }
      if (sql.includes("legacy-generative-ai-billing:quarantine")
          || sql.includes("legacy-generative-ai-billing:expire")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("legacy-generative-ai-billing:claim")) {
        const billing = state.job.input.legacyBilling;
        const nextAttempt = billing?.nextAttemptAt
          ? new Date(billing.nextAttemptAt).getTime() : 0;
        if (state.job.status !== "completed"
            || !["pending", "retry_wait"].includes(billing?.status)
            || nextAttempt > Date.now()) {
          return { rows: [], rowCount: 0 };
        }
        state.job.input = {
          ...state.job.input,
          legacyBilling: {
            ...billing,
            status: "delivering",
            leaseOwner: params[0],
            leaseExpiresAt: new Date(Date.now() + 90_000).toISOString(),
            attempts: Number(billing.attempts || 0) + 1,
          },
        };
        return {
          rows: [{
            id: state.job.id,
            project_id: state.job.project_id,
            input: state.job.input,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("legacy-generative-ai-billing:patch")) {
        if (state.job.input.legacyBilling?.leaseOwner !== params[2]) {
          return { rows: [], rowCount: 0 };
        }
        const patch = JSON.parse(String(params[3] || "{}"));
        state.job.input = {
          ...state.job.input,
          legacyBilling: { ...state.job.input.legacyBilling, ...patch },
        };
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("error='untrusted_output_url'")) {
        state.job.status = "failed";
        state.job.error = "untrusted_output_url";
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT stripe_customer_id")) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [],
        rowCount: sql.includes("UPDATE generative_ai_jobs") ? 1 : 0,
      };
    },
  };
  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool,
    requireUserSession: () => ({
      userId: "owner-user",
      email: "owner@example.test",
      name: "Owner",
      role: "super_admin",
    }),
  });
  return { app, pool, queries, outputUrl, state };
}

describe("legacy workspace provider-output archive contract", () => {
  it("rejects an untrusted provider output without fetching or resubmitting it", async () => {
    const previousFalKey = process.env.FAL_KEY;
    process.env.FAL_KEY = "fal-test-key";
    const outputUrl = "http://127.0.0.1:8080/internal.mp4";
    const { app, queries } = legacyAiJobPollApp(outputUrl, {
      sourceAssetId: "asset-from-project-2",
      assetProjectId: "project-2",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({ status: "COMPLETED" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ video: { url: outputUrl } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    try {
      const response = await request(app)
        .get("/api/projects/project-1/ai/jobs/job-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        status: "failed",
        error: "untrusted_output_url",
        beforeUrl: null,
      }));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.some(([url]) => String(url) === outputUrl))
        .toBe(false);
      expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST"))
        .toBe(true);
      const failed = queries.find((call) =>
        call.sql.includes("error='untrusted_output_url'"));
      expect(failed?.params).toEqual(["job-1", "project-1"]);
      const beforeAssetLookup = queries.find((call) =>
        call.sql.includes("FROM capture_assets a"));
      expect(beforeAssetLookup?.params).toEqual([
        "asset-from-project-2",
        "project-1",
      ]);
    } finally {
      fetchMock.mockRestore();
      if (previousFalKey === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previousFalKey;
    }
  });

  it("bounds an oversized trusted output and keeps the safe provider fallback", async () => {
    const previousFalKey = process.env.FAL_KEY;
    process.env.FAL_KEY = "fal-test-key";
    const outputUrl = "https://cdn.fal.media/final.mp4";
    const { app, queries } = legacyAiJobPollApp(outputUrl);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({ status: "COMPLETED" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://queue.fal.run/requests/fal-request-1") {
          return new Response(JSON.stringify({ video: { url: outputUrl } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": String(129 * 1024 * 1024),
          },
        });
      },
    );
    try {
      const response = await request(app)
        .get("/api/projects/project-1/ai/jobs/job-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        status: "completed",
        afterUrl: outputUrl,
      }));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
        redirect: "error",
        signal: expect.any(AbortSignal),
      });
      expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST"))
        .toBe(true);
      const completed = queries.find((call) =>
        call.sql.includes("SET status='completed'"));
      expect(completed?.params).toEqual([
        null, outputUrl, "job-1", "project-1",
      ]);
    } finally {
      fetchMock.mockRestore();
      if (previousFalKey === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previousFalKey;
    }
  });

  it("does not retro-bill a historical job when settings switch to metered", async () => {
    const previous = {
      fal: process.env.FAL_KEY,
      stripe: process.env.STRIPE_SECRET_KEY,
      meter: process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME,
    };
    process.env.FAL_KEY = "fal-test-key";
    process.env.STRIPE_SECRET_KEY = "stripe-test-key";
    process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = "genai_test";
    invalidateGenSettings();
    const outputUrl = "https://cdn.fal.media/repeat-safe.mp4";
    const { app, queries, state } = legacyAiJobPollApp(outputUrl, {
      billingMode: "metered",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({ status: "COMPLETED" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://queue.fal.run/requests/fal-request-1") {
          return new Response(JSON.stringify({ video: { url: outputUrl } }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": String(129 * 1024 * 1024),
          },
        });
      },
    );
    try {
      const first = await request(app)
        .get("/api/projects/project-1/ai/jobs/job-1");
      const second = await request(app)
        .get("/api/projects/project-1/ai/jobs/job-1");

      expect(first.body).toEqual(expect.objectContaining({
        status: "completed", afterUrl: outputUrl,
      }));
      expect(second.body).toEqual(expect.objectContaining({
        status: "completed", afterUrl: outputUrl,
      }));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(state.completionWins).toBe(1);
      expect(queries.filter((call) =>
        call.sql.includes("SELECT stripe_customer_id"))).toHaveLength(0);
      expect(state.job.input.legacyBilling).toBeUndefined();
    } finally {
      fetchMock.mockRestore();
      invalidateGenSettings();
      if (previous.fal === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previous.fal;
      if (previous.stripe === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous.stripe;
      if (previous.meter === undefined) delete process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME;
      else process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = previous.meter;
    }
  });

  it("retries a persisted billing intent in the background without another client GET", async () => {
    const previous = {
      fal: process.env.FAL_KEY,
      stripe: process.env.STRIPE_SECRET_KEY,
      meter: process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME,
    };
    process.env.FAL_KEY = "fal-test-key";
    process.env.STRIPE_SECRET_KEY = "stripe-test-key";
    process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = "genai_test";
    invalidateGenSettings();
    const outputUrl = "https://cdn.fal.media/background-retry.mp4";
    const { app, pool, queries, state } = legacyAiJobPollApp(outputUrl, {
      billingMode: "metered",
      legacyBillingIntent: true,
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({ status: "COMPLETED" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://queue.fal.run/requests/fal-request-1") {
          return new Response(JSON.stringify({ video: { url: outputUrl } }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": String(129 * 1024 * 1024),
          },
        });
      },
    );
    try {
      const response = await request(app)
        .get("/api/projects/project-1/ai/jobs/job-1");
      expect(response.body.status).toBe("completed");
      expect(state.job.input.legacyBilling?.status).toBe("pending");
      expect(queries.filter((call) =>
        call.sql.includes("SELECT stripe_customer_id"))).toHaveLength(0);

      const stats = await tickLegacyGenerativeAiBillingSettlements(
        pool as any,
        { workerId: "legacy-background-worker" },
      );

      expect(stats).toEqual({
        quarantined: 0,
        expired: 0,
        claimed: 1,
        completed: 0,
        retrying: 1,
        permanentlyFailed: 0,
        deliveryUnknown: 0,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(queries.filter((call) =>
        call.sql.includes("SELECT stripe_customer_id"))).toHaveLength(1);
      const backgroundClaim = queries.filter((call) =>
        call.sql.includes("legacy-generative-ai-billing:claim")).at(-1);
      expect(backgroundClaim?.params).toEqual([
        "legacy-background-worker", 4, 130, null, null,
      ]);
      expect(backgroundClaim?.sql).toContain(
        "input#>>'{legacyBilling,mode}' IN ('metered','credits')",
      );
      expect(backgroundClaim?.sql).toContain("FOR UPDATE SKIP LOCKED");
    } finally {
      fetchMock.mockRestore();
      invalidateGenSettings();
      if (previous.fal === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previous.fal;
      if (previous.stripe === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous.stripe;
      if (previous.meter === undefined) delete process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME;
      else process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = previous.meter;
    }
  });

  it("persists one intent across concurrent reads and lets the worker claim it", async () => {
    const previous = {
      fal: process.env.FAL_KEY,
      stripe: process.env.STRIPE_SECRET_KEY,
      meter: process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME,
    };
    process.env.FAL_KEY = "fal-test-key";
    process.env.STRIPE_SECRET_KEY = "stripe-test-key";
    process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = "genai_test";
    invalidateGenSettings();
    const outputUrl = "https://cdn.fal.media/concurrent-safe.mp4";
    const { app, pool, queries, state } = legacyAiJobPollApp(outputUrl, {
      billingMode: "metered",
      legacyBillingIntent: true,
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({ status: "COMPLETED" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://queue.fal.run/requests/fal-request-1") {
          return new Response(JSON.stringify({ video: { url: outputUrl } }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": String(129 * 1024 * 1024),
          },
        });
      },
    );
    try {
      const [first, second] = await Promise.all([
        request(app).get("/api/projects/project-1/ai/jobs/job-1"),
        request(app).get("/api/projects/project-1/ai/jobs/job-1"),
      ]);

      expect(first.body.status).toBe("completed");
      expect(second.body.status).toBe("completed");
      expect(state.completionWins).toBe(1);
      expect(queries.filter((call) =>
        call.sql.includes("SELECT stripe_customer_id"))).toHaveLength(0);
      await tickLegacyGenerativeAiBillingSettlements(pool as any, {
        workerId: "legacy-concurrent-worker",
      });
      expect(queries.filter((call) =>
        call.sql.includes("SELECT stripe_customer_id"))).toHaveLength(1);
      expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST"))
        .toBe(true);
    } finally {
      fetchMock.mockRestore();
      invalidateGenSettings();
      if (previous.fal === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previous.fal;
      if (previous.stripe === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous.stripe;
      if (previous.meter === undefined) delete process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME;
      else process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = previous.meter;
    }
  });
});

describe("legacy workspace video reference tenant binding", () => {
  it("omits a cross-project reference asset while preserving Beeble submit", async () => {
    const previous = {
      beeble: process.env.BEEBLE_API_KEY,
      b2KeyId: process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID,
      b2Key: process.env.B2_ROLE_ROOM_APPLICATION_KEY,
      b2Bucket: process.env.B2_ROLE_ROOM_BUCKET_NAME,
    };
    process.env.BEEBLE_API_KEY = "beeble-test-key";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "b2-test-key-id";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY = "b2-test-application-key";
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "b2-test-bucket";
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes("SELECT 1 WHERE EXISTS")) {
          return { rows: [{ ok: 1 }], rowCount: 1 };
        }
        if (sql.includes("SELECT email, role FROM users")) {
          return {
            rows: [{ email: "owner@example.test", role: "super_admin" }],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT * FROM generative_ai_settings")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT consented FROM project_ai_consent")) {
          return { rows: [{ consented: true }], rowCount: 1 };
        }
        if (sql.includes("COALESCE(SUM(est_cost_usd),0)")) {
          return { rows: [{ s: 0 }], rowCount: 1 };
        }
        if (sql.includes("FROM project_video_versions")) {
          return {
            rows: [{
              b2_key: "workspace/project-1/video-versions/source.mp4",
              storage_version_id: "confirmed-version-1",
              file_url: "https://legacy.example.test/unpinned.mp4",
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("FROM capture_assets a")) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [],
          rowCount: sql.includes("INSERT INTO generative_ai_jobs") ? 1 : 0,
        };
      },
    };
    const app = express();
    app.use(express.json());
    setupProjectWorkspaceRoutes({
      app,
      pool,
      requireUserSession: () => ({
        userId: "owner-user",
        email: "owner@example.test",
        name: "Owner",
        role: "super_admin",
      }),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "beeble-generation-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      const response = await request(app)
        .post("/api/projects/project-1/ai/video-restyle")
        .send({
          versionId: "video-version-1",
          referenceAssetId: "asset-from-project-2",
          prompt: "Cool dusk atmosphere",
        });

      expect(response.status).toBe(202);
      const referenceLookup = queries.find((call) =>
        call.sql.includes("FROM capture_assets a"));
      expect(referenceLookup?.params).toEqual([
        "asset-from-project-2",
        "project-1",
      ]);
      const submittedBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(submittedBody).not.toHaveProperty("reference_image_uri");
      const sourceUrl = new URL(submittedBody.source_uri);
      expect(sourceUrl.searchParams.get("versionId")).toBe("confirmed-version-1");
      expect(sourceUrl.pathname).toContain(
        "/b2-test-bucket/workspace/project-1/video-versions/source.mp4",
      );
    } finally {
      fetchMock.mockRestore();
      for (const [key, value] of [
        ["BEEBLE_API_KEY", previous.beeble],
        ["B2_ROLE_ROOM_APPLICATION_KEY_ID", previous.b2KeyId],
        ["B2_ROLE_ROOM_APPLICATION_KEY", previous.b2Key],
        ["B2_ROLE_ROOM_BUCKET_NAME", previous.b2Bucket],
      ] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
