/**
 * Competitor Metadata Fetcher — Page Metadata 2.0 Fase 1.
 *
 * Fase 1 leverer datalag (tabeller + watchlist-CRUD). Plattform-spesifikke
 * fetchers (Meta Graph, YouTube Data API, etc.) implementeres i Fase 1.5
 * som per-platform-strategi-fil. Inntil da returnerer fetcher() null og
 * daglig sweep er en no-op som logger.
 *
 * Manual on-demand fetch (POST /competitors/watchlist/:id/refresh) wirer
 * inn samme stub — UI får "Ikke implementert ennå"-tilbakemelding.
 */
import type { Pool } from "pg";

export interface CompetitorMetadata {
  followers_count: number | null;
  posts_30d: number | null;
  engagement_avg_30d: number | null;
  about_text: string | null;
  category: string | null;
  raw_metadata: Record<string, unknown> | null;
}

/**
 * Hent metadata for én konkurrent. Stub i Fase 1 — returnerer null så
 * routes returnerer 501 til UI. Per-plattform-fetchers kommer i Fase 1.5.
 */
export async function fetchCompetitorMetadata(
  platform: string,
  externalId: string,
): Promise<CompetitorMetadata | null> {
  console.log(`[competitor-fetcher] stub: ${platform}/${externalId} — Fase 1.5 implementerer faktisk fetch`);
  return null;
}

/**
 * Daglig snapshot-sweep. Boot-registreres i index.ts. Fase 1: no-op
 * loop som logger. Fase 1.5 vil iterere over watchlist-rader og
 * INSERT'e snapshots per row.
 */
export function maybeStartCompetitorSnapshotSweep(_pool: Pool): void {
  if (process.env.COMPETITOR_SNAPSHOT_RUNNER_ENABLED === "false") {
    console.log("[competitor-snapshot] disabled via env-var");
    return;
  }
  // Fase 1 stub: logger oppstart men kjører ikke fetch ennå.
  console.log("[competitor-snapshot] runner registrert (Fase 1 stub — fetch implementeres i 1.5)");
}
