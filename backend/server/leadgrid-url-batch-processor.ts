/**
 * leadgrid-url-batch-processor.ts
 *
 * Bakgrunns-processor for bulk-URL-research (mig 0351). Tar en batch_id
 * og kjører hver item gjennom samme `runUrlResearch` som enkelt-URL-flyten
 * fra mig 0328. Mens batchen kjører, oppdateres counters på
 * leadgrid_url_research_batches.{completed_urls,failed_urls,pinned_leads}
 * slik at iPad/web kan polle og rendre "X / Y leads lagt til på kartet".
 *
 * Concurrency
 *   - Maks N (default 3) parallelle items. Hindrer at vi hammer Brreg/Places
 *     med 20 anrop på en gang når brukeren limer inn en stor URL-liste.
 *   - Konfigurerbart via env-variabel LEADGRID_BULK_URL_CONCURRENCY.
 *
 * Cache
 *   - `runUrlResearch` kaller `runOrchestratedBootstrap` som selv slår opp
 *     i role-room-agent-cache. Vi trenger ingen ekstra cache-lag her.
 *
 * Avbryt
 *   - Batchen kan settes til status='cancelled' fra API. Processor sjekker
 *     status mellom hver item — pending items får status='skipped'.
 *
 * Pin-garanti
 *   - Hver item logger `has_pin` (lat/lng populert?) + `location_confidence`.
 *     Pinned counter brukes i UI-counter ("X av Y leads lagt til på kartet").
 *
 * Exporter:
 *   - processUrlResearchBatch(pool, batchId)   ← hovedfunksjon
 *   - For tester: kan injisere runner-fn for å mocke runUrlResearch.
 */

import type { Pool } from "pg";
import { runUrlResearch as defaultRunUrlResearch } from "./leadgrid-url-research-routes.js";
import { leadgridRealtime } from "./leadgrid-realtime.js";

// =====================================================================
// Konfigurasjon
// =====================================================================

const DEFAULT_CONCURRENCY = 3;
const ENV_CONCURRENCY = Number.parseInt(
  process.env.LEADGRID_BULK_URL_CONCURRENCY ?? "",
  10,
);
export const BULK_URL_CONCURRENCY = Number.isFinite(ENV_CONCURRENCY) &&
  ENV_CONCURRENCY > 0 &&
  ENV_CONCURRENCY <= 10
  ? ENV_CONCURRENCY
  : DEFAULT_CONCURRENCY;

// =====================================================================
// Types
// =====================================================================

export interface BulkUrlBatchProgress {
  batchId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  pinned: number;
  startedAt: string | null;
  finishedAt: string | null;
}

interface BatchItem {
  id: string;
  url: string;
  draft_lead_id: string | null;
  status: string;
}

type RunUrlResearchFn = typeof defaultRunUrlResearch;

interface ProcessOptions {
  runner?: RunUrlResearchFn;
  concurrency?: number;
}

// =====================================================================
// Helpers
// =====================================================================

async function loadBatchItems(
  pool: Pool,
  batchId: string,
): Promise<BatchItem[]> {
  const r = await pool.query<BatchItem>(
    `SELECT id::text, url, draft_lead_id::text, status
       FROM leadgrid_url_research_items
      WHERE batch_id = $1::uuid AND status = 'pending'
      ORDER BY order_index ASC`,
    [batchId],
  );
  return r.rows;
}

async function isBatchCancelled(
  pool: Pool,
  batchId: string,
): Promise<boolean> {
  const r = await pool.query<{ status: string }>(
    `SELECT status FROM leadgrid_url_research_batches WHERE id = $1::uuid`,
    [batchId],
  );
  return r.rows[0]?.status === "cancelled";
}

async function getBatchOrgAndUser(
  pool: Pool,
  batchId: string,
): Promise<{ orgId: string | null; userId: string | null }> {
  const r = await pool.query<{ organization_id: string | null; created_by: string }>(
    `SELECT organization_id::text, created_by::text
       FROM leadgrid_url_research_batches
      WHERE id = $1::uuid`,
    [batchId],
  );
  if (!r.rows[0]) return { orgId: null, userId: null };
  return {
    orgId: r.rows[0].organization_id,
    userId: r.rows[0].created_by,
  };
}

async function markItemRunning(pool: Pool, itemId: string): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'running', started_at = NOW()
      WHERE id = $1::uuid`,
    [itemId],
  );
}

async function markItemCompleted(
  pool: Pool,
  itemId: string,
  draftLeadId: string,
  hasPin: boolean,
  confidence: string,
  researchResult: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'completed',
            has_pin = $2,
            location_confidence = $3,
            research_result = $4::jsonb,
            finished_at = NOW()
      WHERE id = $1::uuid`,
    [itemId, hasPin, confidence, JSON.stringify(researchResult)],
  );
  // Bump batch counters atomisk
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET completed_urls = completed_urls + 1,
            pinned_leads = pinned_leads + (CASE WHEN $2 THEN 1 ELSE 0 END)
      WHERE id = (
        SELECT batch_id FROM leadgrid_url_research_items WHERE id = $1::uuid
      )`,
    [itemId, hasPin],
  );
  // Behold draftLeadId-referansen som logg-info (kanonisk lever på item-raden)
  if (draftLeadId) {
    void draftLeadId;
  }
}

async function markItemFailed(
  pool: Pool,
  itemId: string,
  errorMessage: string,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'failed',
            error_message = $2,
            finished_at = NOW()
      WHERE id = $1::uuid`,
    [itemId, errorMessage.slice(0, 1000)],
  );
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET failed_urls = failed_urls + 1
      WHERE id = (
        SELECT batch_id FROM leadgrid_url_research_items WHERE id = $1::uuid
      )`,
    [itemId],
  );
}

async function markPendingAsSkipped(
  pool: Pool,
  batchId: string,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'skipped', finished_at = NOW()
      WHERE batch_id = $1::uuid AND status IN ('pending', 'running')`,
    [batchId],
  );
}

async function finalizeBatch(pool: Pool, batchId: string): Promise<void> {
  const r = await pool.query<{
    total_urls: number;
    completed_urls: number;
    failed_urls: number;
    status: string;
  }>(
    `SELECT total_urls, completed_urls, failed_urls, status
       FROM leadgrid_url_research_batches WHERE id = $1::uuid`,
    [batchId],
  );
  const row = r.rows[0];
  if (!row) return;
  if (row.status === "cancelled") return;
  let nextStatus: string;
  const processed = row.completed_urls + row.failed_urls;
  if (processed === 0) {
    nextStatus = "failed";
  } else if (row.failed_urls === 0) {
    nextStatus = "completed";
  } else if (row.completed_urls === 0) {
    nextStatus = "failed";
  } else {
    nextStatus = "partial";
  }
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET status = $2, finished_at = NOW()
      WHERE id = $1::uuid`,
    [batchId, nextStatus],
  );
}

// =====================================================================
// Broadcast — emit progress på WebSocket-kanal slik at iPad/web
// kan animere pins idet de blir committet.
// =====================================================================

function broadcastBatchProgress(
  orgId: string | null,
  userId: string | null,
  payload: {
    batchId: string;
    completed: number;
    failed: number;
    pinned: number;
    total: number;
    itemUrl?: string;
    itemStatus?: string;
    leadId?: string | null;
    confidence?: string | null;
  },
): void {
  const eventPayload = {
    batch_id: payload.batchId,
    completed: payload.completed,
    failed: payload.failed,
    pinned: payload.pinned,
    total: payload.total,
    item_url: payload.itemUrl ?? null,
    item_status: payload.itemStatus ?? null,
    lead_id: payload.leadId ?? null,
    location_confidence: payload.confidence ?? null,
  };
  if (orgId) {
    leadgridRealtime.emit({
      type: "url_research.batch.progress",
      channel: `org:${orgId}`,
      data: eventPayload,
    });
  }
  if (userId) {
    leadgridRealtime.emit({
      type: "url_research.batch.progress",
      channel: `user:${userId}`,
      data: eventPayload,
    });
  }
}

async function emitProgress(
  pool: Pool,
  batchId: string,
  orgId: string | null,
  userId: string | null,
  extra: {
    itemUrl?: string;
    itemStatus?: string;
    leadId?: string | null;
    confidence?: string | null;
  } = {},
): Promise<void> {
  const r = await pool.query<{
    completed_urls: number;
    failed_urls: number;
    pinned_leads: number;
    total_urls: number;
  }>(
    `SELECT completed_urls, failed_urls, pinned_leads, total_urls
       FROM leadgrid_url_research_batches WHERE id = $1::uuid`,
    [batchId],
  );
  const row = r.rows[0];
  if (!row) return;
  broadcastBatchProgress(orgId, userId, {
    batchId,
    completed: row.completed_urls,
    failed: row.failed_urls,
    pinned: row.pinned_leads,
    total: row.total_urls,
    ...extra,
  });
}

// =====================================================================
// Hovedfunksjon — kalles fra POST /batch (setImmediate)
// =====================================================================

export async function processUrlResearchBatch(
  pool: Pool,
  batchId: string,
  opts: ProcessOptions = {},
): Promise<void> {
  const runner = opts.runner ?? defaultRunUrlResearch;
  const concurrency = Math.max(
    1,
    Math.min(opts.concurrency ?? BULK_URL_CONCURRENCY, 10),
  );

  // Marker batch running
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET status = 'running', started_at = COALESCE(started_at, NOW())
      WHERE id = $1::uuid AND status = 'pending'`,
    [batchId],
  );

  const { orgId, userId } = await getBatchOrgAndUser(pool, batchId);
  const items = await loadBatchItems(pool, batchId);

  // Worker-pool: en gruppe Promises som plukker fra `queue`.
  const queue = [...items];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      // Sjekk avbryt før hver item
      if (await isBatchCancelled(pool, batchId)) {
        return;
      }
      const item = queue.shift();
      if (!item) return;
      await processItem(pool, item, runner, orgId, userId, batchId);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Hvis batchen ble cancelled, marker pending-items som skipped
  if (await isBatchCancelled(pool, batchId)) {
    await markPendingAsSkipped(pool, batchId);
    return;
  }

  await finalizeBatch(pool, batchId);
  await emitProgress(pool, batchId, orgId, userId, {
    itemStatus: "batch_done",
  });
}

async function processItem(
  pool: Pool,
  item: BatchItem,
  runner: RunUrlResearchFn,
  orgId: string | null,
  userId: string | null,
  batchId: string,
): Promise<void> {
  if (!item.draft_lead_id) {
    await markItemFailed(pool, item.id, "missing_draft_lead_id");
    await emitProgress(pool, batchId, orgId, userId, {
      itemUrl: item.url,
      itemStatus: "failed",
    });
    return;
  }
  try {
    await markItemRunning(pool, item.id);
    const result = await runner({
      websiteUrl: item.url,
      draftId: item.draft_lead_id,
    });
    if (!result) {
      await markItemFailed(pool, item.id, "orchestrator_unavailable");
      await emitProgress(pool, batchId, orgId, userId, {
        itemUrl: item.url,
        itemStatus: "failed",
      });
      return;
    }

    // Apply research til draft-raden (samme som enkelt-URL-flyten)
    await applyResearchToDraftLite(pool, item.draft_lead_id, result);

    const hasPin =
      result.location.latitude != null && result.location.longitude != null;

    // Lagre research_result light-version slik at UI kan vise det uten ny call
    const lightResult = {
      companyProfile: result.companyProfile,
      location: result.location,
    };

    await markItemCompleted(
      pool,
      item.id,
      item.draft_lead_id,
      hasPin,
      result.location.confidence,
      lightResult,
    );
    await emitProgress(pool, batchId, orgId, userId, {
      itemUrl: item.url,
      itemStatus: "completed",
      leadId: item.draft_lead_id,
      confidence: result.location.confidence,
    });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await markItemFailed(pool, item.id, msg);
    await emitProgress(pool, batchId, orgId, userId, {
      itemUrl: item.url,
      itemStatus: "failed",
    });
  }
}

// =====================================================================
// Mini-versjon av applyResearchToDraft — vi vil unngå sirkulær import
// av den interne funksjonen fra leadgrid-url-research-routes.ts, så
// vi inlinet det vi trenger her. Samme SQL-shape, samme felter.
// =====================================================================

type ApplyResearchInput = NonNullable<
  Awaited<ReturnType<RunUrlResearchFn>>
>;

async function applyResearchToDraftLite(
  pool: Pool,
  draftId: string,
  result: ApplyResearchInput,
): Promise<void> {
  const { companyProfile, location, bootstrapPayload } = result;
  await pool.query(
    `UPDATE crm_customers SET
       name                    = COALESCE($2, name),
       company                 = COALESCE($3, company),
       email                   = COALESCE($4, email),
       phone                   = COALESCE($5, phone),
       website_url             = COALESCE($6, website_url),
       address                 = COALESCE($7, address),
       postal_code             = COALESCE($8, postal_code),
       city                    = COALESCE($9, city),
       country                 = COALESCE($10, country),
       latitude                = $11,
       longitude               = $12,
       location_confidence     = $13,
       instagram_url           = COALESCE($14, instagram_url),
       linkedin_url            = COALESCE($15, linkedin_url),
       lead_source             = 'url_research',
       lead_status             = 'unvisited',
       ai_opportunity_score    = COALESCE($16, ai_opportunity_score),
       estimated_value         = COALESCE($17, estimated_value),
       draft_status            = 'researched',
       import_raw_data         = $18::jsonb,
       updated_at              = NOW()
     WHERE id = $1::uuid`,
    [
      draftId,
      companyProfile.name,
      companyProfile.company,
      companyProfile.email,
      companyProfile.phone,
      companyProfile.website,
      location.address,
      location.postalCode,
      location.city,
      location.country,
      location.latitude,
      location.longitude,
      location.confidence,
      companyProfile.socials.instagram ?? null,
      companyProfile.socials.linkedin ?? null,
      companyProfile.aiOpportunityScore,
      companyProfile.estimatedValueOere,
      JSON.stringify(bootstrapPayload ?? {}),
    ],
  );
  if (companyProfile.socials.facebook) {
    try {
      await pool.query(
        `UPDATE crm_customers SET facebook_url = COALESCE($2, facebook_url)
          WHERE id = $1::uuid`,
        [draftId, companyProfile.socials.facebook],
      );
    } catch {
      /* facebook_url-kolonnen kan mangle i eldre miljøer */
    }
  }
}

// =====================================================================
// Public progress-snapshot — brukes av polling-endpointet
// =====================================================================

export async function readBatchProgress(
  pool: Pool,
  batchId: string,
): Promise<BulkUrlBatchProgress | null> {
  const r = await pool.query<{
    id: string;
    status: string;
    total_urls: number;
    completed_urls: number;
    failed_urls: number;
    pinned_leads: number;
    started_at: Date | null;
    finished_at: Date | null;
  }>(
    `SELECT id::text, status, total_urls, completed_urls, failed_urls,
            pinned_leads, started_at, finished_at
       FROM leadgrid_url_research_batches WHERE id = $1::uuid`,
    [batchId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    batchId: row.id,
    status: row.status,
    total: row.total_urls,
    completed: row.completed_urls,
    failed: row.failed_urls,
    pinned: row.pinned_leads,
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
  };
}

// =====================================================================
// URL-validering brukt av POST /batch
// =====================================================================

export function normalizeAndValidateUrls(input: unknown): {
  valid: string[];
  invalid: string[];
} {
  if (!Array.isArray(input)) return { valid: [], invalid: [] };
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    let s = raw.trim();
    if (!s) continue;
    // Tillat brukeren å lime inn "domene.no"
    if (!/^https?:\/\//i.test(s)) {
      s = `https://${s}`;
    }
    try {
      const u = new URL(s);
      // Dedupe — bruker hostname+pathname som canonical
      const key = `${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push(s);
    } catch {
      invalid.push(raw);
    }
  }
  return { valid, invalid };
}

// =====================================================================
// Tester
// =====================================================================

export const __test = {
  applyResearchToDraftLite,
  loadBatchItems,
  isBatchCancelled,
  markItemRunning,
  markItemCompleted,
  markItemFailed,
  markPendingAsSkipped,
  finalizeBatch,
  readBatchProgress,
};
