/**
 * Pure helpers for the Drive batch upload pipeline. No network, no
 * DB — every function takes plain inputs and returns plain outputs.
 * The orchestrator in ``drive-batch-upload-service.ts`` composes
 * these with the ``googleapis`` Drive client + the
 * ``drive_upload_batch`` / ``drive_upload_item`` tables.
 *
 * Separating the logic this way keeps the expensive parts (auth
 * handshake, resumable upload, retry loop) free of conditional
 * branches we'd otherwise have to hand-verify in integration tests.
 * Routing + dedup + progress arithmetic all get unit coverage here.
 *
 * Context: the photo-enhancer pipeline produces several artefact
 * kinds per image (original, enhanced PNG, preview JPEG, manifest
 * JSON), each destined for a distinct folder in the customer's
 * Drive workspace (``PHOTO_ENHANCER_DRIVE_STRUCTURE``). A typical
 * batch is 40–200 files. Uploading them sequentially would take
 * minutes; uploading them concurrently without a planner would
 * OOM the Drive SDK's socket pool. This module gives the planner.
 */

/// One file queued for upload. Inputs are local-path + target-folder;
/// the pipeline fills in ``driveFileId`` + ``state`` as it runs.
export interface DriveBatchItem {
  /// Stable within the batch. Lets the orchestrator keep ordering
  /// across retries without re-matching by path.
  localId: string;
  /// Absolute or repo-relative path to the file on disk. The
  /// orchestrator reads the stream from here.
  localPath: string;
  /// Display name under Drive. Usually the local basename but we
  /// allow override so photographer-facing names can differ from
  /// disk layout (e.g. ``IMG_0472_enhanced.png`` → ``0472.png``).
  driveName: string;
  mimeType: string;
  /// File size in bytes. Used for ordering heuristics (smaller
  /// files first so a single 200 MB RAW doesn't block 100 JPEGs).
  sizeBytes: number;
  /// SHA-256 of the file contents. The planner uses this to skip
  /// re-uploads if Drive already has the file in the target folder.
  checksumSha256: string;
  /// Drive folder id the file should land in. The caller resolves
  /// this up-front (via ``ensureDriveFolder`` or similar) so the
  /// planner doesn't need to touch Drive.
  targetFolderId: string;
}

/// Per-item state in the DB.
export type DriveBatchItemState =
  | "pending"
  | "uploading"
  | "uploaded"
  | "skipped-duplicate"
  | "failed";

/// Execution outcome for a single upload attempt. The classifier
/// maps HTTP / Drive API responses into this narrow surface so the
/// orchestrator doesn't need to hand-parse every field.
export type UploadOutcome =
  | { kind: "succeeded"; driveFileId: string }
  | { kind: "duplicate"; driveFileId: string }
  | { kind: "retryable"; reason: string }
  | { kind: "permanent"; reason: string };

/// Batch-level snapshot for progress UI + polling.
export interface BatchProgress {
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedDuplicateItems: number;
  /// 0..1 fraction of bytes uploaded. Computed from per-item sizes
  /// so a 200 MB RAW doesn't show 1% progress for 95% of the run
  /// while lots of small JPEGs sail past.
  byteFraction: number;
  totalBytes: number;
  uploadedBytes: number;
  /// True when every item has reached a terminal state
  /// (``uploaded | skipped-duplicate | failed``).
  isComplete: boolean;
}

/**
 * Partition a queue of items by target folder + sort each partition
 * smaller-first. The orchestrator drains each partition in parallel
 * up to a concurrency limit.
 *
 * Why per-folder: Drive's resumable-upload session is folder-aware,
 * and serialising ``ensureDriveFolder`` calls is much cheaper when
 * grouped by folder id. Sorting smaller-first keeps the progress
 * bar moving — a 200 MB RAW wedged at the head of a 100-file batch
 * looks like a hang.
 */
export function groupItemsByFolder(
  items: readonly DriveBatchItem[],
): Map<string, DriveBatchItem[]> {
  const byFolder = new Map<string, DriveBatchItem[]>();
  for (const item of items) {
    const bucket = byFolder.get(item.targetFolderId) ?? [];
    bucket.push(item);
    byFolder.set(item.targetFolderId, bucket);
  }
  for (const bucket of byFolder.values()) {
    bucket.sort((a, b) => a.sizeBytes - b.sizeBytes);
  }
  return byFolder;
}

/**
 * Deduplicate by ``(targetFolderId, checksumSha256)``. Two items
 * with the same checksum going to the same folder collapse to one —
 * the later entry wins only if the earlier one has a different
 * ``localId`` (treat distinct localIds as independent requests,
 * same localId as the authoritative re-submission).
 *
 * Returns the deduplicated list so ``totalItems`` stays honest.
 * Callers wanting to audit what was dropped should inspect the
 * sibling ``duplicateLocalIds`` return value.
 */
export function dedupeByFolderAndChecksum(
  items: readonly DriveBatchItem[],
): { unique: DriveBatchItem[]; duplicateLocalIds: string[] } {
  const seen = new Map<string, DriveBatchItem>();
  const duplicates: string[] = [];
  for (const item of items) {
    const key = `${item.targetFolderId}::${item.checksumSha256}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    if (existing.localId === item.localId) {
      // Re-submission of the same logical item — keep the newer
      // version (allows the caller to retry with a different path
      // or name).
      seen.set(key, item);
    } else {
      duplicates.push(item.localId);
    }
  }
  return {
    unique: Array.from(seen.values()),
    duplicateLocalIds: duplicates,
  };
}

/**
 * Aggregate per-item progress into a batch-level snapshot.
 * ``items`` is the full roster; the function walks each and sums.
 */
export function aggregateBatchProgress(
  items: readonly { state: DriveBatchItemState; sizeBytes: number }[],
): BatchProgress {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let totalBytes = 0;
  let uploadedBytes = 0;
  for (const item of items) {
    totalBytes += item.sizeBytes;
    switch (item.state) {
      case "uploaded":
        completed += 1;
        uploadedBytes += item.sizeBytes;
        break;
      case "skipped-duplicate":
        skipped += 1;
        uploadedBytes += item.sizeBytes;
        break;
      case "failed":
        failed += 1;
        break;
      case "pending":
      case "uploading":
        break;
    }
  }
  const isComplete = items.every(
    (item) =>
      item.state === "uploaded" ||
      item.state === "skipped-duplicate" ||
      item.state === "failed",
  );
  const byteFraction = totalBytes === 0 ? 0 : uploadedBytes / totalBytes;
  return {
    totalItems: items.length,
    completedItems: completed,
    failedItems: failed,
    skippedDuplicateItems: skipped,
    byteFraction,
    totalBytes,
    uploadedBytes,
    isComplete,
  };
}

/**
 * Pick the next slice of items the orchestrator should start. Respects
 *   * ``globalConcurrency`` — total in-flight uploads.
 *   * ``perFolderConcurrency`` — keeps the Drive session pool under
 *     control on folders with 100+ queued items.
 *
 * ``inFlight`` is the current roster of items with state
 * ``uploading``. ``pending`` must be sorted by the caller in the
 * desired start-order (``groupItemsByFolder`` handles the
 * smaller-first heuristic).
 */
export function pickNextItems<T extends DriveBatchItem>(params: {
  pending: readonly T[];
  inFlight: readonly T[];
  globalConcurrency: number;
  perFolderConcurrency: number;
}): T[] {
  const { pending, inFlight, globalConcurrency, perFolderConcurrency } = params;
  const globalBudget = Math.max(0, globalConcurrency - inFlight.length);
  if (globalBudget === 0) return [];

  const perFolderCount = new Map<string, number>();
  for (const item of inFlight) {
    perFolderCount.set(
      item.targetFolderId,
      (perFolderCount.get(item.targetFolderId) ?? 0) + 1,
    );
  }

  const picked: T[] = [];
  for (const item of pending) {
    if (picked.length >= globalBudget) break;
    const folderCount = perFolderCount.get(item.targetFolderId) ?? 0;
    if (folderCount >= perFolderConcurrency) continue;
    picked.push(item);
    perFolderCount.set(item.targetFolderId, folderCount + 1);
  }
  return picked;
}

/**
 * Map a Drive response (or thrown error) into a typed outcome.
 * Centralising this here means the orchestrator can switch on the
 * return kind without parsing Drive's error shape at multiple call
 * sites. Call with ``{ response }`` on 2xx, ``{ error }`` on throw.
 */
export function classifyUploadOutcome(input: {
  response?: { statusCode?: number; data?: { id?: string } };
  error?: { code?: number; message?: string };
}): UploadOutcome {
  if (input.response) {
    const id = input.response.data?.id;
    if (id && id.length > 0) {
      return { kind: "succeeded", driveFileId: id };
    }
    return { kind: "permanent", reason: "Drive returned no file id" };
  }
  const code = input.error?.code ?? 0;
  const message = input.error?.message ?? "unknown error";
  // Drive's "file already exists" is reported via the error
  // surface with a specific HTTP 409-style code in some client
  // configurations. Treat it as a duplicate and let the caller
  // pair it with an existing Drive file id via a follow-up lookup.
  if (code === 409) {
    return { kind: "duplicate", driveFileId: "" };
  }
  if (code === 401 || code === 403) {
    // Retryable because the orchestrator can refresh the OAuth
    // token and re-try; if that fails the follow-up error maps
    // here again and burns another attempt.
    return { kind: "retryable", reason: message };
  }
  if (code === 408 || code === 429 || (code >= 500 && code < 600)) {
    return { kind: "retryable", reason: message };
  }
  return { kind: "permanent", reason: `${code}: ${message}` };
}

/**
 * Exponential-backoff delay table (seconds) for a retryable upload
 * attempt. Mirrors the iPad's ``RealtimeBackoff`` ladder so both
 * sync channels degrade predictably under the same flaky-network
 * conditions.
 */
export function backoffSeconds(attempts: number): number {
  const n = Math.max(1, attempts);
  switch (n) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 5;
    case 4:
      return 15;
    default:
      return 60;
  }
}
