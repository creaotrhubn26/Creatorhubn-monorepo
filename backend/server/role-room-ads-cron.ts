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
import type { AdsPlatform } from "./role-room-ads-shared.js";
import {
  runAdsAutoPauseSweep,
  type AutoPauseSweepSummary,
  type PausePlatformDispatchers,
} from "./role-room-ads-auto-pause.js";
import { listActiveCampaignsForProject } from "./role-room-ads-db.js";

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
  return runAdsAttributionSweep(pool, {
    connectors: buildAdsConnectorRegistry(),
    resolveToken: buildPlatformTokenResolver(pool),
    meterEmitter: opts?.meterEmitter ?? null,
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
      res.json({ ok: true, summary, autoPause });
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
          .catch((e) => console.error("[ads-sweep] interval run failed", e));
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
