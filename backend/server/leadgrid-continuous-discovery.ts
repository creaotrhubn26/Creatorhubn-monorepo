/**
 * leadgrid-continuous-discovery.ts
 *
 * Mig 0353 — "Continuous Lead Discovery" workflow-action + cron-scheduler.
 *
 * Når en workflow med trigger=schedule.cron + action=leadgrid.discover_leads
 * fyrer, kaller engine `runDiscoveryForProject()` her. Vi henter prosjektets
 * config fra leadgrid_project_discovery_config og kjører discovery
 * pipeline'en (samme stack som /discover-leads-endpointet).
 *
 * Ekstrahert til egen fil for å unngå sirkulær import mellom engine
 * + project-lead-discovery-routes.
 *
 * Kjøres også av en periodic-poller (registerLeadgridContinuousDiscoveryCron)
 * som hver 5. minutt sjekker leadgrid_project_discovery_config etter
 * rader med auto_discover_enabled=TRUE + next_run_at <= NOW(). Dette
 * gir oss "Daglig 06:00" via cron-uttrykk i en workflow uten å trenge
 * en separat scheduler-service.
 */

import type { Pool } from "pg";
import crypto from "crypto";

import { searchPlaces } from "./lead-map-service.js";
import { processUrlResearchBatch } from "./leadgrid-url-batch-processor.js";
import { autoAssignIndustryFromDiscoveryQuery } from "./leadgrid-industry-classify.js";

// =====================================================================
// Types
// =====================================================================

export interface RunDiscoveryOpts {
  projectId: string;
  ownerUserId: string;
  organizationId: string;
  count?: number;
  industryQueryOverride?: string | null;
  cityOverride?: string | null;
}

export type RunDiscoveryResult =
  | {
      ok: true;
      batchId: string;
      foundCount: number;
      discoveryQuery: string;
      pinnedLeads: number; // estimat — settes etter processor-finalize via DB-query
    }
  | {
      ok: false;
      reason: string;
    };

interface DiscoveryConfigRow {
  project_id: string;
  industry_query: string | null;
  city_filter: string[] | null;
  geography_lat: string | null;
  geography_lng: string | null;
  geography_radius_km: number | null;
  count_per_run: number;
  organization_id: string | null;
  created_by_user_id: string | null;
}

// =====================================================================
// Hovedfunksjon — gjenbrukt av engine + cron
// =====================================================================

export async function runDiscoveryForProject(
  pool: Pool,
  opts: RunDiscoveryOpts,
): Promise<RunDiscoveryResult> {
  // 1. Hent config (eller bygg en in-memory fra opts hvis ikke i DB)
  const cfg = await loadDiscoveryConfig(pool, opts.projectId);

  const industryQuery =
    opts.industryQueryOverride ?? cfg?.industry_query ?? null;
  const cityList = cfg?.city_filter ?? null;
  const city = opts.cityOverride ?? cityList?.[0] ?? null;
  const count = opts.count ?? cfg?.count_per_run ?? 10;

  if (!industryQuery) {
    return { ok: false, reason: "industry_query_required" };
  }

  const discoveryQuery = city
    ? `${industryQuery} i ${city}`
    : `${industryQuery} i Norge`;

  // 2. Spør Google Places
  const radiusM = cfg?.geography_radius_km
    ? Math.max(1000, Math.min(cfg.geography_radius_km * 1000, 100_000))
    : 25_000;
  const lat = cfg?.geography_lat ? Number(cfg.geography_lat) : undefined;
  const lng = cfg?.geography_lng ? Number(cfg.geography_lng) : undefined;
  const places = await searchPlaces(pool, {
    ownerUserId: opts.ownerUserId,
    query: discoveryQuery,
    latitude: typeof lat === "number" && Number.isFinite(lat) ? lat : undefined,
    longitude: typeof lng === "number" && Number.isFinite(lng) ? lng : undefined,
    radiusMeters:
      typeof lat === "number" && typeof lng === "number" ? radiusM : undefined,
  });
  if (!places.ok) {
    return { ok: false, reason: `places_search_failed:${places.reason}` };
  }

  // 3. Filtrer ut allerede importerte
  const existing = await pool.query<{ google_place_id: string }>(
    `SELECT google_place_id FROM crm_customers
      WHERE owner_user_id = $1 AND google_place_id IS NOT NULL`,
    [opts.ownerUserId],
  );
  const existingPlaceIds = new Set(existing.rows.map((r) => r.google_place_id));
  const candidates = places.results
    .filter((p) => !p.alreadyImported && !existingPlaceIds.has(p.placeId))
    .slice(0, Math.max(1, Math.min(count, 50)));

  if (candidates.length === 0) {
    return {
      ok: true,
      batchId: "",
      foundCount: 0,
      discoveryQuery,
      pinnedLeads: 0,
    };
  }

  // 4. Auto-assign industry_id (Fix 4)
  const autoIndustry = await autoAssignIndustryFromDiscoveryQuery(pool, {
    discoveryQuery,
  }).catch(() => null);

  // 5. Opprett batch + drafts (samme stack som discover-leads-endpointet)
  const batchId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO leadgrid_url_research_batches (
        id, organization_id, created_by, total_urls, status
      ) VALUES ($1::uuid, $2::uuid, $3, $4, 'pending')`,
    [batchId, opts.organizationId, opts.ownerUserId, candidates.length],
  );

  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    const placeholderUrl =
      p.websiteUrl ?? `https://maps.google.com/?cid=${p.placeId}`;
    const draftRes = await pool.query<{ id: string }>(
      `INSERT INTO crm_customers (
          id, name, status, source,
          owner_user_id, organization_id, project_id,
          website_url,
          latitude, longitude, location_confidence,
          google_place_id, google_rating,
          address, phone,
          lead_status, lead_source,
          draft_status,
          industry_id,
          import_source, import_batch_id,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, 'lead', 'lead_discovery_cron',
          $2, $3::uuid, $4,
          $5,
          $6, $7, 'exact',
          $8, $9,
          $10, $11,
          'unvisited', 'lead_discovery_cron',
          'draft',
          $12::uuid,
          'lead_discovery_cron', $13::uuid,
          NOW(), NOW()
        ) RETURNING id::text`,
      [
        p.name,
        opts.ownerUserId,
        opts.organizationId,
        opts.projectId,
        placeholderUrl,
        p.latitude || null,
        p.longitude || null,
        p.placeId,
        p.rating,
        p.address,
        p.phone,
        autoIndustry?.industryId ?? null,
        batchId,
      ],
    );
    const draftId = draftRes.rows[0].id;
    await pool.query(
      `INSERT INTO leadgrid_url_research_items (
          batch_id, url, order_index, draft_lead_id, status
        ) VALUES ($1::uuid, $2, $3, $4::uuid, 'pending')`,
      [batchId, placeholderUrl, i, draftId],
    );
  }

  // Set discovery_meta (best-effort — kan mangle pre-mig-0352)
  try {
    await pool.query(
      `UPDATE leadgrid_url_research_batches
          SET category = 'lead_discovery',
              discovery_meta = $2::jsonb
        WHERE id = $1::uuid`,
      [
        batchId,
        JSON.stringify({
          project_id: opts.projectId,
          discovery_query: discoveryQuery,
          industry: industryQuery,
          city: city ?? null,
          requested_count: count,
          source: "continuous_cron",
          auto_assigned_industry: autoIndustry,
        }),
      ],
    );
  } catch {
    /* silent */
  }

  // 6. Kjør processor inline (vi venter på den så engine kan rapportere
  //    riktig pinned_leads — discovery kan ta opp til 30s × 10 / 3 ≈ 100s.
  //    Cron-loop tåler det fordi den ikke holder request open.)
  await processUrlResearchBatch(pool, batchId);

  // 7. Hent finale stats + oppdater config
  const stats = await pool.query<{
    pinned_leads: number;
    completed_urls: number;
    failed_urls: number;
  }>(
    `SELECT pinned_leads, completed_urls, failed_urls
       FROM leadgrid_url_research_batches WHERE id = $1::uuid`,
    [batchId],
  );
  const pinned = stats.rows[0]?.pinned_leads ?? 0;

  // Oppdater config — bump total_discoveries + total_pinned + neste run
  // (kun hvis config-rad faktisk eksisterer)
  if (cfg) {
    await pool.query(
      `UPDATE leadgrid_project_discovery_config
          SET last_run_at = NOW(),
              total_discoveries = total_discoveries + 1,
              total_pinned = total_pinned + $2,
              updated_at = NOW()
        WHERE project_id = $1`,
      [opts.projectId, pinned],
    );
  }

  return {
    ok: true,
    batchId,
    foundCount: candidates.length,
    discoveryQuery,
    pinnedLeads: pinned,
  };
}

async function loadDiscoveryConfig(
  pool: Pool,
  projectId: string,
): Promise<DiscoveryConfigRow | null> {
  try {
    const r = await pool.query<DiscoveryConfigRow>(
      `SELECT project_id,
              industry_query,
              city_filter,
              geography_lat::text,
              geography_lng::text,
              geography_radius_km,
              count_per_run,
              organization_id::text,
              created_by_user_id::text
         FROM leadgrid_project_discovery_config
        WHERE project_id = $1
        LIMIT 1`,
      [projectId],
    );
    return r.rows[0] ?? null;
  } catch {
    // Tabell finnes ikke — pre-mig-0353
    return null;
  }
}

// =====================================================================
// Periodic poller — sjekker config-tabellen for next_run_at <= NOW()
// =====================================================================
//
// Registreres som setInterval i server-startup. Lett-vekt — én SQL per
// 5 min + kall til runDiscoveryForProject per row.
//
// next_run_at oppdateres til NOW() + 24h etter en kjøring (daglig).
// Hvis brukeren ønsker timeplan utenom dagsfrekvens, kan workflow-
// definisjonen bruke en annen cron — men polleren kjører fortsatt
// daglig som standard.

const POLLER_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_NEXT_RUN_OFFSET_HOURS = 24;

let pollerHandle: NodeJS.Timeout | null = null;
let pollerRunning = false;

export function registerLeadgridContinuousDiscoveryCron(pool: Pool): void {
  if (pollerHandle) return; // idempotent — ikke registrer flere ganger

  // Sett initial neste-run-tid for ferske config-rader
  // (next_run_at NULL → bli kjørt med en gang).
  pollerHandle = setInterval(() => {
    void runPollerTick(pool);
  }, POLLER_INTERVAL_MS);

  // Kjør én tick rett etter oppstart (etter 30s grace-periode for at
  // resten av server-startup skal være ferdig)
  setTimeout(() => {
    void runPollerTick(pool);
  }, 30_000);

  console.log(
    "[continuous-discovery] poller registered (interval 5 min)",
  );
}

export function _stopContinuousDiscoveryCron(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }
}

async function runPollerTick(pool: Pool): Promise<void> {
  if (pollerRunning) return; // overlap-protection
  pollerRunning = true;
  try {
    // Hent prosjekter som skal kjøres nå
    const r = await pool
      .query<{
        project_id: string;
        organization_id: string | null;
        created_by_user_id: string | null;
      }>(
        `SELECT project_id, organization_id::text, created_by_user_id::text
           FROM leadgrid_project_discovery_config
          WHERE auto_discover_enabled = TRUE
            AND (next_run_at IS NULL OR next_run_at <= NOW())
          ORDER BY next_run_at NULLS FIRST
          LIMIT 5`,
      )
      .catch(() => ({ rows: [] as Array<{
        project_id: string;
        organization_id: string | null;
        created_by_user_id: string | null;
      }> }));

    if (r.rows.length === 0) return;

    for (const row of r.rows) {
      // Bump next_run_at FØR vi kjører for å unngå dobbeltkjøring
      await pool.query(
        `UPDATE leadgrid_project_discovery_config
            SET next_run_at = NOW() + INTERVAL '${DEFAULT_NEXT_RUN_OFFSET_HOURS} hours'
          WHERE project_id = $1`,
        [row.project_id],
      );

      if (!row.created_by_user_id || !row.organization_id) {
        console.warn(
          `[continuous-discovery] skipping project=${row.project_id} — missing owner/org`,
        );
        continue;
      }

      try {
        const result = await runDiscoveryForProject(pool, {
          projectId: row.project_id,
          ownerUserId: row.created_by_user_id,
          organizationId: row.organization_id,
        });
        if (result.ok) {
          console.log(
            `[continuous-discovery] project=${row.project_id} found=${result.foundCount} pinned=${result.pinnedLeads}`,
          );
        } else {
          console.warn(
            `[continuous-discovery] project=${row.project_id} skipped: ${result.reason}`,
          );
        }
      } catch (err) {
        console.error(
          `[continuous-discovery] project=${row.project_id} threw:`,
          err,
        );
      }
    }
  } finally {
    pollerRunning = false;
  }
}

export const __test = {
  loadDiscoveryConfig,
  runPollerTick,
};
