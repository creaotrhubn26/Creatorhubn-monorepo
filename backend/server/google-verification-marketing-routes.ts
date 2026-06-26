/**
 * google-verification-marketing-routes.ts
 *
 * Demo-endepunkter for Google OAuth-verifisering — markedsførings-scopene.
 * GoogleVerificationDemoPage kaller disse for å DEMONSTRERE (via live lese-kall
 * mot den tilkoblede kontoen) at appen faktisk bruker adwords / analytics.edit /
 * webmasters / tagmanager. Read-only — bevis på scope-bruk for video/reviewer.
 *
 * GET /api/google-verification/marketing/:action?userId=...
 *   action = ads-customers | ga4-accounts | gsc-sites | gtm-accounts
 */
import type express from "express";
import type { Pool } from "pg";

import { listGa4Accounts, listGtmAccounts, listGscSites } from "./client-google-suite.js";
import { getAdsOauthConnection, ensureFreshAdsToken } from "./role-room-ads-oauth.js";
import { listAccessibleCustomers } from "./role-room-google-ads.js";

export function setupGoogleVerificationMarketingRoutes(deps: {
  app: express.Application;
  pool: Pool;
}): void {
  const { app, pool } = deps;

  app.get("/api/google-verification/marketing/:action", async (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userId) return res.status(400).json({ ok: false, error: "userId_required" });
    const action = req.params.action;

    try {
      if (action === "ads-customers") {
        // adwords: leser klientens/den tilkoblede kontoens Google Ads-konti.
        const conn = await getAdsOauthConnection(pool, userId, "google");
        if (!conn) return res.status(409).json({ ok: false, error: "ads_not_connected" });
        const tok = await ensureFreshAdsToken(pool, conn);
        if (tok.connectionState !== "connected") {
          return res.status(409).json({ ok: false, error: "ads_not_connected" });
        }
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() ?? "";
        if (!developerToken) return res.status(503).json({ ok: false, error: "missing_developer_token" });
        const ids = await listAccessibleCustomers({ accessToken: tok.accessToken, developerToken });
        return res.json({ ok: true, scope: "adwords", count: ids.length, items: ids });
      }

      if (action === "ga4-accounts") {
        const r = await listGa4Accounts(pool, userId);
        if (!r.ok) return res.status(409).json({ ok: false, error: r.error });
        return res.json({ ok: true, scope: "analytics.edit", count: r.accounts.length, items: r.accounts });
      }

      if (action === "gsc-sites") {
        const r = await listGscSites(pool, userId);
        if (!r.ok) return res.status(409).json({ ok: false, error: r.error });
        return res.json({ ok: true, scope: "webmasters", count: r.sites.length, items: r.sites });
      }

      if (action === "gtm-accounts") {
        const r = await listGtmAccounts(pool, userId);
        if (!r.ok) return res.status(409).json({ ok: false, error: r.error });
        return res.json({ ok: true, scope: "tagmanager", count: r.accounts.length, items: r.accounts });
      }

      return res.status(400).json({ ok: false, error: "unknown_action" });
    } catch (err) {
      return res
        .status(502)
        .json({ ok: false, error: err instanceof Error ? err.message : "google_api_error" });
    }
  });
}
