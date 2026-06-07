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
  composeEmail,
  emailIcon,
  emailPalette,
} from "./email-design-system.js";
import {
  generateImage,
  isFalConfigured,
  MARKETING_PROMPTS,
} from "./fal-image-service.js";
import { fireAgencyLeadConversion } from "./linkedin-conversions-service.js";

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
      // Klient-sendt attribusjons-kontekst (UTM-term/content, gclid, fbclid,
      // li_fat_id, referrer, landing_page, screen, locale). Merges med
      // server-side referer + received_at.
      request_context?: Record<string, unknown>;
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
            // Klient-attribusjon (UTM-term/content, click-IDs, referrer, landing-page)
            ...(body.request_context ?? {}),
            // Server-side felt overstyrer for traceability
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

      // Queue LinkedIn Conversion API event (Lead) — fires regardless of
      // whether LinkedIn approval is in yet; cron drainer sender når godkjent.
      try {
        const li_fat_id = (body as { li_fat_id?: string })?.li_fat_id ?? null;
        const firstWord = contactName.split(" ")[0];
        const lastWords = contactName.split(" ").slice(1).join(" ");
        await fireAgencyLeadConversion(pool, {
          leadId: lead.id,
          email,
          firstName: firstWord,
          lastName: lastWords,
          agencyName,
          linkedinClickId: li_fat_id ?? undefined,
        });
      } catch { /* best-effort */ }

      // Bekreftelses-mail til lead + intern notifikasjon (fire-and-forget)
      void (async () => {
        try {
          const baseUrl = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

          // ── 1. Bekreftelse til lead ────────────────────────────
          const resourceRow = (icon: string, href: string, label: string, sub: string, isLast = false) => `
            <tr>
              <td style="padding:10px 0;${isLast ? '' : `border-bottom:1px solid ${emailPalette.borderSubtle};`}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                  <tr>
                    <td style="width:28px;vertical-align:top;padding-top:2px;">${icon}</td>
                    <td>
                      <a href="${href}" style="color:${emailPalette.accentBright};font-weight:700;text-decoration:none;font-size:14px;font-family:-apple-system,sans-serif;">
                        ${label} →
                      </a>
                      <span style="color:${emailPalette.textMuted};font-size:13px;display:block;margin-top:2px;font-family:-apple-system,sans-serif;">${sub}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
          const ackBodyHtml = `
            <p style="margin:0 0 16px 0;color:${emailPalette.textSecondary};font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;">
              I mellomtiden kan du utforske:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
              ${resourceRow(emailIcon('paid', emailPalette.accentBright, 18), `${baseUrl}/pricing`, 'Priser', 'Fra 495 kr/mnd')}
              ${resourceRow(emailIcon('help', emailPalette.accentBright, 18), `${baseUrl}/faq`, 'FAQ', 'Korte svar på vanlige spørsmål')}
              ${resourceRow(emailIcon('slideshow', emailPalette.accentBright, 18), `${baseUrl}/pitch`, 'Hva er The Role Room?', '2-minutters pitch-deck', true)}
            </table>
          `;

          const ackComposed = composeEmail({
            category: "lead_ack",
            subject: "Vi har mottatt forespørselen din — The Role Room",
            preheader: `Daniel kommer tilbake innen 24 timer med demo-tider for ${agencyName}.`,
            headline: "Takk! Vi tar kontakt innen 24 timer",
            subhead: `Hei ${contactName.split(" ")[0]} — vi har mottatt forespørselen fra ${agencyName} og kommer tilbake med 3 demo-tider du kan velge mellom. Du får e-post fra Daniel direkte.`,
            bodyHtml: ackBodyHtml,
            footer: {
              reason: "Du får denne e-posten fordi du sendte inn forespørsel via /for-byraer.",
            },
          });

          await sendTransactionalEmail({
            to: email,
            subject: "Vi har mottatt forespørselen din — The Role Room",
            kind: "agency_lead_ack",
            fromLabel: "The Role Room",
            pool,
            text: ackComposed.text,
            html: ackComposed.html,
          });

          // ── 2. Intern notifikasjon til Daniel ──────────────────
          const internalEmail = process.env.AGENCY_LEAD_NOTIFY_EMAIL
            ?? "daniel@creatorhubn.com";

          const internalComposed = composeEmail({
            category: "lead_internal",
            subject: `Ny byrå-lead: ${agencyName}`,
            preheader: `${contactName} fra ${agencyName} — ${segment}`,
            headline: `Ny lead fra ${agencyName}`,
            subhead: `${contactName} kommer fra ${segment}-segmentet og venter på svar innen 24 timer.`,
            table: [
              { label: 'Byrå', value: agencyName },
              { label: 'Kontakt', value: `${contactName} <${email}>` },
              { label: 'Telefon', value: phone ?? '—' },
              { label: 'Antall talents', value: rosterSize ?? '—' },
              { label: 'Segment', value: segment },
              ...(message ? [{ label: 'Melding', value: message, pre: true }] : []),
            ],
            cta: { label: 'Åpne Admin Room CRM', href: `${baseUrl}/admin-room#crm` },
            footer: {
              reason: 'Intern notifikasjon — du mottar denne fordi du eier The Role Room.',
            },
          });

          await sendTransactionalEmail({
            to: internalEmail,
            subject: `Ny byrå-lead: ${agencyName}`,
            kind: "agency_lead_internal",
            fromLabel: "The Role Room — Leads",
            pool,
            text: internalComposed.text,
            html: internalComposed.html,
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
                utm_campaign, assigned_to_user_id, internal_notes, request_context,
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

      // Attribusjons-aggregering: hvor kommer leads-ene fra?
      // Aggregert per (utm_source, utm_medium, utm_campaign, source) — gir
      // Admin Room en LinkedIn/Meta/Google/direct-overview.
      const sourceBreakdown = await pool.query(
        `SELECT
           COALESCE(utm_source, source, 'direct') AS source_key,
           COALESCE(utm_medium, '') AS medium,
           COALESCE(utm_campaign, '') AS campaign,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE status IN ('demo_booked','trial','customer'))::int AS qualified,
           COUNT(*) FILTER (WHERE status = 'customer')::int AS won
         FROM agency_leads
         GROUP BY source_key, medium, campaign
         ORDER BY n DESC
         LIMIT 50`,
      );

      // Click-ID-aggregering: hvor mange leads kom fra paid-channels?
      const clickIdBreakdown = await pool.query(
        `SELECT
           CASE
             WHEN request_context->>'gclid' IS NOT NULL THEN 'google_ads'
             WHEN request_context->>'fbclid' IS NOT NULL THEN 'meta_ads'
             WHEN request_context->>'li_fat_id' IS NOT NULL THEN 'linkedin_ads'
             ELSE 'organic_or_direct'
           END AS channel,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE status = 'customer')::int AS won
         FROM agency_leads
         GROUP BY channel
         ORDER BY n DESC`,
      );

      return res.json({
        leads: r.rows,
        funnel,
        attribution: {
          by_source: sourceBreakdown.rows,
          by_paid_channel: clickIdBreakdown.rows,
        },
      });
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

