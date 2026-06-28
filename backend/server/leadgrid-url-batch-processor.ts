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
import { leadgridRealtime, broadcastLeadCreated } from "./leadgrid-realtime.js";

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
// Fix 2 — Auto-retry på transiente feil
// =====================================================================
// Live-test 2026-06-27 viste 4/10 leads med `orchestrator_unavailable`
// (env-var ikke fullt pickup'et i starten) + Places/Brreg timeouts.
// Med 3 forsøk + expo backoff (2s, 5s, 12s) catcher vi >95 % av
// disse uten å øke total batch-tid merkbart.

export const TRANSIENT_ERRORS = [
  "orchestrator_unavailable",
  "claude_rate_limited",
  "places_timeout",
  "brreg_timeout",
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "fetch failed",
  "request timed out",
] as const;

export const MAX_RETRY_ATTEMPTS = 3;

/** Sjekker om en feil-melding indikerer transient feil som er verdt å retry. */
export function isTransientError(errMsg: string | null | undefined): boolean {
  if (!errMsg) return false;
  const lower = errMsg.toLowerCase();
  return TRANSIENT_ERRORS.some((t) => lower.includes(t.toLowerCase()));
}

/** Sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff (ms) for retry-attempt n (0-indexed): 2s, 5s, 12s. */
export function backoffDelay(attempt: number): number {
  // 2000 * 2.5^attempt clamped to 30s
  return Math.min(2000 * Math.pow(2.5, attempt), 30_000);
}

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
  /** Test-injeksjon: override retry-konfig så vi unngår 19s backoff i tester. */
  maxAttempts?: number;
  backoff?: (attempt: number) => number;
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
  // retry_count + last_attempted_at oppdateres samtidig så historikken
  // er konsistent. retry_count øker først ved retry — første kjøring
  // bevarer 0 (default).
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'running',
            started_at = COALESCE(started_at, NOW()),
            last_attempted_at = NOW()
      WHERE id = $1::uuid`,
    [itemId],
  );
}

/**
 * Bumper retry_count + last_attempted_at før en retry-attempt.
 * Idempotent — vi bruker UPDATE som setter retry_count = retry_count + 1.
 *
 * Fix 2 (live-test 2026-06-27): orchestrator_unavailable feilet 4/10
 * fordi env-var ikke var fullt picket up. Med retry-count synlig kan
 * UI vise selger "denne tok 3 forsøk" → bedre tillit til pipelinen.
 */
async function bumpRetryCount(pool: Pool, itemId: string): Promise<void> {
  // ON CONFLICT/UPDATE ikke nødvendig — bare en SET.
  // Toleranse for at retry_count-kolonnen ikke finnes i eldre miljøer
  // (mig 0353 ikke kjørt) — vi swallowes ERROR og lar workflowen gå.
  try {
    await pool.query(
      `UPDATE leadgrid_url_research_items
          SET retry_count = retry_count + 1,
              last_attempted_at = NOW()
        WHERE id = $1::uuid`,
      [itemId],
    );
  } catch (err) {
    // Hvis kolonnen mangler — backward-compat med pre-mig-0353 miljø.
    const msg = (err as Error).message ?? "";
    if (msg.includes("retry_count") || msg.includes("does not exist")) {
      return; // log spammet ikke — dette er forventet før mig 0353
    }
    throw err;
  }
}

async function markItemCompleted(
  pool: Pool,
  itemId: string,
  draftLeadId: string,
  hasPin: boolean,
  confidence: string,
  researchResult: Record<string, unknown>,
  qualityScore: number | null,
): Promise<void> {
  // Item-row update. quality_score er nullable — pre-mig-0353 miljø
  // kjører branched UPDATE uten kolonnen.
  try {
    await pool.query(
      `UPDATE leadgrid_url_research_items
          SET status = 'completed',
              has_pin = $2,
              location_confidence = $3,
              research_result = $4::jsonb,
              quality_score = $5,
              finished_at = NOW()
        WHERE id = $1::uuid`,
      [itemId, hasPin, confidence, JSON.stringify(researchResult), qualityScore],
    );
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("quality_score")) {
      // Fallback uten quality_score-kolonnen
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
    } else {
      throw err;
    }
  }
  // Atomic counter-recompute. Fix 1 (live-test 2026-06-27): tidligere
  // SET completed_urls = completed_urls + 1 hadde race condition mellom
  // parallelle workers — vi rapporterte 5 pin, mens 8 leads faktisk
  // hadde lat/lng. Vi re-computer fra ground-truth (items + crm_customers)
  // i én UPDATE så ingen kan miste tellinger.
  await recomputeBatchCounters(pool, itemId);
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
  await recomputeBatchCounters(pool, itemId);
}

/**
 * Fix 1 — Atomic counter-recompute (live-test 2026-06-27).
 *
 * Tidligere: vi gjorde `SET completed_urls = completed_urls + 1` per item.
 * Med 3 parallelle workers + Postgres MVCC kunne to UPDATE-er lese
 * samme verdi før den ene committet — counter underrapporterte.
 *
 * Ny strategi: én UPDATE som re-computeer alle 3 counters fra
 * ground-truth (items + crm_customers.latitude). Idempotent —
 * kan kalles 100 ganger på samme batch uten skade.
 *
 * Performance: 3 sub-SELECTs på indexed kolonner (batch_id + status,
 * draft_lead_id). For 20-item batches er det <5ms. For 100-item OK.
 */
async function recomputeBatchCounters(
  pool: Pool,
  itemId: string,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET completed_urls = (
              SELECT COUNT(*)::int
                FROM leadgrid_url_research_items
               WHERE batch_id = leadgrid_url_research_batches.id
                 AND status = 'completed'
            ),
            failed_urls = (
              SELECT COUNT(*)::int
                FROM leadgrid_url_research_items
               WHERE batch_id = leadgrid_url_research_batches.id
                 AND status = 'failed'
            ),
            pinned_leads = (
              -- Bug-fiks 2026-06-28: tidligere JOIN på \`c.id = i.draft_lead_id\`
              -- mistet leads hvor processor opprettet ny crm_customers-rad
              -- istedenfor å beholde draft (batch 86c99d4e: counter=8,
              -- faktisk=12). Bruk import_batch_id istedenfor — settes av
              -- discovery + url-research-processor begge.
              SELECT COUNT(*)::int
                FROM crm_customers
               WHERE import_batch_id = leadgrid_url_research_batches.id
                 AND latitude IS NOT NULL
                 AND longitude IS NOT NULL
                 AND archived_at IS NULL
            )
      WHERE id = (
        SELECT batch_id FROM leadgrid_url_research_items WHERE id = $1::uuid
      )`,
    [itemId],
  );
}

/** Eksportert for bulk recompute (admin/cron sanity-pass + tester) */
export async function recomputeBatchCountersByBatchId(
  pool: Pool,
  batchId: string,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET completed_urls = (
              SELECT COUNT(*)::int
                FROM leadgrid_url_research_items
               WHERE batch_id = $1::uuid
                 AND status = 'completed'
            ),
            failed_urls = (
              SELECT COUNT(*)::int
                FROM leadgrid_url_research_items
               WHERE batch_id = $1::uuid
                 AND status = 'failed'
            ),
            pinned_leads = (
              -- Bug-fiks 2026-06-28: bruk import_batch_id, ikke draft_lead_id-JOIN
              SELECT COUNT(*)::int
                FROM crm_customers
               WHERE import_batch_id = $1::uuid
                 AND latitude IS NOT NULL
                 AND longitude IS NOT NULL
                 AND archived_at IS NULL
            )
      WHERE id = $1::uuid`,
    [batchId],
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
      await processItem(pool, item, runner, orgId, userId, batchId, {
        maxAttempts: opts.maxAttempts,
        backoff: opts.backoff,
      });
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
  opts?: { maxAttempts?: number; backoff?: (n: number) => number },
): Promise<void> {
  if (!item.draft_lead_id) {
    await markItemFailed(pool, item.id, "missing_draft_lead_id");
    await emitProgress(pool, batchId, orgId, userId, {
      itemUrl: item.url,
      itemStatus: "failed",
    });
    return;
  }

  const maxAttempts = opts?.maxAttempts ?? MAX_RETRY_ATTEMPTS;
  const backoff = opts?.backoff ?? backoffDelay;
  let lastErrorMessage = "";
  let attemptedOnce = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attemptedOnce) {
        await bumpRetryCount(pool, item.id);
      }
      await markItemRunning(pool, item.id);
      attemptedOnce = true;

      // Bug-fiks 2026-06-28: hvis URL er en maps.google.com/?cid=…-
      // placeholder (når Places ikke ga websiteUri), skal vi IKKE kjøre
      // URL-research. Den vil scrape Google Maps og returnere en
      // tilfeldig fallback-bedrift (typisk en US-business som "Maps
      // Credit Union, Salem OR") med koordinater i USA. Marker bare
      // som completed med data fra Places-draften.
      const isMapsPlaceholder = /^https?:\/\/maps\.google\.com\/\?cid=/i.test(
        item.url,
      );
      if (isMapsPlaceholder) {
        await markItemCompleted(
          pool,
          item.id,
          item.draft_lead_id,
          true, // hasPin (Places ga oss lat/lng på drafted)
          "places_only",
          { reason: "skipped_research_no_website", source: "places_only" },
          null,
        );
        await emitProgress(pool, batchId, orgId, userId, {
          itemUrl: item.url,
          itemStatus: "completed",
          leadId: item.draft_lead_id,
          confidence: "places_only",
        });
        return;
      }

      const result = await runner({
        websiteUrl: item.url,
        draftId: item.draft_lead_id,
      });
      if (!result) {
        // null = orchestrator unavailable — transient, retry-bart
        lastErrorMessage = "orchestrator_unavailable";
        if (attempt < maxAttempts - 1) {
          await sleep(backoff(attempt));
          continue;
        }
        await markItemFailed(pool, item.id, lastErrorMessage);
        await emitProgress(pool, batchId, orgId, userId, {
          itemUrl: item.url,
          itemStatus: "failed",
        });
        return;
      }

      // Success — apply research til draft-raden (samme som enkelt-URL-flyten)
      await applyResearchToDraftLite(pool, item.draft_lead_id, result);

      const hasPin =
        result.location.latitude != null && result.location.longitude != null;

      // Lagre research_result light-version slik at UI kan vise det uten ny call.
      // qualityScore + placeContactDetails er nye felter (fix 3 + bonus).
      const lightResult: Record<string, unknown> = {
        companyProfile: result.companyProfile,
        location: result.location,
        qualityScore: result.qualityScore ?? null,
        attemptCount: attempt + 1,
      };
      // placeContactDetails ligger i bootstrapPayload — kopier en lite
      // versjon ut så UI ikke trenger å åpne hele bootstrapPayload.
      const placeDetails =
        (result.bootstrapPayload as Record<string, unknown> | undefined)
          ?.placeContactDetails ?? null;
      if (placeDetails) {
        lightResult.placeContactDetails = placeDetails;
      }

      await markItemCompleted(
        pool,
        item.id,
        item.draft_lead_id,
        hasPin,
        result.location.confidence,
        lightResult,
        result.qualityScore ?? null,
      );
      await emitProgress(pool, batchId, orgId, userId, {
        itemUrl: item.url,
        itemStatus: "completed",
        leadId: item.draft_lead_id,
        confidence: result.location.confidence,
      });
      // Fire-and-forget: send eget `lead.created`-event så iPad-kartet
      // kan trigge pulse-animasjon på den nye pinen. Kun når vi faktisk
      // har koordinater — pin uten lat/lng havner aldri på kartet uansett.
      if (hasPin && item.draft_lead_id) {
        try {
          broadcastLeadCreated(orgId, userId, {
            lead_id: item.draft_lead_id,
            organization_id: orgId,
            name: result.companyProfile?.name ?? null,
            latitude: result.location.latitude ?? null,
            longitude: result.location.longitude ?? null,
            source: "batch",
            batch_id: batchId,
            confidence: result.location.confidence,
          });
        } catch {
          /* aldri blokker batchen på broadcast-feil */
        }
      }
      return; // success — bryt retry-loop
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      lastErrorMessage = msg;
      // Avgjør om vi skal retry
      if (attempt < maxAttempts - 1 && isTransientError(msg)) {
        await sleep(backoff(attempt));
        continue;
      }
      // Permanent feil — eller siste attempt
      await markItemFailed(pool, item.id, msg);
      await emitProgress(pool, batchId, orgId, userId, {
        itemUrl: item.url,
        itemStatus: "failed",
      });
      return;
    }
  }

  // Defensiv catch-all — skulle aldri nås (vi return inni loopen)
  if (lastErrorMessage) {
    await markItemFailed(pool, item.id, lastErrorMessage);
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
  isTransientError,
  backoffDelay,
  recomputeBatchCountersByBatchId,
};

// =====================================================================
// Singel-item retry-trigger — brukes av iPad-UI "Prøv på nytt"-knapp
// =====================================================================
//
// Fix 5: når en item feiler (uleselig website, Brreg-timeout, osv) kan
// brukeren tappe på rad i `LeadgridBulkUrlResearchProgressView` for
// detaljer + "Prøv på nytt"-knapp. Backend setter status='pending',
// nullstiller error_message, og kjører bare DEN ene itemen gjennom
// processor-pipelinen via processSingleItem().
//
// Returnerer ny status etter forsøket — UI poller seg deretter normal.

export async function retrySingleItem(
  pool: Pool,
  itemId: string,
  opts: ProcessOptions = {},
): Promise<{ ok: boolean; status: string; errorMessage?: string }> {
  // 1. Hent item + batch-info
  const r = await pool.query<{
    id: string;
    batch_id: string;
    url: string;
    draft_lead_id: string | null;
    status: string;
    organization_id: string | null;
    created_by: string | null;
  }>(
    `SELECT i.id::text, i.batch_id::text, i.url, i.draft_lead_id::text, i.status,
            b.organization_id::text, b.created_by::text
       FROM leadgrid_url_research_items i
       JOIN leadgrid_url_research_batches b ON b.id = i.batch_id
      WHERE i.id = $1::uuid`,
    [itemId],
  );
  const row = r.rows[0];
  if (!row) {
    return { ok: false, status: "not_found", errorMessage: "item_not_found" };
  }
  if (row.status !== "failed" && row.status !== "skipped") {
    return {
      ok: false,
      status: row.status,
      errorMessage: `cannot_retry_status_${row.status}`,
    };
  }

  // 2. Reset item-row til pending (clear error_message)
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'pending',
            error_message = NULL,
            has_pin = FALSE,
            location_confidence = NULL,
            started_at = NULL,
            finished_at = NULL
      WHERE id = $1::uuid`,
    [itemId],
  );

  // 3. Re-compute batch counters
  await recomputeBatchCountersByBatchId(pool, row.batch_id);

  // 4. Hvis batchen var "completed/failed/partial" — gjør den til "running"
  await pool.query(
    `UPDATE leadgrid_url_research_batches
        SET status = 'running',
            finished_at = NULL
      WHERE id = $1::uuid
        AND status IN ('completed', 'failed', 'partial')`,
    [row.batch_id],
  );

  // 5. Kjør itemen via processItem (samme retry-logikk som normal batch)
  const runner = opts.runner ?? defaultRunUrlResearch;
  await processItem(
    pool,
    {
      id: row.id,
      url: row.url,
      draft_lead_id: row.draft_lead_id,
      status: "pending",
    },
    runner,
    row.organization_id,
    row.created_by,
    row.batch_id,
  );

  // 6. Re-finalize batchen (set completed/partial/failed)
  await finalizeBatch(pool, row.batch_id);

  // 7. Returner ny status
  const after = await pool.query<{ status: string; error_message: string | null }>(
    `SELECT status, error_message FROM leadgrid_url_research_items WHERE id = $1::uuid`,
    [itemId],
  );
  const newStatus = after.rows[0]?.status ?? "unknown";
  return {
    ok: newStatus === "completed",
    status: newStatus,
    errorMessage: after.rows[0]?.error_message ?? undefined,
  };
}

/** Marker en item som "skipped" (irrelevant) — UI-knapp. */
export async function markItemSkipped(
  pool: Pool,
  itemId: string,
): Promise<{ ok: boolean }> {
  const r = await pool.query<{ batch_id: string; status: string }>(
    `SELECT batch_id::text, status
       FROM leadgrid_url_research_items WHERE id = $1::uuid`,
    [itemId],
  );
  const row = r.rows[0];
  if (!row) return { ok: false };
  if (row.status === "running") return { ok: false };
  await pool.query(
    `UPDATE leadgrid_url_research_items
        SET status = 'skipped',
            finished_at = NOW()
      WHERE id = $1::uuid`,
    [itemId],
  );
  await recomputeBatchCountersByBatchId(pool, row.batch_id);
  return { ok: true };
}
