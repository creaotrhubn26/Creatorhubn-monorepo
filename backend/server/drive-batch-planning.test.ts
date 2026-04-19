import { describe, expect, it } from "vitest";
import {
  aggregateBatchProgress,
  backoffSeconds,
  classifyUploadOutcome,
  dedupeByFolderAndChecksum,
  groupItemsByFolder,
  pickNextItems,
} from "./drive-batch-planning";
import type { DriveBatchItem, DriveBatchItemState } from "./drive-batch-planning";

/**
 * Coverage targets (pure logic only; network + DB live elsewhere):
 *   - groupItemsByFolder partitions, sort-smallest-first
 *   - dedupeByFolderAndChecksum keeps one per (folder, checksum)
 *     + reports dropped localIds for auditability
 *   - aggregateBatchProgress byte-weighted completion,
 *     terminal-state detection, empty-batch zero-division guard
 *   - pickNextItems respects global + per-folder concurrency
 *   - classifyUploadOutcome maps the five Drive response shapes
 *   - backoffSeconds matches the iPad RealtimeBackoff ladder exactly
 */

const makeItem = (o: Partial<DriveBatchItem> = {}): DriveBatchItem => ({
  localId: o.localId ?? "i-1",
  localPath: o.localPath ?? "/tmp/a.jpg",
  driveName: o.driveName ?? "a.jpg",
  mimeType: o.mimeType ?? "image/jpeg",
  sizeBytes: o.sizeBytes ?? 100,
  checksumSha256: o.checksumSha256 ?? "aaa",
  targetFolderId: o.targetFolderId ?? "folder-A",
});

describe("groupItemsByFolder", () => {
  it("splits items per target folder id", () => {
    const groups = groupItemsByFolder([
      makeItem({ localId: "a", targetFolderId: "F1" }),
      makeItem({ localId: "b", targetFolderId: "F2" }),
      makeItem({ localId: "c", targetFolderId: "F1" }),
    ]);
    expect(groups.size).toBe(2);
    expect(groups.get("F1")!.map((i) => i.localId)).toEqual(["a", "c"]);
    expect(groups.get("F2")!.map((i) => i.localId)).toEqual(["b"]);
  });

  it("sorts each partition smaller-first so small JPEGs aren't blocked by a 200 MB RAW", () => {
    const groups = groupItemsByFolder([
      makeItem({ localId: "big", sizeBytes: 200_000_000 }),
      makeItem({ localId: "mid", sizeBytes: 1_000_000 }),
      makeItem({ localId: "small", sizeBytes: 50_000 }),
    ]);
    const order = groups.get("folder-A")!.map((i) => i.localId);
    expect(order).toEqual(["small", "mid", "big"]);
  });

  it("empty input yields empty map", () => {
    expect(groupItemsByFolder([]).size).toBe(0);
  });
});

describe("dedupeByFolderAndChecksum", () => {
  it("dedupes across same folder + checksum, keeps the first distinct localId", () => {
    const { unique, duplicateLocalIds } = dedupeByFolderAndChecksum([
      makeItem({ localId: "a", checksumSha256: "HASH" }),
      makeItem({ localId: "b", checksumSha256: "HASH" }),
      makeItem({ localId: "c", checksumSha256: "OTHER" }),
    ]);
    expect(unique.map((i) => i.localId)).toEqual(["a", "c"]);
    expect(duplicateLocalIds).toEqual(["b"]);
  });

  it("keeps distinct checksums in the same folder", () => {
    const { unique } = dedupeByFolderAndChecksum([
      makeItem({ localId: "a", checksumSha256: "H1" }),
      makeItem({ localId: "b", checksumSha256: "H2" }),
    ]);
    expect(unique).toHaveLength(2);
  });

  it("keeps same checksum in different folders — they genuinely live in two places", () => {
    const { unique, duplicateLocalIds } = dedupeByFolderAndChecksum([
      makeItem({ localId: "a", checksumSha256: "HASH", targetFolderId: "F1" }),
      makeItem({ localId: "b", checksumSha256: "HASH", targetFolderId: "F2" }),
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicateLocalIds).toEqual([]);
  });

  it("re-submission with the same localId wins (caller is retrying)", () => {
    // Same logical item with a newer localPath / driveName — not a
    // duplicate; the caller is re-submitting with corrected fields.
    const { unique, duplicateLocalIds } = dedupeByFolderAndChecksum([
      makeItem({ localId: "a", driveName: "v1.jpg" }),
      makeItem({ localId: "a", driveName: "v2.jpg" }),
    ]);
    expect(unique).toHaveLength(1);
    expect(unique[0].driveName).toBe("v2.jpg");
    expect(duplicateLocalIds).toEqual([]);
  });
});

describe("aggregateBatchProgress", () => {
  type Row = { state: DriveBatchItemState; sizeBytes: number };

  it("empty batch reports zeros + isComplete=true (vacuously true)", () => {
    const snap = aggregateBatchProgress([]);
    expect(snap.totalItems).toBe(0);
    expect(snap.byteFraction).toBe(0);
    expect(snap.isComplete).toBe(true);
  });

  it("byte fraction is byte-weighted, not item-weighted", () => {
    const items: Row[] = [
      { state: "uploaded", sizeBytes: 900 },
      { state: "pending", sizeBytes: 100 },
    ];
    const snap = aggregateBatchProgress(items);
    expect(snap.byteFraction).toBeCloseTo(0.9, 5);
    expect(snap.uploadedBytes).toBe(900);
    expect(snap.totalBytes).toBe(1000);
  });

  it("skipped-duplicate counts as uploaded bytes (Drive already had the bytes)", () => {
    const items: Row[] = [
      { state: "skipped-duplicate", sizeBytes: 500 },
      { state: "uploaded", sizeBytes: 500 },
    ];
    expect(aggregateBatchProgress(items).byteFraction).toBe(1);
    expect(aggregateBatchProgress(items).skippedDuplicateItems).toBe(1);
  });

  it("isComplete true only when every item is in a terminal state", () => {
    const mixed: Row[] = [
      { state: "uploaded", sizeBytes: 1 },
      { state: "uploading", sizeBytes: 1 },
    ];
    expect(aggregateBatchProgress(mixed).isComplete).toBe(false);

    const done: Row[] = [
      { state: "uploaded", sizeBytes: 1 },
      { state: "failed", sizeBytes: 1 },
      { state: "skipped-duplicate", sizeBytes: 1 },
    ];
    expect(aggregateBatchProgress(done).isComplete).toBe(true);
  });

  it("counts failed items separately from completed", () => {
    const items: Row[] = [
      { state: "uploaded", sizeBytes: 1 },
      { state: "failed", sizeBytes: 1 },
      { state: "failed", sizeBytes: 1 },
    ];
    const snap = aggregateBatchProgress(items);
    expect(snap.completedItems).toBe(1);
    expect(snap.failedItems).toBe(2);
  });
});

describe("pickNextItems", () => {
  it("respects globalConcurrency", () => {
    const pending = [
      makeItem({ localId: "a" }),
      makeItem({ localId: "b" }),
      makeItem({ localId: "c" }),
    ];
    const picked = pickNextItems({
      pending,
      inFlight: [],
      globalConcurrency: 2,
      perFolderConcurrency: 10,
    });
    expect(picked).toHaveLength(2);
  });

  it("subtracts in-flight from the global budget", () => {
    const pending = [makeItem({ localId: "a" }), makeItem({ localId: "b" })];
    const picked = pickNextItems({
      pending,
      inFlight: [makeItem({ localId: "x" })],
      globalConcurrency: 2,
      perFolderConcurrency: 10,
    });
    expect(picked).toHaveLength(1);
  });

  it("respects perFolderConcurrency even when global budget is ample", () => {
    const pending = [
      makeItem({ localId: "f1a", targetFolderId: "F1" }),
      makeItem({ localId: "f1b", targetFolderId: "F1" }),
      makeItem({ localId: "f2a", targetFolderId: "F2" }),
    ];
    const picked = pickNextItems({
      pending,
      inFlight: [],
      globalConcurrency: 5,
      perFolderConcurrency: 1,
    });
    expect(picked.map((i) => i.localId)).toEqual(["f1a", "f2a"]);
  });

  it("returns empty when inFlight saturates the global budget", () => {
    const picked = pickNextItems({
      pending: [makeItem()],
      inFlight: [makeItem({ localId: "x" }), makeItem({ localId: "y" })],
      globalConcurrency: 2,
      perFolderConcurrency: 10,
    });
    expect(picked).toEqual([]);
  });

  it("skips items in a saturated folder but picks from others", () => {
    const pending = [
      makeItem({ localId: "f1a", targetFolderId: "F1" }),
      makeItem({ localId: "f2a", targetFolderId: "F2" }),
    ];
    const picked = pickNextItems({
      pending,
      inFlight: [makeItem({ localId: "x", targetFolderId: "F1" })],
      globalConcurrency: 5,
      perFolderConcurrency: 1,
    });
    expect(picked.map((i) => i.localId)).toEqual(["f2a"]);
  });
});

describe("classifyUploadOutcome", () => {
  it("success with a Drive file id → succeeded", () => {
    expect(
      classifyUploadOutcome({
        response: { statusCode: 200, data: { id: "drive-abc" } },
      }),
    ).toEqual({ kind: "succeeded", driveFileId: "drive-abc" });
  });

  it("success without an id → permanent (Drive violated its contract)", () => {
    expect(
      classifyUploadOutcome({ response: { statusCode: 200, data: {} } }).kind,
    ).toBe("permanent");
  });

  it("409 → duplicate", () => {
    expect(
      classifyUploadOutcome({ error: { code: 409, message: "exists" } }).kind,
    ).toBe("duplicate");
  });

  it("401 / 403 → retryable (token refresh path)", () => {
    expect(
      classifyUploadOutcome({ error: { code: 401, message: "invalid" } }).kind,
    ).toBe("retryable");
    expect(
      classifyUploadOutcome({ error: { code: 403, message: "forbidden" } }).kind,
    ).toBe("retryable");
  });

  it("408 / 429 / 5xx → retryable", () => {
    for (const code of [408, 429, 500, 502, 503, 504]) {
      expect(classifyUploadOutcome({ error: { code } }).kind).toBe("retryable");
    }
  });

  it("400 / 404 → permanent (retrying gets the same rejection)", () => {
    for (const code of [400, 404, 410]) {
      expect(classifyUploadOutcome({ error: { code } }).kind).toBe("permanent");
    }
  });
});

describe("backoffSeconds", () => {
  it("follows the 1, 2, 5, 15, 60 ladder", () => {
    expect(backoffSeconds(1)).toBe(1);
    expect(backoffSeconds(2)).toBe(2);
    expect(backoffSeconds(3)).toBe(5);
    expect(backoffSeconds(4)).toBe(15);
    expect(backoffSeconds(5)).toBe(60);
  });

  it("clamps at 60 for large attempt counts", () => {
    expect(backoffSeconds(10)).toBe(60);
    expect(backoffSeconds(1_000)).toBe(60);
  });

  it("treats zero/negative attempts as the first attempt", () => {
    expect(backoffSeconds(0)).toBe(1);
    expect(backoffSeconds(-5)).toBe(1);
  });
});
