import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => ({
  readConfig: vi.fn(),
  runSweep: vi.fn(),
}));
const sentryMocks = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock("./leadgrid-canvas-retention-worker.js", () => ({
  readCanvasRetentionWorkerConfig: workerMocks.readConfig,
  runCanvasRetentionSweep: workerMocks.runSweep,
}));
vi.mock("./sentry-init.js", () => ({
  captureLeadgridError: sentryMocks.capture,
}));

import { registerLeadgridRetentionCron } from "./leadgrid-retention-cron.js";

function registerRoute(pool: Pool) {
  let handler: ((req: Request, res: Response) => Promise<void>) | undefined;
  const app = {
    post: vi.fn(
      (
        _path: string,
        registered: (req: Request, res: Response) => Promise<void>,
      ) => {
        handler = registered;
      },
    ),
  } as unknown as Express;
  registerLeadgridRetentionCron({ app, pool });
  if (!handler) throw new Error("retention route was not registered");
  return handler;
}

function responseRecorder() {
  const json = vi.fn();
  const status = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  return { response, status, json };
}

function request(): Request {
  return {
    headers: { "x-cron-trigger-token": "cron-secret" },
    query: {},
    body: {},
  } as unknown as Request;
}

function canvasSummary() {
  return {
    runId: "run-1",
    trigger: "cron",
    status: "completed",
    mode: "dry-run",
    includeOrphans: true,
    retentionDays: 30,
    batchSize: 100,
    lockAcquired: true,
    startedAt: "2026-08-29T00:00:00.000Z",
    finishedAt: "2026-08-29T00:00:00.010Z",
    durationMs: 10,
    trash: {
      notesScanned: 2,
      versionsScanned: 4,
      documentsScanned: 3,
      notesDeleted: 0,
      versionsDeleted: 0,
      documentsDeleted: 0,
    },
    orphans: {
      versionsScanned: 1,
      documentsScanned: 2,
      documentsWithMissingParentScanned: 1,
      documentScopeMismatchesScanned: 1,
      versionsDeleted: 0,
      documentsDeleted: 0,
    },
    error: null,
  };
}

beforeEach(() => {
  process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN = "cron-secret";
  workerMocks.readConfig.mockReset();
  workerMocks.runSweep.mockReset();
  sentryMocks.capture.mockReset();
});
describe("Leadgrid retention cron Canvas integration", () => {
  it("leaves Canvas completely untouched while the step is disabled", async () => {
    workerMocks.readConfig.mockReturnValue({
      enabled: false,
      requestedMode: "dry-run",
      mode: "dry-run",
      destructiveConfirmed: false,
      includeOrphans: false,
      retentionDays: 30,
      batchSize: 100,
    });
    const pool = {
      query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    } as unknown as Pool;
    const handler = registerRoute(pool);
    const { response, json } = responseRecorder();
    await handler(request(), response);

    expect(workerMocks.runSweep).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        canvas: expect.objectContaining({
          enabled: false,
          mode: "dry-run",
          apply_wired: false,
          summary: null,
        }),
        stats: expect.objectContaining({
          canvas_retention_enabled: 0,
          canvas_trash_notes_scanned: 0,
          canvas_trash_notes_deleted: 0,
          canvas_orphan_versions_scanned: 0,
          canvas_orphan_versions_deleted: 0,
        }),
      }),
    );
  });

  it("pins the recurring cron to dry-run even if apply was requested", async () => {
    workerMocks.readConfig.mockReturnValue({
      enabled: true,
      requestedMode: "apply",
      mode: "apply",
      destructiveConfirmed: true,
      includeOrphans: true,
      retentionDays: 30,
      batchSize: 100,
    });
    workerMocks.runSweep.mockResolvedValue(canvasSummary());
    const pool = {
      query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    } as unknown as Pool;
    const handler = registerRoute(pool);
    const { response, json } = responseRecorder();
    await handler(request(), response);

    expect(workerMocks.runSweep).toHaveBeenCalledWith(
      pool,
      {
        enabled: true,
        mode: "dry-run",
        destructiveConfirmed: false,
        includeOrphans: true,
        retentionDays: 30,
        batchSize: 100,
      },
      "cron",
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas: expect.objectContaining({
          enabled: true,
          mode: "dry-run",
          include_orphans: true,
          apply_wired: false,
        }),
        stats: expect.objectContaining({
          canvas_retention_enabled: 1,
          canvas_retention_lock_acquired: 1,
          canvas_trash_notes_scanned: 2,
          canvas_trash_notes_deleted: 0,
          canvas_orphan_versions_scanned: 1,
          canvas_orphan_versions_deleted: 0,
          canvas_orphan_document_scope_mismatches_scanned: 1,
        }),
      }),
    );
  });
});
