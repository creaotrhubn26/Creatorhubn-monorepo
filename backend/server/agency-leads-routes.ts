/**
 * agency-leads-routes.ts
 *
 * Public POST /api/public/agency-lead → ny rad i agency_leads
 * Admin GET/PATCH for funnel-håndtering fra Admin Room CRM.
 *
 * Inkluderer:
 *  - Spam-/rate-limit via enkel email + ip-throttling (1/min per ip)
 *  - Resend-e-post bekreftelse til lead + intern notifikasjon til Daniel
 *  - Audit-event ved opprettelse + status-endringer
 */

import type express from "express";
import type { Pool } from "pg";

import { sendTransactionalEmail } from "./transactional-email-service.js";
import {
  generateImage,
  isFalConfigured,
  MARKETING_PROMPTS,
} from "./fal-image-service.js";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface AgencyLeadsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
  isAdminEmail?: (email: string | null | undefined) => boolean;
}

// Enkel in-memory rate-limit (per IP, 60s vindu)
const recentRequests = new Map<string, number>();
function checkRateLimit(ip: string | null): boolean {
  if (!ip) return true;
  const now = Date.now();
  // Cleanup gamle entries
  for (const [k, t] of recentRequests) {
    if (now - t > 60_000) recentRequests.delete(k);
  }
  const last = recentRequests.get(ip);
  if (last && now - last < 60_000) return false;
  recentRequests.set(ip, now);
  return true;
}

const ALLOWED_STATUSES = new Set([
  "new", "contacted", "demo_booked", "trial", "customer", "disqualified", "archived",
]);

const SEGMENTS = new Set([
  "skuespillerbyrå", "modellbyrå", "bookingbyrå", "annet",
]);

export function setupAgencyLeadsRoutes(deps: AgencyLeadsRoutesDeps): void {
  const { app, pool, getActiveSession, isAdminEmail } = deps;

  // ── POST /api/public/agency-lead — fra landingsside-skjema ───────
  app.post("/api/public/agency-lead", async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.ip
      ?? null;
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "For mange henvendelser. Prøv igjen om litt." });
    }

    const body = (req.body ?? {}) as {
      agency_name?: string;
      contact_name?: string;
      email?: string;
      phone?: string | null;
      roster_size?: string | null;
      message?: string | null;
      source?: string;
      segment?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };

    // Validér påkrevde felt
    const agencyName = (body.agency_name ?? "").trim();
    const contactName = (body.contact_name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    if (!agencyName || agencyName.length > 255) {
      return res.status(400).json({ error: "Byrå-navn er påkrevd (maks 255 tegn)" });
    }
    if (!contactName || contactName.length > 255) {
      return res.status(400).json({ error: "Navn er påkrevd (maks 255 tegn)" });
    }
    // Enkel e-post-validering
    if (!email || !email.includes("@") || email.length > 255) {
      return res.status(400).json({ error: "Gyldig e-post er påkrevd" });
    }

    const segment = SEGMENTS.has(body.segment ?? "")
      ? body.segment as string
      : "skuespillerbyrå";

    const phone = body.phone?.trim().slice(0, 50) || null;
    const rosterSize = body.roster_size?.trim().slice(0, 60) || null;
    const message = body.message?.trim().slice(0, 4000) || null;

    try {
      const r = await pool.query(
        `INSERT INTO agency_leads (
           agency_name, contact_name, email, phone, roster_size, segment,
           message, source, utm_source, utm_medium, utm_campaign,
           ip_address, user_agent, request_context
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14::jsonb
         )
         ON CONFLICT (email, segment) DO UPDATE
           SET agency_name = EXCLUDED.agency_name,
               contact_name = EXCLUDED.contact_name,
               phone = COALESCE(EXCLUDED.phone, agency_leads.phone),
               roster_size = COALESCE(EXCLUDED.roster_size, agency_leads.roster_size),
               message = COALESCE(EXCLUDED.message, agency_leads.message),
               updated_at = now()
         RETURNING id::text, agency_name, contact_name, email, status, created_at`,
        [
          agencyName, contactName, email, phone, rosterSize, segment,
          message, body.source ?? "agency_landing",
          body.utm_source?.slice(0, 120) ?? null,
          body.utm_medium?.slice(0, 120) ?? null,
          body.utm_campaign?.slice(0, 120) ?? null,
          ip?.slice(0, 45) ?? null,
          req.headers["user-agent"]?.toString().slice(0, 1000) ?? null,
          JSON.stringify({
            referer: req.headers.referer ?? null,
            received_at: new Date().toISOString(),
          }),
        ],
      );
      const lead = r.rows[0];

      // Event
      try {
        await pool.query(
          `INSERT INTO agency_lead_events (lead_id, event_type, actor)
           VALUES ($1::uuid, 'created', $2)`,
          [lead.id, email],
        );
      } catch { /* best-effort */ }

      // Bekreftelses-mail til lead + intern notifikasjon (fire-and-forget)
      void (async () => {
        try {
          const baseUrl = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";
          await sendTransactionalEmail({
            to: email,
            subject: "Vi har mottatt forespørselen din — The Role Room",
            kind: "agency_lead_ack",
            fromLabel: "The Role Room",
            pool,
            text: [
              `Hei ${contactName.split(" ")[0]},`,
              "",
              `Vi har mottatt forespørselen din fra ${agencyName} og kommer tilbake innen 24 timer med 3 demo-tider å velge mellom.`,
              "",
              "I mellomtiden kan du lese mer her:",
              `· Priser: ${baseUrl}/pricing`,
              `· FAQ: ${baseUrl}/faq`,
              "",
              "— The Role Room",
            ].join("\n"),
            html: [
              `<!doctype html><html><body style="margin:0;padding:0;background:#0a0118;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">`,
              `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0118;padding:32px 16px;"><tr><td align="center">`,
              `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#150b2e;border:1px solid rgba(168,85,247,0.18);border-radius:14px;overflow:hidden;">`,
              `<tr><td style="padding:32px;">`,
              `<div style="display:inline-block;background:linear-gradient(135deg,#a855f7 0%,#d946ef 100%);color:#fff;font-weight:700;font-size:12px;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:16px;">Mottatt</div>`,
              `<h1 style="color:#f5f3ff;font-size:22px;line-height:1.25;margin:0 0 12px;">Vi har mottatt forespørselen din</h1>`,
              `<p style="color:#c4b5fd;font-size:15px;line-height:1.55;margin:0 0 16px;">Hei ${escapeHtml(contactName.split(" ")[0])} — vi tar kontakt innen 24 timer med 3 demo-tider å velge mellom. Du får e-post fra <strong>daniel@creatorhubn.com</strong>.</p>`,
              `<p style="color:#8b7ec4;font-size:13px;margin:0 0 8px;">I mellomtiden:</p>`,
              `<p style="margin:0 0 8px;"><a href="${baseUrl}/pricing" style="color:#c084fc;font-weight:600;text-decoration:none;">Priser →</a></p>`,
              `<p style="margin:0;"><a href="${baseUrl}/faq" style="color:#c084fc;font-weight:600;text-decoration:none;">FAQ →</a></p>`,
              `</td></tr></table></td></tr></table></body></html>`,
            ].join(""),
          });

          // Intern notifikasjon til Daniel
          const internalEmail = process.env.AGENCY_LEAD_NOTIFY_EMAIL
            ?? "daniel@creatorhubn.com";
          await sendTransactionalEmail({
            to: internalEmail,
            subject: `🎯 Ny byrå-lead: ${agencyName}`,
            kind: "agency_lead_internal",
            fromLabel: "The Role Room — Leads",
            pool,
            text: [
              `Ny byrå-lead via landingssiden:`,
              "",
              `Byrå: ${agencyName}`,
              `Kontakt: ${contactName}`,
              `E-post: ${email}`,
              `Telefon: ${phone ?? "(ikke oppgitt)"}`,
              `Antall talents: ${rosterSize ?? "(ikke oppgitt)"}`,
              `Segment: ${segment}`,
              "",
              message ? `Melding:\n${message}` : "(ingen melding)",
              "",
              `Admin Room: ${baseUrl}/admin-room#crm`,
            ].join("\n"),
            html: [
              `<!doctype html><html><body style="margin:0;padding:0;background:#0a0118;font-family:-apple-system,sans-serif;">`,
              `<table width="100%" style="background:#0a0118;padding:24px;"><tr><td align="center">`,
              `<table style="max-width:560px;background:#150b2e;border:1px solid rgba(168,85,247,0.18);border-radius:12px;padding:24px;color:#f5f3ff;">`,
              `<h2 style="margin:0 0 16px;font-size:18px;">🎯 Ny byrå-lead</h2>`,
              `<dl style="font-size:13px;line-height:1.6;color:#c4b5fd;">`,
              `<dt style="color:#8b7ec4;font-weight:600;">Byrå</dt><dd style="margin:0 0 8px 0;color:#f5f3ff;">${escapeHtml(agencyName)}</dd>`,
              `<dt style="color:#8b7ec4;font-weight:600;">Kontakt</dt><dd style="margin:0 0 8px 0;color:#f5f3ff;">${escapeHtml(contactName)} &lt;${escapeHtml(email)}&gt;</dd>`,
              `<dt style="color:#8b7ec4;font-weight:600;">Telefon</dt><dd style="margin:0 0 8px 0;color:#f5f3ff;">${escapeHtml(phone ?? "—")}</dd>`,
              `<dt style="color:#8b7ec4;font-weight:600;">Talents</dt><dd style="margin:0 0 8px 0;color:#f5f3ff;">${escapeHtml(rosterSize ?? "—")}</dd>`,
              `<dt style="color:#8b7ec4;font-weight:600;">Segment</dt><dd style="margin:0 0 8px 0;color:#f5f3ff;">${escapeHtml(segment)}</dd>`,
              message ? `<dt style="color:#8b7ec4;font-weight:600;">Melding</dt><dd style="margin:0 0 8px 0;color:#f5f3ff;white-space:pre-wrap;">${escapeHtml(message)}</dd>` : "",
              `</dl>`,
              `<a href="${baseUrl}/admin-room#crm" style="display:inline-block;background:linear-gradient(135deg,#a855f7 0%,#d946ef 100%);color:#fff;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;margin-top:12px;">Åpne Admin Room CRM</a>`,
              `</table></td></tr></table></body></html>`,
            ].join(""),
          });
        } catch (err) {
          console.warn("[agency-lead] mail-notification feilet", err);
        }
      })();

      return res.status(201).json({
        ok: true,
        lead_id: lead.id,
        message: "Mottatt — vi tar kontakt innen 24 timer",
      });
    } catch (err) {
      console.error("[agency-leads POST] failed", err);
      return res.status(500).json({ error: "Innsending feilet. Prøv igjen senere." });
    }
  });

  // ── GET /api/admin-room/agency-leads — Daniel/admin listing ──────
  app.get("/api/admin-room/agency-leads", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (isAdminEmail && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "Admin Room kreves" });
    }

    const status = typeof req.query.status === "string" ? req.query.status : null;
    const segment = typeof req.query.segment === "string" ? req.query.segment : null;
    const limit = Math.min(Number(req.query.limit ?? 200), 500);

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status && ALLOWED_STATUSES.has(status)) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (segment && SEGMENTS.has(segment)) {
        params.push(segment);
        conditions.push(`segment = $${params.length}`);
      }
      params.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const r = await pool.query(
        `SELECT id::text, agency_name, contact_name, email, phone, roster_size,
                segment, message, status, source, utm_source, utm_medium,
                utm_campaign, assigned_to_user_id, internal_notes,
                created_at, updated_at, contacted_at, trial_started_at, customer_at
           FROM agency_leads
           ${where}
           ORDER BY created_at DESC
           LIMIT $${params.length}`,
        params,
      );

      // Aggregate funnel-stats
      const stats = await pool.query(
        `SELECT status, COUNT(*)::int AS n FROM agency_leads GROUP BY status`,
      );
      const funnel = Object.fromEntries(stats.rows.map((s) => [s.status, s.n]));

      return res.json({ leads: r.rows, funnel });
    } catch (err) {
      console.error("[agency-leads GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente leads" });
    }
  });

  // ── POST /api/admin-room/marketing/generate-image — FAL.ai hero-image
  // Brukes fra Admin Room "Brand Studio" for å lage hero-bilder til
  // landingssider og blog-headers.
  app.post("/api/admin-room/marketing/generate-image", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (isAdminEmail && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "Admin Room kreves" });
    }
    if (!isFalConfigured()) {
      return res.status(503).json({
        error: "FAL.ai er ikke konfigurert. Sett FAL_API_KEY på Render.",
      });
    }
    const body = (req.body ?? {}) as {
      prompt?: string;
      style?: 'editorial' | 'cinematic' | 'studio' | 'lifestyle';
      width?: number;
      height?: number;
      preset?: keyof typeof MARKETING_PROMPTS;
    };
    try {
      const opts = body.preset
        ? MARKETING_PROMPTS[body.preset]
        : { prompt: body.prompt ?? '', style: body.style, width: body.width, height: body.height };
      if (!opts.prompt || opts.prompt.trim().length < 3) {
        return res.status(400).json({ error: "prompt eller preset må være satt" });
      }
      const result = await generateImage(opts);
      return res.json({ image: result });
    } catch (err) {
      console.error("[fal generate-image] failed", err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Bilde-generering feilet",
      });
    }
  });

  // ── PATCH /api/admin-room/agency-leads/:id — endre status/notes ──
  app.patch("/api/admin-room/agency-leads/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (isAdminEmail && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "Admin Room kreves" });
    }

    const body = (req.body ?? {}) as {
      status?: string;
      internal_notes?: string;
      assigned_to_user_id?: string | null;
    };

    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return res.status(400).json({ error: `Ugyldig status` });
      }
      sets.push(`status = $${p++}`);
      vals.push(body.status);
      // Sett tilhørende tidsstempel
      if (body.status === "contacted") {
        sets.push(`contacted_at = COALESCE(contacted_at, now())`);
      } else if (body.status === "trial") {
        sets.push(`trial_started_at = COALESCE(trial_started_at, now())`);
      } else if (body.status === "customer") {
        sets.push(`customer_at = COALESCE(customer_at, now())`);
      }
    }
    if (body.internal_notes !== undefined) {
      sets.push(`internal_notes = $${p++}`);
      vals.push(body.internal_notes);
    }
    if (body.assigned_to_user_id !== undefined) {
      sets.push(`assigned_to_user_id = $${p++}`);
      vals.push(body.assigned_to_user_id);
    }

    if (sets.length === 0) return res.status(400).json({ error: "Ingen felter å endre" });

    vals.push(req.params.id);

    try {
      const r = await pool.query(
        `UPDATE agency_leads SET ${sets.join(", ")} WHERE id = $${p}::uuid RETURNING *`,
        vals,
      );
      if (!r.rowCount) return res.status(404).json({ error: "Lead ikke funnet" });

      // Audit-event
      try {
        await pool.query(
          `INSERT INTO agency_lead_events (lead_id, event_type, actor, details)
           VALUES ($1::uuid, $2, $3, $4::jsonb)`,
          [
            req.params.id,
            body.status ? `status_${body.status}` : "updated",
            session.email ?? session.userId,
            JSON.stringify(body),
          ],
        );
      } catch { /* best-effort */ }

      return res.json({ lead: r.rows[0] });
    } catch (err) {
      console.error("[agency-leads PATCH] failed", err);
      return res.status(500).json({ error: "Oppdatering feilet" });
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
