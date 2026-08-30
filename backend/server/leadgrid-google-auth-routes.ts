/**
 * leadgrid-google-auth-routes.ts
 *
 * Google Sign-In for Leadgrid (web + iOS native).
 *
 *   1. GET /api/leadgrid/auth/google/start?platform=ios
 *      → Returnerer auth_url (Google OAuth-URL) + state.
 *        iOS-appen åpner i ASWebAuthenticationSession m/ callback-scheme
 *        'leadgrid://oauth'. Web kan bruke samme + redirect tilbake.
 *
 *   2. POST /api/leadgrid/auth/google/callback
 *      → Bytter code mot Google id_token. Web-bruk.
 *
 *   3. POST /api/leadgrid/auth/google/exchange
 *      → Bytter id_token mot Leadgrid bearer-token.
 *        Verifiserer JWT mot Google's JWK (issuer + audience).
 *        Oppretter Solo Free-org hvis ny bruker.
 *        Returnerer { bearer, user: { id, email } } — samme format som
 *        /api/ipad-tokens/exchange.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { persistAuthSession } from "./auth-session-store.js";
import {
  consumeOauthState,
  loadOauthState,
  persistOauthState,
} from "./role-room-oauth-store";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
  name?: string;
  loginAt?: string;
};

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

type GoogleOAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  configured: boolean;
  complete: boolean;
  label: string;
};

function firstConfiguredValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return "";
}

function publicOrigin(
  label: string,
  ...values: Array<string | undefined>
): string {
  const configured = firstConfiguredValue(...values);
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(`${label} må være en gyldig absolutt URL`);
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(`${label} må bruke HTTPS (HTTP er kun tillatt lokalt)`);
  }
  if (
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== "/") ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${label} må være et origin uten sti, query eller fragment`,
    );
  }
  return url.origin;
}

function oauthClientConfig(
  label: string,
  clientIdValue: string | undefined,
  clientSecretValue: string | undefined,
): GoogleOAuthClientConfig {
  const clientId = firstConfiguredValue(clientIdValue);
  const clientSecret = firstConfiguredValue(clientSecretValue);
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId || clientSecret),
    complete: Boolean(clientId && clientSecret),
    label,
  };
}

const DEDICATED_LEADGRID_CLIENT = oauthClientConfig(
  "Leadgrid",
  process.env.LEADGRID_GOOGLE_CLIENT_ID,
  process.env.LEADGRID_GOOGLE_CLIENT_SECRET,
);
const CREATORHUB_CLIENT = oauthClientConfig(
  "CreatorHub",
  process.env.CREATORHUB_GOOGLE_CLIENT_ID,
  process.env.CREATORHUB_GOOGLE_CLIENT_SECRET,
);
const GENERIC_GOOGLE_CLIENT = oauthClientConfig(
  "Google",
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

// Select whole credential pairs. Never combine an ID from one Google app with
// a secret from another when a namespace is only partially configured.
const LEGACY_GOOGLE_CLIENT = CREATORHUB_CLIENT.complete
  ? CREATORHUB_CLIENT
  : GENERIC_GOOGLE_CLIENT.complete
    ? GENERIC_GOOGLE_CLIENT
    : CREATORHUB_CLIENT.configured
      ? CREATORHUB_CLIENT
      : GENERIC_GOOGLE_CLIENT;
const LEADGRID_GOOGLE_CLIENT = DEDICATED_LEADGRID_CLIENT.configured
  ? DEDICATED_LEADGRID_CLIENT
  : LEGACY_GOOGLE_CLIENT;

const LEADGRID_PUBLIC_BASE = publicOrigin(
  "LEADGRID_PUBLIC_URL",
  process.env.LEADGRID_PUBLIC_URL,
  process.env.ROLE_ROOM_PUBLIC_URL,
  "https://theroleroom.com",
);
const LEGACY_PUBLIC_BASE = publicOrigin(
  "ROLE_ROOM_PUBLIC_URL",
  process.env.ROLE_ROOM_PUBLIC_URL,
  "https://theroleroom.com",
);

type LeadgridGoogleState = {
  platform: string;
  createdAt: number;
  clientId?: string;
  redirectUri?: string;
};
const GOOGLE_STATE_RE = /^[a-f0-9]{32}$/;
const GOOGLE_PLATFORMS = new Set(["web", "ios", "ios-storyboard"]);

function oauthClientForPlatform(platform: string): GoogleOAuthClientConfig {
  // Older Storyboard Studio builds used this endpoint. Keep those builds on
  // the existing CreatorHub client while Leadgrid moves to its own project.
  return platform === "ios-storyboard"
    ? LEGACY_GOOGLE_CLIENT
    : LEADGRID_GOOGLE_CLIENT;
}

function publicBaseForPlatform(platform: string): string {
  return platform === "ios-storyboard"
    ? LEGACY_PUBLIC_BASE
    : LEADGRID_PUBLIC_BASE;
}

function splitClientIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueClientIds(...ids: Array<string | undefined>): string[] {
  return [...new Set(ids.flatMap((id) => splitClientIds(id)))];
}

function requestString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

async function verifyGoogleIdToken(
  idToken: string,
  allowedAudiences: string[],
): Promise<{
  email: string;
  name: string;
  sub: string;
  aud: string;
  email_verified: boolean;
} | null> {
  if (allowedAudiences.length === 0) return null;
  try {
    const { OAuth2Client } = await import("google-auth-library");
    const verifier = new OAuth2Client(allowedAudiences[0]);
    const ticket = await verifier.verifyIdToken({
      idToken,
      audience: allowedAudiences,
    });
    const d = ticket.getPayload();
    if (!d?.aud || !allowedAudiences.includes(d.aud)) return null;
    return {
      email: d.email ?? "",
      name: d.name ?? d.given_name ?? d.email ?? "",
      sub: d.sub ?? "",
      aud: d.aud,
      email_verified: d.email_verified === true,
    };
  } catch (e) {
    console.error("[google-auth] id-token verification failed", e);
    return null;
  }
}

export function registerLeadgridGoogleAuthRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  // ---------- Start ----------
  app.get("/api/leadgrid/auth/google/start", async (req, res) => {
    const platform = requestString(req.query.platform, 32) ?? "web";
    if (!GOOGLE_PLATFORMS.has(platform)) {
      return res.status(400).json({ error: "Ugyldig platform" });
    }
    const oauthClient = oauthClientForPlatform(platform);
    if (oauthClient.configured && !oauthClient.complete) {
      return res.status(500).json({
        error: `${oauthClient.label} Google credentials er ufullstendig konfigurert`,
      });
    }
    if (!oauthClient.clientId) {
      return res
        .status(500)
        .json({ error: "Google client_id ikke konfigurert" });
    }

    const redirectUri = `${publicBaseForPlatform(platform)}/api/leadgrid/auth/google/web-callback`;
    const state = crypto.randomBytes(16).toString("hex");
    const statePayload: LeadgridGoogleState = {
      platform,
      createdAt: Date.now(),
      clientId: oauthClient.clientId,
      redirectUri,
    };
    const persisted = await persistOauthState(
      pool,
      state,
      statePayload,
      new Date(Date.now() + 10 * 60 * 1000),
    );
    if (!persisted) {
      return res
        .status(503)
        .json({ error: "OAuth state-lager er utilgjengelig" });
    }

    // Redirect-URI bestemmes av platform:
    // - iOS: backend egen callback-URL (vi forwarder til leadgrid:// scheme)
    // - web: same path
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", oauthClient.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");

    res.json({ auth_url: url.toString(), state });
  });

  // ---------- Web callback (GET via Google redirect) ----------
  // For iOS: vi redirecter videre til leadgrid:// scheme m/ samme code+state.
  app.get("/api/leadgrid/auth/google/web-callback", async (req, res) => {
    const code = requestString(req.query.code, 8_192);
    const state = requestString(req.query.state, 64);
    const error = requestString(req.query.error, 256);
    if (!state || !GOOGLE_STATE_RE.test(state)) {
      return res.status(400).send("Ugyldig state");
    }
    const cached = error
      ? await consumeOauthState<LeadgridGoogleState>(pool, state)
      : await loadOauthState<LeadgridGoogleState>(pool, state);
    if (!cached || !GOOGLE_PLATFORMS.has(cached.platform)) {
      return res.status(400).send("Ugyldig state");
    }
    const publicBase = publicBaseForPlatform(cached.platform);
    if (error) {
      if (cached.platform === "ios" || cached.platform === "ios-storyboard") {
        const scheme =
          cached.platform === "ios-storyboard"
            ? "storyboardstudio"
            : "leadgrid";
        return res.redirect(
          `${scheme}://oauth?error=${encodeURIComponent(error)}`,
        );
      }
      return res.redirect(
        `${publicBase}/leadgrid/welcome?google_error=${encodeURIComponent(error)}`,
      );
    }
    if (!code) {
      return res.status(400).send("Mangler code eller state");
    }

    // iOS: redirect tilbake til app via app-scheme. Storyboard Studio bruker
    // samme flyt med platform=ios-storyboard → storyboardstudio://oauth.
    if (cached.platform === "ios" || cached.platform === "ios-storyboard") {
      const scheme =
        cached.platform === "ios-storyboard" ? "storyboardstudio" : "leadgrid";
      return res.redirect(
        `${scheme}://oauth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      );
    }
    // Web: redirect til /leadgrid/welcome m/ code (handler lengre frem)
    res.redirect(
      `${publicBase}/leadgrid/welcome?google_code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    );
  });

  // ---------- Bytte code mot id_token (server-side flow) ----------
  app.post("/api/leadgrid/auth/google/callback", async (req, res) => {
    const code = requestString(req.body?.code, 8_192);
    const state = requestString(req.body?.state, 64);
    if (!code || !state)
      return res.status(400).json({ error: "code og state påkrevd" });
    if (!GOOGLE_STATE_RE.test(state)) {
      return res.status(400).json({ error: "Ugyldig state" });
    }
    const cached = await consumeOauthState<LeadgridGoogleState>(pool, state);
    if (!cached || !GOOGLE_PLATFORMS.has(cached.platform)) {
      return res.status(400).json({ error: "Ugyldig state" });
    }

    const oauthClient = oauthClientForPlatform(cached.platform);
    const publicBase = publicBaseForPlatform(cached.platform);
    if (!oauthClient.complete) {
      return res.status(500).json({
        error: `${oauthClient.label} Google credentials ikke konfigurert`,
      });
    }
    const redirectUri = `${publicBase}/api/leadgrid/auth/google/web-callback`;
    if (
      (cached.clientId && cached.clientId !== oauthClient.clientId) ||
      (cached.redirectUri && cached.redirectUri !== redirectUri)
    ) {
      return res.status(409).json({
        error:
          "Google OAuth-konfigurasjonen ble endret. Start innloggingen på nytt.",
      });
    }

    try {
      const tokenR = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: oauthClient.clientId,
          client_secret: oauthClient.clientSecret,
          redirect_uri: cached.redirectUri ?? redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenR.ok) {
        const err = await tokenR.text();
        console.error("[google-auth] token-exchange failed", err);
        return res.status(400).json({ error: "Google token-exchange feilet" });
      }
      const d = (await tokenR.json()) as {
        id_token?: string;
        access_token?: string;
      };
      if (!d.id_token)
        return res.status(400).json({ error: "Manglende id_token" });
      res.json({ id_token: d.id_token });
    } catch (e: any) {
      console.error("[google-auth callback]", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Bytte id_token mot Role Room-SESJON (Storyboard Studio) ----------
  // Krever EKSISTERENDE bruker (artisten må allerede være i The Role Room —
  // ingen auto-opprett fra tegneappen). Returnerer creatorhub-sesjonstoken
  // som fungerer mot /api/auth/user, /api/casting/* osv.
  app.post("/api/auth/google/session-exchange", async (req, res) => {
    const { id_token } = req.body ?? {};
    if (!id_token) return res.status(400).json({ error: "id_token påkrevd" });

    const legacyAudiences = uniqueClientIds(
      LEGACY_GOOGLE_CLIENT.clientId,
      process.env.ROLE_ROOM_GOOGLE_CLIENT_ID,
      process.env.CAPTUREAPP_GOOGLE_CLIENT_ID,
    );
    if (legacyAudiences.length === 0) {
      return res.status(503).json({ error: "Google OAuth ikke konfigurert" });
    }
    const verified = await verifyGoogleIdToken(id_token, legacyAudiences);
    if (!verified?.email)
      return res.status(401).json({ error: "Ugyldig Google-token" });
    if (!verified.email_verified) {
      return res.status(400).json({ error: "Google e-post ikke verifisert" });
    }

    try {
      // users-tabellen har first_name/last_name/username — IKKE display_name/
      // name (kolonnereferansen kastet 42703 → internal_error på all innlogging).
      const r = await pool.query<{
        id: string;
        email: string;
        name: string | null;
        role: string | null;
      }>(
        `SELECT id, email,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), username, email) AS name,
                role
           FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [verified.email],
      );
      const user = r.rows[0];
      if (!user) {
        return res.status(403).json({
          error: "user_not_found",
          message:
            "Ingen Role Room-konto for denne e-posten. Opprett konto i The Role Room først.",
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        userId: user.id,
        email: user.email,
        name: user.name ?? user.email,
        role: user.role ?? "user",
        loginAt: new Date().toISOString(),
        isAdmin: user.role === "admin" || user.role === "super_admin",
        verified_email: true,
      };
      activeSessions.set(token, session as SessionData);
      void persistAuthSession(pool, token, session as any);
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: session.name,
          role: session.role,
        },
      });
    } catch (e) {
      console.error("[google session-exchange]", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Bytte id_token mot Leadgrid bearer ----------
  // Hovedendepunktet for iOS-appen. Verifiserer JWT mot Google,
  // oppretter Solo Free-org hvis ny bruker, returnerer bearer + user.
  app.post("/api/leadgrid/auth/google/exchange", async (req, res) => {
    const { id_token, deviceInfo, platform } = req.body ?? {};
    if (!id_token) return res.status(400).json({ error: "id_token påkrevd" });

    if (!LEADGRID_GOOGLE_CLIENT.complete) {
      return res.status(503).json({
        error: "Leadgrid Google OAuth er ufullstendig konfigurert",
      });
    }
    const leadgridAudiences = uniqueClientIds(
      LEADGRID_GOOGLE_CLIENT.clientId,
      process.env.LEADGRID_IOS_GOOGLE_CLIENT_ID,
    );
    const verified = await verifyGoogleIdToken(id_token, leadgridAudiences);
    if (!verified)
      return res.status(401).json({ error: "Ugyldig Google-token" });
    if (!verified.email)
      return res.status(400).json({ error: "Ingen e-post i token" });
    if (!verified.email_verified) {
      return res.status(400).json({ error: "Google e-post ikke verifisert" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Hent eller opprett bruker (matchet på email LOWER).
      // Henter role også — eksisterende brukere kan ha role='super_admin'
      // (Daniel) og det skal forplantes til session-cachen, ikke
      // overskrives med 'member'.
      let userId: string;
      let userRole: string = "member";
      let isNew = false;
      const userR = await client.query<{
        id: string;
        role: string | null;
        is_active: boolean;
      }>(
        `SELECT id, role, COALESCE(is_active, TRUE) AS is_active
           FROM users WHERE LOWER(email) = LOWER($1)`,
        [verified.email],
      );
      if (userR.rows.length > 0) {
        if (userR.rows[0].is_active !== true) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "account_inactive" });
        }
        userId = userR.rows[0].id;
        userRole = userR.rows[0].role ?? "member";
      } else {
        userId = crypto.randomUUID();
        // users.password er NOT NULL uten default. Bruker aldri passord her
        // (Google-only), men trenger en ikke-null placeholder — samme mønster
        // som google-id-token-service.ts. Uten denne feiler INSERT med
        // "null value in column password violates not-null constraint" for
        // enhver ny bruker (oppdaget 2026-08-16, iPad Google-innlogging).
        const bcrypt = await import("bcrypt");
        const placeholderPassword = await bcrypt.default.hash(
          `${crypto.randomUUID()}${crypto.randomUUID()}`,
          10,
        );
        await client.query(
          // users-tabellen har first_name + last_name + username, ikke full_name
          `INSERT INTO users (id, email, username, password, role, first_name, last_name, created_at)
           VALUES ($1, $2, $3, $4, 'member', $5, $6, now())`,
          [
            userId,
            verified.email,
            verified.email,
            placeholderPassword,
            verified.name?.split(" ")[0] ?? null,
            verified.name?.split(" ").slice(1).join(" ") ?? null,
          ],
        );
        isNew = true;
      }

      // 2) Sjekk om brukeren har en org. Hvis ikke, opprett Solo Free.
      const orgR = await client.query<{ id: string }>(
        `SELECT om.organization_id AS id
           FROM organization_members om
          WHERE om.user_id = $1 LIMIT 1`,
        [userId],
      );
      let orgId: string;
      if (orgR.rows.length > 0) {
        orgId = orgR.rows[0].id;
      } else {
        // Opprett Solo Free-org
        const orgName = verified.name
          ? `${verified.name}'s Leadgrid`
          : `${verified.email.split("@")[0]}'s Leadgrid`;
        const slug =
          orgName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          crypto.randomBytes(3).toString("hex");
        const newOrgR = await client.query<{ id: string }>(
          `INSERT INTO organizations (name, slug, org_type, plan, owner_user_id, contact_email)
           VALUES ($1, $2, 'customer', 'solo_free', $3, $4)
           RETURNING id`,
          [orgName, slug, userId, verified.email],
        );
        orgId = newOrgR.rows[0].id;
        await client.query(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'admin')`,
          [orgId, userId],
        );
      }

      // 3) Lag bearer-token + lagre i samme tabell som ipad-tokens
      const bearer = crypto.randomBytes(32).toString("hex");
      const deviceName = (deviceInfo as any)?.deviceName ?? "Google Sign-In";
      const deviceModel = (deviceInfo as any)?.model ?? null;
      const osVersion = (deviceInfo as any)?.osVersion ?? null;
      const appVersion = (deviceInfo as any)?.appVersion ?? null;

      // Bruk ipad_tokens-tabellen som allerede eksisterer for bearer-lagring
      try {
        await client.query(
          `INSERT INTO ipad_tokens (token, user_id, device_name, device_model,
                                    os_version, app_version, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'google_signin', now())`,
          [bearer, userId, deviceName, deviceModel, osVersion, appVersion],
        );
      } catch (e) {
        // Hvis ipad_tokens-tabellen ikke har source-kolonne, prøv uten
        await client.query(
          `INSERT INTO ipad_tokens (token, user_id, device_name, device_model,
                                    os_version, app_version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [bearer, userId, deviceName, deviceModel, osVersion, appVersion],
        );
      }

      await client.query("COMMIT");

      // Auto-aktiver session-cache (in-memory) så bruker er innlogget umiddelbart.
      // userRole settes fra DB — eksisterende super_admin bevares (Daniel),
      // nye brukere får 'member' fra default-en over.
      activeSessions.set(bearer, {
        userId,
        email: verified.email,
        role: userRole,
        name: verified.name?.trim() || verified.email,
        loginAt: new Date().toISOString(),
      });

      res.json({
        bearer,
        user: { id: userId, email: verified.email, role: userRole },
        is_new_user: isNew,
        organization_id: orgId,
      });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[google-auth exchange]", e);
      res.status(500).json({ error: "internal_error" });
    } finally {
      client.release();
    }
  });
}
