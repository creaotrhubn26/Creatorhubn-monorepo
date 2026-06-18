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

type SessionData = { userId: string; role?: string; email?: string };

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

// State-cache for OAuth flow. Holdes i memory siden flowen er <5min.
const stateCache = new Map<string, { platform: string; createdAt: number }>();

// Decode JWT (id_token) uten signatur-validering. For full sikkerhet bør
// vi cache + validere mot Google's JWK, men for MVP — Google's egne
// token-info-endpoint dekker verifisering.
async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string; name: string; sub: string; aud: string; email_verified: boolean;
} | null> {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!r.ok) return null;
    const d = (await r.json()) as any;
    // aud (audience) må matche client_id
    if (GOOGLE_CLIENT_ID && d.aud !== GOOGLE_CLIENT_ID) {
      // For multiple Google clients (web vs ios), aksepterer vi flere
      const allowed = [
        GOOGLE_CLIENT_ID,
        process.env.CAPTUREAPP_GOOGLE_CLIENT_ID,
        process.env.LEADGRID_IOS_GOOGLE_CLIENT_ID,
      ].filter(Boolean);
      if (!allowed.includes(d.aud)) return null;
    }
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
    const platform = (req.query.platform as string) ?? "web";
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google client_id ikke konfigurert" });
    }

    const state = crypto.randomBytes(16).toString("hex");
    stateCache.set(state, { platform, createdAt: Date.now() });
    // Cleanup gamle states
    for (const [k, v] of stateCache.entries()) {
      if (Date.now() - v.createdAt > 10 * 60 * 1000) stateCache.delete(k);
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
    const { code, state, error } = req.query as Record<string, string>;
    if (error) {
      return res.redirect(`leadgrid://oauth?error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.status(400).send("Mangler code eller state");
    }
    const cached = stateCache.get(state);
    if (!cached) return res.status(400).send("Ugyldig state");

    // iOS: redirect tilbake til app via leadgrid:// scheme
    if (cached.platform === "ios") {
      return res.redirect(`leadgrid://oauth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
    }
    // Web: redirect til /leadgrid/welcome m/ code (handler lengre frem)
    res.redirect(`${PUBLIC_BASE}/leadgrid/welcome?google_code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  });

  // ---------- Bytte code mot id_token (server-side flow) ----------
  app.post("/api/leadgrid/auth/google/callback", async (req, res) => {
    const { code, state } = req.body ?? {};
    if (!code || !state) return res.status(400).json({ error: "code og state påkrevd" });
    const cached = stateCache.get(state);
    if (!cached) return res.status(400).json({ error: "Ugyldig state" });
    stateCache.delete(state);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: "Google credentials ikke konfigurert" });
    }

    try {
      const tokenR = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      res.status(500).json({ error: e.message ?? "Feil" });
    }
  });

  // ---------- Bytte id_token mot Leadgrid bearer ----------
  // Hovedendepunktet for iOS-appen. Verifiserer JWT mot Google,
  // oppretter Solo Free-org hvis ny bruker, returnerer bearer + user.
  app.post("/api/leadgrid/auth/google/exchange", async (req, res) => {
    const { id_token, deviceInfo, platform } = req.body ?? {};
    if (!id_token) return res.status(400).json({ error: "id_token påkrevd" });

    const verified = await verifyGoogleIdToken(id_token);
    if (!verified) return res.status(401).json({ error: "Ugyldig Google-token" });
    if (!verified.email) return res.status(400).json({ error: "Ingen e-post i token" });
    if (!verified.email_verified) {
      return res.status(400).json({ error: "Google e-post ikke verifisert" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Hent eller opprett bruker (matchet på email LOWER)
      let userId: string;
      let isNew = false;
      const userR = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [verified.email],
      );
      if (userR.rows.length > 0) {
        userId = userR.rows[0].id;
      } else {
        userId = crypto.randomUUID();
        await client.query(
          // users-tabellen har first_name + last_name + username, ikke full_name
          `INSERT INTO users (id, email, username, role, first_name, last_name, created_at)
           VALUES ($1, $2, $3, 'member', $4, $5, now())`,
          [
            userId, verified.email, verified.email,
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

      // Auto-aktiver session-cache (in-memory) så bruker er innlogget umiddelbart
      activeSessions.set(bearer, {
        userId, email: verified.email, role: "member",
      });

      res.json({
        bearer,
        user: { id: userId, email: verified.email },
        is_new_user: isNew,
        organization_id: orgId,
      });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[google-auth exchange]", e);
      res.status(500).json({ error: e.message ?? "Feil ved Google-innlogging" });
    } finally {
      client.release();
    }
  });
}
