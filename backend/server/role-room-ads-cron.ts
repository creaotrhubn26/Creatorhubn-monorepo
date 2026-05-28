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
import { getGoogleAdsConnectorFromEnv } from "./role-room-google-ads.js";
import { getLinkedInAdsConnectorFromEnv } from "./role-room-linkedin-ads.js";
import {
  listInstagramConnections,
  ensureFreshConnection,
} from "./role-room-instagram-oauth.js";
import { resolveAdsAccessToken } from "./role-room-ads-oauth.js";
import { buildRoleRoomAdsMeterEmitter } from "./role-room-ads-meter-emitter.js";
import type { AdsPlatform } from "./role-room-ads-shared.js";

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
      res.json({ ok: true, summary });
    } catch (error) {
      res.status(500).json({ error: "ads_attribution_tick_failed", detail: String(error) });
    }
  });

  // Optional in-process loop for non-serverless deploys (off unless configured).
  const intervalMinutes = Number(process.env.ADS_SWEEP_INTERVAL_MINUTES || 0);
  if (intervalMinutes > 0) {
    setInterval(
      () => {
        void runAdsAttributionSweepWithDefaults(pool).catch((e) =>
          console.error("[ads-sweep] interval run failed", e),
        );
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
