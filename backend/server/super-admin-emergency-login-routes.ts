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
 *  - Krever env-var SUPER_ADMIN_EMERGENCY_TOKEN (hemmelighet kun Daniel har)
 *  - Email MÅ være daniel@creatorhubn.com (hardkodet)
 *  - Rate-limit: én login per minutt per IP
 *  - Logger ALT i admin_activity_log
 *
 * Returns: { token, user } — frontend lagrer token i localStorage og
 * inkluderer i Bearer-header på alle admin-kall.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { persistSession } from "./persistent-session-store.js";

const SUPER_ADMIN_EMAIL = "daniel@creatorhubn.com";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// Naive rate-limit: ett forsøk per minutt per IP
const lastAttempt = new Map<string, number>();

export function registerSuperAdminEmergencyLoginRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  app.post("/api/super-admin/emergency-login", async (req, res) => {
    const ip =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? "") ||
      req.socket?.remoteAddress ||
      "unknown";

    const last = lastAttempt.get(ip) ?? 0;
    if (Date.now() - last < 60_000) {
      return res.status(429).json({ error: "for_mange_forsøk" });
    }
    lastAttempt.set(ip, Date.now());

    const expected = process.env.SUPER_ADMIN_EMERGENCY_TOKEN;
    if (!expected || expected.length < 16) {
      console.error("[emergency-login] SUPER_ADMIN_EMERGENCY_TOKEN ikke satt eller for kort");
      return res.status(500).json({ error: "ikke_konfigurert" });
    }

    const body = (req.body ?? {}) as { token?: string; email?: string };
    if (!body.token || !body.email) {
      return res.status(400).json({ error: "mangler_token_eller_email" });
    }
    if (body.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: "feil_email" });
    }

    // Konstant-tids-sjekk for å unngå timing-leak
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(body.token);
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return res.status(403).json({ error: "feil_token" });
    }

    // Finn Daniels user-id i users-tabellen
    try {
      const userResult = await pool.query<{ id: string; email: string }>(
        `SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [SUPER_ADMIN_EMAIL],
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "bruker_ikke_funnet" });
      }
      const user = userResult.rows[0];

      // Generer ny session-token
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionData = {
        userId: user.id,
        email: user.email,
        role: "admin",
      };
      activeSessions.set(sessionToken, sessionData);

      // Persistér til DB så sessionen overlever Render-restart.
      // Best-effort: hvis DB skriv feiler logger vi men returnerer
      // fortsatt token (in-memory holder fortsatt på denne instansen).
      void persistSession(pool, {
        token: sessionToken,
        session: sessionData,
        source: "emergency_login",
        ttlDays: 30,
        ip,
        userAgent: req.headers["user-agent"] as string | undefined,
      });

      // Logg aktiviteten
      try {
        await pool.query(
          `INSERT INTO admin_activity_log (user_id, entity_type, entity_id, action, summary, details)
           VALUES ($1, 'auth', $2, 'emergency_login', $3, $4::jsonb)`,
          [
            user.id,
            sessionToken.slice(0, 8),
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
          role: "admin",
        },
      });
    } catch (err) {
      console.error("[emergency-login] failed", err);
      return res.status(500).json({ error: "login_feilet", detail: String(err) });
    }
  });
}
