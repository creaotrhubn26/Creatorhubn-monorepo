/**
 * leadgrid-app-waitlist-routes.ts
 *
 * Leadgrid-appen (iOS) er i TestFlight, ikke live på App Store ennå.
 * Header-lenken som før pekte "Logg inn" til creatorhubn.com peker nå til
 * en venteliste-modal — besøkende legger igjen e-post og varsles ved
 * App Store-lansering. Speiler leadgrid-demo-request-routes: lat
 * ensureSchema, offentlig endepunkt (landing har ingen sesjon).
 */

import type { Express } from "express";
import type { Pool } from "pg";
import { sendEmail, isEmailConfigured } from "./casting-reminder-sender.js";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

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
  schemaReady = true;
}

export function registerLeadgridAppWaitlistRoutes(deps: { app: Express; pool: Pool }) {
  const { app, pool } = deps;

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
}
