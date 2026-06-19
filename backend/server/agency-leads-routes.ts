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

  // ── GET /api/public/ads-config — Google Ads conversion-tag config ─
  // Returnerer AW-ID + conversion-labels fra env, så frontend kan fire
  // gtag('event', 'conversion', { send_to: ... }) på key actions.
  // Krever ingen auth — kun publiske ID-er, ingen secrets.
  app.get("/api/public/ads-config", (_req, res) => {
    const conversionId = (process.env.GOOGLE_ADS_CONVERSION_ID || "").trim();
    if (!conversionId || !conversionId.startsWith("AW-")) {
      return res.json({ enabled: false });
    }
    return res.json({
      enabled: true,
      conversionId,
      labels: {
        lead: (process.env.GOOGLE_ADS_LABEL_LEAD || "").trim() || null,
        demo: (process.env.GOOGLE_ADS_LABEL_DEMO || "").trim() || null,
        signup: (process.env.GOOGLE_ADS_LABEL_SIGNUP || "").trim() || null,
      },
    });
  });

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
      // B2B-intake (fra "Book demo"-modalen) — all bedrifts-info en demo trenger.
      org_number?: string | null;
      website?: string | null;
      contact_title?: string | null;
      team_size?: string | null;
      current_tools?: string | null;
      use_case?: string | null;
      preferred_demo_time?: string | null;
      demo_language?: string | null;
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

    // B2B-intake fra "Book demo"-modalen.
    const source = (body.source ?? "agency_landing").slice(0, 60);
    const isBookDemo = source === "book_demo";
    const orgNumber = body.org_number?.trim().slice(0, 40) || null;
    const website = body.website?.trim().slice(0, 255) || null;
    const contactTitle = body.contact_title?.trim().slice(0, 120) || null;
    const teamSize = body.team_size?.trim().slice(0, 60) || null;
    const currentTools = body.current_tools?.trim().slice(0, 2000) || null;
    const useCase = body.use_case?.trim().slice(0, 2000) || null;
    const preferredDemoTime = body.preferred_demo_time?.trim().slice(0, 120) || null;
    const demoLanguage = body.demo_language === "en" ? "en" : "nb";
    // "Book demo" registreres direkte som demo_booked (en aktiv booking),
    // ordinære landing-leads starter som 'new'.
    const initialStatus = isBookDemo ? "demo_booked" : "new";

    try {
      const r = await pool.query(
        `INSERT INTO agency_leads (
           agency_name, contact_name, email, phone, roster_size, segment,
           message, source, utm_source, utm_medium, utm_campaign,
           ip_address, user_agent, request_context,
           org_number, website, contact_title, team_size, current_tools,
           use_case, preferred_demo_time, demo_language, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14::jsonb,
           $15, $16, $17, $18, $19,
           $20, $21, $22, $23
         )
         ON CONFLICT (email, segment) DO UPDATE
           SET agency_name = EXCLUDED.agency_name,
               contact_name = EXCLUDED.contact_name,
               phone = COALESCE(EXCLUDED.phone, agency_leads.phone),
               roster_size = COALESCE(EXCLUDED.roster_size, agency_leads.roster_size),
               message = COALESCE(EXCLUDED.message, agency_leads.message),
               org_number = COALESCE(EXCLUDED.org_number, agency_leads.org_number),
               website = COALESCE(EXCLUDED.website, agency_leads.website),
               contact_title = COALESCE(EXCLUDED.contact_title, agency_leads.contact_title),
               team_size = COALESCE(EXCLUDED.team_size, agency_leads.team_size),
               current_tools = COALESCE(EXCLUDED.current_tools, agency_leads.current_tools),
               use_case = COALESCE(EXCLUDED.use_case, agency_leads.use_case),
               preferred_demo_time = COALESCE(EXCLUDED.preferred_demo_time, agency_leads.preferred_demo_time),
               demo_language = EXCLUDED.demo_language,
               -- En ny "Book demo" på en eksisterende lead løfter den til demo_booked,
               -- men nedgraderer aldri en lead som alt er trial/customer.
               status = CASE
                 WHEN EXCLUDED.status = 'demo_booked'
                   AND agency_leads.status IN ('new', 'contacted')
                 THEN 'demo_booked' ELSE agency_leads.status END,
               updated_at = now()
         RETURNING id::text, agency_name, contact_name, email, status, created_at`,
        [
          agencyName, contactName, email, phone, rosterSize, segment,
          message, source,
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
          orgNumber, website, contactTitle, teamSize, currentTools,
          useCase, preferredDemoTime, demoLanguage, initialStatus,
        ],
      );
      const lead = r.rows[0];

      // "Book demo" = en aktiv booking — sett demo_booked-tidsstempel ved opprettelse.
      if (isBookDemo) {
        try {
          await pool.query(
            `UPDATE agency_leads
               SET contacted_at = COALESCE(contacted_at, now())
             WHERE id = $1::uuid`,
            [lead.id],
          );
        } catch { /* best-effort */ }
      }

      // Event
      try {
        await pool.query(
          `INSERT INTO agency_lead_events (lead_id, event_type, actor, details)
           VALUES ($1::uuid, $2, $3, $4::jsonb)`,
          [
            lead.id,
            isBookDemo ? "demo_booked" : "created",
            email,
            JSON.stringify({ source, preferred_demo_time: preferredDemoTime, demo_language: demoLanguage }),
          ],
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
            subject: isBookDemo
              ? `Demo booket: ${agencyName}`
              : `Ny byrå-lead: ${agencyName}`,
            preheader: `${contactName} fra ${agencyName} — ${segment}`,
            headline: isBookDemo
              ? `Demo-forespørsel fra ${agencyName}`
              : `Ny lead fra ${agencyName}`,
            subhead: isBookDemo
              ? `${contactName} (${contactTitle ?? segment}) har booket en demo${preferredDemoTime ? ` — ønsket tid: ${preferredDemoTime}` : ''}.`
              : `${contactName} kommer fra ${segment}-segmentet og venter på svar innen 24 timer.`,
            table: [
              { label: 'Bedrift', value: agencyName },
              { label: 'Kontakt', value: `${contactName} <${email}>` },
              ...(contactTitle ? [{ label: 'Tittel', value: contactTitle }] : []),
              { label: 'Telefon', value: phone ?? '—' },
              ...(orgNumber ? [{ label: 'Org.nr', value: orgNumber }] : []),
              ...(website ? [{ label: 'Nettside', value: website }] : []),
              { label: 'Team-størrelse', value: teamSize ?? rosterSize ?? '—' },
              { label: 'Segment', value: segment },
              ...(useCase ? [{ label: 'Bruksområde', value: useCase, pre: true }] : []),
              ...(currentTools ? [{ label: 'Dagens verktøy', value: currentTools }] : []),
              ...(preferredDemoTime ? [{ label: 'Ønsket demo-tid', value: preferredDemoTime }] : []),
              { label: 'Demo-språk', value: demoLanguage === 'en' ? 'Engelsk' : 'Norsk' },
              ...(message ? [{ label: 'Melding', value: message, pre: true }] : []),
            ],
            cta: { label: 'Åpne Admin Room CRM', href: `${baseUrl}/admin-room#crm` },
            footer: {
              reason: 'Intern notifikasjon — du mottar denne fordi du eier The Role Room.',
            },
          });

          await sendTransactionalEmail({
            to: internalEmail,
            subject: isBookDemo
              ? `Demo booket: ${agencyName}`
              : `Ny byrå-lead: ${agencyName}`,
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
                org_number, website, contact_title, team_size, current_tools,
                use_case, preferred_demo_time, demo_language,
                converted_user_id, conversion_persona, stripe_customer_id,
                stripe_subscription_id, conversion_checkout_session_id,
                conversion_initiated_at,
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
      // Prioritert rekkefølge — leads kan ha multiple click-IDs ved
      // x-channel-kampanjer, vi velger den mest sannsynlig som drev sist-klikk.
      // Instagram skilles fra Meta via utm_source eller referrer (instagram.com).
      const clickIdBreakdown = await pool.query(
        `SELECT
           CASE
             WHEN request_context->>'gclid' IS NOT NULL THEN 'google_ads'
             WHEN request_context->>'ttclid' IS NOT NULL THEN 'tiktok_ads'
             WHEN request_context->>'li_fat_id' IS NOT NULL THEN 'linkedin_ads'
             WHEN request_context->>'fbclid' IS NOT NULL AND (
               LOWER(COALESCE(utm_source,'')) = 'instagram'
               OR LOWER(COALESCE(request_context->>'referrer','')) LIKE '%instagram.com%'
             ) THEN 'instagram_ads'
             WHEN request_context->>'fbclid' IS NOT NULL THEN 'meta_ads'
             WHEN LOWER(COALESCE(request_context->>'referrer','')) LIKE '%instagram.com%' THEN 'instagram_organic'
             WHEN LOWER(COALESCE(request_context->>'referrer','')) LIKE '%tiktok.com%' THEN 'tiktok_organic'
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

  // ── PATCH /api/admin-room/agency-leads/:id — oppdater status/noter ──
  app.patch("/api/admin-room/agency-leads/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (isAdminEmail && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "Admin Room kreves" });
    }

    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "mangler_id" });

    const body = (req.body ?? {}) as {
      status?: string;
      internal_notes?: string;
      assigned_to_user_id?: string | null;
    };

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.status && ALLOWED_STATUSES.has(body.status)) {
      params.push(body.status);
      updates.push(`status = $${params.length}`);
      // Auto-fyll tidsstempler ved status-overgang
      if (body.status === 'contacted') updates.push(`contacted_at = COALESCE(contacted_at, NOW())`);
      if (body.status === 'trial') updates.push(`trial_started_at = COALESCE(trial_started_at, NOW())`);
      if (body.status === 'customer') updates.push(`customer_at = COALESCE(customer_at, NOW())`);
    }
    if (typeof body.internal_notes === 'string') {
      params.push(body.internal_notes);
      updates.push(`internal_notes = $${params.length}`);
    }
    if (body.assigned_to_user_id !== undefined) {
      params.push(body.assigned_to_user_id ?? null);
      updates.push(`assigned_to_user_id = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "ingen_endringer" });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    try {
      const r = await pool.query(
        `UPDATE agency_leads SET ${updates.join(', ')}
         WHERE id = $${params.length}::uuid
         RETURNING id::text, agency_name, status, contacted_at, trial_started_at,
                   customer_at, internal_notes, assigned_to_user_id, updated_at`,
        params,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ ok: true, lead: r.rows[0] });
    } catch (err) {
      console.error("[agency-leads PATCH] failed", err);
      return res.status(500).json({ error: "Oppdatering feilet", detail: String(err) });
    }
  });

  // ── GET /api/admin-room/agency-acquisition/dashboard ──────────────
  // Dashboard-aggregering for byrå-akkvisisjons-fanen.
  // Returnerer funnel + konverteringsrater + tid-i-steg + pipeline-verdi.
  app.get("/api/admin-room/agency-acquisition/dashboard", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (isAdminEmail && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "Admin Room kreves" });
    }

    // ARPU-estimat for pipeline-verdi — kan overstyres via query
    const arpuMonthlyNok = Math.max(0, Number(req.query.arpuMonthlyNok) || 4900);

    try {
      // Funnel-counts per status
      const funnelRes = await pool.query<{ status: string; n: number }>(
        `SELECT status, COUNT(*)::int AS n FROM agency_leads GROUP BY status`,
      );
      const funnel: Record<string, number> = {};
      for (const r of funnelRes.rows) funnel[r.status] = r.n;

      const totalLeads = Object.values(funnel).reduce((a, b) => a + b, 0);
      const newCount = funnel.new ?? 0;
      const contactedCount = funnel.contacted ?? 0;
      const demoCount = funnel.demo_booked ?? 0;
      const trialCount = funnel.trial ?? 0;
      const customerCount = funnel.customer ?? 0;
      const disqualifiedCount = funnel.disqualified ?? 0;

      // Akkumulerte tellinger for konverteringsrater (alt etter steget)
      const reachedContacted = contactedCount + demoCount + trialCount + customerCount;
      const reachedDemo = demoCount + trialCount + customerCount;
      const reachedTrial = trialCount + customerCount;
      const reachedCustomer = customerCount;

      const conversionRates = {
        new_to_contacted: totalLeads > 0
          ? Math.round((reachedContacted / Math.max(1, totalLeads - disqualifiedCount)) * 100)
          : 0,
        contacted_to_demo: reachedContacted > 0
          ? Math.round((reachedDemo / reachedContacted) * 100)
          : 0,
        demo_to_trial: reachedDemo > 0
          ? Math.round((reachedTrial / reachedDemo) * 100)
          : 0,
        trial_to_customer: reachedTrial > 0
          ? Math.round((reachedCustomer / reachedTrial) * 100)
          : 0,
        overall: totalLeads > 0
          ? Math.round((reachedCustomer / Math.max(1, totalLeads - disqualifiedCount)) * 100)
          : 0,
      };

      // Avg-time per stage (i dager)
      const timeRes = await pool.query<{
        avg_to_contacted: number | null;
        avg_to_trial: number | null;
        avg_to_customer: number | null;
      }>(
        `SELECT
           AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 86400)::int AS avg_to_contacted,
           AVG(EXTRACT(EPOCH FROM (trial_started_at - contacted_at)) / 86400)
             FILTER (WHERE trial_started_at IS NOT NULL AND contacted_at IS NOT NULL)::int AS avg_to_trial,
           AVG(EXTRACT(EPOCH FROM (customer_at - trial_started_at)) / 86400)
             FILTER (WHERE customer_at IS NOT NULL AND trial_started_at IS NOT NULL)::int AS avg_to_customer
         FROM agency_leads
         WHERE contacted_at IS NOT NULL`,
      );
      const avgDays = {
        new_to_contacted: timeRes.rows[0]?.avg_to_contacted ?? null,
        contacted_to_trial: timeRes.rows[0]?.avg_to_trial ?? null,
        trial_to_customer: timeRes.rows[0]?.avg_to_customer ?? null,
      };

      // Velocity — leads per uke siste 8 uker
      const velocityRes = await pool.query<{ week: string; n: number; customers: number }>(
        `SELECT
           DATE_TRUNC('week', created_at)::date::text AS week,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE status = 'customer')::int AS customers
         FROM agency_leads
         WHERE created_at >= NOW() - INTERVAL '8 weeks'
         GROUP BY week
         ORDER BY week DESC
         LIMIT 8`,
      );

      // Pipeline-verdi — estimat
      const pipelineValueNok = {
        annual_trial: trialCount * arpuMonthlyNok * 12,
        annual_customer: customerCount * arpuMonthlyNok * 12,
        weighted_pipeline:
          (demoCount * 0.25 + trialCount * 0.5 + customerCount * 1.0) * arpuMonthlyNok * 12,
      };

      // Top sources
      const sourceRes = await pool.query<{
        source_key: string; n: number; customers: number;
      }>(
        `SELECT
           COALESCE(NULLIF(utm_source, ''), source, 'direct') AS source_key,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE status = 'customer')::int AS customers
         FROM agency_leads
         GROUP BY source_key
         ORDER BY n DESC
         LIMIT 10`,
      );

      // Hot leads — nylige, handlingsklare leads. Inkluderer booket demo + trial
      // så de kan konverteres til kunde direkte fra dashboardet.
      const hotRes = await pool.query(
        `SELECT id::text, agency_name, contact_name, email, status, segment,
                roster_size, conversion_persona,
                created_at, EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS days_old
         FROM agency_leads
         WHERE status IN ('new', 'contacted', 'demo_booked', 'trial')
           AND created_at >= NOW() - INTERVAL '30 days'
         ORDER BY
           CASE status WHEN 'demo_booked' THEN 0 WHEN 'trial' THEN 1
             WHEN 'contacted' THEN 2 ELSE 3 END,
           created_at DESC
         LIMIT 12`,
      );

      return res.json({
        funnel,
        funnelTotals: {
          total: totalLeads,
          new: newCount,
          contacted: contactedCount,
          demo: demoCount,
          trial: trialCount,
          customer: customerCount,
          disqualified: disqualifiedCount,
        },
        conversionRates,
        avgDaysInStage: avgDays,
        velocityByWeek: velocityRes.rows,
        pipelineValueNok,
        arpuMonthlyNok,
        topSources: sourceRes.rows,
        hotLeads: hotRes.rows,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[agency-acquisition/dashboard] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente dashboard", detail: String(err) });
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

  // ── POST /api/admin-room/agency-leads/:id/convert-to-customer ──────
  // Selvbetjent konvertering: sender kontakten den utprøvde, persona-forhånds-
  // utfylte onboarding-/checkout-lenken (de fyller inn org/seter/betaling selv
  // i den eksisterende flyten). Ved fullført betaling flipper Role Room-
  // billing-webhooken leaden til 'customer' (match på e-post — se
  // markRoleRoomCommercialCheckoutRecordPaid i index.ts). Robust fordi org/roller/
  // seter samles av den ordinære onboarding-flyten, ikke fabrikkeres her.
  app.post("/api/admin-room/agency-leads/:id/convert-to-customer", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (isAdminEmail && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "Admin Room kreves" });
    }

    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "mangler_id" });

    const body = (req.body ?? {}) as { persona?: string; sendEmail?: boolean };
    const persona = body.persona === "production_team" ? "production_team" : "content_producer";
    const sendEmail = body.sendEmail !== false;

    try {
      const leadRes = await pool.query(
        `SELECT id::text, agency_name, contact_name, email, status
           FROM agency_leads WHERE id = $1::uuid`,
        [id],
      );
      if (leadRes.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      const lead = leadRes.rows[0] as {
        id: string; agency_name: string; contact_name: string; email: string; status: string;
      };
      if (lead.status === "customer") {
        return res.status(409).json({ error: "allerede_kunde" });
      }

      const baseUrl = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";
      const onboardingUrl =
        `${baseUrl}/?signup=${persona}&email=${encodeURIComponent(lead.email)}&ref=demo_conversion`;

      // Registrer konverterings-intensjon. Status løftes til 'trial' (i onboarding);
      // webhook flipper til 'customer' når betalingen fullføres.
      await pool.query(
        `UPDATE agency_leads
           SET conversion_persona = $2,
               conversion_initiated_at = COALESCE(conversion_initiated_at, now()),
               status = CASE
                 WHEN status IN ('new','contacted','demo_booked') THEN 'trial'
                 ELSE status END,
               trial_started_at = COALESCE(trial_started_at, now()),
               updated_at = now()
         WHERE id = $1::uuid`,
        [id, persona],
      );

      try {
        await pool.query(
          `INSERT INTO agency_lead_events (lead_id, event_type, actor, details)
           VALUES ($1::uuid, 'conversion_initiated', $2, $3::jsonb)`,
          [
            id,
            session.email ?? session.userId,
            JSON.stringify({ persona, onboardingUrl, emailed: sendEmail }),
          ],
        );
      } catch { /* best-effort */ }

      // Send onboarding-lenken til kontakten.
      if (sendEmail) {
        try {
          const planLabel = persona === "production_team" ? "Produksjonsteam" : "Innholdsprodusent";
          const firstName = String(lead.contact_name || "").split(" ")[0] || "der";
          const composed = composeEmail({
            category: "welcome",
            subject: "Kom i gang med The Role Room",
            preheader: `Sett opp ${lead.agency_name} på The Role Room — ${planLabel}.`,
            headline: "Klar til å komme i gang?",
            subhead: `Hei ${firstName} — takk for praten! Trykk under for å sette opp ${lead.agency_name} på The Role Room. Du velger plan, legger til teamet og fullfører i samme flyt.`,
            cta: { label: "Sett opp kontoen", href: onboardingUrl },
            footer: {
              reason: "Du får denne e-posten fordi du booket en demo med The Role Room.",
            },
          });
          await sendTransactionalEmail({
            to: lead.email,
            subject: "Kom i gang med The Role Room",
            kind: "agency_lead_conversion",
            fromLabel: "The Role Room",
            pool,
            text: composed.text,
            html: composed.html,
          });
        } catch (err) {
          console.warn("[agency-lead convert] e-post feilet", err);
        }
      }

      return res.json({ ok: true, onboardingUrl, persona, emailed: sendEmail });
    } catch (err) {
      console.error("[agency-leads convert] failed", err);
      return res.status(500).json({ error: "Konvertering feilet", detail: String(err) });
    }
  });
}

