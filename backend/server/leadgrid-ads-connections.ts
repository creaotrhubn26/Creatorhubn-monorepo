/**
 * leadgrid-ads-connections.ts
 *
 * Bindingen mellom et Leadgrid-prosjekt og en annonsekonto.
 *
 * Alt som trengs for å STYRE annonseflatene finnes allerede:
 *   client-google-suite.ts   GTM-containere, tagger og triggere, GA4-
 *                            properties, Search Console-verifisering
 *   client-meta-suite.ts     pixler, custom conversions, audiences, CAPI
 *   client-tiktok-suite.ts   pixler, lead-skjema, offline-konverteringer
 *
 * Hver eneste av dem tar `producerUserId` og leser tokenet fra
 * role_room_ads_oauth_connections — byråets kobling, nøklet på en
 * brukerkonto. Det finnes ingen vei fra et Leadgrid-prosjekt dit.
 *
 * Denne modulen er den veien. Den gir samme slags tilgangstoken, men for
 * (organisasjon, prosjekt) i stedet for for en byråansatt, slik at de
 * eksisterende klientene kan gjenbrukes uten å skrives om.
 *
 * SAMME Google-app, EGEN tabell: tagmanager.* og analytics.edit er sensitive
 * scopes, og en ny client_id må gjennom Googles appverifisering på nytt.
 * Ved å beholde GOOGLE_ADS_OAUTH_CLIENT_ID arver vi godkjenningen som
 * finnes; ved å eie tabellen slipper kundens tilgang å henge i en
 * byråansatt sin brukerkonto.
 */

import { randomBytes } from "crypto";
import type { Pool } from "pg";
import {
  decryptGoogleToken,
  encryptGoogleToken,
  isAccessTokenExpiring,
} from "./google-oauth-shared.js";

export type LeadgridAdsPlatform = "google" | "meta" | "tiktok" | "linkedin";

export interface ProsjektScope {
  organizationId: string;
  projectId: string;
}

/**
 * Scopene Google-appen allerede ber om (role-room-ads-oauth.ts). Listen står
 * her også fordi Leadgrid-flyten må sende nøyaktig de samme — ber vi om et
 * scope appen ikke er verifisert for, avviser Google hele autorisasjonen.
 */
export const LEADGRID_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.edit",
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.publish",
] as const;

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** Refresh litt før utløp, så et kall midt i en jobb ikke treffer veggen. */
const REFRESH_SKEW_MS = 5 * 60_000;

export interface LeadgridAdsConnection {
  id: string;
  organizationId: string;
  projectId: string;
  platform: LeadgridAdsPlatform;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  accountRef: string | null;
  accountLabel: string | null;
  connectionState: "connected" | "needs_reauth" | "revoked" | "error";
}

interface Rad {
  id: string;
  organization_id: string;
  project_id: string;
  platform: LeadgridAdsPlatform;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: Date | null;
  account_ref: string | null;
  account_label: string | null;
  connection_state: LeadgridAdsConnection["connectionState"];
}

function tilKobling(r: Rad): LeadgridAdsConnection {
  return {
    id: r.id,
    organizationId: r.organization_id,
    projectId: r.project_id,
    platform: r.platform,
    accessToken: decryptGoogleToken(r.access_token_encrypted),
    refreshToken: decryptGoogleToken(r.refresh_token_encrypted),
    tokenExpiresAt: r.token_expires_at,
    accountRef: r.account_ref,
    accountLabel: r.account_label,
    connectionState: r.connection_state,
  };
}

export async function hentKobling(
  pool: Pool,
  scope: ProsjektScope,
  platform: LeadgridAdsPlatform,
): Promise<LeadgridAdsConnection | null> {
  const r = await pool.query<Rad>(
    `SELECT id::text, organization_id::text, project_id, platform,
            access_token_encrypted, refresh_token_encrypted, token_expires_at,
            account_ref, account_label, connection_state
       FROM leadgrid_ads_connections
      WHERE organization_id = $1::uuid AND project_id = $2 AND platform = $3
        AND revoked_at IS NULL
      LIMIT 1`,
    [scope.organizationId, scope.projectId, platform],
  );
  return r.rows[0] ? tilKobling(r.rows[0]) : null;
}

/** Google-legitimasjonen. Samme app som byrå-flyten, med vilje. */
export function googleOauthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function byggGoogleAuthUrl(opts: { state: string; redirectUri: string }): string | null {
  const creds = googleOauthCreds();
  if (!creds) return null;
  const p = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: LEADGRID_GOOGLE_SCOPES.join(" "),
    // offline + consent er det som faktisk gir et refresh_token. Uten dem
    // virker koblingen i en time og dør stille.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${p.toString()}`;
}

/**
 * Starter en autorisasjon. Prosjektet lagres server-side mot en tilfeldig
 * state — ikke i state-parameteren. Lå prosjekt-id-en i parameteren, kunne
 * den endres underveis og en Google-konto koblet til feil prosjekt.
 */
export async function startAutorisasjon(
  pool: Pool,
  opts: ProsjektScope & {
    platform: LeadgridAdsPlatform;
    userId: string;
    redirectUri: string;
  },
): Promise<{ ok: true; state: string; authUrl: string } | { ok: false; error: string }> {
  if (opts.platform !== "google") {
    return { ok: false, error: "plattform_ikke_stottet_enna" };
  }
  const state = randomBytes(24).toString("base64url");
  const authUrl = byggGoogleAuthUrl({ state, redirectUri: opts.redirectUri });
  if (!authUrl) return { ok: false, error: "google_oauth_ikke_konfigurert" };

  await pool.query(
    `INSERT INTO leadgrid_ads_oauth_states
       (state, organization_id, project_id, platform, started_by_user_id, redirect_uri)
     VALUES ($1, $2::uuid, $3, $4, $5, $6)`,
    [state, opts.organizationId, opts.projectId, opts.platform, opts.userId, opts.redirectUri],
  );
  return { ok: true, state, authUrl };
}

/**
 * Løser inn en state. Den kan bare brukes én gang, og bare før den utløper.
 * Returnerer prosjektet autorisasjonen faktisk gjaldt.
 */
export async function forbrukState(
  pool: Pool,
  state: string,
): Promise<
  | { ok: true; scope: ProsjektScope; platform: LeadgridAdsPlatform; userId: string; redirectUri: string }
  | { ok: false; error: string }
> {
  const r = await pool.query<{
    organization_id: string;
    project_id: string;
    platform: LeadgridAdsPlatform;
    started_by_user_id: string;
    redirect_uri: string;
  }>(
    `UPDATE leadgrid_ads_oauth_states
        SET consumed_at = NOW()
      WHERE state = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING organization_id::text, project_id, platform,
                started_by_user_id, redirect_uri`,
    [state],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: "ukjent_eller_utlopt_state" };
  return {
    ok: true,
    scope: { organizationId: row.organization_id, projectId: row.project_id },
    platform: row.platform,
    userId: row.started_by_user_id,
    redirectUri: row.redirect_uri,
  };
}

export async function lagreKobling(
  pool: Pool,
  opts: ProsjektScope & {
    platform: LeadgridAdsPlatform;
    accessToken: string | null;
    refreshToken: string | null;
    expiresInSeconds?: number | null;
    scopes?: string[];
    userId: string | null;
  },
): Promise<void> {
  const expiresAt =
    typeof opts.expiresInSeconds === "number"
      ? new Date(Date.now() + opts.expiresInSeconds * 1000)
      : null;
  await pool.query(
    `INSERT INTO leadgrid_ads_connections
       (organization_id, project_id, platform, access_token_encrypted,
        refresh_token_encrypted, token_expires_at, scopes, connection_state,
        connected_by_user_id, last_refreshed_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::text[], 'connected', $8, NOW())
     ON CONFLICT (organization_id, project_id, platform)
       WHERE revoked_at IS NULL
     DO UPDATE SET
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       -- Google sender bare refresh_token ved FØRSTE samtykke. Kommer det
       -- ingen ny, skal den gamle beholdes — ellers dør koblingen ved neste
       -- refresh, en time senere, uten at noen forstår hvorfor.
       refresh_token_encrypted = COALESCE(
         EXCLUDED.refresh_token_encrypted,
         leadgrid_ads_connections.refresh_token_encrypted),
       token_expires_at = EXCLUDED.token_expires_at,
       scopes = EXCLUDED.scopes,
       connection_state = 'connected',
       last_error = NULL,
       last_refreshed_at = NOW(),
       updated_at = NOW()`,
    [
      opts.organizationId, opts.projectId, opts.platform,
      encryptGoogleToken(opts.accessToken),
      encryptGoogleToken(opts.refreshToken),
      expiresAt,
      opts.scopes ?? [],
      opts.userId,
    ],
  );
}

async function markerReauth(pool: Pool, id: string, grunn: string): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_ads_connections
        SET connection_state = 'needs_reauth', last_error = $2, updated_at = NOW()
      WHERE id = $1::uuid`,
    [id, grunn.slice(0, 500)],
  );
}

/**
 * Tilgangstoken for et PROSJEKT. Dette er funksjonen de eksisterende
 * klientene mangler: der de tar producerUserId, tar denne (org, prosjekt).
 *
 * Returnerer null i stedet for å kaste. En manglende kobling er en normal
 * tilstand — kunden har ikke koblet til ennå — ikke en feil.
 */
export async function leadgridGoogleAccessToken(
  pool: Pool,
  scope: ProsjektScope,
): Promise<string | null> {
  const conn = await hentKobling(pool, scope, "google");
  if (!conn || conn.connectionState === "revoked") return null;

  const utloper = isAccessTokenExpiring(conn.tokenExpiresAt?.getTime() ?? null, REFRESH_SKEW_MS);
  if (conn.accessToken && !utloper) {
    void pool.query(
      `UPDATE leadgrid_ads_connections SET last_used_at = NOW() WHERE id = $1::uuid`,
      [conn.id],
    ).catch(() => undefined);
    return conn.accessToken;
  }

  if (!conn.refreshToken) {
    await markerReauth(pool, conn.id, "mangler refresh_token");
    return null;
  }
  const creds = googleOauthCreds();
  if (!creds) return null;

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: conn.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !body.access_token) {
      // invalid_grant = brukeren har trukket tilbake tilgangen. Da hjelper
      // ingen retry; koblingen må opprettes på nytt av et menneske.
      await markerReauth(
        pool, conn.id,
        `${body.error ?? `HTTP ${res.status}`}: ${body.error_description ?? ""}`,
      );
      return null;
    }
    await lagreKobling(pool, {
      ...scope,
      platform: "google",
      accessToken: body.access_token,
      refreshToken: null,
      expiresInSeconds: body.expires_in ?? null,
      userId: null,
    });
    return body.access_token;
  } catch (err) {
    await markerReauth(pool, conn.id, `refresh feilet: ${(err as Error)?.message ?? ""}`);
    return null;
  }
}
