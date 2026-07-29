/**
 * marketing-segments-service.ts
 *
 * Fase 1 av «målrettet markedsføring»-broen (audience graph): definer et segment
 * → resolver medlemmer (e-poster) → materialiser til en ad-audience → lagre
 * koblingen (grafkanten) i marketing_segment_audiences, så den kan refreshes og
 * attribueres per segment senere.
 *
 * MVP-kilde: `role_room_industry_targets` (Tier-1/ICP-CRM med e-post).
 * Kilden 'leadgrid_leads' (crm_customers) er reservert for fase 2 — de radene er
 * bedrifter fra kart/Brønnøysund UTEN e-postkolonne, så de kan ikke materialiseres
 * til Google Customer Match før en kontakt-/e-postkilde finnes. resolve returnerer
 * tom liste + note for den kilden i stedet for å feile stille.
 *
 * Tabellene self-heales lazily (Render har ingen preDeploy-migrasjon).
 */

import type { Pool } from "pg";
import { createGoogleCustomerMatchAudience } from "./client-google-customer-match.js";
import { createMetaCustomAudience } from "./client-meta-suite.js";
import { createLinkedinMatchedAudience } from "./client-linkedin-suite.js";

export type MarketingSegmentSource = "industry_targets" | "leadgrid_leads";

export interface MarketingSegmentFilters {
  tiers?: string[];
  segments?: string[];
  statuses?: string[];
}

export interface MarketingSegment {
  id: string;
  userId: string;
  name: string;
  source: MarketingSegmentSource;
  filters: MarketingSegmentFilters;
  createdAt: string;
  updatedAt: string;
}

const VALID_TIERS = new Set(["T1", "T2", "T3"]);
const VALID_STATUSES = new Set([
  "cold",
  "warm",
  "hot",
  "contacted",
  "replied",
  "meeting",
  "won",
  "lost",
]);

let tablesReady = false;
export async function ensureTables(pool: Pool): Promise<void> {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_segments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL,
      name        VARCHAR(120) NOT NULL,
      source      VARCHAR(32) NOT NULL DEFAULT 'industry_targets',
      filters     JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_marketing_segments_user ON marketing_segments (user_id);
    CREATE TABLE IF NOT EXISTS marketing_segment_audiences (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      segment_id            UUID NOT NULL REFERENCES marketing_segments(id) ON DELETE CASCADE,
      platform              VARCHAR(32) NOT NULL,
      external_audience_id  TEXT,
      member_count          INTEGER NOT NULL DEFAULT 0,
      status                VARCHAR(24) NOT NULL DEFAULT 'pending',
      last_error            TEXT,
      last_synced_at        TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (segment_id, platform)
    );
    CREATE INDEX IF NOT EXISTS idx_marketing_segment_audiences_segment
      ON marketing_segment_audiences (segment_id);
  `);
  tablesReady = true;
}

interface SegmentRow {
  id: string;
  user_id: string;
  name: string;
  source: string;
  filters: MarketingSegmentFilters | null;
  created_at: string;
  updated_at: string;
}

function rowToSegment(r: SegmentRow): MarketingSegment {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    source: r.source === "leadgrid_leads" ? "leadgrid_leads" : "industry_targets",
    filters: r.filters ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listSegments(pool: Pool, userId: string): Promise<MarketingSegment[]> {
  await ensureTables(pool);
  const r = await pool.query<SegmentRow>(
    `SELECT * FROM marketing_segments WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return r.rows.map(rowToSegment);
}

export async function getSegment(
  pool: Pool,
  userId: string,
  id: string,
): Promise<MarketingSegment | null> {
  await ensureTables(pool);
  const r = await pool.query<SegmentRow>(
    `SELECT * FROM marketing_segments WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return r.rows[0] ? rowToSegment(r.rows[0]) : null;
}

export async function createSegment(
  pool: Pool,
  userId: string,
  input: { name: string; source?: string; filters?: MarketingSegmentFilters },
): Promise<MarketingSegment> {
  await ensureTables(pool);
  const source = input.source === "leadgrid_leads" ? "leadgrid_leads" : "industry_targets";
  const r = await pool.query<SegmentRow>(
    `INSERT INTO marketing_segments (user_id, name, source, filters)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
    [userId, input.name.slice(0, 120), source, JSON.stringify(input.filters ?? {})],
  );
  return rowToSegment(r.rows[0]);
}

export async function deleteSegment(pool: Pool, userId: string, id: string): Promise<boolean> {
  await ensureTables(pool);
  const r = await pool.query(`DELETE FROM marketing_segments WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
  return (r.rowCount ?? 0) > 0;
}

export interface SegmentAudienceRow {
  platform: string;
  externalAudienceId: string | null;
  memberCount: number;
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
}

export async function listSegmentAudiences(
  pool: Pool,
  segmentId: string,
): Promise<SegmentAudienceRow[]> {
  await ensureTables(pool);
  const r = await pool.query(
    `SELECT platform, external_audience_id, member_count, status, last_error, last_synced_at
       FROM marketing_segment_audiences WHERE segment_id = $1`,
    [segmentId],
  );
  return r.rows.map((x) => ({
    platform: x.platform,
    externalAudienceId: x.external_audience_id,
    memberCount: x.member_count,
    status: x.status,
    lastError: x.last_error,
    lastSyncedAt: x.last_synced_at,
  }));
}

/** Resolver segment-medlemmer til unike, normaliserte e-poster. */
export async function resolveSegmentMembers(
  pool: Pool,
  segment: MarketingSegment,
): Promise<{ emails: string[]; total: number; note?: string }> {
  await ensureTables(pool);
  if (segment.source !== "industry_targets") {
    return {
      emails: [],
      total: 0,
      note: "Kilde 'leadgrid_leads' krever en e-postkilde (fase 2) — crm_customers har ingen e-postkolonne.",
    };
  }

  const where: string[] = ["user_id = $1", "email IS NOT NULL", "TRIM(email) <> ''"];
  const params: unknown[] = [segment.userId];
  const f = segment.filters ?? {};

  const tiers = (f.tiers ?? []).filter((t) => VALID_TIERS.has(t));
  if (tiers.length) {
    params.push(tiers);
    where.push(`tier = ANY($${params.length})`);
  }
  const segs = (f.segments ?? []).filter((s) => typeof s === "string" && /^[a-z_]{1,40}$/.test(s));
  if (segs.length) {
    params.push(segs);
    where.push(`segment = ANY($${params.length})`);
  }
  const statuses = (f.statuses ?? []).filter((s) => VALID_STATUSES.has(s));
  if (statuses.length) {
    params.push(statuses);
    where.push(`status = ANY($${params.length})`);
  }

  const r = await pool.query<{ email: string }>(
    `SELECT DISTINCT LOWER(TRIM(email)) AS email
       FROM role_room_industry_targets WHERE ${where.join(" AND ")}`,
    params,
  );
  const emails = r.rows.map((x) => x.email).filter((e): e is string => Boolean(e));
  return { emails, total: emails.length };
}

export interface MaterializeResult {
  ok: boolean;
  platform: string;
  memberCount: number;
  externalAudienceId?: string;
  error?: string;
  note?: string;
}

export type MaterializePlatform =
  | "google_customer_match"
  | "meta_custom_audience"
  | "linkedin_matched_audience";

/** Normalisert resultat fra en plattform-push (skjuler ulike felt-navn:
 *  userListResource / audienceId / segmentUrn). */
type PushResult =
  | { ok: true; externalId: string; uploadCount: number }
  | { ok: false; error: string };

/**
 * Delt materialiserings-kjerne: resolver medlemmer → pusher til plattformen →
 * lagrer grafkanten (marketing_segment_audiences). Idempotent per (segment,
 * plattform). Plattform-spesifikk push injiseres, så hashing/OAuth ligger i de
 * eksisterende client-*-suite-funksjonene.
 */
async function runMaterialize(
  pool: Pool,
  segment: MarketingSegment,
  platform: MaterializePlatform,
  push: (identifiers: Array<{ email: string }>) => Promise<PushResult>,
): Promise<MaterializeResult> {
  await ensureTables(pool);

  const record = async (
    status: string,
    memberCount: number,
    externalId: string | null,
    error: string | null,
  ): Promise<void> => {
    await pool.query(
      `INSERT INTO marketing_segment_audiences
         (segment_id, platform, external_audience_id, member_count, status, last_error, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'synced' THEN NOW() ELSE NULL END)
       ON CONFLICT (segment_id, platform) DO UPDATE SET
         external_audience_id = COALESCE(EXCLUDED.external_audience_id, marketing_segment_audiences.external_audience_id),
         member_count = EXCLUDED.member_count,
         status = EXCLUDED.status,
         last_error = EXCLUDED.last_error,
         last_synced_at = CASE WHEN EXCLUDED.status = 'synced' THEN NOW()
                               ELSE marketing_segment_audiences.last_synced_at END`,
      [segment.id, platform, externalId, memberCount, status, error],
    );
  };

  const { emails, note } = await resolveSegmentMembers(pool, segment);
  if (emails.length === 0) {
    await record("failed", 0, null, note ?? "Ingen e-poster i segmentet.");
    return { ok: false, platform, memberCount: 0, error: "no_members", note };
  }

  const result = await push(emails.map((e) => ({ email: e })));
  if (!result.ok) {
    await record("failed", emails.length, null, result.error);
    return { ok: false, platform, memberCount: emails.length, error: result.error };
  }

  await record("synced", result.uploadCount, result.externalId, null);
  return { ok: true, platform, memberCount: result.uploadCount, externalAudienceId: result.externalId };
}

const desc = (segment: MarketingSegment): string =>
  `Målrettet markedsføring — segment «${segment.name}»`;

/** Materialiser til Google Customer Match. */
export async function materializeToGoogleCustomerMatch(
  pool: Pool,
  args: { segment: MarketingSegment; customerId: string; producerUserId: string },
): Promise<MaterializeResult> {
  const { segment, customerId, producerUserId } = args;
  return runMaterialize(pool, segment, "google_customer_match", async (identifiers) => {
    const r = await createGoogleCustomerMatchAudience(pool, {
      producerUserId,
      customerId,
      name: `Segment: ${segment.name}`,
      sourceDescription: desc(segment),
      identifiers,
    });
    return r.ok
      ? { ok: true, externalId: r.userListResource, uploadCount: r.uploadCount }
      : { ok: false, error: r.error };
  });
}

/** Materialiser til Meta Custom Audience (adAccountId = act_XXXXXXXXX). */
export async function materializeToMetaCustomAudience(
  pool: Pool,
  args: { segment: MarketingSegment; adAccountId: string; producerUserId: string },
): Promise<MaterializeResult> {
  const { segment, adAccountId, producerUserId } = args;
  return runMaterialize(pool, segment, "meta_custom_audience", async (identifiers) => {
    const r = await createMetaCustomAudience(pool, {
      producerUserId,
      adAccountId,
      name: `Segment: ${segment.name}`,
      sourceDescription: desc(segment),
      identifiers,
    });
    return r.ok
      ? { ok: true, externalId: r.audienceId, uploadCount: r.uploadCount }
      : { ok: false, error: r.error };
  });
}

/** Materialiser til LinkedIn Matched Audience (adAccountUrn = urn:li:sponsoredAccount:X). */
export async function materializeToLinkedinMatchedAudience(
  pool: Pool,
  args: { segment: MarketingSegment; adAccountUrn: string; producerUserId: string },
): Promise<MaterializeResult> {
  const { segment, adAccountUrn, producerUserId } = args;
  return runMaterialize(pool, segment, "linkedin_matched_audience", async (identifiers) => {
    const r = await createLinkedinMatchedAudience(pool, {
      producerUserId,
      adAccountUrn,
      name: `Segment: ${segment.name}`,
      sourceDescription: desc(segment),
      identifiers,
    });
    return r.ok
      ? { ok: true, externalId: r.segmentUrn, uploadCount: r.uploadCount }
      : { ok: false, error: r.error };
  });
}
