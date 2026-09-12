/**
 * owned-channels-signal-sync.ts
 *
 * Integrasjonsplanen steg 3 i drift (docs/integration-audit/06): henter
 * GSC- og GA4-data for tilkoblede kontoer (client_ads_configs + Google-
 * OAuth-tilkoblingen) og skriver dem til normalized_signals via de
 * testede normaliserer-funksjonene. Kjøres daglig via cron-endepunkt
 * (CRON_TRIGGER_TOKEN) eller on-demand.
 *
 * Dette er BRUKERENS EGNE data (subjectType own_property, sourceType
 * official_api, isEstimated=false) — i motsetning til GEO-probens
 * syntetiske signaler.
 *
 * AI-trafikk: GA4-referrals fra AI-assistenter (chatgpt.com,
 * perplexity.ai, copilot, gemini, claude.ai) normaliseres som
 * metricType 'ai_referral_sessions' — det ekte, gratis GEO-beviset.
 */

import type { Pool } from "pg";
import { externalFetch } from "../external-api.js";
import { getAdsOauthConnection, ensureFreshAdsToken } from "../role-room-ads-oauth.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";
import { insertNormalizedSignals } from "./normalized-signal-store.js";
import {
  normalizeGscSearchAnalytics,
  type GscSearchAnalyticsRow,
} from "./gsc-signal-normalizer.js";
import {
  normalizeGa4RunReport,
  type Ga4RunReportResponse,
} from "./ga4-signal-normalizer.js";
import type { NormalizedSignal } from "./normalized-signal-schema.js";

const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const GA4_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

/** AI-assistent-kilder vi sporer referral-trafikk fra (GA4 sessionSource). */
export const AI_REFERRAL_SOURCES = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "www.perplexity.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
  "claude.ai",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function accessToken(pool: Pool, producerUserId: string): Promise<string | null> {
  const conn = await getAdsOauthConnection(pool, producerUserId, "google");
  if (!conn) return null;
  const t = await ensureFreshAdsToken(pool, conn);
  return t.connectionState === "connected" ? t.accessToken : null;
}

function dateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/**
 * Merk om GA4-sessions-signaler til AI-referral-signaler (ren funksjon —
 * enhetstestet). Beholder deterministiske id-er ved å bytte metricType-
 * komponenten i id/sourceRecordId.
 */
export function toAiReferralSignals(signals: NormalizedSignal[]): NormalizedSignal[] {
  return signals
    .filter((s) => s.metricType === "sessions")
    .map((s) => ({
      ...s,
      metricType: "ai_referral_sessions",
      id: s.id.replace("|sessions|", "|ai_referral_sessions|"),
      sourceRecordId: s.sourceRecordId?.replace("|sessions", "|ai_referral_sessions"),
      // topic = 'sessionSource=chatgpt.com' fra normalisereren → forenkle
      topic: s.topic.replace(/^sessionSource=/, ""),
    }));
}

export interface ConfigSyncResult {
  configId: string;
  clientName: string;
  gscSignals: number;
  ga4Signals: number;
  aiReferralSignals: number;
  skippedReason?: string;
}

export interface SyncResult {
  producerUserId: string;
  organizationId: string | null;
  configs: ConfigSyncResult[];
  inserted: number;
  skippedDuplicates: number;
  skippedReason?: string;
}

interface AdsConfigRow {
  id: string;
  client_name: string;
  ga4_property_id: string | null;
  gsc_property_url: string | null;
}

export async function syncOwnedChannelSignals(
  pool: Pool,
  args: { producerUserId: string; days?: number },
): Promise<SyncResult> {
  const days = Math.min(Math.max(args.days ?? 28, 7), 90);
  const { start, end } = dateRange(days);
  const collectedAt = new Date().toISOString();
  const periodStart = `${start}T00:00:00.000Z`;
  const periodEnd = `${end}T23:59:59.999Z`;

  const base: SyncResult = {
    producerUserId: args.producerUserId,
    organizationId: null,
    configs: [],
    inserted: 0,
    skippedDuplicates: 0,
  };

  // Org-scoping er obligatorisk i normalized_signals (FK) — uten ekte
  // org-UUID rapporteres det ærlig i stedet for å skrives skjevt.
  const orgId = await resolveOrgIdForUser(pool, args.producerUserId);
  if (!UUID_PATTERN.test(orgId)) {
    return { ...base, skippedReason: "ingen organization_id (solo-bruker) — signal-lagring krever org" };
  }
  base.organizationId = orgId;

  const token = await accessToken(pool, args.producerUserId);
  if (!token) {
    return { ...base, skippedReason: "ingen tilkoblet Google-OAuth-konto" };
  }

  const configs = await pool.query<AdsConfigRow>(
    `SELECT id::text, client_name, ga4_property_id, gsc_property_url
       FROM client_ads_configs
      WHERE content_producer_user_id = $1
        AND (ga4_property_id IS NOT NULL OR gsc_property_url IS NOT NULL)`,
    [args.producerUserId],
  );

  const allSignals: NormalizedSignal[] = [];
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  for (const cfg of configs.rows) {
    const result: ConfigSyncResult = {
      configId: cfg.id,
      clientName: cfg.client_name,
      gscSignals: 0,
      ga4Signals: 0,
      aiReferralSignals: 0,
    };

    const ctxBase = {
      organizationId: orgId,
      workspaceId: args.producerUserId,
      periodStart,
      periodEnd,
      collectedAt,
    };

    // ── GSC: daglige totaler + topp-queries ──────────────────────────
    if (cfg.gsc_property_url) {
      try {
        for (const dimension of ["date", "query"] as const) {
          const r = await externalFetch(
            `${GSC_BASE}/sites/${encodeURIComponent(cfg.gsc_property_url)}/searchAnalytics/query`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({
                startDate: start,
                endDate: end,
                dimensions: [dimension],
                rowLimit: dimension === "date" ? 100 : 50,
              }),
            },
          );
          if (!r.ok) continue;
          const body = (await r.json()) as { rows?: GscSearchAnalyticsRow[] };
          const signals = normalizeGscSearchAnalytics(body.rows ?? [], {
            ...ctxBase,
            siteUrl: cfg.gsc_property_url,
            dimension,
          });
          result.gscSignals += signals.length;
          allSignals.push(...signals);
        }
      } catch (err) {
        console.warn(`[owned-sync] GSC feilet for ${cfg.client_name}:`, String(err).slice(0, 150));
      }
    }

    // ── GA4: totaler + AI-referrals ──────────────────────────────────
    if (cfg.ga4_property_id) {
      const propertyId = `properties/${cfg.ga4_property_id}`;
      try {
        // Totaler for perioden
        const totalsR = await externalFetch(`${GA4_DATA_BASE}/${propertyId}:runReport`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            dateRanges: [{ startDate: start, endDate: end }],
            metrics: [
              { name: "sessions" },
              { name: "totalUsers" },
              { name: "conversions" },
            ],
          }),
        });
        if (totalsR.ok) {
          const report = (await totalsR.json()) as Ga4RunReportResponse;
          const { signals, skippedMetrics } = normalizeGa4RunReport(report, {
            ...ctxBase,
            propertyId,
          });
          if (skippedMetrics.length > 0) {
            console.warn(`[owned-sync] GA4-metrikker uten mapping hoppet over: ${skippedMetrics.join(", ")}`);
          }
          result.ga4Signals += signals.length;
          allSignals.push(...signals);
        }

        // AI-referrals per kilde
        const aiR = await externalFetch(`${GA4_DATA_BASE}/${propertyId}:runReport`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            dateRanges: [{ startDate: start, endDate: end }],
            dimensions: [{ name: "sessionSource" }],
            metrics: [{ name: "sessions" }],
            dimensionFilter: {
              filter: {
                fieldName: "sessionSource",
                inListFilter: { values: [...AI_REFERRAL_SOURCES] },
              },
            },
          }),
        });
        if (aiR.ok) {
          const report = (await aiR.json()) as Ga4RunReportResponse;
          const { signals } = normalizeGa4RunReport(report, { ...ctxBase, propertyId });
          const aiSignals = toAiReferralSignals(signals);
          result.aiReferralSignals += aiSignals.length;
          allSignals.push(...aiSignals);
        }
      } catch (err) {
        console.warn(`[owned-sync] GA4 feilet for ${cfg.client_name}:`, String(err).slice(0, 150));
      }
    }

    base.configs.push(result);
  }

  if (allSignals.length > 0) {
    const insertResult = await insertNormalizedSignals(pool, allSignals);
    base.inserted = insertResult.inserted;
    base.skippedDuplicates = insertResult.skippedDuplicates;
  }

  return base;
}

/** Alle produsenter med tilkoblet Google-OAuth og minst én synkbar config. */
export async function listSyncableProducers(pool: Pool, limit = 50): Promise<string[]> {
  const r = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT c.content_producer_user_id AS user_id
       FROM client_ads_configs c
       JOIN role_room_ads_oauth_connections o
         ON o.user_id = c.content_producer_user_id
        AND o.platform = 'google'
        AND o.connection_state = 'connected'
      WHERE c.ga4_property_id IS NOT NULL OR c.gsc_property_url IS NOT NULL
      LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => row.user_id);
}
