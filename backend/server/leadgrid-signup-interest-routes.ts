/**
 * leadgrid-signup-interest-routes.ts
 *
 * «Kom i gang»-flyten fra Leadgrid-appens login-skjerm: en interessent
 * skriver inn e-posten sin og blir en LEAD for Leadgrid (ikke en konto —
 * kontoer opprettes via onboarding etter at salg har tatt kontakt).
 *
 * OFFENTLIG endepunkt (login-skjermen har ingen sesjon) → minimal flate:
 * kun e-post inn, alltid samme svar (ingen enumerering), dedupe på e-post,
 * lengde-cap. Nettside: leadgrid.no.
 */

import type { Express } from "express";
import type { Pool } from "pg";
import { sendEmail, isEmailConfigured } from "./casting-reminder-sender.js";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_signup_leads (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'app_login',
      contacted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_signup_email
       ON leadgrid_signup_leads (lower(email))`,
  );
  schemaReady = true;
}

export function registerLeadgridSignupInterestRoutes(deps: { app: Express; pool: Pool }) {
  const { app, pool } = deps;

  app.post("/api/leadgrid/signup-interest", async (req, res) => {
    try {
      await ensureSchema(pool);
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
      const source = ["app_login", "web"].includes(String(req.body?.source))
        ? String(req.body.source) : "app_login";
      const inserted = await pool.query(
        `INSERT INTO leadgrid_signup_leads (id, email, source)
         VALUES ($1, $2, $3)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [(globalThis.crypto as any).randomUUID(), email, source],
      );
      // Løftet i appen er «vi tar kontakt» — da må salg få vite om leaden.
      // Varsle kun for NYE leads (rowCount=1), mottaker styres av env.
      const notify = process.env.LEADGRID_SIGNUP_NOTIFY_EMAIL || "";
      if ((inserted.rowCount ?? 0) > 0 && notify && isEmailConfigured()) {
        void sendEmail({
          to: notify,
          subject: "Ny Leadgrid-interessent (Kom i gang)",
          html: `<p>Ny interessent fra ${source === "app_login" ? "app-login-skjermen" : source}:</p>
                 <p style="font-size:16px"><b>${email}</b></p>
                 <p>De forventer å bli kontaktet for å komme i gang med Leadgrid.</p>`,
          fromName: "Leadgrid",
        }).catch(() => { /* varsling er best-effort — leaden er lagret */ });
      }
      // Alltid ok — samme svar for ny og eksisterende (ingen enumerering).
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-signup] failed:", (err as Error).message);
      return res.status(500).json({ error: "signup_failed" });
    }
  });
}
