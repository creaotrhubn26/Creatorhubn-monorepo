/**
 * ipad-pair-routes.ts
 *
 * 2-endepunkts pairing-flow for iPad-apper (LeadMapApp, fremtidige).
 *
 * Brukeren (web, autentisert) genererer en kort-levd kode via
 * POST /api/admin-room/ipad-tokens/generate. Koden vises som QR + tekst.
 * iPad-en (kun upairet versjon) bytter koden mot et langlevd bearer-
 * token via POST /api/ipad-tokens/exchange.
 *
 * Bearer-tokenet havner i den canonical creatorhub_auth_sessions-tabellen
 * med en snapshot av gjeldende brukerautoritet, så det overlever restart og
 * kan revokeres med auth_session_version.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { persistAuthSessionInTransaction } from "./auth-session-store.js";
import {
  normalizeAuthSessionVersion,
  type AuthoritativeSessionRequestResolver,
} from "./auth-session-authority.js";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
  name?: string;
  loginAt?: string;
  authSessionVersion?: string;
  isAdmin?: boolean;
};
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  resolveAuthoritativeSession: AuthoritativeSessionRequestResolver;
  persistCanonicalSession?: typeof persistAuthSessionInTransaction;
}

async function requireAuthoritativeUser(
  req: Request,
  res: Response,
  resolveSession: AuthoritativeSessionRequestResolver,
): Promise<SessionData | null> {
  let resolution: Awaited<ReturnType<AuthoritativeSessionRequestResolver>>;
  try {
    resolution = await resolveSession(req);
  } catch {
    res.status(503).json({ error: "session_authority_unavailable" });
    return null;
  }
  if (resolution.status === "unavailable") {
    res.status(503).json({ error: "session_authority_unavailable" });
    return null;
  }
  if (resolution.status !== "authenticated") {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  }
  return resolution.session as SessionData;
}

/**
 * Generer kort-levd kode for å pairing en iPad. Krever at brukeren
 * er innlogget i web (eier kontoen iPad'en skal kobles til).
 */
function generateShortCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[crypto.randomInt(chars.length)];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function registerIpadPairRoutes({
  app,
  pool,
  activeSessions,
  resolveAuthoritativeSession,
  persistCanonicalSession = persistAuthSessionInTransaction,
}: Deps): void {
  // ─── POST /admin-room/ipad-tokens/generate ──
  app.post(
    "/api/admin-room/ipad-tokens/generate",
    async (req: Request, res: Response) => {
      const session = await requireAuthoritativeUser(
        req,
        res,
        resolveAuthoritativeSession,
      );
      if (!session?.userId) return;
      const authSessionVersion = normalizeAuthSessionVersion(
        session.authSessionVersion,
      );
      if (authSessionVersion === null) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      try {
        const longToken = crypto.randomBytes(32).toString("base64url");
        let shortCode = generateShortCode();
        // Sjekk kollisjon (svært usannsynlig men gratis å verifisere)
        for (let attempt = 0; attempt < 5; attempt++) {
          const dup = await pool.query(
            `SELECT 1 FROM ipad_pair_tokens WHERE short_code = $1 AND used_at IS NULL LIMIT 1`,
            [shortCode],
          );
          if (dup.rows.length === 0) break;
          shortCode = generateShortCode();
        }
        await pool.query(
          `INSERT INTO ipad_pair_tokens (
             token, short_code, user_id, email, auth_session_version, expires_at
           ) VALUES (
             $1, $2, $3, $4, $5::bigint, NOW() + INTERVAL '5 minutes'
           )`,
          [
            longToken,
            shortCode,
            session.userId,
            session.email ?? null,
            authSessionVersion,
          ],
        );
        return res.json({
          token: longToken,
          shortCode,
          expiresInSeconds: 300,
          // Også returner et QR-payload-format som iPad-appen kan parse:
          // ROLE-ROOM-PAIR:<token>
          qrPayload: `ROLE-ROOM-PAIR:${longToken}`,
        });
      } catch (err) {
        return res.status(500).json({ error: "generate_failed", detail: "internal_error" });
      }
    },
  );

  // ─── GET /admin-room/ipad-tokens/recent ──
  // Liste over siste 10 pair-attempts for audit/visning i web
  app.get(
    "/api/admin-room/ipad-tokens/recent",
    async (req: Request, res: Response) => {
      const session = await requireAuthoritativeUser(
        req,
        res,
        resolveAuthoritativeSession,
      );
      if (!session?.userId) return;
      try {
        const r = await pool.query<{
          short_code: string;
          created_at: string;
          used_at: string | null;
          expires_at: string;
          device_info: Record<string, unknown> | null;
        }>(
          `SELECT short_code, created_at::text, used_at::text, expires_at::text, device_info
             FROM ipad_pair_tokens
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10`,
          [session.userId],
        );
        return res.json({
          tokens: r.rows.map((row) => ({
            shortCode: row.short_code,
            createdAt: row.created_at,
            usedAt: row.used_at,
            expiresAt: row.expires_at,
            deviceInfo: row.device_info,
            status: row.used_at ? "claimed" :
              new Date(row.expires_at) < new Date() ? "expired" : "pending",
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /ipad-tokens/exchange ──
  // Bytter pair-token mot permanent bearer. Ingen auth-krav — iPad-en
  // er per definisjon ikke logget inn ennå.
  app.post(
    "/api/ipad-tokens/exchange",
    async (req: Request, res: Response) => {
      const body = req.body as {
        token?: string;
        shortCode?: string;
        deviceInfo?: {
          model?: string;
          osVersion?: string;
          appVersion?: string;
          deviceName?: string;
        };
      };
      // Aksepter enten full token eller kort kode
      const pairToken = body.token?.trim();
      const shortCode = body.shortCode?.trim().toUpperCase().replace(/\s/g, "");
      if (!pairToken && !shortCode) {
        return res.status(400).json({ error: "token_eller_shortCode_kreves" });
      }
      const client = await pool.connect().catch(() => null);
      if (!client) {
        return res.status(503).json({ error: "session_store_unavailable" });
      }

      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        const lookup = pairToken
          ? await client.query<{ token: string; user_id: string; issued_auth_session_version: string | number | bigint | null; expires_at: string; used_at: string | null }>(
              `SELECT token, user_id,
                      auth_session_version::text AS issued_auth_session_version,
                      expires_at::text, used_at::text
                 FROM ipad_pair_tokens WHERE token = $1
                 FOR UPDATE`,
              [pairToken],
            )
          : await client.query<{ token: string; user_id: string; issued_auth_session_version: string | number | bigint | null; expires_at: string; used_at: string | null }>(
              `SELECT token, user_id,
                      auth_session_version::text AS issued_auth_session_version,
                      expires_at::text, used_at::text
                 FROM ipad_pair_tokens WHERE short_code = $1
                 FOR UPDATE`,
              [shortCode],
            );
        if (lookup.rows.length === 0) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(404).json({ error: "ukjent_kode" });
        }
        const row = lookup.rows[0];
        if (row.used_at) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(409).json({ error: "kode_allerede_brukt" });
        }
        if (new Date(row.expires_at) < new Date()) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(410).json({ error: "kode_utlopt" });
        }

        // Konsumer pair-token ATOMISK før vi minter noe. `used_at IS NULL`-
        // guarden gjør at bare ÉN samtidig exchange-request vinner kappløpet;
        // uten dette kunne to parallelle requests med samme kode begge passere
        // used_at-sjekken over og hver minte et langlevd bearer på kontoen
        // (én engangs-kode → flere sesjoner). Taperen får 0 rader tilbake og
        // avvises.
        const claim = await client.query(
          `UPDATE ipad_pair_tokens
              SET used_at = NOW(),
                  device_info = $2::jsonb
            WHERE token = $1
              AND used_at IS NULL
              AND expires_at > NOW()
            RETURNING token`,
          [row.token, JSON.stringify(body.deviceInfo ?? {})],
        );
        if (claim.rows.length === 0) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(409).json({ error: "kode_allerede_brukt" });
        }

        // Pairing-raden er ikke autoritet for rolle/status. Hent og lås den
        // gjeldende brukeren i samme transaksjon som engangskoden konsumeres.
        const userResult = await client.query<{
          id: string;
          email: string;
          name: string | null;
          role: string;
          is_active: boolean;
          auth_session_version: string | number | bigint | null;
        }>(
          `SELECT id::text, email::text,
                  COALESCE(
                    NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                    email::text
                  )::text AS name,
                  COALESCE(NULLIF(TRIM(role::text), ''), 'user') AS role,
                  COALESCE(is_active, TRUE) AS is_active,
                  auth_session_version::text AS auth_session_version
             FROM users
            WHERE id::text = $1
            LIMIT 1
            FOR SHARE`,
          [row.user_id],
        );
        const user = userResult.rows[0];
        if (!user || user.is_active !== true) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(403).json({ error: "bruker_ikke_aktiv" });
        }

        const email = user.email?.trim();
        const role = user.role?.trim();
        const authSessionVersion = normalizeAuthSessionVersion(
          user.auth_session_version,
        );
        const pairingAuthSessionVersion = normalizeAuthSessionVersion(
          row.issued_auth_session_version,
        );
        if (!email || !role || authSessionVersion === null) {
          throw new Error("invalid_user_authority_snapshot");
        }
        if (
          pairingAuthSessionVersion === null ||
          pairingAuthSessionVersion !== authSessionVersion
        ) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(410).json({ error: "pairing_authority_changed" });
        }

        // Kun vinneren av claimet minter bearer. Canonical persistence skjer
        // før COMMIT, cache og response; feil ruller også used_at tilbake.
        const bearer = crypto.randomBytes(32).toString("hex");
        const sessionData = {
          userId: user.id,
          email,
          name: user.name?.trim() || email,
          role,
          loginAt: new Date().toISOString(),
          authSessionVersion,
          isAdmin: role === "admin" || role === "super_admin",
        };
        await persistCanonicalSession(client, bearer, sessionData);
        await client.query("COMMIT");
        transactionOpen = false;

        activeSessions.set(bearer, sessionData);

        return res.json({
          bearer,
          user: {
            id: user.id,
            email,
            name: sessionData.name,
            role,
          },
        });
      } catch (err) {
        if (transactionOpen) {
          await client.query("ROLLBACK").catch(() => undefined);
        }
        console.error("[ipad-pair] canonical exchange failed");
        return res.status(503).json({ error: "session_store_unavailable" });
      } finally {
        client.release();
      }
    },
  );
}
