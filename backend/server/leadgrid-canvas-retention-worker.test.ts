import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  readCanvasRetentionWorkerConfig,
  runCanvasRetentionSweep,
} from "./leadgrid-canvas-retention-worker.js";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";

type QueryCall = { sql: string; values?: unknown[] };

function buildPool(
  handler: (
    sql: string,
    values?: unknown[],
  ) => Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount: number;
  }>,
): { pool: Pool; calls: QueryCall[]; release: ReturnType<typeof vi.fn> } {
  const calls: QueryCall[] = [];
  const release = vi.fn();
  const client = {
    query: vi.fn(async (sqlValue: unknown, values?: unknown[]) => {
      const sql = String(sqlValue);
      calls.push({ sql, values });
      if (
        sql === "BEGIN" ||
        sql === "COMMIT" ||
        sql === "ROLLBACK" ||
        sql.startsWith("SET LOCAL")
      ) {
        return { rows: [], rowCount: 0 };
      }
      return handler(sql, values);
    }),
    release,
  };
  return {
    pool: { connect: vi.fn(async () => client) } as unknown as Pool,
    calls,
    release,
  };
}

function successfulHandler(
  options: {
    lock?: boolean;
    trash?: boolean;
    orphanVersions?: boolean;
    orphanDocuments?: boolean;
  } = {},
) {
  return async (sql: string) => {
    if (sql.includes("pg_try_advisory_xact_lock")) {
      return { rows: [{ locked: options.lock !== false }], rowCount: 1 };
    }
    if (
      sql.includes("SELECT id::text, organization_id, user_id") &&
      sql.includes("FROM leadgrid_canvas_notater")
    ) {
      return options.trash === false
        ? { rows: [], rowCount: 0 }
        : {
            rows: [
              {
                id: NOTE_ID,
                organization_id: "org-a",
                user_id: "user-a",
              },
            ],
            rowCount: 1,
          };
    }
    if (
      sql.includes("SELECT COUNT(*)::int AS count") &&
      sql.includes("leadgrid_canvas_versjoner")
    ) {
      return { rows: [{ count: 3 }], rowCount: 1 };
    }
    if (
      sql.includes("SELECT COUNT(*)::int AS count") &&
      sql.includes("leadgrid_canvas_dokumenter")
    ) {
      return { rows: [{ count: 2 }], rowCount: 1 };
    }
    if (sql.includes("SELECT v.id::text, v.notat_id::text")) {
      return options.orphanVersions
        ? {
            rows: [{ id: VERSION_ID, notat_id: NOTE_ID }],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("SELECT d.id,") && sql.includes("AS parent_missing")) {
      return options.orphanDocuments
        ? {
            rows: [
              {
                id: "pdf-missing",
                notat_id: NOTE_ID,
                organization_id: "org-a",
                user_id: "user-a",
                parent_missing: true,
              },
              {
                id: "pdf-scope-mismatch",
                notat_id: "33333333-3333-4333-8333-333333333333",
                organization_id: "org-b",
                user_id: "user-b",
                parent_missing: false,
              },
            ],
            rowCount: 2,
          }
        : { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("DELETE FROM leadgrid_canvas_versjoner")) {
      return { rows: [], rowCount: 3 };
    }
    if (sql.startsWith("DELETE FROM leadgrid_canvas_dokumenter")) {
      return { rows: [], rowCount: 2 };
    }
    if (sql.startsWith("DELETE FROM leadgrid_canvas_notater")) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
  };
}

describe("Canvas retention worker configuration", () => {
  it("is off and dry-run by default", () => {
    expect(readCanvasRetentionWorkerConfig({})).toMatchObject({
      enabled: false,
      requestedMode: "dry-run",
      mode: "dry-run",
      destructiveConfirmed: false,
      includeOrphans: false,
      retentionDays: 30,
      batchSize: 100,
    });
  });

  it("requires the exact destructive confirmation phrase before apply", () => {
    const unconfirmed = readCanvasRetentionWorkerConfig({
      CANVAS_RETENTION_WORKER_ENABLED: "true",
      CANVAS_RETENTION_WORKER_MODE: "apply",
      CANVAS_RETENTION_WORKER_DESTRUCTIVE_CONFIRMATION: "true",
    });
    expect(unconfirmed.requestedMode).toBe("apply");
    expect(unconfirmed.mode).toBe("dry-run");

    const confirmed = readCanvasRetentionWorkerConfig({
      CANVAS_RETENTION_WORKER_ENABLED: "true",
      CANVAS_RETENTION_WORKER_MODE: "apply",
      CANVAS_RETENTION_WORKER_DESTRUCTIVE_CONFIRMATION:
        "DELETE_EXPIRED_CANVAS_DATA",
      CANVAS_RETENTION_WORKER_RECONCILE_ORPHANS: "true",
    });
    expect(confirmed).toMatchObject({
      enabled: true,
      mode: "apply",
      destructiveConfirmed: true,
      includeOrphans: true,
    });
  });

  it("clamps retention and batch sizes to safe ranges", () => {
    const config = readCanvasRetentionWorkerConfig({
      CANVAS_RETENTION_WORKER_RETENTION_DAYS: "1",
      CANVAS_RETENTION_WORKER_BATCH_SIZE: "99999",
    });
    expect(config.retentionDays).toBe(30);
    expect(config.batchSize).toBe(200);
  });
});
describe("Canvas retention sweep", () => {
  it("reports trash and orphan candidates without deleting in dry-run", async () => {
    const { pool, calls, release } = buildPool(
      successfulHandler({ orphanVersions: true, orphanDocuments: true }),
    );
    const summary = await runCanvasRetentionSweep(
      pool,
      {
        enabled: true,
        mode: "dry-run",
        destructiveConfirmed: false,
        includeOrphans: true,
        retentionDays: 30,
        batchSize: 25,
      },
      "manual",
    );

    expect(summary).toMatchObject({
      status: "completed",
      mode: "dry-run",
      lockAcquired: true,
      trash: {
        notesScanned: 1,
        versionsScanned: 3,
        documentsScanned: 2,
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
    });
    expect(calls.some((call) => call.sql.includes("DELETE FROM"))).toBe(false);
    expect(calls.at(-1)?.sql).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("downgrades a direct apply request when execution guards are incomplete", async () => {
    const { pool, calls } = buildPool(successfulHandler());
    const summary = await runCanvasRetentionSweep(pool, {
      enabled: true,
      mode: "apply",
      destructiveConfirmed: false,
      includeOrphans: true,
      retentionDays: 30,
      batchSize: 100,
    });

    expect(summary.mode).toBe("dry-run");
    expect(calls.some((call) => call.sql.includes("DELETE FROM"))).toBe(false);
  });

  it("deletes expired trash child-first and anchors every delete to tenant tuples", async () => {
    const { pool, calls } = buildPool(successfulHandler());
    const summary = await runCanvasRetentionSweep(pool, {
      enabled: true,
      mode: "apply",
      destructiveConfirmed: true,
      includeOrphans: false,
      retentionDays: 45,
      batchSize: 10,
    });

    expect(summary).toMatchObject({
      status: "completed",
      trash: {
        notesDeleted: 1,
        versionsDeleted: 3,
        documentsDeleted: 2,
      },
    });
    const deletes = calls.filter((call) => call.sql.startsWith("DELETE FROM"));
    expect(deletes).toHaveLength(3);
    expect(deletes[0].sql).toContain("leadgrid_canvas_versjoner");
    expect(deletes[1].sql).toContain("leadgrid_canvas_dokumenter");
    expect(deletes[2].sql).toContain("leadgrid_canvas_notater");
    for (const call of deletes) {
      expect(call.sql).toContain(
        "candidate.organization_id = n.organization_id",
      );
      expect(call.sql).toContain("candidate.user_id = n.user_id");
      expect(call.values).toEqual([[NOTE_ID], ["org-a"], ["user-a"], 45]);
    }
    expect(calls.some((call) => call.sql.includes("SELECT v.id::text"))).toBe(
      false,
    );
  });

  it("rechecks exact IDs and scope before deleting opted-in orphans", async () => {
    const { pool, calls } = buildPool(
      successfulHandler({
        trash: false,
        orphanVersions: true,
        orphanDocuments: true,
      }),
    );
    const summary = await runCanvasRetentionSweep(pool, {
      enabled: true,
      mode: "apply",
      destructiveConfirmed: true,
      includeOrphans: true,
      retentionDays: 30,
      batchSize: 50,
    });

    expect(summary.orphans).toMatchObject({
      versionsScanned: 1,
      documentsScanned: 2,
      versionsDeleted: 3,
      documentsDeleted: 2,
    });
    const orphanVersionDelete = calls.find(
      (call) =>
        call.sql.startsWith("DELETE FROM leadgrid_canvas_versjoner") &&
        call.sql.includes("candidate(id, notat_id)"),
    );
    expect(orphanVersionDelete?.values).toEqual([[VERSION_ID], [NOTE_ID]]);

    const orphanDocumentDelete = calls.find(
      (call) =>
        call.sql.startsWith("DELETE FROM leadgrid_canvas_dokumenter") &&
        call.sql.includes("candidate(id, notat_id, organization_id, user_id)"),
    );
    expect(orphanDocumentDelete?.values).toEqual([
      ["pdf-missing", "pdf-scope-mismatch"],
      [NOTE_ID, "33333333-3333-4333-8333-333333333333"],
      ["org-a", "org-b"],
      ["user-a", "user-b"],
    ]);
    expect(orphanDocumentDelete?.sql).toContain(
      "n.organization_id = d.organization_id",
    );
    expect(orphanDocumentDelete?.sql).toContain("n.user_id = d.user_id");
  });

  it("skips cleanly when another instance holds the advisory lock", async () => {
    const { pool, calls } = buildPool(successfulHandler({ lock: false }));
    const summary = await runCanvasRetentionSweep(pool, {
      enabled: true,
      mode: "apply",
      destructiveConfirmed: true,
      includeOrphans: true,
      retentionDays: 30,
      batchSize: 100,
    });
    expect(summary).toMatchObject({
      status: "skipped_locked",
      lockAcquired: false,
    });
    expect(
      calls.some((call) => call.sql.includes("leadgrid_canvas_notater")),
    ).toBe(false);
    expect(calls.at(-1)?.sql).toBe("COMMIT");
  });

  it("rolls back and returns bounded observability on database failure", async () => {
    const { pool, calls, release } = buildPool(async (sql) => {
      if (sql.includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ locked: true }], rowCount: 1 };
      }
      throw new Error("candidate scan failed\nwith noisy details");
    });
    const summary = await runCanvasRetentionSweep(pool, {
      enabled: true,
      mode: "dry-run",
      destructiveConfirmed: false,
      includeOrphans: false,
      retentionDays: 30,
      batchSize: 100,
    });
    expect(summary.status).toBe("failed");
    expect(summary.error).toBe("candidate scan failed with noisy details");
    expect(calls.at(-1)?.sql).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
