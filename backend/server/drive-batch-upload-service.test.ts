import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  advanceBatch,
  createBatch,
  fetchBatch,
  reconcileOrphanedUploads,
} from "./drive-batch-upload-service";
import type {
  DriveBatchItem,
  UploadOutcome,
} from "./drive-batch-planning";

/**
 * In-memory Pool stand-in. Supports the exact SQL shapes the
 * service issues — enough to drive the orchestrator through its
 * full state machine without standing up Postgres. If the service
 * grows a new query shape, add a handler here.
 *
 * The goal is to pin orchestrator behaviour (pick → classify →
 * persist → progress → complete) against a storage backend we
 * control, not to revalidate Postgres.
 */
class FakePool {
  batches = new Map<
    string,
    {
      id: string;
      user_id: string;
      project_id: string | null;
      status: string;
      total_items: number;
      created_at: Date;
      updated_at: Date;
      completed_at: Date | null;
    }
  >();
  items = new Map<
    string,
    {
      id: string;
      batch_id: string;
      local_id: string;
      local_path: string;
      drive_name: string;
      target_folder_id: string;
      mime_type: string;
      size_bytes: number;
      checksum_sha256: string;
      state: string;
      drive_file_id: string | null;
      attempt_count: number;
      last_error: string | null;
      next_attempt_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }
  >();
  private uuidCounter = 0;

  private newId(): string {
    this.uuidCounter += 1;
    return `fake-uuid-${this.uuidCounter}`;
  }

  async query(sql: string, args: unknown[] = []): Promise<any> {
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith("create table") || normalized.startsWith("create index") || normalized === "begin" || normalized === "commit" || normalized === "rollback") {
      return { rowCount: 0, rows: [] };
    }
    if (normalized.startsWith("insert into drive_upload_batch")) {
      // SQL hardcodes status='queued'; args are (id, user_id,
      // project_id, total_items).
      const [id, user_id, project_id, total_items] = args as [
        string, string, string | null, number,
      ];
      const now = new Date();
      this.batches.set(id, {
        id, user_id, project_id,
        status: "queued",
        total_items,
        created_at: now, updated_at: now, completed_at: null,
      });
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("insert into drive_upload_item")) {
      const [batch_id, local_id, local_path, drive_name, target_folder_id,
        mime_type, size_bytes, checksum_sha256] = args as [
        string, string, string, string, string, string, number, string,
      ];
      const id = this.newId();
      const now = new Date();
      this.items.set(id, {
        id, batch_id, local_id, local_path, drive_name, target_folder_id,
        mime_type, size_bytes, checksum_sha256,
        state: "pending",
        drive_file_id: null, attempt_count: 0,
        last_error: null, next_attempt_at: null,
        created_at: now, updated_at: now,
      });
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("select id, user_id, project_id, status, created_at, updated_at, completed_at\n     from drive_upload_batch")) {
      const [batchId, userId] = args as [string, string];
      const batch = this.batches.get(batchId);
      if (!batch || batch.user_id !== userId) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [batch] };
    }
    if (normalized.startsWith("select id, batch_id, local_id")) {
      const [batchId] = args as [string];
      const rows = [...this.items.values()]
        .filter((i) => i.batch_id === batchId)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      return { rowCount: rows.length, rows };
    }
    if (normalized.startsWith("select state, size_bytes from drive_upload_item")) {
      const [batchId] = args as [string];
      const rows = [...this.items.values()].filter((i) => i.batch_id === batchId);
      return { rowCount: rows.length, rows };
    }
    if (normalized.startsWith("update drive_upload_item")) {
      // reconcileOrphanedUploads: no args, WHERE state='uploading'.
      // Flip every uploading row back to pending + report the count.
      if (args.length === 0 && normalized.includes("where state = 'uploading'")) {
        let flipped = 0;
        for (const item of this.items.values()) {
          if (item.state === "uploading") {
            item.state = "pending";
            item.updated_at = new Date();
            flipped += 1;
          }
        }
        return { rowCount: flipped, rows: Array.from({ length: flipped }, () => ({ "?column?": 1 })) };
      }
      // Locate items by (batch_id, local_id) args at
      // the END of the args list + the WHERE clause. Each UPDATE
      // variant places batch_id + local_id as the last two params.
      const batchId = args[args.length - 2] as string;
      const localId = args[args.length - 1] as string;
      const item = [...this.items.values()].find(
        (i) => i.batch_id === batchId && i.local_id === localId,
      );
      if (!item) return { rowCount: 0, rows: [] };
      // Parse the assignment by matching column names in the sql.
      if (normalized.includes("set state = 'uploading'")) {
        if (item.state !== "pending") return { rowCount: 0, rows: [] };
        item.state = "uploading";
        item.updated_at = args[0] as Date;
      } else if (normalized.includes("state = 'uploaded'")) {
        item.state = "uploaded";
        item.drive_file_id = args[0] as string;
        item.attempt_count = args[1] as number;
        item.last_error = null;
        item.updated_at = args[2] as Date;
      } else if (normalized.includes("state = 'skipped-duplicate'")) {
        item.state = "skipped-duplicate";
        item.drive_file_id = (args[0] as string) || null;
        item.attempt_count = args[1] as number;
        item.last_error = null;
        item.updated_at = args[2] as Date;
      } else if (normalized.includes("state = 'failed'")) {
        item.state = "failed";
        item.attempt_count = args[0] as number;
        item.last_error = args[1] as string;
        item.updated_at = args[2] as Date;
      } else if (normalized.includes("state = 'pending'") && normalized.includes("next_attempt_at")) {
        item.state = "pending";
        item.attempt_count = args[0] as number;
        item.last_error = args[1] as string;
        item.next_attempt_at = args[2] as Date;
        item.updated_at = args[3] as Date;
      } else if (normalized.includes("set state = 'pending'") && !normalized.includes("next_attempt_at")) {
        // reconcileOrphanedUploads path
        if (item.state === "uploading") {
          item.state = "pending";
          item.updated_at = new Date();
        }
      }
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("update drive_upload_batch")) {
      const id = args[args.length - 1] as string;
      const batch = this.batches.get(id);
      if (!batch) return { rowCount: 0, rows: [] };
      if (normalized.includes("status = 'running'")) {
        if (batch.status === "queued") {
          batch.status = "running";
          batch.updated_at = args[0] as Date;
        }
      } else if (normalized.includes("status = $1")) {
        if (batch.completed_at === null) {
          batch.status = args[0] as string;
          const now = new Date();
          batch.updated_at = now;
          batch.completed_at = now;
        }
      } else {
        batch.updated_at = args[0] as Date;
      }
      return { rowCount: 1, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  }

  async connect() {
    return {
      query: (sql: string, args?: unknown[]) => this.query(sql, args ?? []),
      release: () => {},
    };
  }
}

const asPool = (fake: FakePool) => fake as unknown as Pool;

const makeItem = (overrides: Partial<DriveBatchItem> = {}): DriveBatchItem => ({
  localId: overrides.localId ?? "i-1",
  localPath: overrides.localPath ?? "/tmp/a.jpg",
  driveName: overrides.driveName ?? "a.jpg",
  mimeType: overrides.mimeType ?? "image/jpeg",
  sizeBytes: overrides.sizeBytes ?? 100,
  checksumSha256: overrides.checksumSha256 ?? "hash-1",
  targetFolderId: overrides.targetFolderId ?? "F1",
});

/// Scripted uploader: consumes outcomes in order per localId.
class ScriptedUploader {
  private scripts = new Map<string, UploadOutcome[]>();
  calls: string[] = [];

  setScript(localId: string, outcomes: UploadOutcome[]) {
    this.scripts.set(localId, [...outcomes]);
  }

  async upload(item: DriveBatchItem) {
    this.calls.push(item.localId);
    const script = this.scripts.get(item.localId) ?? [];
    const next = script.shift() ?? { kind: "succeeded" as const, driveFileId: `dr-${item.localId}` };
    this.scripts.set(item.localId, script);
    switch (next.kind) {
      case "succeeded":
        return { response: { statusCode: 200, data: { id: next.driveFileId } } };
      case "duplicate":
        return { error: { code: 409, message: "exists" } };
      case "retryable":
        return { error: { code: 500, message: next.reason } };
      case "permanent":
        return { error: { code: 400, message: next.reason } };
    }
  }
}

describe("drive-batch-upload-service", () => {
  let pool: FakePool;
  let uploader: ScriptedUploader;

  beforeEach(() => {
    pool = new FakePool();
    uploader = new ScriptedUploader();
  });

  afterEach(() => {
    pool.batches.clear();
    pool.items.clear();
  });

  it("createBatch dedupes items before persisting", async () => {
    const { batchId, dedupedCount, duplicateLocalIds } = await createBatch(
      asPool(pool),
      {
        userId: "u-1",
        projectId: null,
        items: [
          makeItem({ localId: "a", checksumSha256: "H" }),
          makeItem({ localId: "b", checksumSha256: "H" }),
          makeItem({ localId: "c", checksumSha256: "X" }),
        ],
      },
    );
    expect(dedupedCount).toBe(2);
    expect(duplicateLocalIds).toEqual(["b"]);
    const itemRows = [...pool.items.values()].filter(
      (i) => i.batch_id === batchId,
    );
    expect(itemRows).toHaveLength(2);
    expect(pool.batches.get(batchId)?.total_items).toBe(2);
    expect(pool.batches.get(batchId)?.status).toBe("queued");
  });

  it("advanceBatch drives a single item to uploaded + marks batch completed", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: "proj",
      items: [makeItem({ localId: "only", checksumSha256: "h1" })],
    });
    const result = await advanceBatch({
      pool: asPool(pool),
      uploader,
      batchId,
      globalConcurrency: 4,
      perFolderConcurrency: 2,
    });
    expect(result.transitions).toBe(1);
    expect(result.isComplete).toBe(true);
    expect(uploader.calls).toEqual(["only"]);
    const snap = await fetchBatch(asPool(pool), "u-1", batchId);
    expect(snap?.status).toBe("completed");
    expect(snap?.progress.completedItems).toBe(1);
    expect(snap?.progress.byteFraction).toBe(1);
  });

  it("advanceBatch classifies a 409 as skipped-duplicate", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: null,
      items: [makeItem({ localId: "dupe", checksumSha256: "h1" })],
    });
    uploader.setScript("dupe", [{ kind: "duplicate", driveFileId: "" }]);
    await advanceBatch({ pool: asPool(pool), uploader, batchId });
    const snap = await fetchBatch(asPool(pool), "u-1", batchId);
    expect(snap?.progress.skippedDuplicateItems).toBe(1);
    expect(snap?.status).toBe("completed");
  });

  it("retryable failure pushes next_attempt_at into the future + backs off", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: null,
      items: [makeItem({ localId: "flaky", checksumSha256: "h1" })],
    });
    uploader.setScript("flaky", [
      { kind: "retryable", reason: "net" },
      { kind: "succeeded", driveFileId: "dr-flaky" },
    ]);
    const t0 = new Date("2026-04-19T10:00:00Z");
    await advanceBatch({ pool: asPool(pool), uploader, batchId, now: () => t0 });
    const firstSnap = await fetchBatch(asPool(pool), "u-1", batchId);
    const flaky = firstSnap!.items.find((item) => item.localId === "flaky")!;
    expect(flaky.state).toBe("pending");
    expect(flaky.attemptCount).toBe(1);
    expect(flaky.nextAttemptAt).not.toBeNull();

    // A tick *before* the backoff elapses picks up nothing.
    const tSoon = new Date(t0.getTime() + 500);
    const waiting = await advanceBatch({
      pool: asPool(pool), uploader, batchId, now: () => tSoon,
    });
    expect(waiting.transitions).toBe(0);

    // After the backoff, the row is ready + the retry succeeds.
    const tLate = new Date(t0.getTime() + 60_000);
    await advanceBatch({
      pool: asPool(pool), uploader, batchId, now: () => tLate,
    });
    const finalSnap = await fetchBatch(asPool(pool), "u-1", batchId);
    expect(finalSnap?.status).toBe("completed");
    expect(finalSnap?.items[0].state).toBe("uploaded");
  });

  it("maxAttempts burns out retryable failures into permanent failed state", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: null,
      items: [makeItem({ localId: "doomed", checksumSha256: "h1" })],
    });
    uploader.setScript("doomed", Array.from({ length: 5 }, () => ({
      kind: "retryable" as const, reason: "net",
    })));
    let t = new Date("2026-04-19T10:00:00Z");
    for (let i = 0; i < 5; i += 1) {
      await advanceBatch({
        pool: asPool(pool), uploader, batchId, now: () => t,
        maxAttempts: 5,
      });
      t = new Date(t.getTime() + 120_000);
    }
    const snap = await fetchBatch(asPool(pool), "u-1", batchId);
    expect(snap?.items[0].state).toBe("failed");
    expect(snap?.items[0].lastError).toContain("max-attempts");
    expect(snap?.status).toBe("failed");
  });

  it("permanent failures fail immediately without consuming the retry budget", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: null,
      items: [makeItem({ localId: "bad", checksumSha256: "h1" })],
    });
    uploader.setScript("bad", [{ kind: "permanent", reason: "invalid mime" }]);
    await advanceBatch({ pool: asPool(pool), uploader, batchId });
    const snap = await fetchBatch(asPool(pool), "u-1", batchId);
    expect(snap?.items[0].state).toBe("failed");
    expect(snap?.items[0].attemptCount).toBe(1);
    expect(snap?.status).toBe("failed");
  });

  it("progresses a 3-item batch across two advance ticks at concurrency=2", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: null,
      items: [
        makeItem({ localId: "a", checksumSha256: "h1", sizeBytes: 100 }),
        makeItem({ localId: "b", checksumSha256: "h2", sizeBytes: 200 }),
        makeItem({ localId: "c", checksumSha256: "h3", sizeBytes: 300 }),
      ],
    });
    const first = await advanceBatch({
      pool: asPool(pool), uploader, batchId,
      globalConcurrency: 2, perFolderConcurrency: 2,
    });
    expect(first.transitions).toBe(2);
    expect(first.isComplete).toBe(false);

    const second = await advanceBatch({
      pool: asPool(pool), uploader, batchId,
      globalConcurrency: 2, perFolderConcurrency: 2,
    });
    expect(second.transitions).toBe(1);
    expect(second.isComplete).toBe(true);

    const snap = await fetchBatch(asPool(pool), "u-1", batchId);
    expect(snap?.progress.completedItems).toBe(3);
  });

  it("reconcileOrphanedUploads flips 'uploading' rows back to 'pending'", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "u-1",
      projectId: null,
      items: [makeItem({ localId: "a", checksumSha256: "h1" })],
    });
    // Simulate a crash: force one item into ``uploading`` directly.
    const only = [...pool.items.values()].find((i) => i.batch_id === batchId)!;
    only.state = "uploading";
    const recovered = await reconcileOrphanedUploads(asPool(pool));
    expect(recovered).toBe(1);
    expect(only.state).toBe("pending");
  });

  it("fetchBatch refuses other users' batches (owner gate)", async () => {
    const { batchId } = await createBatch(asPool(pool), {
      userId: "owner",
      projectId: null,
      items: [makeItem({ localId: "a", checksumSha256: "h1" })],
    });
    expect(await fetchBatch(asPool(pool), "attacker", batchId)).toBeNull();
    expect(await fetchBatch(asPool(pool), "owner", batchId)).not.toBeNull();
  });
});
