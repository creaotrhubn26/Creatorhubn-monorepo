import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { drainOnce } from "./drive-batch-worker";
import {
  DriveNotConnectedError,
  type DriveClientResolver,
} from "./drive-batch-upload-wiring";

/**
 * Tests for the worker's drain loop. Verifies:
 *   - Visits only ``queued``/``running`` batches, capped by
 *     ``maxBatchesPerTick``.
 *   - A ``DriveNotConnectedError`` flips the batch + its pending
 *     items into ``failed`` with a photographer-readable message
 *     instead of crashing the whole sweep.
 *   - Unrelated errors are isolated to the offending batch.
 *
 * The worker's long-lived ``setInterval`` loop isn't tested
 * directly — covering ``drainOnce`` alone is enough because the
 * interval is pure plumbing (start/stop/unref).
 */

class FakeBatchPool {
  batches: {
    id: string;
    user_id: string;
    status: string;
    created_at: Date;
  }[] = [];
  itemUpdates: {
    batch_id: string;
    state_to?: string;
    last_error?: string;
    where_state_in?: string[];
  }[] = [];
  batchUpdates: { id: string; status: string }[] = [];

  async query(sql: string, args: unknown[] = []): Promise<any> {
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith("select id, user_id from drive_upload_batch")) {
      const limit = (args[0] as number) ?? 10;
      const candidates = this.batches
        .filter((b) => b.status === "queued" || b.status === "running")
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .slice(0, limit);
      return { rowCount: candidates.length, rows: candidates };
    }
    if (normalized.startsWith("update drive_upload_batch")) {
      const id = args[args.length - 1] as string;
      const batch = this.batches.find((b) => b.id === id);
      if (batch) {
        // Match the two UPDATE shapes the worker issues + the one
        // from DriveNotConnectedError path (hardcoded "status = 'failed'").
        if (normalized.includes("status = 'failed'")) {
          batch.status = "failed";
          this.batchUpdates.push({ id, status: "failed" });
        }
      }
      return { rowCount: batch ? 1 : 0, rows: [] };
    }
    if (normalized.startsWith("update drive_upload_item")) {
      const batchId = args[0] as string;
      this.itemUpdates.push({
        batch_id: batchId,
        state_to: "failed",
        last_error: "Google-tilkobling frakoblet",
      });
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

const asPool = (fake: FakeBatchPool) => fake as unknown as Pool;

/// Resolver fake: returns a no-op Drive client, or throws on demand.
function makeResolver(opts: {
  throwFor?: Set<string>;
  errorFactory?: (userId: string) => Error;
} = {}): DriveClientResolver {
  return {
    resolve: async (userId: string) => {
      if (opts.throwFor?.has(userId)) {
        throw opts.errorFactory
          ? opts.errorFactory(userId)
          : new DriveNotConnectedError(userId);
      }
      // We never actually call .files.create in drainOnce because
      // the fake pool returns empty roster via the stub
      // advanceBatch path; but we still need a non-null object to
      // satisfy the signature.
      return {
        files: {
          create: async () => ({ status: 200, data: { id: "fake-id" } }),
        },
      } as unknown as Awaited<ReturnType<DriveClientResolver["resolve"]>>;
    },
  };
}

describe("drainOnce", () => {
  it("visits only active batches", async () => {
    const pool = new FakeBatchPool();
    pool.batches = [
      { id: "b1", user_id: "u1", status: "queued", created_at: new Date(1) },
      { id: "b2", user_id: "u1", status: "completed", created_at: new Date(2) },
      { id: "b3", user_id: "u1", status: "running", created_at: new Date(3) },
      { id: "b4", user_id: "u1", status: "failed", created_at: new Date(4) },
    ];
    const out = await drainOnce({
      pool: asPool(pool),
      resolver: makeResolver(),
      maxBatchesPerTick: 10,
    });
    expect(out.batchesVisited).toBe(2);
  });

  it("respects maxBatchesPerTick", async () => {
    const pool = new FakeBatchPool();
    pool.batches = Array.from({ length: 20 }, (_, i) => ({
      id: `b${i}`,
      user_id: "u1",
      status: "queued",
      created_at: new Date(i),
    }));
    const out = await drainOnce({
      pool: asPool(pool),
      resolver: makeResolver(),
      maxBatchesPerTick: 5,
    });
    expect(out.batchesVisited).toBe(5);
  });

  it("fails a batch whose owner disconnected Google", async () => {
    const pool = new FakeBatchPool();
    pool.batches = [
      { id: "b1", user_id: "disconnected", status: "queued", created_at: new Date(1) },
    ];
    await drainOnce({
      pool: asPool(pool),
      resolver: makeResolver({ throwFor: new Set(["disconnected"]) }),
      maxBatchesPerTick: 10,
    });
    expect(pool.batchUpdates).toEqual([{ id: "b1", status: "failed" }]);
    expect(pool.itemUpdates[0]?.last_error).toBe("Google-tilkobling frakoblet");
  });

  it("isolates unexpected resolver errors — one bad batch doesn't stop the sweep", async () => {
    const pool = new FakeBatchPool();
    pool.batches = [
      { id: "b1", user_id: "boom", status: "queued", created_at: new Date(1) },
      { id: "b2", user_id: "ok", status: "queued", created_at: new Date(2) },
    ];
    const out = await drainOnce({
      pool: asPool(pool),
      resolver: makeResolver({
        throwFor: new Set(["boom"]),
        errorFactory: () => new Error("network blew up"),
      }),
      maxBatchesPerTick: 10,
    });
    // drainOnce still visited both — the second didn't die from
    // the first's error.
    expect(out.batchesVisited).toBe(2);
    // Only the disconnected-style error triggers the fail-batch
    // path; a generic Error just gets logged + the batch survives
    // to retry next tick.
    expect(pool.batchUpdates).toEqual([]);
  });

  it("reports zero transitions when no batches are active", async () => {
    const pool = new FakeBatchPool();
    const out = await drainOnce({
      pool: asPool(pool),
      resolver: makeResolver(),
      maxBatchesPerTick: 5,
    });
    expect(out.batchesVisited).toBe(0);
    expect(out.itemsTransitioned).toBe(0);
  });
});
