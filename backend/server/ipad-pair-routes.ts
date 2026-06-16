/**
 * ipad-pair-routes.ts
 *
 * 2-endepunkts pairing-flow for iPad-apper (LeadMapApp, fremtidige).
 *
 * Brukeren (web, autentisert) genererer en kort-levd kode via
 * POST /api/admin-room/ipad-tokens/generate. Koden vises som QR + tekst.
 * iPad-en (kun upairet versjon) bytter koden mot et permanent bearer-
 * token via POST /api/ipad-tokens/exchange.
 *
 * Bearer-tokenet havner i persistent_auth_sessions (mig 280) så det
 * overlever Render-restart.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { persistSession } from "./persistent-session-store.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

/**
 * Generer kort-levd kode for å pairing en iPad. Krever at brukeren
 * er innlogget i web (eier kontoen iPad'en skal kobles til).
 */
function generateShortCode(): string {
  // 8 tegn, store bokstaver + tall (unngår ambivalente: 0/O, 1/I/L)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  // Format som XXXX-XXXX for lesbarhet
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function registerIpadPairRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── POST /admin-room/ipad-tokens/generate ──
  app.post(
    "/api/admin-room/ipad-tokens/generate",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
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
             token, short_code, user_id, email, expires_at
           ) VALUES (
             $1, $2, $3, $4, NOW() + INTERVAL '5 minutes'
           )`,
          [longToken, shortCode, session.userId, session.email ?? null],
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
        return res.status(500).json({ error: "generate_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /admin-room/ipad-tokens/recent ──
  // Liste over siste 10 pair-attempts for audit/visning i web
  app.get(
    "/api/admin-room/ipad-tokens/recent",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
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
        return res.status(500).json({ error: "list_failed", detail: String(err) });
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
      try {
        const lookup = pairToken
          ? await pool.query<{ token: string; user_id: string; email: string | null; expires_at: string; used_at: string | null }>(
              `SELECT token, user_id, email, expires_at::text, used_at::text
                 FROM ipad_pair_tokens WHERE token = $1`,
              [pairToken],
            )
          : await pool.query<{ token: string; user_id: string; email: string | null; expires_at: string; used_at: string | null }>(
              `SELECT token, user_id, email, expires_at::text, used_at::text
                 FROM ipad_pair_tokens WHERE short_code = $1`,
              [shortCode],
            );
        if (lookup.rows.length === 0) {
          return res.status(404).json({ error: "ukjent_kode" });
        }
        const row = lookup.rows[0];
        if (row.used_at) {
          return res.status(409).json({ error: "kode_allerede_brukt" });
        }
        if (new Date(row.expires_at) < new Date()) {
          return res.status(410).json({ error: "kode_utlopt" });
        }

        // Opprett permanent bearer
        const bearer = crypto.randomBytes(32).toString("hex");
        const sessionData = {
          userId: row.user_id,
          email: row.email ?? undefined,
          role: "ipad",
        };
        activeSessions.set(bearer, sessionData);
        await persistSession(pool, {
          token: bearer,
          session: sessionData,
          source: "ipad_pair",
          ttlDays: 365, // iPad-tokens varer lenge — bruker logger ut manuelt
          ip: (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? "") ||
              req.socket?.remoteAddress || undefined,
          userAgent: req.headers["user-agent"] as string | undefined,
          meta: { deviceInfo: body.deviceInfo ?? {} },
        });

        // Marker pair-token som brukt
        await pool.query(
          `UPDATE ipad_pair_tokens
              SET used_at = NOW(),
                  device_info = $2::jsonb
            WHERE token = $1`,
          [row.token, JSON.stringify(body.deviceInfo ?? {})],
        );

        return res.json({
          bearer,
          user: {
            id: row.user_id,
            email: row.email,
          },
        });
      } catch (err) {
        return res.status(500).json({ error: "exchange_failed", detail: String(err) });
      }
    },
  );
}
