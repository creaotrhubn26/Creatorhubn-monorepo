/**
 * client-portal-google-ads-oauth.ts
 *
 * KLIENT-portal Google Ads-tilkobling (scope: adwords). Lar klienten koble SIN
 * EGEN Google Ads-konto fra portalen, slik at produsenten kan kjøre annonser /
 * opprette konverterings-actions i klientens konto.
 *
 * Isolert fra:
 *   • role_room_ads_oauth_connections (produsentens egen MCC-OAuth, user_id-scopet)
 *   • role_room_google_connections (Workspace-lesere)
 * Lagres prosjekt-scopet i role_room_client_google_ads_connections (mig 0343).
 *
 * Gjenbruker OAuth-mekanikken fra role-room-ads-oauth.ts (samme OAuth-app /
 * client_id+secret), men med egen state (project_id + producer + returnPath) og
 * egen callback-rute. MERK: callback-URL-en under MÅ registreres som «Authorized
 * redirect URI» i Google Cloud-konsollen for Ads-OAuth-appen.
 */

import type express from "express";
import type { Pool } from "pg";

import {
  adsOauthClientCreds,
  buildAdsAuthUrl,
  exchangeAdsCodeForToken,
  refreshGoogleAdsAccessToken,
} from "./role-room-ads-oauth.js";
import { encryptInstagramToken, decryptInstagramToken } from "./role-room-instagram-oauth.js";
import { listAccessibleCustomers } from "./role-room-google-ads.js";
import { resolveClientPortalSession } from "./role-room-client-portal.js";
import { notifyProducerOfClientPlatformConnection } from "./role-room-producer-notifications.js";

const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const STATE_TTL_MS = 10 * 60 * 1000;

interface AdsOauthState {
  k: "cp_ads";
  projectId: string;
  producerUserId: string;
  clientEmail: string | null;
  returnPath: string;
  ts: number;
}

function encodeState(s: AdsOauthState): string {
  return Buffer.from(JSON.stringify(s)).toString("base64url");
}

function decodeState(raw: string): AdsOauthState | null {
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (obj && obj.k === "cp_ads" && typeof obj.projectId === "string") {
      return obj as AdsOauthState;
    }
  } catch {
    /* ugyldig state */
  }
  return null;
}

function resolveCallbackRedirectUri(req: express.Request): string {
  const envUri = process.env.ROLE_ROOM_GOOGLE_ADS_CLIENT_REDIRECT_URI;
  if (envUri) return envUri;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}/api/role-room/google-ads/oauth/callback`;
}

function portalOrigin(): string {
  return (
    process.env.ROLE_ROOM_CLIENT_PORTAL_ORIGIN ||
    process.env.ROLE_ROOM_PUBLIC_ORIGIN ||
    "https://theroleroom.com"
  ).replace(/\/$/, "");
}

async function upsertClientGoogleAdsConnection(
  pool: Pool,
  input: {
    projectId: string;
    producerUserId: string;
    email: string | null;
    adsCustomerId: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiryDate: Date | null;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO role_room_client_google_ads_connections (
       project_id, producer_user_id, google_email, ads_customer_id,
       access_token_encrypted, refresh_token_encrypted, expiry_date,
       scopes, connection_state, created_at, updated_at, last_used_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'connected', now(), now(), now())
     ON CONFLICT (project_id) DO UPDATE SET
       producer_user_id = EXCLUDED.producer_user_id,
       google_email = COALESCE(EXCLUDED.google_email, role_room_client_google_ads_connections.google_email),
       ads_customer_id = COALESCE(EXCLUDED.ads_customer_id, role_room_client_google_ads_connections.ads_customer_id),
       access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, role_room_client_google_ads_connections.access_token_encrypted),
       refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, role_room_client_google_ads_connections.refresh_token_encrypted),
       expiry_date = EXCLUDED.expiry_date,
       scopes = EXCLUDED.scopes,
       connection_state = 'connected',
       last_error = NULL,
       updated_at = now(),
       last_used_at = now()`,
    [
      input.projectId,
      input.producerUserId,
      input.email,
      input.adsCustomerId,
      encryptInstagramToken(input.accessToken),
      encryptInstagramToken(input.refreshToken),
      input.expiryDate ? input.expiryDate.toISOString() : null,
      JSON.stringify([ADS_SCOPE]),
    ],
  );
}

/**
 * Henter klientens Google Ads-customer-id via listAccessibleCustomers
 * (klientens egen access-token). Returnerer den FØRSTE tilgjengelige konto-id-en
 * (10 sifre, uten prefiks). Best-effort: null hvis ingen / feil.
 */
async function fetchClientAdsCustomerId(accessToken: string): Promise<string | null> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) return null;
  try {
    const ids = await listAccessibleCustomers({ accessToken, developerToken });
    return ids[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fersk klient-Ads-tilgang for et prosjekt: dekrypterer refresh-token, fornyer
 * access-token, og returnerer { accessToken, customerId } — klar til bruk mot
 * KLIENTENS egen konto (uten MCC/login-customer-id). Null hvis ikke koblet.
 *
 * Dette gjør at den portal-lagrede klient-tokenen FAKTISK kan brukes til ads-
 * operasjoner (conversion-actions), i stedet for å være foreldreløs.
 */
export async function getClientAdsAccess(
  pool: Pool,
  projectId: string,
): Promise<{ accessToken: string; customerId: string | null } | null> {
  const { rows } = await pool.query(
    `SELECT refresh_token_encrypted, ads_customer_id
       FROM role_room_client_google_ads_connections
      WHERE project_id = $1 AND connection_state = 'connected'
      LIMIT 1`,
    [projectId],
  );
  const row = rows[0];
  if (!row) return null;
  const refreshToken = decryptInstagramToken(row.refresh_token_encrypted);
  if (!refreshToken) return null;
  const creds = adsOauthClientCreds("google");
  if (!creds) return null;
  try {
    const refreshed = await refreshGoogleAdsAccessToken(refreshToken, creds.clientId, creds.clientSecret);
    if (!refreshed.accessToken) return null;
    return {
      accessToken: refreshed.accessToken,
      customerId: row.ads_customer_id ? String(row.ads_customer_id) : null,
    };
  } catch {
    return null;
  }
}

export function setupClientPortalGoogleAdsRoutes(deps: {
  app: express.Application;
  pool: Pool;
}): void {
  const { app, pool } = deps;

  // Klient starter Google Ads-tilkobling fra portalen (token-auth).
  app.post(
    "/api/role-room/client-portal/oauth/google-ads/start",
    async (req, res) => {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) {
        return res.status(400).json({ success: false, error: "missing_token" });
      }
      const session = await resolveClientPortalSession(pool, token);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "invalid_or_expired_token" });
      }
      const creds = adsOauthClientCreds("google");
      if (!creds) {
        return res
          .status(503)
          .json({ success: false, error: "google_ads_oauth_not_configured" });
      }
      const returnPath = `/client/portal/${encodeURIComponent(token)}?connected=google_ads`;
      const redirectUri = resolveCallbackRedirectUri(req);
      const state = encodeState({
        k: "cp_ads",
        projectId: session.projectId,
        producerUserId: session.invitedByUserId,
        clientEmail: session.clientEmail ?? null,
        returnPath,
        ts: Date.now(),
      });
      const authUrl = buildAdsAuthUrl("google", {
        clientId: creds.clientId,
        redirectUri,
        state,
      });
      if (!authUrl) {
        return res
          .status(500)
          .json({ success: false, error: "could_not_build_auth_url" });
      }
      return res.json({ success: true, mode: "link", authorizationUrl: authUrl });
    },
  );

  // Google Ads OAuth-callback for klientportalen.
  app.get("/api/role-room/google-ads/oauth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = decodeState(
      typeof req.query.state === "string" ? req.query.state : "",
    );
    if (!state) return res.redirect(`${portalOrigin()}/`);

    const successUrl = `${portalOrigin()}${state.returnPath}`;
    const errorUrl = successUrl.replace("connected=google_ads", "connect_error=google_ads");

    if (req.query.error || !code || Date.now() - state.ts > STATE_TTL_MS) {
      return res.redirect(errorUrl);
    }
    const creds = adsOauthClientCreds("google");
    if (!creds) return res.redirect(errorUrl);

    try {
      const tokens = await exchangeAdsCodeForToken("google", {
        code,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        redirectUri: resolveCallbackRedirectUri(req),
      });
      const expiry = tokens.expiresInSec
        ? new Date(Date.now() + tokens.expiresInSec * 1000)
        : null;
      // Fang klientens Google Ads customer-id med en gang — uten den vet
      // systemet ikke HVILKEN konto operasjonene skal gå mot. Best-effort.
      const adsCustomerId = await fetchClientAdsCustomerId(tokens.accessToken);
      await upsertClientGoogleAdsConnection(pool, {
        projectId: state.projectId,
        producerUserId: state.producerUserId,
        email: null,
        adsCustomerId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        expiryDate: expiry,
      });
      // Varsle produsent-teamet: tilgangen er nå aktiv og virker.
      void notifyProducerOfClientPlatformConnection(pool, {
        projectId: state.projectId,
        platformLabel: "Google Ads",
        platformKey: "google_ads",
        clientEmail: state.clientEmail,
      });
      return res.redirect(successUrl);
    } catch (err) {
      console.warn("[client-portal] Google Ads OAuth-callback feilet", err);
      return res.redirect(errorUrl);
    }
  });
}
