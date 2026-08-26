import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import express from "express";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { setupAdminMigrationsRoutes } from "./admin-room-migrations-routes";

const TOKEN = "test-migrate-trigger-token";
const previousToken = process.env.MIGRATE_TRIGGER_TOKEN;

function createRouteHarness(
  query: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ rows: [] }),
) {
  const app = express();
  app.use(express.json());
  const requireAdminRoomAccess = vi.fn((_req, res) => {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  });
  const logAdminActivity = vi.fn().mockResolvedValue(undefined);

  setupAdminMigrationsRoutes({
    app,
    pool: { query } as never,
    getActiveSessionFromRequest: vi.fn(),
    requireAdminRoomAccess: requireAdminRoomAccess as never,
    logAdminActivity,
  });

  return { app, query, requireAdminRoomAccess, logAdminActivity };
}

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

beforeAll(() => {
  process.env.MIGRATE_TRIGGER_TOKEN = TOKEN;
});

afterAll(() => {
  if (previousToken === undefined) {
    delete process.env.MIGRATE_TRIGGER_TOKEN;
  } else {
    process.env.MIGRATE_TRIGGER_TOKEN = previousToken;
  }
});

beforeEach(() => {
  spawnMock.mockReset();
});

describe.sequential("admin room migrations routes", () => {
  it("rejects status calls without a valid CI token or admin session", async () => {
    const { app, query, requireAdminRoomAccess } = createRouteHarness();

    const response = await request(app).get(
      "/api/admin-room/migrations/status",
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Innlogging kreves" });
    expect(requireAdminRoomAccess).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the authoritative pending-file contract for a valid CI token", async () => {
    const { app, query, requireAdminRoomAccess } = createRouteHarness();

    const response = await request(app)
      .get("/api/admin-room/migrations/status")
      .set("Authorization", `Migrate ${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("idle");
    expect(response.body.pendingCheck).toBe("ok");
    expect(response.body.pendingCount).toBeGreaterThan(0);
    expect(response.body.pendingFiles).toContain(
      "334_storyboard_reference_assets.sql",
    );
    expect(requireAdminRoomAccess).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      "SELECT filename FROM _migrations_applied",
    );
  });

  it("fails closed when the tracking-table query fails", async () => {
    const query = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const { app } = createRouteHarness(query);

    const response = await request(app)
      .get("/api/admin-room/migrations/status")
      .set("X-Migrate-Trigger-Token", TOKEN);

    expect(response.status).toBe(200);
    expect(response.body.pendingCheck).toBe("error");
    expect(response.body.pendingError).toBe("query_failed");
    expect(response.body.pendingCount).toBeGreaterThan(0);
  });

  it("keeps the legacy custom header compatible during rollout", async () => {
    const { app, requireAdminRoomAccess } = createRouteHarness();

    const response = await request(app)
      .get("/api/admin-room/migrations/status")
      .set("X-Migrate-Trigger-Token", TOKEN);

    expect(response.status).toBe(200);
    expect(response.body.pendingCheck).toBe("ok");
    expect(requireAdminRoomAccess).not.toHaveBeenCalled();
  });

  it("does not interpret an Admin Room Bearer session as a migrate token", async () => {
    const { app, query, requireAdminRoomAccess } = createRouteHarness();

    const response = await request(app)
      .get("/api/admin-room/migrations/status")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Innlogging kreves" });
    expect(requireAdminRoomAccess).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
  });

  it("times out a tracking-table query instead of hanging the status route", async () => {
    const query = vi.fn().mockReturnValue(new Promise(() => undefined));
    const { app } = createRouteHarness(query);
    const startedAt = Date.now();

    const response = await request(app)
      .get("/api/admin-room/migrations/status")
      .set("Authorization", `Migrate ${TOKEN}`);

    expect(response.status).toBe(200);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(response.body.pendingCheck).toBe("timeout");
    expect(response.body.pendingError).toBe("query_timeout");
    expect(response.body.pendingCount).toBeGreaterThan(0);
  });

  it("flushes 202, enforces the run lock, and reports running without a DB query", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { app, query } = createRouteHarness();

    const started = await request(app)
      .post("/api/admin-room/migrations/run")
      .set("Authorization", `Migrate ${TOKEN}`)
      .send({});

    expect(started.status).toBe(202);
    expect(started.body.state.status).toBe("running");
    expect(spawnMock).not.toHaveBeenCalled();

    const duplicate = await request(app)
      .post("/api/admin-room/migrations/run")
      .set("Authorization", `Migrate ${TOKEN}`)
      .send({});
    expect(duplicate.status).toBe(409);

    const running = await request(app)
      .get("/api/admin-room/migrations/status")
      .set("Authorization", `Migrate ${TOKEN}`);
    expect(running.status).toBe(200);
    expect(running.body).toMatchObject({
      status: "running",
      lockHeld: true,
      pendingCount: 1,
      pendingCheck: "running",
    });
    expect(query).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(spawnMock.mock.calls[0]?.[0]).toBe("bash");

    child.emit("close", 0);
    await new Promise((resolve) => setImmediate(resolve));
  });
});
