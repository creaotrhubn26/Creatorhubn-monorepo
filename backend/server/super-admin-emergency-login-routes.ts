/**
 * super-admin-emergency-login-routes.ts
 *
 * Nød-login for Super Admin når Google-OAuth-flyten er ødelagt.
 *
 * Hvorfor: 2026-06-14 viste Daniels prod-session at cookies + token +
 * user-obj alle var tomme — backend setter aldri session-cookie i
 * Google-OAuth-callback. Vi trenger en pragmatisk vei rundt mens vi
 * fikser OAuth-flyten.
 *
 * Sikkerhet:
 *  - Krever env-varene SUPER_ADMIN_EMERGENCY_TOKEN og
 *    SUPER_ADMIN_EMERGENCY_EMAIL
 *  - Brukeren må fortsatt være aktiv super_admin i databasen
 *  - Rate-limit: én login per minutt per IP
 *  - Logger ALT i admin_activity_log
 *
 * Returns: { token, user } — frontend lagrer token i localStorage og
 * inkluderer i Bearer-header på alle admin-kall.
 */

import type { Express, Request } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { persistAuthSessionInTransaction } from "./auth-session-store.js";

type SessionData = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  authSessionVersion: string;
  isAdmin: boolean;
};

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: { set: (token: string, session: SessionData) => unknown };
  persistCanonicalSession?: typeof persistAuthSessionInTransaction;
  resolveClientIp?: (req: Request) => string;
}

// Naive rate-limit: ett forsøk per minutt per IP
const lastAttempt = new Map<string, number>();

// Never trust a caller-controlled forwarding header by default. Deployments
// that have an exact proxy topology can inject a vetted resolver through the
// route dependency without coupling emergency auth to self-onboarding code.
const resolveSocketClientIp = (req: Request): string =>
  req.socket?.remoteAddress?.trim() || "unknown";

export function registerSuperAdminEmergencyLoginRoutes({
  app,
  pool,
  activeSessions,
  persistCanonicalSession = persistAuthSessionInTransaction,
  resolveClientIp = resolveSocketClientIp,
}: Deps): void {
  app.post("/api/super-admin/emergency-login", async (req, res) => {
    const ip = resolveClientIp(req);

    const last = lastAttempt.get(ip) ?? 0;
    if (Date.now() - last < 60_000) {
      return res.status(429).json({ error: "for_mange_forsøk" });
    }
    lastAttempt.set(ip, Date.now());

    const expected = process.env.SUPER_ADMIN_EMERGENCY_TOKEN;
    const expectedEmail = process.env.SUPER_ADMIN_EMERGENCY_EMAIL
      ?.trim()
      .toLowerCase();
    if (!expected || expected.length < 32 || !expectedEmail) {
      console.error("[emergency-login] emergency credential er ikke konfigurert");
      return res.status(503).json({ error: "ikke_konfigurert" });
    }

    const body = (req.body ?? {}) as { token?: string; email?: string };
    if (!body.token || !body.email) {
      return res.status(400).json({ error: "mangler_token_eller_email" });
    }
    if (body.email.trim().toLowerCase() !== expectedEmail) {
      return res.status(403).json({ error: "ugyldig_legitimasjon" });
    }

    // Konstant-tids-sjekk for å unngå timing-leak
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(body.token);
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return res.status(403).json({ error: "ugyldig_legitimasjon" });
    }

    // Resolve the configured identity from the database; env never grants role.
    try {
      const userResult = await pool.query<{
        id: string;
        email: string;
        name: string | null;
        role: string | null;
        is_active: boolean;
        auth_session_version: string;
      }>(
        `SELECT id::text, email::text,
                COALESCE(
                  NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                  email::text
                )::text AS name,
                role::text,
                COALESCE(is_active, TRUE) AS is_active,
                auth_session_version::text AS auth_session_version
           FROM users
          WHERE LOWER(email) = $1
          LIMIT 1`,
        [expectedEmail],
      );
      const user = userResult.rows[0];
      if (!user || user.is_active !== true || user.role !== "super_admin") {
        return res.status(403).json({ error: "ugyldig_superadmin" });
      }

      // Generer ny session-token
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionData = {
        userId: user.id,
        email: user.email,
        name: user.name?.trim() || user.email,
        role: user.role,
        loginAt: new Date().toISOString(),
        authSessionVersion: String(user.auth_session_version),
        isAdmin: true,
      };
      try {
        await persistCanonicalSession(pool, sessionToken, sessionData);
      } catch (error) {
        console.error("[emergency-login] canonical session persistence failed", error);
        return res.status(503).json({ error: "session_store_unavailable" });
      }
      // Cache only after the canonical write has committed successfully.
      activeSessions.set(sessionToken, sessionData);

      // Logg aktiviteten
      try {
        await pool.query(
          `INSERT INTO admin_activity_log (user_id, entity_type, entity_id, action, summary, details)
           VALUES ($1, 'auth', $2, 'emergency_login', $3, $4::jsonb)`,
          [
            user.id,
            crypto.createHash("sha256").update(sessionToken).digest("hex").slice(0, 12),
            "Emergency login via super-admin-bypass",
            JSON.stringify({ ip, timestamp: new Date().toISOString() }),
          ],
        );
      } catch (logErr) {
        console.warn("[emergency-login] kunne ikke logge aktivitet:", logErr);
      }

      return res.json({
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: sessionData.name,
          role: user.role,
        },
      });
    } catch (err) {
      console.error("[emergency-login] failed", err);
      return res.status(500).json({ error: "login_feilet" });
    }
  });
}
