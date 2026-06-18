/**
 * leadgrid-drips-routes.ts
 *
 * E-post-drypp etter aha-moment + grace-period-håndhevelse.
 *
 * To cron-trigger-endepunkter (auth: x-cron-trigger-token eller admin-session):
 *
 *   POST /api/leadgrid/drips/run
 *     Leser onboarding_drips m/ converted_at IS NULL AND unsubscribed_at IS NULL.
 *     For hver: sjekker hvilke dryp som er forfalt (dag 1, 3, 7, 14) og
 *     ikke sendt. Sender Resend-mail og oppdaterer dayN_sent_at.
 *
 *   POST /api/leadgrid/plan-grace/expire
 *     Sjekker plan_grace.expires_at < now() — orgs som var i grace
 *     etter downgrade. Lokker ut til Solo Free + sender notify-mail.
 *
 * Drypp-trigger settes av customer-auto-onboard når første vellykket
 * onboard fullføres (trigger_event='first_auto_onboard').
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN
                ?? process.env.MIGRATE_TRIGGER_TOKEN
                ?? "";

const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

function isCronAuthorized(req: Request, activeSessions: Map<string, SessionData>): boolean {
  const headerToken = req.headers["x-cron-trigger-token"] as string | undefined;
  if (headerToken && CRON_TOKEN && headerToken === CRON_TOKEN) return true;
  // Alternativ: admin-session
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.substring(7)
              : (req as any).cookies?.sessionToken;
  const s = token ? activeSessions.get(token) : null;
  return s?.role === "admin" || s?.role === "super_admin";
}

// ---------------------------------------------------------------------------
// Drypp-innhold
// ---------------------------------------------------------------------------

interface DripContent {
  subject: string;
  html: string;
  text: string;
}

const DRIPS: Record<1 | 3 | 7 | 14, (orgName: string, contactName: string | null) => DripContent> = {
  1: (orgName, name) => ({
    subject: `Hei${name ? ` ${name}` : ""} — slik utnytter du Leadgrid videre`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0512;color:#fff;">
        <h1 style="color:#a78bfa;font-size:24px;margin:0 0 16px;">Leadgrid</h1>
        <p>Hei${name ? ` ${name}` : ""},</p>
        <p>I går la du til din første kunde i ${orgName}. Vi tråler, plotter pins og finner muligheter — men gridden blir <strong>mye sterkere</strong> med flere kunder.</p>
        <p style="background:rgba(167,139,250,0.10);padding:16px;border-left:3px solid #a78bfa;border-radius:6px;margin:20px 0;">
          <strong style="color:#a78bfa;">Visste du:</strong><br/>
          Solo Pro gir deg 10 kunder + 30 auto-onboards/mnd — for 199 kr/mnd.
        </p>
        <p>
          <a href="${PUBLIC_BASE}/leadgrid" style="background:#a78bfa;color:#0a0512;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
            Se Solo Pro
          </a>
        </p>
        <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:32px;">
          Vil du ikke ha flere tips? <a href="${PUBLIC_BASE}/leadgrid/drips/unsubscribe" style="color:rgba(255,255,255,0.5);">Avregistrer</a>.
        </p>
      </div>`,
    text: `Hei${name ? ` ${name}` : ""},\n\nI går la du til din første kunde i ${orgName}. Solo Pro gir deg 10 kunder + 30 auto-onboards/mnd for 199 kr/mnd. Se mer: ${PUBLIC_BASE}/leadgrid`,
  }),
  3: (orgName, name) => ({
    subject: `${orgName} — har du sett klient-portalen?`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0512;color:#fff;">
        <h1 style="color:#a78bfa;font-size:24px;margin:0 0 16px;">Leadgrid</h1>
        <p>Hei${name ? ` ${name}` : ""},</p>
        <p>Tre dager inn — har du sjekket hvordan kunden din ser portalen sin?</p>
        <p>Hver kunde får en egen lenke (/c/{token}) hvor de ser:</p>
        <ul style="color:rgba(255,255,255,0.85);">
          <li>Sin Leadgrid-score (0–100)</li>
          <li>Behov vi har funnet — med 'Be om fokus'-checkbox</li>
          <li>Positive + negative signaler</li>
          <li>Live progress på leveranser</li>
        </ul>
        <p style="background:rgba(155,225,93,0.10);padding:16px;border-left:3px solid #9be15d;border-radius:6px;margin:20px 0;">
          <strong style="color:#9be15d;">Tips:</strong> Send portal-lenken direkte i e-post — kunden trenger ingen konto.
        </p>
        <p>
          <a href="${PUBLIC_BASE}/leadgrid" style="color:#a78bfa;text-decoration:underline;">Gå til Leadgrid →</a>
        </p>
      </div>`,
    text: `Hei${name ? ` ${name}` : ""},\n\nHar du sjekket kunde-portalen? Hver kunde får en egen lenke hvor de ser score, behov, signaler og live progress.\n\n${PUBLIC_BASE}/leadgrid`,
  }),
  7: (orgName, name) => ({
    subject: `En uke med Leadgrid — hva er neste steg?`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0512;color:#fff;">
        <h1 style="color:#a78bfa;font-size:24px;margin:0 0 16px;">Leadgrid</h1>
        <p>Hei${name ? ` ${name}` : ""},</p>
        <p>Du har brukt Leadgrid i én uke. Vi setter pris på at du gir oss en sjanse.</p>
        <p>Her er noen Pro-funksjoner du sannsynligvis vil ha glede av:</p>
        <div style="background:rgba(255,255,255,0.04);padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0 0 8px;"><strong>🔄 Automation rules</strong></p>
          <p style="margin:0 0 12px;color:rgba(255,255,255,0.7);font-size:14px;">IF status=interested THEN send SMS</p>
          <p style="margin:0 0 8px;"><strong>📋 Custom fields</strong></p>
          <p style="margin:0 0 12px;color:rgba(255,255,255,0.7);font-size:14px;">Lag egne datapunkter per kunde</p>
          <p style="margin:0 0 8px;"><strong>🎯 Pitch Deck Studio</strong></p>
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;">Generer pitch-decks som passer kunden</p>
        </div>
        <p>
          <a href="${PUBLIC_BASE}/leadgrid" style="background:#a78bfa;color:#0a0512;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
            Oppgrader til Solo Pro
          </a>
        </p>
        <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:32px;">
          Spørsmål? Svar på denne e-posten, så hjelper vi.
        </p>
      </div>`,
    text: `Hei${name ? ` ${name}` : ""},\n\nÉn uke med Leadgrid! Pro-funksjoner: Automation rules, Custom fields, Pitch Deck Studio.\n\nOppgrader: ${PUBLIC_BASE}/leadgrid`,
  }),
  14: (orgName, name) => ({
    subject: `Et siste tilbud — 30% rabatt første mnd Solo Pro`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0512;color:#fff;">
        <h1 style="color:#a78bfa;font-size:24px;margin:0 0 16px;">Leadgrid</h1>
        <p>Hei${name ? ` ${name}` : ""},</p>
        <p>To uker er gått. Hvis Leadgrid har gitt deg verdi, vil du spare tid og se mer ved å gå Pro:</p>
        <p style="background:linear-gradient(135deg,#a78bfa,#7ab8ff);padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
          <strong style="color:#0a0512;font-size:18px;">30% rabatt første måned</strong><br/>
          <span style="color:#0a0512;font-size:14px;">Kode: <strong>LEADGRID30</strong></span>
        </p>
        <p>Tilbudet gjelder i 7 dager.</p>
        <p>
          <a href="${PUBLIC_BASE}/leadgrid" style="background:#a78bfa;color:#0a0512;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
            Bruk koden nå
          </a>
        </p>
        <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:32px;">
          Vil du ikke ha flere tilbud? <a href="${PUBLIC_BASE}/leadgrid/drips/unsubscribe" style="color:rgba(255,255,255,0.5);">Avregistrer</a>.
        </p>
      </div>`,
    text: `Hei${name ? ` ${name}` : ""},\n\n30% rabatt første måned på Solo Pro. Kode: LEADGRID30. Gyldig i 7 dager.\n\n${PUBLIC_BASE}/leadgrid`,
  }),
};

// ---------------------------------------------------------------------------
// Helper: trigger drip (kalles fra customer-auto-onboard-routes)
// ---------------------------------------------------------------------------

export async function triggerOnboardingDrip(
  pool: Pool, opts: {
    userId: string;
    organizationId: string;
    triggerEvent: string;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO onboarding_drips (user_id, organization_id, trigger_event, triggered_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, trigger_event) DO NOTHING`,
      [opts.userId, opts.organizationId, opts.triggerEvent],
    );
  } catch (e) {
    console.error("[triggerOnboardingDrip]", e);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerLeadgridDripsRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Run drip-batch ----------
  app.post("/api/leadgrid/drips/run", async (req, res) => {
    if (!isCronAuthorized(req, activeSessions)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const start = Date.now();
    const results = { processed: 0, sent: 0, skipped: 0, errors: 0 };

    try {
      // Hent aktive drypp som ikke er konvertert eller avregistrert
      const rowsR = await pool.query<{
        id: string; user_id: string; organization_id: string;
        trigger_event: string; triggered_at: string;
        day1_sent_at: string | null; day3_sent_at: string | null;
        day7_sent_at: string | null; day14_sent_at: string | null;
        user_email: string; user_name: string | null;
        org_name: string;
      }>(
        `SELECT d.id, d.user_id, d.organization_id, d.trigger_event, d.triggered_at,
                d.day1_sent_at, d.day3_sent_at, d.day7_sent_at, d.day14_sent_at,
                u.email AS user_email, u.full_name AS user_name,
                o.name AS org_name
           FROM onboarding_drips d
           JOIN users u ON u.id = d.user_id
           JOIN organizations o ON o.id = d.organization_id
          WHERE d.converted_at IS NULL
            AND d.unsubscribed_at IS NULL
            -- Skip orgs på Pro+
            AND o.plan = 'solo_free'`,
      );

      for (const row of rowsR.rows) {
        results.processed++;
        const triggeredAt = new Date(row.triggered_at);
        const ageDays = (Date.now() - triggeredAt.getTime()) / (24 * 3600 * 1000);

        // Bestem hvilke dryp som skal sendes nå (≥ N dager + ikke sendt enda)
        const toSend: Array<1 | 3 | 7 | 14> = [];
        if (ageDays >= 1 && !row.day1_sent_at) toSend.push(1);
        if (ageDays >= 3 && !row.day3_sent_at) toSend.push(3);
        if (ageDays >= 7 && !row.day7_sent_at) toSend.push(7);
        if (ageDays >= 14 && !row.day14_sent_at) toSend.push(14);

        if (toSend.length === 0) { results.skipped++; continue; }

        for (const day of toSend) {
          try {
            const content = DRIPS[day](row.org_name, row.user_name);
            await sendTransactionalEmail({
              to: row.user_email,
              subject: content.subject,
              html: content.html,
              text: content.text,
              kind: `leadgrid_drip_day${day}`,
              pool,
            });
            await pool.query(
              `UPDATE onboarding_drips SET day${day}_sent_at = now() WHERE id = $1`,
              [row.id],
            );
            results.sent++;
          } catch (e) {
            console.error(`[drip-send day${day}]`, e);
            results.errors++;
          }
        }
      }

      res.json({ ok: true, duration_ms: Date.now() - start, ...results });
    } catch (e: any) {
      console.error("[drips run]", e);
      res.status(500).json({ error: e.message ?? "Drip-run feilet" });
    }
  });

  // ---------- Markér konvertert (kalles fra Stripe webhook ved invoice.paid) ----------
  app.post("/api/leadgrid/drips/converted", async (req, res) => {
    if (!isCronAuthorized(req, activeSessions)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { userId, organizationId } = req.body ?? {};
    if (!userId && !organizationId) return res.status(400).json({ error: "userId eller organizationId påkrevd" });

    await pool.query(
      `UPDATE onboarding_drips SET converted_at = now()
        WHERE converted_at IS NULL
          AND ($1::text IS NULL OR user_id = $1)
          AND ($2::uuid IS NULL OR organization_id = $2)`,
      [userId ?? null, organizationId ?? null],
    );
    res.json({ ok: true });
  });

  // ---------- Avregistrere (offentlig — token i URL) ----------
  app.get("/api/leadgrid/drips/unsubscribe", async (req, res) => {
    const email = req.query.email as string;
    if (!email) return res.status(400).send("Mangler e-post");
    await pool.query(
      `UPDATE onboarding_drips
          SET unsubscribed_at = now()
        WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($1))`,
      [email],
    );
    res.send(`
      <html><body style="font-family:system-ui;padding:60px;text-align:center;background:#0a0512;color:#fff;">
        <h1>Avregistrert</h1>
        <p>Vi sender ikke flere drypp-mails til ${email}.</p>
      </body></html>
    `);
  });

  // ---------- Plan-grace expire ----------
  app.post("/api/leadgrid/plan-grace/expire", async (req, res) => {
    if (!isCronAuthorized(req, activeSessions)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const start = Date.now();
    const results = { expired: 0, notified: 0, errors: 0 };

    try {
      // Hent grace-perioder som har utløpt
      const expiredR = await pool.query<{
        organization_id: string; former_plan_key: string;
        expires_at: string; org_name: string; contact_email: string | null;
      }>(
        `SELECT pg.organization_id, pg.former_plan_key, pg.expires_at,
                o.name AS org_name, o.contact_email
           FROM plan_grace pg
           JOIN organizations o ON o.id = pg.organization_id
          WHERE pg.expires_at <= now()
            AND pg.notified_at IS NULL`,
      );

      for (const row of expiredR.rows) {
        try {
          // Lokker org til Solo Free + sletter grace-rad
          await pool.query(
            `UPDATE organizations SET plan = 'solo_free' WHERE id = $1`,
            [row.organization_id],
          );
          await pool.query(
            `UPDATE plan_grace SET notified_at = now() WHERE organization_id = $1`,
            [row.organization_id],
          );
          results.expired++;

          if (row.contact_email) {
            try {
              await sendTransactionalEmail({
                to: row.contact_email,
                subject: `${row.org_name} — grace-periode utløpt`,
                html: `<p>Hei,</p>
                       <p>Grace-perioden etter at ${row.org_name} ble nedgradert er nå utløpt.
                       Org'en er flyttet til Solo Free-planen.</p>
                       <p>Hvis du vil ha tilbake Pro-funksjonene:
                       <a href="${PUBLIC_BASE}/leadgrid">Oppgrader igjen</a>.</p>`,
                text: `Grace-perioden for ${row.org_name} er utløpt. Org'en er flyttet til Solo Free. Oppgrader: ${PUBLIC_BASE}/leadgrid`,
                kind: "leadgrid_grace_expired",
                pool,
              });
              results.notified++;
            } catch (e) {
              console.error("[grace-expire mail]", e);
              results.errors++;
            }
          }
        } catch (e) {
          console.error("[grace-expire org]", e);
          results.errors++;
        }
      }

      // Slett gamle grace-rader (> 30 dager utløpt)
      await pool.query(
        `DELETE FROM plan_grace WHERE expires_at < now() - interval '30 days'`,
      );

      res.json({ ok: true, duration_ms: Date.now() - start, ...results });
    } catch (e: any) {
      console.error("[plan-grace expire]", e);
      res.status(500).json({ error: e.message ?? "Grace-expire feilet" });
    }
  });
}
