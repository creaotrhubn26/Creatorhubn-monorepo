/**
 * leadgrid-demo-request-routes.ts
 *
 * «Book demo»-flyten fra leadgrid.no: en interessent booker en demo ved å
 * legge igjen navn, e-post, firma og et ønsket tidspunkt/notat. Blir en LEAD
 * (ikke en konto) — salg tar kontakt for å avtale.
 *
 * OFFENTLIG endepunkt (landing har ingen sesjon). Speiler
 * leadgrid-signup-interest-routes: lat ensureSchema, alltid samme svar,
 * lengde-cap, best-effort e-postvarsel til salg.
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
    CREATE TABLE IF NOT EXISTS leadgrid_demo_requests (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      preferred TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      contacted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  schemaReady = true;
}

export function registerLeadgridDemoRequestRoutes(deps: { app: Express; pool: Pool }) {
  const { app, pool } = deps;

  app.post("/api/leadgrid/demo-request", async (req, res) => {
    try {
      await ensureSchema(pool);
      const email = clip(req.body?.email, 320).toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
      const name = clip(req.body?.name, 120);
      const company = clip(req.body?.company, 160);
      const preferred = clip(req.body?.preferred, 160);
      const note = clip(req.body?.note, 1000);

      await pool.query(
        `INSERT INTO leadgrid_demo_requests (id, name, email, company, preferred, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [(globalThis.crypto as any).randomUUID(), name, email, company, preferred, note],
      );

      // Løftet er «vi tar kontakt for å avtale demo» → salg må varsles.
      const notify = process.env.LEADGRID_SIGNUP_NOTIFY_EMAIL || "daniel@creatorhubn.com";
      if (notify && isEmailConfigured()) {
        void sendEmail({
          to: notify,
          subject: `Ny demo-forespørsel: ${company || email}`,
          html: `<p>Ny <b>demo-forespørsel</b> fra leadgrid.no:</p>
                 <table style="font-size:15px;line-height:1.6">
                   <tr><td><b>Navn</b></td><td>&nbsp;${name || "—"}</td></tr>
                   <tr><td><b>E-post</b></td><td>&nbsp;${email}</td></tr>
                   <tr><td><b>Firma</b></td><td>&nbsp;${company || "—"}</td></tr>
                   <tr><td><b>Ønsket tid</b></td><td>&nbsp;${preferred || "—"}</td></tr>
                 </table>
                 ${note ? `<p><b>Notat:</b><br>${note.replace(/</g, "&lt;")}</p>` : ""}
                 <p>Ta kontakt for å avtale.</p>`,
          fromName: "Leadgrid",
        }).catch(() => { /* varsling er best-effort — forespørselen er lagret */ });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-demo] failed:", (err as Error).message);
      return res.status(500).json({ error: "demo_request_failed" });
    }
  });
}
