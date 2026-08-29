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
 *        Verifiserer tokenet hos Google og audience mot konfigurert klient.
 *        Oppretter Solo Free-org hvis ny bruker.
 *        Returnerer { bearer, user: { id, email } } — samme format som
 *        /api/ipad-tokens/exchange.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import {
  ensureAuthSessionTable,
  persistAuthSessionInTransaction,
} from "./auth-session-store";
import {
  consumeOauthState,
  deleteOauthState,
  loadOauthState,
  persistOauthState,
} from "./role-room-oauth-store";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
  authSessionVersion?: string;
};

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const GOOGLE_CLIENT_ID = process.env.CREATORHUB_GOOGLE_CLIENT_ID
                      ?? process.env.GOOGLE_CLIENT_ID
                      ?? "";
const GOOGLE_CLIENT_SECRET = process.env.CREATORHUB_GOOGLE_CLIENT_SECRET
                          ?? process.env.GOOGLE_CLIENT_SECRET
                          ?? "";
const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

type LeadgridGoogleState = { platform: string; createdAt: number };
const GOOGLE_STATE_RE = /^[a-f0-9]{32}$/;
const GOOGLE_PLATFORMS = new Set(["web", "ios", "ios-storyboard"]);

function requestString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function setAuthResponseHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
}

// Google validerer signatur, issuer, levetid og tokenformat i tokeninfo.
// Vi verifiserer i tillegg audience eksplisitt mot våre konfigurerte klienter.
async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string; name: string; sub: string; aud: string; email_verified: boolean;
} | null> {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as any;
    // Audience må alltid matche en eksplisitt konfigurert klient. Tidligere
    // ble aud-kontrollen utilsiktet hoppet over når web-client-ID manglet.
    const allowed = [
      GOOGLE_CLIENT_ID,
      process.env.CAPTUREAPP_GOOGLE_CLIENT_ID,
      process.env.LEADGRID_IOS_GOOGLE_CLIENT_ID,
    ].filter((value): value is string => Boolean(value?.trim()));
    if (allowed.length === 0 || !allowed.includes(d.aud)) return null;
    return {
      email: d.email,
      name: d.name ?? d.given_name,
      sub: d.sub,
      aud: d.aud,
      email_verified: d.email_verified === "true" || d.email_verified === true,
    };
  } catch (e) {
    console.error("[google-auth] tokeninfo failed", e);
    return null;
  }
}

export function registerLeadgridGoogleAuthRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Start ----------
  app.get("/api/leadgrid/auth/google/start", async (req, res) => {
    setAuthResponseHeaders(res);
    const requestedPlatform = requestString(req.query.platform, 32) ?? "web";
    if (!GOOGLE_PLATFORMS.has(requestedPlatform)) {
      return res.status(400).json({ error: "Ugyldig platform" });
    }
    const platform = requestedPlatform;
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google client_id ikke konfigurert" });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const statePayload: LeadgridGoogleState = { platform, createdAt: Date.now() };
    const persisted = await persistOauthState(
      pool,
      state,
      statePayload,
      new Date(Date.now() + 10 * 60 * 1000),
    );
    if (!persisted) {
      return res.status(503).json({ error: "OAuth state-lager er utilgjengelig" });
    }

    // Redirect-URI bestemmes av platform:
    // - iOS: backend egen callback-URL (vi forwarder til leadgrid:// scheme)
    // - web: same path
    const redirectUri = `${PUBLIC_BASE}/api/leadgrid/auth/google/web-callback`;

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");

    res.json({ auth_url: url.toString(), state });
  });

  // ---------- Web callback (GET via Google redirect) ----------
  // For iOS: vi redirecter videre til leadgrid:// scheme m/ samme code+state.
  app.get("/api/leadgrid/auth/google/web-callback", async (req, res) => {
    setAuthResponseHeaders(res);
    const code = requestString(req.query.code, 8_192);
    const state = requestString(req.query.state, 64);
    const error = requestString(req.query.error, 256);
    if (!state || !GOOGLE_STATE_RE.test(state)) {
      return res.status(400).send("Ugyldig state");
    }
    const cached = await loadOauthState<LeadgridGoogleState>(pool, state);
    if (!cached || !GOOGLE_PLATFORMS.has(cached.platform)) {
      return res.status(400).send("Ugyldig state");
    }
    if (error) {
      await deleteOauthState(pool, state);
      if (cached?.platform === "ios" || cached?.platform === "ios-storyboard") {
        const scheme = cached.platform === "ios-storyboard" ? "storyboardstudio" : "leadgrid";
        return res.redirect(`${scheme}://oauth?error=${encodeURIComponent(error)}`);
      }
      return res.redirect(
        `${PUBLIC_BASE}/leadgrid/welcome#google_error=${encodeURIComponent(error)}`,
      );
    }
    if (!code) {
      return res.status(400).send("Mangler code eller state");
    }

    // iOS: redirect tilbake til app via app-scheme. Storyboard Studio bruker
    // samme flyt med platform=ios-storyboard → storyboardstudio://oauth.
    if (cached.platform === "ios" || cached.platform === "ios-storyboard") {
      const scheme = cached.platform === "ios-storyboard" ? "storyboardstudio" : "leadgrid";
      return res.redirect(`${scheme}://oauth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
    }
    // Web: fragmentet sendes ikke videre til webserver-/proxylogger.
    res.redirect(`${PUBLIC_BASE}/leadgrid/welcome#google_code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  });

  // ---------- Bytte code mot id_token (server-side flow) ----------
  app.post("/api/leadgrid/auth/google/callback", async (req, res) => {
    setAuthResponseHeaders(res);
    const code = requestString(req.body?.code, 8_192);
    const state = requestString(req.body?.state, 64);
    if (!code || !state) return res.status(400).json({ error: "code og state påkrevd" });
    if (!GOOGLE_STATE_RE.test(state)) {
      return res.status(400).json({ error: "Ugyldig state" });
    }
    const cached = await consumeOauthState<LeadgridGoogleState>(pool, state);
    if (!cached || !GOOGLE_PLATFORMS.has(cached.platform)) {
      return res.status(400).json({ error: "Ugyldig state" });
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: "Google credentials ikke konfigurert" });
    }

    try {
      const tokenR = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${PUBLIC_BASE}/api/leadgrid/auth/google/web-callback`,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenR.ok) {
        const err = await tokenR.text();
        console.error("[google-auth] token-exchange failed", err);
        return res.status(400).json({ error: "Google token-exchange feilet" });
      }
      const d = (await tokenR.json()) as { id_token?: string; access_token?: string };
      if (!d.id_token) return res.status(400).json({ error: "Manglende id_token" });
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
    setAuthResponseHeaders(res);
    const id_token = requestString(req.body?.id_token, 16_384);
    if (!id_token) return res.status(400).json({ error: "id_token påkrevd" });

    const verified = await verifyGoogleIdToken(id_token);
    if (!verified?.email) return res.status(401).json({ error: "Ugyldig Google-token" });
    if (!verified.email_verified) {
      return res.status(400).json({ error: "Google e-post ikke verifisert" });
    }

    try {
      // users-tabellen har first_name/last_name — ikke en canonical name-kolonne.
      const r = await pool.query<{
        id: string;
        email: string;
        name: string | null;
        role: string | null;
        auth_session_version: string;
        is_active: boolean;
      }>(
        `SELECT id, email,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), email) AS name,
                role,
                auth_session_version::text AS auth_session_version,
                COALESCE(is_active, TRUE) AS is_active
           FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [verified.email],
      );
      const user = r.rows[0];
      if (!user) {
        return res.status(403).json({
          error: "user_not_found",
          message: "Ingen Role Room-konto for denne e-posten. Opprett konto i The Role Room først.",
        });
      }
      if (user.is_active !== true) {
        return res.status(403).json({ error: "account_inactive" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        userId: user.id,
        email: user.email,
        name: user.name ?? user.email,
        role: user.role ?? "user",
        authSessionVersion: String(user.auth_session_version ?? "0"),
        loginAt: new Date().toISOString(),
        isAdmin: user.role === "admin" || user.role === "super_admin",
        verified_email: true,
      };
      if (!(await ensureAuthSessionTable(pool))) {
        return res.status(503).json({ error: "session_store_unavailable" });
      }
      try {
        await persistAuthSessionInTransaction(pool, token, session);
      } catch {
        return res.status(503).json({ error: "session_store_unavailable" });
      }
      activeSessions.set(token, session as SessionData);
      res.json({ token, user: { id: user.id, email: user.email, name: session.name, role: session.role } });
    } catch (e) {
      console.error("[google session-exchange]", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Bytte id_token mot Leadgrid bearer ----------
  // Hovedendepunktet for iOS-appen. Verifiserer JWT mot Google,
  // oppretter Solo Free-org hvis ny bruker, returnerer bearer + user.
  app.post("/api/leadgrid/auth/google/exchange", async (req, res) => {
    setAuthResponseHeaders(res);
    const id_token = requestString(req.body?.id_token, 16_384);
    const { deviceInfo } = req.body ?? {};
    if (!id_token) return res.status(400).json({ error: "id_token påkrevd" });

    const verified = await verifyGoogleIdToken(id_token);
    if (!verified) return res.status(401).json({ error: "Ugyldig Google-token" });
    if (!verified.email) return res.status(400).json({ error: "Ingen e-post i token" });
    if (!verified.email_verified) {
      return res.status(400).json({ error: "Google e-post ikke verifisert" });
    }

    if (!(await ensureAuthSessionTable(pool))) {
      return res.status(503).json({ error: "session_store_unavailable" });
    }

    const client = await pool.connect().catch(() => null);
    if (!client) {
      return res.status(503).json({ error: "session_store_unavailable" });
    }
    let canonicalWriteStarted = false;
    try {
      await client.query("BEGIN");

      // 1) Hent eller opprett bruker (matchet på email LOWER).
      // Henter role også — eksisterende brukere kan ha role='super_admin'
      // (Daniel) og det skal forplantes til session-cachen, ikke
      // overskrives med 'member'.
      let userId: string;
      let userRole: string = "member";
      let authSessionVersion = "0";
      let isNew = false;
      const userR = await client.query<{
        id: string;
        role: string | null;
        auth_session_version: string;
        is_active: boolean;
      }>(
        `SELECT id, role,
                auth_session_version::text AS auth_session_version,
                COALESCE(is_active, TRUE) AS is_active
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
        authSessionVersion = String(
          userR.rows[0].auth_session_version ?? "0",
        );
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
            userId, verified.email, verified.email, placeholderPassword,
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
        const slug = orgName.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
          + "-" + crypto.randomBytes(3).toString("hex");
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
      const deviceName = requestString((deviceInfo as any)?.deviceName, 160) ?? "Google Sign-In";
      const deviceModel = requestString((deviceInfo as any)?.model, 160);
      const osVersion = requestString((deviceInfo as any)?.osVersion, 80);
      const appVersion = requestString((deviceInfo as any)?.appVersion, 80);

      // Bruk ipad_tokens-tabellen som allerede eksisterer for bearer-lagring
      await client.query("SAVEPOINT leadgrid_ipad_token_insert");
      try {
        await client.query(
          `INSERT INTO ipad_tokens (token, user_id, device_name, device_model,
                                    os_version, app_version, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'google_signin', now())`,
          [bearer, userId, deviceName, deviceModel, osVersion, appVersion],
        );
        await client.query("RELEASE SAVEPOINT leadgrid_ipad_token_insert");
      } catch (e) {
        // Hvis ipad_tokens-tabellen ikke har source-kolonne, prøv uten
        await client.query("ROLLBACK TO SAVEPOINT leadgrid_ipad_token_insert");
        await client.query(
          `INSERT INTO ipad_tokens (token, user_id, device_name, device_model,
                                    os_version, app_version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [bearer, userId, deviceName, deviceModel, osVersion, appVersion],
        );
        await client.query("RELEASE SAVEPOINT leadgrid_ipad_token_insert");
      }

      const session = {
        userId,
        email: verified.email.trim().toLowerCase(),
        name: verified.name?.trim() || verified.email.split("@")[0],
        displayName: verified.name?.trim() || verified.email.split("@")[0],
        role: userRole,
        authSessionVersion,
        activeOrganizationId: orgId,
        loginAt: new Date().toISOString(),
        isAdmin: userRole === "admin" || userRole === "super_admin",
        verified_email: true,
      };
      // Samme transaksjon som bruker/org/device-token. En webklient får aldri
      // et bearer som bare finnes i én instans' minne.
      canonicalWriteStarted = true;
      await persistAuthSessionInTransaction(client, bearer, session);

      await client.query("COMMIT");

      // Auto-aktiver session-cache (in-memory) så bruker er innlogget umiddelbart.
      // userRole settes fra DB — eksisterende super_admin bevares (Daniel),
      // nye brukere får 'member' fra default-en over.
      activeSessions.set(bearer, session);

      res.json({
        bearer,
        user: {
          id: userId,
          email: session.email,
          name: session.name,
          displayName: session.displayName,
          role: userRole,
          isAdmin: session.isAdmin,
          verified_email: true,
        },
        is_new_user: isNew,
        organization_id: orgId,
      });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[google-auth exchange]", e);
      res.status(canonicalWriteStarted ? 503 : 500).json({
        error: canonicalWriteStarted
          ? "session_store_unavailable"
          : "internal_error",
      });
    } finally {
      client.release();
    }
  });
}
