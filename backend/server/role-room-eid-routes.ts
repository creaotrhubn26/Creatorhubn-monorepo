/**
 * role-room-eid-routes.ts — identitetsverifisering med BankID.
 *
 *   GET  /api/role-room/eid/config                  — er eID satt opp her?
 *   POST /api/role-room/talents/me/verify/start     — start verifisering
 *   GET  /api/role-room/eid/callback                — brokerens retur
 *
 * Flyten verifiserer en konto som ALLEREDE er innlogget. Den oppretter aldri
 * brukere: en skrivefeil i e-posten under registrering ville ellers blitt en
 * permanent duplikatkonto (regel 2 i ferdigheten).
 *
 * OIDC-detaljene ligger i openid-client, som allerede er en avhengighet.
 * Discovery caches, så vi ikke slår opp .well-known på hver forespørsel.
 */

import type express from "express";
import type { Pool } from "pg";

import {
  PROVIDER_SETTINGS,
  birthYearFromSsn,
  consumeAuthState,
  createAuthState,
  hashSsn,
  logAuthEvent,
  markTalentVerified,
  readEidConfig,
  writeIdentity,
  type EidProvider,
} from "./role-room-eid-service.js";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomEidRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
  /** Hvor brukeren sendes tilbake etter fullført runde. */
  getPublicOrigin: () => string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let cachedDiscovery: { issuer: string; config: any } | null = null;

async function getOidcConfig(issuer: string, clientId: string, clientSecret: string) {
  if (cachedDiscovery?.issuer === issuer) return cachedDiscovery.config;
  const client = await import("openid-client");
  const config = await client.discovery(new URL(issuer), clientId, clientSecret);
  cachedDiscovery = { issuer, config };
  return config;
}

/** Retur-stien må være relativ og på egen origin. */
function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw.slice(0, 500);
}

export function setupRoleRoomEidRoutes(deps: RoleRoomEidRoutesDeps): void {
  const { app, pool, getActiveSession, getPublicOrigin } = deps;

  // ── GET /eid/config ─────────────────────────────────────────────────
  // Frontend spør først, og viser «ikke tilgjengelig» i stedet for en knapp
  // som feiler. Svarer aldri med hemmeligheter.
  app.get("/api/role-room/eid/config", (_req, res) => {
    const config = readEidConfig();
    res.json({
      configured: Boolean(config),
      providers: config ? Object.keys(PROVIDER_SETTINGS) : [],
    });
  });

  // ── POST /talents/me/verify/start ───────────────────────────────────
  app.post("/api/role-room/talents/me/verify/start", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const config = readEidConfig();
    if (!config) return res.status(503).json({ error: "eid_not_configured" });

    const body = (req.body || {}) as Record<string, unknown>;
    const provider: EidProvider =
      body.provider === "buypass" ? "buypass" : "bankid";
    const returnPath = safeReturnPath(body.returnPath);

    try {
      const talent = await pool.query(
        `SELECT id FROM talents WHERE owner_user_id = $1 LIMIT 1`,
        [session.userId],
      );
      if (!talent.rowCount) return res.status(404).json({ error: "Ingen talent-profil ennå" });

      const { state, nonce, codeVerifier } = await createAuthState(pool, {
        userId: session.userId,
        provider,
        intent: "verify",
        returnPath,
      });

      const client = await import("openid-client");
      const oidc = await getOidcConfig(config.issuer, config.clientId, config.clientSecret);
      const settings = PROVIDER_SETTINGS[provider];

      const authorizeUrl = client.buildAuthorizationUrl(oidc, {
        redirect_uri: config.redirectUri,
        scope: settings.scope,
        acr_values: settings.acrValues,
        state,
        nonce,
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: "S256",
      });

      return res.json({ authorizeUrl: authorizeUrl.href });
    } catch (err) {
      console.error("[eid/start] failed", err);
      await logAuthEvent(pool, {
        userId: session.userId,
        provider,
        intent: "verify",
        outcome: "failed",
        failureReason: "start_failed",
      });
      return res.status(500).json({ error: "start_failed" });
    }
  });

  // ── GET /eid/callback ───────────────────────────────────────────────
  //
  // Brokeren sender brukeren hit. Vi bytter kode mot token, henter
  // fødselsnummeret ut av claimene, hasher det og skriver identiteten.
  // Brukeren ender alltid på en side — aldri på rå JSON.
  app.get("/api/role-room/eid/callback", async (req, res) => {
    const origin = getPublicOrigin().replace(/\/$/, "");
    const fail = (reason: string, path = "/talents/profiles") =>
      res.redirect(`${origin}${path}?eid=feil&grunn=${encodeURIComponent(reason)}`);

    const config = readEidConfig();
    if (!config) return fail("ikke_konfigurert");

    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!state) return fail("mangler_state");

    // Engangsbruk. Ukjent, utløpt og allerede brukt behandles likt.
    const stored = await consumeAuthState(pool, state);
    if (!stored) return fail("ugyldig_state");

    const returnPath = safeReturnPath(stored.return_path) ?? "/talents/profiles";

    try {
      const client = await import("openid-client");
      const oidc = await getOidcConfig(config.issuer, config.clientId, config.clientSecret);

      const currentUrl = new URL(`${config.redirectUri}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
      const tokens = await client.authorizationCodeGrant(oidc, currentUrl, {
        pkceCodeVerifier: stored.code_verifier,
        expectedNonce: stored.nonce,
        expectedState: state,
      });

      const claims = (tokens.claims() ?? {}) as Record<string, unknown>;
      // Diagnose uten å skrive persondata: nøklene, aldri verdiene.
      console.log("[eid/callback] claim-nøkler:", Object.keys(claims).join(","));

      const settings = PROVIDER_SETTINGS[stored.provider];
      const ssnRaw = claims[settings.ssnClaim];
      const ssn = typeof ssnRaw === "string" ? ssnRaw.replace(/\D/g, "") : "";

      if (ssn.length !== 11) {
        // Nesten alltid samme årsak: scope er satt, men fødselsnummer er ikke
        // aktivert i brokerens dashbord. Uten fnr har vi ingen kontonøkkel.
        await logAuthEvent(pool, {
          userId: stored.user_id,
          provider: stored.provider,
          intent: stored.intent,
          outcome: "failed",
          failureReason: "missing_ssn_claim",
        });
        return fail("mangler_fodselsnummer", returnPath);
      }

      const written = await writeIdentity(pool, {
        userId: stored.user_id,
        provider: stored.provider,
        ssnHash: hashSsn(ssn, config.ssnPepper),
        ssnHashKind: "ssn",
        providerSub: typeof claims.sub === "string" ? claims.sub : null,
        verifiedName: typeof claims.name === "string" ? claims.name : null,
        birthYear: birthYearFromSsn(ssn),
      });

      if (!written.ok) {
        await logAuthEvent(pool, {
          userId: stored.user_id,
          provider: stored.provider,
          intent: stored.intent,
          outcome: "failed",
          failureReason: written.reason,
        });
        // «Denne identiteten er allerede brukt» er en reell tilstand: én
        // person skal ikke ha to talent-profiler.
        return fail(written.reason === "ssn_taken" ? "allerede_verifisert" : "svakere_bevis", returnPath);
      }

      await markTalentVerified(pool, stored.user_id);
      await logAuthEvent(pool, {
        userId: stored.user_id,
        provider: stored.provider,
        intent: stored.intent,
        outcome: "completed",
      });

      return res.redirect(`${origin}${returnPath}?eid=verifisert`);
    } catch (err) {
      console.error("[eid/callback] failed", err);
      await logAuthEvent(pool, {
        userId: stored.user_id,
        provider: stored.provider,
        intent: stored.intent,
        outcome: "failed",
        failureReason: "callback_failed",
      });
      return fail("verifisering_feilet", returnPath);
    }
  });
}
