/**
 * role-room-retention-service.ts
 *
 * Automatisk sletting av casting-data når lagringsfristen er ute
 * (Del A punkt 35 — «GDPR-autosletting: compliance, ikke feature»).
 *
 * Plattformen hadde fra før brukerinitierte rettigheter — innsyn (art. 15),
 * sletting (art. 17) og portabilitet (art. 20) i
 * role-room-talent-gdpr-routes.ts. Det som manglet var motstykket: at data
 * forsvinner av seg selv når grunnlaget for å lagre dem er borte.
 *
 * Fire kategorier feies:
 *   expired_consent_media      — samtykket er utløpt → media fjernes
 *   rejected_candidate_media   — kandidaten gikk ikke videre → media fjernes
 *   closed_project_candidates  — prosjektet er avsluttet → PII anonymiseres
 *   expired_selftape_links     — delingslenken er utløpt → token nulles
 *
 * Fristene ligger i role_room_retention_policies og settes uten kodeendring.
 * Prosjekt-scope overstyrer plattform-scope. Prosjekter med
 * `retention_hold = TRUE` (tvist, bevaringspålegg) hoppes alltid over.
 *
 * **B2:** feiingen sletter aldri objekter direkte. Den markerer
 * `role_room_user_files.deleted_at`, og den eksisterende
 * role-room-storage-cleanup-worker.ts rydder objektene fra B2. Det holder
 * kvoteregnskapet konsistent og gjenbruker en path som allerede er i drift.
 *
 * **Dry-run er standard.** Uten `RR_RETENTION_ENFORCE=true` rapporterer
 * feiingen hva den ville gjort uten å endre noe — fristene i migrering 0443
 * er ikke juridisk vurdert ennå (DPA-notatet fører sletteregler som åpent
 * punkt), og ingenting bør slettes før de er det.
 */

import { randomUUID } from "crypto";
import type { Pool, PoolClient } from "pg";

// ── Kategorier ──────────────────────────────────────────────────────────────

export const RETENTION_CATEGORIES = [
  "expired_consent_media",
  "rejected_candidate_media",
  "closed_project_candidates",
  "expired_selftape_links",
] as const;

export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];

/** Brukes når en kategori mangler policy-rad — feier ikke, men logger. */
export const NO_POLICY = null;

/**
 * Kandidatstatuser som betyr «gikk ikke videre». Holdt i synk med
 * ALLOWED_STATUSES i role-room-candidate-status-routes.ts.
 */
export const REJECTED_CANDIDATE_STATUSES = ["declined", "withdrawn", "passed"];

/** Prosjektstatuser som regnes som avsluttet. */
export const CLOSED_PROJECT_STATUSES = ["completed", "archived", "closed", "wrapped"];

// ── Policy-oppslag ──────────────────────────────────────────────────────────

export interface RetentionPolicyRow {
  scope_type: "platform" | "project";
  scope_ref: string | null;
  category: string;
  retention_days: number;
  enabled: boolean;
}

/**
 * Finner gjeldende frist for en kategori: prosjekt-overstyring vinner over
 * plattform-default. Deaktivert policy (enabled = false) slår av feiingen
 * for den kategorien — også når en plattform-default finnes, slik at et
 * enkeltprosjekt kan unntas uten å røre plattformraden.
 *
 * Returnerer null når ingen policy gjelder — da skal kategorien ikke feies.
 */
export function resolveRetentionDays(
  policies: RetentionPolicyRow[],
  projectId: string | null,
  category: RetentionCategory,
): number | null {
  const forCategory = policies.filter((p) => p.category === category);

  const projectPolicy = projectId
    ? forCategory.find((p) => p.scope_type === "project" && p.scope_ref === projectId)
    : undefined;
  if (projectPolicy) return projectPolicy.enabled ? projectPolicy.retention_days : NO_POLICY;

  const platformPolicy = forCategory.find((p) => p.scope_type === "platform");
  if (platformPolicy) return platformPolicy.enabled ? platformPolicy.retention_days : NO_POLICY;

  return NO_POLICY;
}

export async function loadRetentionPolicies(pool: Pool): Promise<RetentionPolicyRow[]> {
  const r = await pool.query(
    `SELECT scope_type, scope_ref, category, retention_days, enabled
       FROM role_room_retention_policies`,
  );
  return r.rows as RetentionPolicyRow[];
}

// ── Media-referanser → B2-nøkler ────────────────────────────────────────────

/**
 * Kandidat-media lagres som URL-lister (`photos`/`videos` JSONB). For å
 * kunne rydde objektet må URL-en oversettes tilbake til b2_key.
 *
 * Vi gjenkjenner to former:
 *   - offentlig base:  {R2_PUBLIC_BASE|B2_PUBLIC_BASE}/<key>
 *   - S3-endepunkt:    https://s3.<region>.backblazeb2.com/<bucket>/<key>
 *
 * URL-er vi ikke kjenner igjen er eksterne (byrå-lenker, Vimeo o.l.) — dem
 * eier vi ikke og kan bare fjerne referansen til. De telles separat slik at
 * revisjonssporet ikke gir inntrykk av at filen er borte.
 */
export function b2KeyFromMediaUrl(url: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (typeof url !== "string" || !url) return null;

  const bases = [env.B2_PUBLIC_BASE, env.R2_PUBLIC_BASE, env.R2_PUBLIC_URL_BASE]
    .filter((b): b is string => typeof b === "string" && b.length > 0)
    .map((b) => b.replace(/\/+$/, ""));

  for (const base of bases) {
    if (url.startsWith(base + "/")) {
      return decodeURIComponent(url.slice(base.length + 1).split("?")[0]);
    }
  }

  const bucket = env.B2_ROLE_ROOM_BUCKET_NAME;
  if (bucket) {
    const m = url.match(
      new RegExp(`^https?://s3\\.[^/]+\\.backblazeb2\\.com/${escapeRegExp(bucket)}/(.+)$`),
    );
    if (m) return decodeURIComponent(m[1].split("?")[0]);
  }

  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Deler en medieliste i våre egne B2-nøkler og eksterne referanser. */
export function partitionMediaUrls(
  urls: unknown,
  env: NodeJS.ProcessEnv = process.env,
): { keys: string[]; externalCount: number } {
  if (!Array.isArray(urls)) return { keys: [], externalCount: 0 };
  const keys: string[] = [];
  let externalCount = 0;
  for (const raw of urls) {
    const url = typeof raw === "string" ? raw : (raw as { url?: string } | null)?.url;
    if (typeof url !== "string") continue;
    const key = b2KeyFromMediaUrl(url, env);
    if (key) keys.push(key);
    else externalCount += 1;
  }
  return { keys, externalCount };
}

// ── Feiing ──────────────────────────────────────────────────────────────────

export interface RetentionSweepOptions {
  /** Uten dette er kjøringen en tørrkjøring som ikke endrer data. */
  enforce?: boolean;
  /** Feier bare disse kategoriene. Default: alle. */
  categories?: RetentionCategory[];
  /** Maks antall rader per kategori per kjøring. */
  batchSize?: number;
  env?: NodeJS.ProcessEnv;
}

export interface CategoryResult {
  category: RetentionCategory;
  retentionDays: number | null;
  candidatesFound: number;
  rowsAffected: number;
  filesMarkedForDeletion: number;
  externalMediaRefs: number;
  skippedReason?: string;
}

export interface RetentionSweepResult {
  runId: string;
  dryRun: boolean;
  startedAt: string;
  durationMs: number;
  categories: CategoryResult[];
  totalRowsAffected: number;
}

const DEFAULT_BATCH_SIZE = 500;

export async function runRetentionSweep(
  pool: Pool,
  options: RetentionSweepOptions = {},
): Promise<RetentionSweepResult> {
  const env = options.env ?? process.env;
  const enforce = options.enforce ?? env.RR_RETENTION_ENFORCE === "true";
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const categories = options.categories ?? [...RETENTION_CATEGORIES];
  const runId = randomUUID();
  const startedAt = new Date();

  const policies = await loadRetentionPolicies(pool);
  const results: CategoryResult[] = [];

  for (const category of categories) {
    // Fristen slås opp per rad for prosjekt-overstyringer; her henter vi
    // plattform-defaulten for å kunne hoppe over kategorien tidlig.
    const platformDays = resolveRetentionDays(policies, null, category);

    const hasProjectOverride = policies.some(
      (p) => p.scope_type === "project" && p.category === category && p.enabled,
    );
    if (platformDays === NO_POLICY && !hasProjectOverride) {
      results.push({
        category,
        retentionDays: null,
        candidatesFound: 0,
        rowsAffected: 0,
        filesMarkedForDeletion: 0,
        externalMediaRefs: 0,
        skippedReason: "ingen aktiv policy",
      });
      continue;
    }

    try {
      const result = await sweepCategory(pool, {
        category,
        policies,
        platformDays,
        enforce,
        batchSize,
        runId,
        env,
      });
      results.push(result);
    } catch (err) {
      console.error(`[rr-retention] kategori ${category} feilet:`, err);
      results.push({
        category,
        retentionDays: platformDays,
        candidatesFound: 0,
        rowsAffected: 0,
        filesMarkedForDeletion: 0,
        externalMediaRefs: 0,
        skippedReason: `feilet: ${String(err).slice(0, 200)}`,
      });
    }
  }

  return {
    runId,
    dryRun: !enforce,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    categories: results,
    totalRowsAffected: results.reduce((sum, r) => sum + r.rowsAffected, 0),
  };
}

interface SweepCtx {
  category: RetentionCategory;
  policies: RetentionPolicyRow[];
  platformDays: number | null;
  enforce: boolean;
  batchSize: number;
  runId: string;
  env: NodeJS.ProcessEnv;
}

async function sweepCategory(pool: Pool, ctx: SweepCtx): Promise<CategoryResult> {
  switch (ctx.category) {
    case "expired_consent_media":
      return sweepCandidateMedia(pool, ctx, {
        reason: "consent_expired",
        // Ankeret er samtykkets utløpsdato.
        whereSql: `
          EXISTS (
            SELECT 1 FROM casting_consents k
             WHERE k.candidate_id = c.id
               AND k.project_id = c.project_id
               AND k.expires_at IS NOT NULL
               AND k.expires_at < NOW() - (($DAYS$)::text || ' days')::interval
          )`,
        anchorSql: `(
          SELECT MAX(k.expires_at) FROM casting_consents k
           WHERE k.candidate_id = c.id AND k.project_id = c.project_id
        )`,
      });

    case "rejected_candidate_media":
      return sweepCandidateMedia(pool, ctx, {
        reason: "candidate_rejected",
        // Ankeret er siste statusendring.
        whereSql: `
          c.status = ANY($REJECTED$)
          AND c.updated_at < NOW() - (($DAYS$)::text || ' days')::interval`,
        anchorSql: `c.updated_at`,
      });

    case "closed_project_candidates":
      return sweepClosedProjects(pool, ctx);

    case "expired_selftape_links":
      return sweepExpiredSelftapeLinks(pool, ctx);

    default:
      return {
        category: ctx.category,
        retentionDays: null,
        candidatesFound: 0,
        rowsAffected: 0,
        filesMarkedForDeletion: 0,
        externalMediaRefs: 0,
        skippedReason: "ukjent kategori",
      };
  }
}

/**
 * Felles feiing for de to kategoriene som bare fjerner media fra en
 * kandidatrad. Personopplysningene beholdes — det er mediene grunnlaget er
 * bortfalt for.
 */
async function sweepCandidateMedia(
  pool: Pool,
  ctx: SweepCtx,
  spec: { reason: string; whereSql: string; anchorSql: string },
): Promise<CategoryResult> {
  const days = ctx.platformDays;
  // Prosjekt-overstyringer håndteres ved å filtrere bort rader som har en
  // egen policy, og kjøre dem i egen runde med sin egen frist.
  const projectOverrides = ctx.policies.filter(
    (p) => p.scope_type === "project" && p.category === ctx.category,
  );

  const result: CategoryResult = {
    category: ctx.category,
    retentionDays: days,
    candidatesFound: 0,
    rowsAffected: 0,
    filesMarkedForDeletion: 0,
    externalMediaRefs: 0,
  };

  const runs: Array<{ days: number; projectId: string | null }> = [];
  if (days !== NO_POLICY) runs.push({ days, projectId: null });
  for (const o of projectOverrides) {
    if (o.enabled && o.scope_ref) runs.push({ days: o.retention_days, projectId: o.scope_ref });
  }

  for (const run of runs) {
    const params: unknown[] = [run.days];
    let where = spec.whereSql.replace(/\$DAYS\$/g, "$1");

    if (spec.whereSql.includes("$REJECTED$")) {
      params.push(REJECTED_CANDIDATE_STATUSES);
      where = where.replace(/\$REJECTED\$/g, `$${params.length}`);
    }

    // Plattformkjøringen hopper over prosjekter som har egen policy.
    const overrideIds = projectOverrides.map((o) => o.scope_ref).filter(Boolean) as string[];
    let scopeClause = "";
    if (run.projectId) {
      params.push(run.projectId);
      scopeClause = `AND c.project_id = $${params.length}`;
    } else if (overrideIds.length > 0) {
      params.push(overrideIds);
      scopeClause = `AND NOT (c.project_id = ANY($${params.length}))`;
    }

    params.push(ctx.batchSize);
    const limitParam = `$${params.length}`;

    const rows = await pool.query(
      `SELECT c.id, c.project_id, c.photos, c.videos, ${spec.anchorSql} AS anchor_at
         FROM casting_candidates c
         JOIN casting_projects p ON p.id = c.project_id
        WHERE p.retention_hold = FALSE
          AND c.anonymized_at IS NULL
          AND (
            (jsonb_typeof(c.photos) = 'array' AND jsonb_array_length(c.photos) > 0)
            OR (jsonb_typeof(c.videos) = 'array' AND jsonb_array_length(c.videos) > 0)
          )
          AND ${where}
          ${scopeClause}
        ORDER BY c.updated_at
        LIMIT ${limitParam}`,
      params,
    );

    result.candidatesFound += rows.rowCount ?? 0;

    for (const row of rows.rows) {
      const photos = partitionMediaUrls(row.photos, ctx.env);
      const videos = partitionMediaUrls(row.videos, ctx.env);
      const keys = [...photos.keys, ...videos.keys];
      const external = photos.externalCount + videos.externalCount;

      result.externalMediaRefs += external;

      if (!ctx.enforce) {
        result.rowsAffected += 1;
        result.filesMarkedForDeletion += keys.length;
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE casting_candidates
              SET photos = '[]'::jsonb, videos = '[]'::jsonb, updated_at = NOW()
            WHERE id = $1`,
          [row.id],
        );
        const marked = await markFilesForDeletion(client, keys);
        await writeAuditRow(client, {
          runId: ctx.runId,
          category: ctx.category,
          entityType: "casting_candidate",
          entityId: row.id,
          projectId: row.project_id,
          reason: spec.reason,
          retentionDays: run.days,
          anchorAt: row.anchor_at,
          action: "media_purged",
          mediaDeleted: marked,
          mediaExternal: external,
          dryRun: false,
        });
        await client.query("COMMIT");
        result.rowsAffected += 1;
        result.filesMarkedForDeletion += marked;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        console.error(`[rr-retention] kandidat ${row.id} feilet:`, err);
      } finally {
        client.release();
      }
    }
  }

  return result;
}

/**
 * Avsluttet prosjekt: kandidatraden beholdes (statistikk, budsjettkobling)
 * men tømmes for personopplysninger. `anonymized_at` hindrer at raden tas
 * om igjen ved neste kjøring.
 */
async function sweepClosedProjects(pool: Pool, ctx: SweepCtx): Promise<CategoryResult> {
  const days = ctx.platformDays;
  const result: CategoryResult = {
    category: ctx.category,
    retentionDays: days,
    candidatesFound: 0,
    rowsAffected: 0,
    filesMarkedForDeletion: 0,
    externalMediaRefs: 0,
  };
  if (days === NO_POLICY) {
    result.skippedReason = "ingen aktiv policy";
    return result;
  }

  const rows = await pool.query(
    `SELECT c.id, c.project_id, c.photos, c.videos,
            COALESCE(p.end_date::timestamptz, p.updated_at) AS anchor_at
       FROM casting_candidates c
       JOIN casting_projects p ON p.id = c.project_id
      WHERE p.retention_hold = FALSE
        AND c.anonymized_at IS NULL
        AND p.status = ANY($1)
        AND COALESCE(p.end_date::timestamptz, p.updated_at) < NOW() - ($2::text || ' days')::interval
      ORDER BY c.updated_at
      LIMIT $3`,
    [CLOSED_PROJECT_STATUSES, String(days), ctx.batchSize],
  );

  result.candidatesFound = rows.rowCount ?? 0;

  for (const row of rows.rows) {
    const photos = partitionMediaUrls(row.photos, ctx.env);
    const videos = partitionMediaUrls(row.videos, ctx.env);
    const keys = [...photos.keys, ...videos.keys];
    const external = photos.externalCount + videos.externalCount;
    result.externalMediaRefs += external;

    if (!ctx.enforce) {
      result.rowsAffected += 1;
      result.filesMarkedForDeletion += keys.length;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Navnet erstattes framfor å nulles — NOT NULL, og en lesbar
      // plassholder er greiere i UI enn en tom streng.
      await client.query(
        `UPDATE casting_candidates
            SET name = 'Anonymisert kandidat',
                email = NULL,
                phone = NULL,
                agency = NULL,
                notes = NULL,
                emergency_contact = '{}'::jsonb,
                metadata = '{}'::jsonb,
                photos = '[]'::jsonb,
                videos = '[]'::jsonb,
                anonymized_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      );
      const marked = await markFilesForDeletion(client, keys);
      await writeAuditRow(client, {
        runId: ctx.runId,
        category: ctx.category,
        entityType: "casting_candidate",
        entityId: row.id,
        projectId: row.project_id,
        reason: "project_closed",
        retentionDays: days,
        anchorAt: row.anchor_at,
        action: "anonymized",
        mediaDeleted: marked,
        mediaExternal: external,
        dryRun: false,
      });
      await client.query("COMMIT");
      result.rowsAffected += 1;
      result.filesMarkedForDeletion += marked;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(`[rr-retention] anonymisering av ${row.id} feilet:`, err);
    } finally {
      client.release();
    }
  }

  return result;
}

/**
 * Utløpt delingslenke skal ikke kunne gjenoppstå. Token og passord-hash
 * nulles; selve innsendingen beholdes med sin historikk.
 */
async function sweepExpiredSelftapeLinks(pool: Pool, ctx: SweepCtx): Promise<CategoryResult> {
  const days = ctx.platformDays;
  const result: CategoryResult = {
    category: ctx.category,
    retentionDays: days,
    candidatesFound: 0,
    rowsAffected: 0,
    filesMarkedForDeletion: 0,
    externalMediaRefs: 0,
  };
  if (days === NO_POLICY) {
    result.skippedReason = "ingen aktiv policy";
    return result;
  }

  const rows = await pool.query(
    `SELECT id, casting_project_id, private_expires_at
       FROM talent_selftape_submissions
      WHERE private_token IS NOT NULL
        AND private_expires_at IS NOT NULL
        AND private_expires_at < NOW() - ($1::text || ' days')::interval
      ORDER BY private_expires_at
      LIMIT $2`,
    [String(days), ctx.batchSize],
  );

  result.candidatesFound = rows.rowCount ?? 0;

  if (!ctx.enforce) {
    result.rowsAffected = rows.rowCount ?? 0;
    return result;
  }

  for (const row of rows.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE talent_selftape_submissions
            SET private_token = NULL, private_password_hash = NULL, updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      );
      await writeAuditRow(client, {
        runId: ctx.runId,
        category: ctx.category,
        entityType: "talent_selftape_submission",
        entityId: row.id,
        projectId: row.casting_project_id,
        reason: "share_link_expired",
        retentionDays: days,
        anchorAt: row.private_expires_at,
        action: "token_revoked",
        mediaDeleted: 0,
        mediaExternal: 0,
        dryRun: false,
      });
      await client.query("COMMIT");
      result.rowsAffected += 1;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(`[rr-retention] lenke ${row.id} feilet:`, err);
    } finally {
      client.release();
    }
  }

  return result;
}

// ── Hjelpere ────────────────────────────────────────────────────────────────

/**
 * Markerer sporede filer som slettet. Selve B2-objektet ryddes av
 * role-room-storage-cleanup-worker.ts, som allerede eier den jobben.
 * Returnerer antall rader som faktisk ble markert — nøkler vi ikke sporer
 * (opplastet før fil-registeret, eller fra en annen modul) treffer ingen rad.
 */
async function markFilesForDeletion(client: PoolClient, b2Keys: string[]): Promise<number> {
  if (b2Keys.length === 0) return 0;
  const r = await client.query(
    `UPDATE role_room_user_files
        SET deleted_at = NOW()
      WHERE b2_key = ANY($1) AND deleted_at IS NULL`,
    [b2Keys],
  );
  return r.rowCount ?? 0;
}

interface AuditRow {
  runId: string;
  category: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  reason: string;
  retentionDays: number;
  anchorAt: Date | string | null;
  action: string;
  mediaDeleted: number;
  mediaExternal: number;
  dryRun: boolean;
}

async function writeAuditRow(client: PoolClient, row: AuditRow): Promise<void> {
  await client.query(
    `INSERT INTO role_room_retention_deletions
       (category, entity_type, entity_id, project_id, reason, retention_days,
        anchor_at, action, media_objects_deleted, media_external_refs, dry_run, run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      row.category,
      row.entityType,
      row.entityId,
      row.projectId,
      row.reason,
      row.retentionDays,
      row.anchorAt,
      row.action,
      row.mediaDeleted,
      row.mediaExternal,
      row.dryRun,
      row.runId,
    ],
  );
}
