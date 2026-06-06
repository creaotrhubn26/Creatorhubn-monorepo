/**
 * role-room-ads-cron.ts
 *
 * Wires the spend→påslag-ryggraden together into something that actually runs:
 *   • buildAdsConnectorRegistry()    — Meta + Google (if env) + LinkedIn
 *   • buildPlatformTokenResolver()   — per-platform OAuth token lookup
 *   • runAdsAttributionSweepWithDefaults() — one call, fully wired
 *   • setupRoleRoomAdsCron()         — HTTP cron-tick + optional in-process loop
 *
 * Cron tick: POST /api/internal/ads/attribution-tick (x-cron-secret = ADS_CRON_SECRET).
 * Run it daily — it pulls each live campaign's spend, refreshes attribution,
 * records the 20 % påslag (finalized days only), and best-effort meters Stripe.
 *
 * Token availability per platform:
 *   • meta     — Instagram OAuth connection. Insights are ads_read; the
 *                ads_management write-paths still await Meta App Review.
 *   • google   — dedicated ads OAuth connection (scope adwords) via
 *                role_room_ads_oauth_connections. Connect at /ads/google/oauth/start.
 *   • linkedin — dedicated ads OAuth connection (r_ads/r_ads_reporting).
 *                Connect at /ads/linkedin/oauth/start.
 * If no connection exists for a user/platform the resolver returns null and the
 * sweep skips those campaigns with a logged reason.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  runAdsAttributionSweep,
  DEFAULT_CONNECTORS,
  type PlatformConnector,
  type MeterEmitter,
  type SweepSummary,
} from "./role-room-ads-sync.js";
import {
  getGoogleAdsConnectorFromEnv,
  setGoogleCampaignStatus,
} from "./role-room-google-ads.js";
import {
  getLinkedInAdsConnectorFromEnv,
  setLinkedInCampaignStatus,
} from "./role-room-linkedin-ads.js";
import { pauseCampaign as pauseMetaCampaign } from "./role-room-meta-ads.js";
import {
  listInstagramConnections,
  ensureFreshConnection,
} from "./role-room-instagram-oauth.js";
import { resolveAdsAccessToken } from "./role-room-ads-oauth.js";
import { runMccLinkStatusSweep } from "./role-room-mcc-link-detector.js";
import { buildRoleRoomAdsMeterEmitter } from "./role-room-ads-meter-emitter.js";
import type { AdsPlatform } from "./role-room-ads-shared.js";
import {
  runAdsAutoPauseSweep,
  type AutoPauseSweepSummary,
  type PausePlatformDispatchers,
} from "./role-room-ads-auto-pause.js";
import {
  getChannelResultRows,
  listActiveCampaignsForProject,
  listProjectsWithAdActivity,
  sumSpendForProjectPeriod,
  upsertAdRecommendations,
} from "./role-room-ads-db.js";
import { buildChannelResults } from "./role-room-ads-shared.js";
import {
  computeBudgetPacing,
  computeBudgetStatus,
  getBudget,
} from "./role-room-ads-budget.js";
import { fetchActiveMarketingPlan } from "./role-room-marketing-plan.js";
import {
  generateAdRecommendations,
  type RecommendationChannelMetrics,
  type RecommendationBudgetSnapshot,
  type RecommendationContext,
} from "./role-room-ads-recommendations.js";

/** Build the connector registry from the modules + env configuration. */
export function buildAdsConnectorRegistry(): Partial<Record<AdsPlatform, PlatformConnector>> {
  const registry: Partial<Record<AdsPlatform, PlatformConnector>> = { ...DEFAULT_CONNECTORS };
  const google = getGoogleAdsConnectorFromEnv();
  if (google) registry.google = google;
  registry.linkedin = getLinkedInAdsConnectorFromEnv();
  return registry;
}

/**
 * Resolve a user's access token for a platform. Meta uses the existing Instagram
 * OAuth connection; Google/LinkedIn return null until their OAuth connections
 * are built (the sweep then skips those campaigns gracefully).
 */
export function buildPlatformTokenResolver(
  pool: Pool,
): (platform: AdsPlatform, userId: string) => Promise<string | null> {
  return async (platform, userId) => {
    if (platform === "meta") {
      const connections = await listInstagramConnections(pool, userId);
      if (!connections.length) return null;
      const fresh = await ensureFreshConnection(pool, connections[0]);
      return fresh.accessToken || null;
    }
    // Google Ads + LinkedIn Ads: dedicated ads-scoped OAuth connection.
    return resolveAdsAccessToken(pool, platform, userId);
  };
}

/** Run the cross-platform attribution sweep with the default wiring. */
export async function runAdsAttributionSweepWithDefaults(
  pool: Pool,
  opts?: { meterEmitter?: MeterEmitter | null; sinceISO?: string; untilISO?: string },
): Promise<SweepSummary> {
  // Default: forsøk å bygge en ekte Stripe-meter-emitter (env-gated). Hvis
  // ROLE_ROOM_STRIPE_METER_ADS_FEE_ENABLED ikke er "true" eller Stripe-
  // nøkkelen mangler, returnerer builderen `null` og oppførselen er
  // identisk med før (ledger-skriv uten Stripe-push).
  const meterEmitter =
    opts?.meterEmitter !== undefined
      ? opts.meterEmitter
      : buildRoleRoomAdsMeterEmitter(pool);
  return runAdsAttributionSweep(pool, {
    connectors: buildAdsConnectorRegistry(),
    resolveToken: buildPlatformTokenResolver(pool),
    meterEmitter,
    sinceISO: opts?.sinceISO,
    untilISO: opts?.untilISO,
  });
}

/**
 * Real platform-pause dispatchers (Lag 3b). The cron uses these; tests inject
 * fakes. PAUSED is the shared status verb across Meta / Google / LinkedIn.
 */
export function buildPausePlatformDispatchers(): PausePlatformDispatchers {
  return {
    meta: async (accessToken, externalCampaignId) => {
      await pauseMetaCampaign(accessToken, externalCampaignId);
    },
    google: async (accessToken, developerToken, customerId, campaignResourceName) => {
      await setGoogleCampaignStatus(
        { accessToken, developerToken, customerId },
        campaignResourceName,
        "PAUSED",
      );
    },
    linkedin: async (accessToken, campaignUrn, apiVersion) => {
      await setLinkedInCampaignStatus({ accessToken, apiVersion }, campaignUrn, "PAUSED");
    },
  };
}

/**
 * Lag 2: AI-anbefalinger pr prosjekt for inneværende periode.
 * Itererer prosjekter med kampanjer; bygger en RecommendationContext fra
 * channel-tall + budsjett-pacing + marketing-plan-strategi; lar Claude
 * foreslå konkrete handlinger; persist-erer pr (prosjekt, periode) — neste
 * dag overskriver. Returnerer ingen action; alt er informasjon for mennesker.
 */
export interface AdRecommendationsSweepSummary {
  period: string;
  scanned: number;
  generated: number;
  errors: number;
}

/** Generer + persist anbefalinger for ETT prosjekt. Returnerer null hvis
 *  Claude/LLM ikke svarer; ellers antallet anbefalinger + modellen brukt.
 *  Brukes både av cron-sweepen og av den manuelle POST-ruten. */
export async function runAdsRecommendationsForProject(
  pool: Pool,
  projectId: string,
  period: string,
): Promise<{ recommendations: number; generatedWithModel: string } | null> {
  // Channel-tall fra ads_attribution_daily JOIN ads_campaigns, samme som
  // GET /ads/results/summary leser.
  const rows = await getChannelResultRows(pool, projectId, period);
  const summary = buildChannelResults(rows);
  const channels: RecommendationChannelMetrics[] = [
    ...summary.perChannel,
    { ...summary.totals }, // platform: 'total'
  ];

  // Budsjett-snapshot — alltid med, selv om hasBudget=false (Claude trenger
  // å vite at det ikke er satt et tak).
  const b = await getBudget(pool, projectId, period);
  const actualSpendNok = await sumSpendForProjectPeriod(pool, projectId, period);
  const status = computeBudgetStatus({
    hasBudget: !!b,
    maxSpendNok: b?.maxSpendNok ?? 0,
    approvedOverageNok: b?.approvedOverageNok ?? 0,
    actualSpendNok,
  });
  const pacing = computeBudgetPacing({ status, period });
  const budget: RecommendationBudgetSnapshot = {
    hasBudget: status.hasBudget,
    maxSpendNok: status.maxSpendNok,
    actualSpendNok: status.actualSpendNok,
    utilizationPct: status.utilizationPct,
    daysInPeriod: pacing.daysInPeriod,
    daysElapsed: pacing.daysElapsed,
    daysRemaining: pacing.daysRemaining,
    dailyRunRateNok: pacing.dailyRunRateNok,
    projectedPeriodSpendNok: pacing.projectedPeriodSpendNok,
    projectedOverspendNok: pacing.projectedOverspendNok,
    recommendedDailyBudgetNok: pacing.recommendedDailyBudgetNok,
    projectedExhaustionDate: pacing.projectedExhaustionDate,
    pace: pacing.pace,
  };

  // Marketing-plan-kontekst gir Claude forretningsforståelse (verdiløfte +
  // tone), ikke bare tall.
  const plan = await fetchActiveMarketingPlan(pool, projectId).catch(() => null);

  const ctx: RecommendationContext = {
    period,
    channels,
    budget,
    valueProp: plan?.strategy?.positioning?.valueProp ?? null,
    differentiator: plan?.strategy?.positioning?.differentiator ?? null,
    toneVoice: plan?.strategy?.toneOfVoice?.voice ?? null,
    language: "no",
  };

  const result = await generateAdRecommendations({ context: ctx });
  if (!result) return null;

  await upsertAdRecommendations(pool, {
    projectId,
    period,
    generatedWithModel: result.generatedWithModel,
    recommendations: { recommendations: result.recommendations, overallNote: result.overallNote },
  });
  return { recommendations: result.recommendations.length, generatedWithModel: result.generatedWithModel };
}

export async function runAdsRecommendationsSweepWithDefaults(
  pool: Pool,
  period?: string,
): Promise<AdRecommendationsSweepSummary> {
  const periodKey = period || new Date().toISOString().slice(0, 7);
  const projectIds = await listProjectsWithAdActivity(pool);
  let generated = 0;
  let errors = 0;

  for (const projectId of projectIds) {
    try {
      const out = await runAdsRecommendationsForProject(pool, projectId, periodKey);
      if (out) generated += 1;
      else errors += 1;
    } catch (error) {
      console.error(`[ads-recommendations] project ${projectId} failed`, error);
      errors += 1;
    }
  }

  return { period: periodKey, scanned: projectIds.length, generated, errors };
}

/** Run auto-pause sweep with the cron's wiring. */
export async function runAdsAutoPauseSweepWithDefaults(
  pool: Pool,
  period?: string,
): Promise<AutoPauseSweepSummary> {
  const periodKey = period || new Date().toISOString().slice(0, 7);
  return runAdsAutoPauseSweep(
    pool,
    {
      resolveToken: buildPlatformTokenResolver(pool),
      listActiveCampaignsForProject,
      dispatchers: buildPausePlatformDispatchers(),
      googleDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null,
      linkedinApiVersion: process.env.LINKEDIN_API_VERSION || undefined,
    },
    periodKey,
  );
}

export interface RoleRoomAdsCronDeps {
  app: express.Application;
  pool: Pool;
}

/** Register the HTTP cron-tick endpoint (+ optional in-process loop). */
export function setupRoleRoomAdsCron(deps: RoleRoomAdsCronDeps): void {
  const { app, pool } = deps;

  app.post("/api/internal/ads/attribution-tick", async (req, res) => {
    const provided = req.headers["x-cron-secret"];
    const secret = process.env.ADS_CRON_SECRET;
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "unauthorized" });
    }
    try {
      const summary = await runAdsAttributionSweepWithDefaults(pool);
      // Lag 3b: når spend er ferskt, sjekk auto-pause-prosjekter. Off by default
      // — krever klient-toggle på role_room_ads_budgets.auto_pause_on_cap.
      // Auto-pause-feil må aldri felle attribution-tick; den eier billing-data.
      let autoPause: AutoPauseSweepSummary | null = null;
      try {
        autoPause = await runAdsAutoPauseSweepWithDefaults(pool);
      } catch (error) {
        console.error("[ads-auto-pause] sweep failed (non-fatal)", error);
      }
      // Lag 2: generer AI-anbefalinger pr prosjekt etter at spend + auto-pause er ferdig.
      // Feilfritt non-fatal — manglende anbefalinger må aldri felle billing-/auto-pause-data.
      let recommendations: AdRecommendationsSweepSummary | null = null;
      try {
        recommendations = await runAdsRecommendationsSweepWithDefaults(pool);
      } catch (error) {
        console.error("[ads-recommendations] sweep failed (non-fatal)", error);
      }
      // MCC-link-detector: poll Google Ads MCC for status-endring (PENDING→ACTIVE
      // / REFUSED / etc.) per produsent. Fyrer producer-notifikasjon ved endring.
      // Trenger samme periode-disiplin: non-fatal, må aldri felle de andre.
      let mccLinks: Awaited<ReturnType<typeof runMccLinkStatusSweep>> | null = null;
      try {
        mccLinks = await runMccLinkStatusSweep(pool);
      } catch (error) {
        console.error("[mcc-link-detector] sweep failed (non-fatal)", error);
      }
      res.json({ ok: true, summary, autoPause, recommendations, mccLinks });
    } catch (error) {
      res.status(500).json({ error: "ads_attribution_tick_failed", detail: String(error) });
    }
  });

  // Optional in-process loop for non-serverless deploys (off unless configured).
  const intervalMinutes = Number(process.env.ADS_SWEEP_INTERVAL_MINUTES || 0);
  if (intervalMinutes > 0) {
    setInterval(
      () => {
        void runAdsAttributionSweepWithDefaults(pool)
          .then(() => runAdsAutoPauseSweepWithDefaults(pool).catch((e) =>
            console.error("[ads-auto-pause] interval run failed (non-fatal)", e),
          ))
          .then(() => runAdsRecommendationsSweepWithDefaults(pool).catch((e) =>
            console.error("[ads-recommendations] interval run failed (non-fatal)", e),
          ))
          .then(() => runMccLinkStatusSweep(pool).catch((e) =>
            console.error("[mcc-link-detector] interval run failed (non-fatal)", e),
          ))
          .catch((e) => console.error("[ads-sweep] interval run failed", e));
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
