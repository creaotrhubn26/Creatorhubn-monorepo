/**
 * leadgrid-app-waitlist-routes.ts
 *
 * Leadgrid-appen (iOS) er i TestFlight, ikke live på App Store ennå.
 * Header-lenken som før pekte "Logg inn" til creatorhubn.com peker nå til
 * en venteliste-modal — besøkende legger igjen e-post og varsles ved
 * App Store-lansering. Speiler leadgrid-demo-request-routes: lat
 * ensureSchema, offentlig endepunkt (landing har ingen sesjon).
 *
 * Lanserings-utsendelse (admin): POST /api/leadgrid/app-waitlist/notify-launch
 * med { appStoreUrl } sender "appen er live"-e-post til alle upvarslede i
 * ventelisten, én om gangen med kort pause (Gmail SMTP — unngå burst/spam-
 * flagging). Idempotent: markerer notified_at per vellykket sending, så et
 * gjentatt kall (f.eks. etter en delvis feil) bare tar de resterende.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { sendEmail, isEmailConfigured } from "./casting-reminder-sender.js";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SessionData = { userId: string; role?: string; email?: string };

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_app_waitlist (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE leadgrid_app_waitlist ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`);
  schemaReady = true;
}

export function registerLeadgridAppWaitlistRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}) {
  const { app, pool, activeSessions, isAdminEmail } = deps;

  function requireAdmin(req: Request, res: Response): SessionData | null {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    const session = token ? activeSessions.get(token) ?? null : null;
    if (!session) {
      res.status(401).json({ error: "ikke_innlogget" });
      return null;
    }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    return session;
  }

  app.post("/api/leadgrid/app-waitlist", async (req, res) => {
    try {
      await ensureSchema(pool);
      const email = clip(req.body?.email, 320).toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });

      await pool.query(
        `INSERT INTO leadgrid_app_waitlist (id, email) VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [(globalThis.crypto as any).randomUUID(), email],
      );

      const notify = process.env.LEADGRID_SIGNUP_NOTIFY_EMAIL || "daniel@creatorhubn.com";
      if (notify && isEmailConfigured()) {
        void sendEmail({
          to: notify,
          subject: `Ny app-venteliste-påmelding: ${email}`,
          html: `<p>Ny påmelding til <b>Leadgrid App Store-venteliste</b>: ${email}</p>`,
          fromName: "Leadgrid",
        }).catch(() => { /* varsling er best-effort — påmeldingen er lagret */ });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-app-waitlist] failed:", (err as Error).message);
      return res.status(500).json({ error: "waitlist_failed" });
    }
  });

  // ── Status (admin) — antall totalt / upvarslet, for å sjekke før man trigger. ──
  app.get("/api/leadgrid/app-waitlist/status", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE notified_at IS NULL)::int AS pending
           FROM leadgrid_app_waitlist`,
      );
      return res.json({ total: r.rows[0].total, pending: r.rows[0].pending });
    } catch (err) {
      return res.status(500).json({ error: "status_failed", detail: (err as Error).message });
    }
  });

  // ── Lanserings-utsendelse (admin) ──────────────────────────────────
  app.post("/api/leadgrid/app-waitlist/notify-launch", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const appStoreUrl = clip(req.body?.appStoreUrl, 500);
    if (!/^https:\/\/apps\.apple\.com\//.test(appStoreUrl)) {
      return res.status(400).json({ error: "invalid_app_store_url" });
    }
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: "email_not_configured" });
    }
    try {
      await ensureSchema(pool);
      const pending = await pool.query<{ id: string; email: string }>(
        `SELECT id, email FROM leadgrid_app_waitlist WHERE notified_at IS NULL ORDER BY created_at ASC`,
      );
      let sent = 0;
      let failed = 0;
      for (const row of pending.rows) {
        const result = await sendEmail({
          to: row.email,
          subject: "Leadgrid er nå på App Store",
          html: `<p>Hei!</p>
                 <p>Leadgrid-appen for iPhone/iPad er nå live på App Store — takk for at du ventet.</p>
                 <p><a href="${appStoreUrl}">Last ned Leadgrid på App Store</a></p>`,
          fromName: "Leadgrid",
        });
        if (result.success) {
          sent += 1;
          await pool.query(`UPDATE leadgrid_app_waitlist SET notified_at = now() WHERE id = $1`, [row.id]);
        } else {
          failed += 1;
          console.warn("[leadgrid-app-waitlist] send failed for", row.email, result.error);
        }
        // Kort pause mellom hver sending — Gmail SMTP flagger burst-utsendelse.
        await sleep(250);
      }
      return res.json({ ok: true, sent, failed, total: pending.rows.length });
    } catch (err) {
      return res.status(500).json({ error: "notify_launch_failed", detail: (err as Error).message });
    }
  });
}
