/**
 * google-verification-marketing-routes.ts
 *
 * Demo-endepunkter for Google OAuth-verifisering — markedsførings-scopene.
 * GoogleVerificationDemoPage kaller disse for å DEMONSTRERE (via live lese-kall
 * mot den tilkoblede kontoen) at appen faktisk bruker adwords / analytics.edit /
 * webmasters / tagmanager. Read-only — bevis på scope-bruk for video/reviewer.
 *
 * Token-kilde: ENTEN produsentens Ads-OAuth (role_room_ads_oauth_connections)
 * ELLER — fallback — klientens portal-Ads-tilkobling
 * (role_room_client_google_ads_connections, by producer_user_id). Begge grantet
 * adwords + analytics.edit + webmasters + tagmanager, så samme token dekker alle
 * 4 handlingene. Fallback-en gjør at demoen virker selv om man koblet Google Ads
 * via klientportalen (egen tabell) i stedet for produsent-Ads-flyten.
 *
 * GET /api/google-verification/marketing/:action?userId=...
 *   action = ads-customers | ga4-accounts | gsc-sites | gtm-accounts
 */
import type express from "express";
import type { Pool } from "pg";

import {
  getAdsOauthConnection,
  ensureFreshAdsToken,
  adsOauthClientCreds,
  refreshGoogleAdsAccessToken,
} from "./role-room-ads-oauth.js";
import { decryptInstagramToken } from "./role-room-instagram-oauth.js";

const GA4_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const GTM_BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

/** Fersk Google-access-token for markedsførings-scopene (produsent ELLER klient-portal). */
async function resolveMarketingAccessToken(pool: Pool, userId: string): Promise<string | null> {
  // 1) Produsentens egen Ads-OAuth.
  const conn = await getAdsOauthConnection(pool, userId, "google");
  if (conn) {
    const t = await ensureFreshAdsToken(pool, conn);
    if (t.connectionState === "connected" && t.accessToken) return t.accessToken;
  }
  // 2) Fallback: klient-portal-Ads-tilkobling som SAMME bruker har som produsent.
  try {
    const { rows } = await pool.query(
      `SELECT refresh_token_encrypted
         FROM role_room_client_google_ads_connections
        WHERE producer_user_id = $1 AND connection_state = 'connected'
        ORDER BY updated_at DESC LIMIT 1`,
      [userId],
    );
    const enc = rows[0]?.refresh_token_encrypted as string | null | undefined;
    if (enc) {
      const refresh = decryptInstagramToken(enc);
      const creds = adsOauthClientCreds("google");
      if (refresh && creds) {
        const refreshed = await refreshGoogleAdsAccessToken(refresh, creds.clientId, creds.clientSecret);
        if (refreshed.accessToken) return refreshed.accessToken;
      }
    }
  } catch {
    /* best-effort */
  }
  return null;
}

async function googleGet(
  url: string,
  accessToken: string,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export function setupGoogleVerificationMarketingRoutes(deps: {
  app: express.Application;
  pool: Pool;
}): void {
  const { app, pool } = deps;

  app.get("/api/google-verification/marketing/:action", async (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userId) return res.status(400).json({ ok: false, error: "userId_required" });
    const action = req.params.action;

    const accessToken = await resolveMarketingAccessToken(pool, userId);
    if (!accessToken) return res.status(409).json({ ok: false, error: "google_ads_not_connected" });

    try {
      if (action === "ads-customers") {
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() ?? "";
        if (!developerToken) return res.status(503).json({ ok: false, error: "missing_developer_token" });
        // v18 er solnedgang-et (juni 2026) → 404 på den faste versjonen i
        // listAccessibleCustomers. Prøv flere versjoner inline og bruk den som
        // svarer; returner Googles faktiske feiltekst hvis ALLE feiler.
        const versions = ["v21", "v20", "v19", "v18"];
        let lastStatus = 0;
        let lastDetail = "";
        for (const v of versions) {
          const r = await fetch(
            `https://googleads.googleapis.com/${v}/customers:listAccessibleCustomers`,
            { headers: { Authorization: `Bearer ${accessToken}`, "developer-token": developerToken } },
          );
          if (r.ok) {
            const body = (await r.json().catch(() => ({}))) as { resourceNames?: string[] };
            const ids = (body.resourceNames ?? []).map((n) => n.replace("customers/", ""));
            return res.json({ ok: true, scope: "adwords", apiVersion: v, count: ids.length, items: ids });
          }
          lastStatus = r.status;
          lastDetail = (await r.text().catch(() => "")).slice(0, 400);
          // 404 = feil versjon → prøv neste. Andre feil (401/403) = token/dev-token,
          // ingen vits i å prøve flere versjoner.
          if (r.status !== 404) break;
        }
        return res
          .status(502)
          .json({ ok: false, error: `adwords_http_${lastStatus}`, detail: lastDetail });
      }

      if (action === "ga4-accounts") {
        const r = await googleGet(`${GA4_BASE}/accountSummaries`, accessToken);
        if (!r.ok) return res.status(502).json({ ok: false, error: `ga4_http_${r.status}` });
        const summaries = Array.isArray(r.body.accountSummaries)
          ? (r.body.accountSummaries as Array<Record<string, unknown>>)
          : [];
        const items = summaries.map((a) => ({ name: a.account, displayName: a.displayName }));
        return res.json({ ok: true, scope: "analytics.edit", count: items.length, items });
      }

      if (action === "gsc-sites") {
        const r = await googleGet(`${GSC_BASE}/sites`, accessToken);
        if (!r.ok) return res.status(502).json({ ok: false, error: `gsc_http_${r.status}` });
        const sites = Array.isArray(r.body.siteEntry)
          ? (r.body.siteEntry as Array<Record<string, unknown>>)
          : [];
        const items = sites.map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
        return res.json({ ok: true, scope: "webmasters", count: items.length, items });
      }

      if (action === "gtm-accounts") {
        const r = await googleGet(`${GTM_BASE}/accounts`, accessToken);
        if (!r.ok) return res.status(502).json({ ok: false, error: `gtm_http_${r.status}` });
        const accounts = Array.isArray(r.body.account)
          ? (r.body.account as Array<Record<string, unknown>>)
          : [];
        const items = accounts.map((a) => ({ accountId: a.accountId, name: a.name }));
        return res.json({ ok: true, scope: "tagmanager", count: items.length, items });
      }

      return res.status(400).json({ ok: false, error: "unknown_action" });
    } catch (err) {
      return res
        .status(502)
        .json({ ok: false, error: err instanceof Error ? err.message : "google_api_error" });
    }
  });
}
