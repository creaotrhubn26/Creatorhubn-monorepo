/**
 * competitor-metadata-fetcher.ts — STUB
 *
 * Page Metadata 2.0 Fase 1.5 was started in a prior session but the
 * implementation file was repeatedly lost to working-tree conflicts
 * before it landed in git. The import in server/index.ts references the
 * eventual sweep entry point; until the real fetcher is rebuilt, this
 * stub keeps the type-check + build green without booting any cron.
 *
 * Replace with the real implementation when re-tackling Page Metadata 2.0
 * Fase 1.5 (per-platform fetchers + sparkline graphs).
 */

import type { Pool } from "pg";

export function maybeStartCompetitorSnapshotSweep(
  _pool: Pool,
): { started: boolean; reason: string } {
  return {
    started: false,
    reason: "competitor-metadata-fetcher not yet rebuilt — Page Metadata 2.0 Fase 1.5 pending",
  };
}
