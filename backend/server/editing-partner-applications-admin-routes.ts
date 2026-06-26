/**
 * editing-partner-applications-admin-routes.ts
 *
 * Superadmin-ruter for Creatorhub Partner Program: list søknader, godkjenn
 * (transaksjonelt: opprett users-rad → vendor-profil approved → mint magic-link
 * → send velkomst-e-post), avvis, send lenke på nytt, tilbakekall.
 *
 * Godkjenning LØSER identitets-gapet: en søker har aldri logget inn, så vi
 * oppretter users-raden FØR profil + token, slik at magic-link-sesjonen peker
 * til en ekte konto.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { composeEmail } from "./email-design-system";
import { sendTransactionalEmail } from "./transactional-email-service";
import { mintPortalToken, revokeVendorPortalTokens } from "./editing-partner-portal-service";
import { paypalHealthCheck, paypalTestPayout } from "./editing-payments-service";

type SessionData = { userId: string; role?: string; email?: string };

const PORTAL_BASE = process.env.CREATORHUB_PUBLIC_URL || "https://creatorhubn.com";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as { cookies?: { sessionToken?: string } }).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response, pool: Pool, sessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, sessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id=$1`, [s.userId]);
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" }); return null;
  }
  return s;
}

async function sendWelcomeEmail(pool: Pool, args: {
  to: string; companyName: string; isForeign: boolean; jti: string; rawToken: string; sentBy?: string;
  partnerType?: string | null; prototypeUntil?: string | null; platformFeeBps?: number | null;
}): Promise<void> {
  const portalUrl = `${PORTAL_BASE}/partner-portal?jti=${args.jti}&t=${encodeURIComponent(args.rawToken)}`;
  const guideUrl = `${PORTAL_BASE}/partner-portal/guide`;
  const no = !args.isForeign;
  const subject = no
    ? "Velkommen som Creatorhub-partner – aktiver portal-tilgangen din"
    : "Welcome to the Creatorhub Partner Program – activate your portal access";
  const headline = no ? "Søknaden din er godkjent" : "Your application is approved";

  // Type-bevisst status-linje: prototype-tester (m/ periode) vs. vanlig partner (m/ fee).
  const feePct = ((args.platformFeeBps ?? 1500) / 100);
  const untilDate = args.prototypeUntil
    ? new Date(args.prototypeUntil).toLocaleDateString(no ? "nb-NO" : "en-GB", { year: "numeric", month: "long", day: "numeric" })
    : null;
  let statusLine = "";
  if (args.partnerType === "prototype") {
    statusLine = no
      ? `Du er registrert som PROTOTYPE-TESTER i Creatorhub Partner Program${untilDate ? ` for perioden frem til ${untilDate}` : ""} — med 0 % plattformgebyr i prototype-perioden${untilDate ? ` (deretter ${feePct}%)` : ""}.`
      : `You are registered as a PROTOTYPE TESTER on the Creatorhub Partner Program${untilDate ? ` for the period until ${untilDate}` : ""} — with 0% platform fee during the prototype period${untilDate ? ` (${feePct}% thereafter)` : ""}.`;
  } else if (args.partnerType === "standard") {
    statusLine = no
      ? `Du er registrert som Creatorhub-partner med ${feePct}% plattformgebyr per oppdrag.`
      : `You are registered as a Creatorhub partner with a ${feePct}% platform fee per job.`;
  }

  const intro = no
    ? `Gratulerer, ${args.companyName}! Du har bestått kravene og er godkjent som Creatorhub redigeringspartner.`
    : `Congratulations, ${args.companyName}! You have passed the requirements and been approved as a Creatorhub editing partner.`;
  const outro = no
    ? `Klikk knappen under for å logge inn i partnerportalen og fullføre verifiseringen (compliance, lagring og betaling). Lenken er personlig og gyldig i 14 dager.`
    : `Click the button below to sign in to your partner portal and complete verification (compliance, storage and payments). The link is personal and valid for 14 days.`;
  const body = `${intro}${statusLine ? ` ${statusLine}` : ""} ${outro}`;
  const { html, text } = composeEmail({
    category: "general",
    brand: "creatorhub",
    subject,
    headline,
    subhead: no ? "Creatorhub Partnerprogram" : "Creatorhub Partner Program",
    body,
    cta: { label: no ? "Åpne partnerportalen" : "Open the partner portal", href: portalUrl, variant: "primary" },
    bodyHtml: `<p style="margin:16px 0 0;font-size:13px;">${no ? "Programguide" : "Program guide"}: <a href="${guideUrl}">${guideUrl}</a></p>`,
    footer: { reason: no ? "Du mottar denne fordi bedriften din søkte om å bli Creatorhub-partner." : "You received this because your company applied to become a Creatorhub partner." },
  });
  await sendTransactionalEmail({
    to: args.to, subject, html, text,
    fromLabel: "Creatorhub", kind: "editing_partner_portal_welcome",
    sentByUserId: args.sentBy ?? null, pool,
  });
}

// Invitasjon til å SØKE selv (lead → selv-avgjørelse + samtykke). Lenke forhåndsutfyller
// firma/e-post på /partner/apply; prospektet fyller ut + samtykker selv.
async function sendInviteEmail(pool: Pool, args: {
  to: string; companyName: string; isForeign: boolean; sentBy?: string;
}): Promise<void> {
  const applyUrl = `${PORTAL_BASE}/partner/apply?email=${encodeURIComponent(args.to)}&company=${encodeURIComponent(args.companyName)}`;
  const no = !args.isForeign;
  const subject = no ? "Invitasjon: bli redigeringspartner i Creatorhub" : "You're invited to apply as a Creatorhub editing partner";
  const headline = no ? "Du er invitert til å søke" : "You're invited to apply";
  const body = no
    ? `Hei ${args.companyName}! Vi vil gjerne ha dere med i Creatorhub Partner Program for redigering. Klikk under for å fylle ut søknaden selv (et par minutter) — dere bestemmer selv og bekrefter vilkårene. Vi ser frem til porteføljen deres.`
    : `Hi ${args.companyName}! We'd love to have you in the Creatorhub editing Partner Program. Click below to fill in the application yourself (a couple of minutes) — you decide and confirm the terms. We look forward to seeing your portfolio.`;
  const { html, text } = composeEmail({
    category: "general", brand: "creatorhub", subject, headline,
    subhead: no ? "Creatorhub Partnerprogram" : "Creatorhub Partner Program",
    body,
    cta: { label: no ? "Søk nå" : "Apply now", href: applyUrl, variant: "primary" },
    footer: { reason: no ? "Du mottar denne fordi vi tror bedriften din passer som Creatorhub-partner. Svar STOPP for å takke nei." : "You received this because we think your company is a good fit as a Creatorhub partner. Reply STOP to opt out." },
  });
  await sendTransactionalEmail({
    to: args.to, subject, html, text,
    fromLabel: "Creatorhub", kind: "editing_partner_invite",
    sentByUserId: args.sentBy ?? null, pool,
  });
}

export function setupEditingPartnerApplicationsAdminRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // Liste over søknader (nyeste først).
  app.get("/api/superadmin/editing-partner-applications", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT * FROM editing_partner_applications ORDER BY created_at DESC LIMIT 200`,
      );
      res.json({ applications: r.rows });
    } catch (err) {
      console.error("[partner-apps:list]", err);
      res.status(500).json({ error: "kunne_ikke_hente" });
    }
  });

  // Prototype-tester-ansvar: hvilke prototype-vendors har (ikke) gitt
  // tilbakemelding nylig. 0%-fordelen forutsetter jevnlig feedback — denne
  // oversikten viser forfalte testere så admin kan påminne / trekke statusen.
  app.get("/api/superadmin/editing/prototype-feedback", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const overdueDays = Number(process.env.PROTOTYPE_FEEDBACK_OVERDUE_DAYS) || 30;
      const warnDays = Number(process.env.PROTOTYPE_FEEDBACK_WARN_DAYS) || 60;
      const r = await pool.query(
        `SELECT v.user_id, v.vendor_name, u.email, v.prototype_until, v.approved_at,
                fb.last_at AS last_feedback_at, fb.cnt AS feedback_count,
                CASE WHEN fb.last_at IS NULL THEN NULL
                     ELSE EXTRACT(DAY FROM now() - fb.last_at)::int END AS days_since
           FROM vendor_onboarding_profiles v
           LEFT JOIN users u ON u.id = v.user_id
           LEFT JOIN LATERAL (
             SELECT MAX(COALESCE(submitted_at, created_at)) AS last_at, COUNT(*) AS cnt
               FROM prototype_feedback p WHERE p.user_id = v.user_id
           ) fb ON true
          WHERE v.vendor_type = 'editing' AND v.partner_type = 'prototype'
            AND v.approval_status = 'approved'
          ORDER BY fb.last_at ASC NULLS FIRST`,
      );

      // Improvement C — atferdssignaler. Best-effort: tom hvis tabellen ikke
      // finnes ennå (opprettes lazily ved første beacon-skriv).
      const activityByUser = new Map<
        string,
        { lastActiveAt: string | null; events7d: number; errors7d: number; surfaces: string[] }
      >();
      try {
        const act = await pool.query(
          `SELECT user_id,
                  MAX(created_at) AS last_active_at,
                  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') AS events_7d,
                  COUNT(*) FILTER (WHERE event_type = 'error_seen'
                                     AND created_at > now() - INTERVAL '7 days') AS errors_7d,
                  array_remove(
                    array_agg(DISTINCT surface) FILTER (WHERE created_at > now() - INTERVAL '7 days'),
                    NULL
                  ) AS surfaces
             FROM prototype_activity_signals
            GROUP BY user_id`,
        );
        for (const a of act.rows as Array<Record<string, unknown>>) {
          activityByUser.set(String(a.user_id), {
            lastActiveAt: a.last_active_at ? new Date(a.last_active_at as string).toISOString() : null,
            events7d: Number(a.events_7d || 0),
            errors7d: Number(a.errors_7d || 0),
            surfaces: Array.isArray(a.surfaces)
              ? (a.surfaces as unknown[]).filter((x): x is string => typeof x === "string")
              : [],
          });
        }
      } catch {
        // tabell finnes ikke ennå → ingen aktivitet å vise
      }

      const rows = r.rows.map((row: Record<string, unknown>) => {
        const days = row.days_since == null ? null : Number(row.days_since);
        const eff = days == null ? Number.MAX_SAFE_INTEGER : days;
        const escalation = eff >= warnDays ? "warning" : eff >= overdueDays ? "due" : "ok";
        return {
          userId: row.user_id,
          vendorName: row.vendor_name,
          email: row.email,
          prototypeUntil: row.prototype_until,
          approvedAt: row.approved_at,
          lastFeedbackAt: row.last_feedback_at,
          feedbackCount: Number(row.feedback_count || 0),
          daysSince: days,
          everGiven: !!row.last_feedback_at,
          escalation,
          activity: activityByUser.get(String(row.user_id)) || null,
        };
      });
      res.json({
        thresholds: { overdueDays, warnDays },
        total: rows.length,
        overdueCount: rows.filter((x) => x.escalation !== "ok").length,
        vendors: rows,
      });
    } catch (err) {
      console.error("[prototype-feedback overview]", err);
      res.status(500).json({ error: "kunne_ikke_hente" });
    }
  });

  // Cron/admin: e-post-påminnelse til FORFALTE prototype-testere. Proaktiv
  // kanal (når de ikke er innlogget) — dashboard-banneret dekker innlogget.
  // Dual-auth: x-cron-trigger-token ELLER super-admin. Kjør ukentlig (cadencen
  // er throttlen — ingen per-bruker last_reminded nødvendig).
  app.post("/api/cron/prototype-feedback-reminders", async (req, res) => {
    const cronToken = req.headers["x-cron-trigger-token"] as string | undefined;
    const expected = process.env.CRON_TRIGGER_TOKEN;
    const viaToken = expected && cronToken && cronToken === expected;
    if (!viaToken) {
      const sess = await requireSuperAdmin(req, res, pool, activeSessions);
      if (!sess) return;
    }
    try {
      const overdueDays = Number(process.env.PROTOTYPE_FEEDBACK_OVERDUE_DAYS) || 30;
      const r = await pool.query(
        `SELECT v.user_id, v.vendor_name, u.email,
                fb.last_at,
                CASE WHEN fb.last_at IS NULL THEN NULL
                     ELSE EXTRACT(DAY FROM now() - fb.last_at)::int END AS days_since
           FROM vendor_onboarding_profiles v
           JOIN users u ON u.id = v.user_id
           LEFT JOIN LATERAL (
             SELECT MAX(COALESCE(submitted_at, created_at)) AS last_at
               FROM prototype_feedback p WHERE p.user_id = v.user_id
           ) fb ON true
          WHERE v.vendor_type = 'editing' AND v.partner_type = 'prototype'
            AND v.approval_status = 'approved' AND u.email IS NOT NULL
            AND (fb.last_at IS NULL OR fb.last_at < now() - ($1 || ' days')::interval)`,
        [overdueDays],
      );
      const workspaceUrl = `${PORTAL_BASE}/partner/portal`;
      let sent = 0;
      for (const row of r.rows as Array<{ email: string; vendor_name: string | null; days_since: number | null; last_at: Date | null }>) {
        const intro = row.last_at
          ? `Det er ${row.days_since} dager siden din siste tilbakemelding.`
          : "Vi har ennå ikke mottatt tilbakemelding fra deg.";
        try {
          await sendTransactionalEmail({
            to: row.email,
            subject: "Påminnelse: gi tilbakemelding som prototype-tester",
            html: `<p>Hei ${row.vendor_name || ""},</p><p>${intro}</p>`
              + `<p>Som prototype-tester har du <strong>0 % plattformgebyr</strong> — avtalen forutsetter at du `
              + `hjelper oss å forbedre systemet med jevnlig tilbakemelding. Logg inn og bruk «Gi tilbakemelding» `
              + `i partner-arbeidsområdet.</p><p><a href="${workspaceUrl}">Åpne partner-arbeidsområdet</a></p>`,
            text: `Hei ${row.vendor_name || ""},\n${intro}\nSom prototype-tester har du 0 % plattformgebyr — `
              + `avtalen forutsetter jevnlig tilbakemelding. Gi tilbakemelding: ${workspaceUrl}`,
            fromLabel: "Creatorhub",
            kind: "prototype_feedback_reminder",
            pool,
          });
          sent += 1;
        } catch (e) {
          console.error("[prototype-feedback reminder] email failed", e);
        }
      }
      res.json({ ok: true, overdue: r.rows.length, sent });
    } catch (err) {
      console.error("[prototype-feedback reminders]", err);
      res.status(500).json({ error: "kunne_ikke_sende" });
    }
  });

  // Liste over godkjente redigeringsvendors m/ partner-type/fee (for admin-panelet, filtrerbar).
  app.get("/api/superadmin/editing/vendors", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT p.user_id, p.vendor_name, p.country, p.is_foreign, p.approval_status,
                p.partner_type, p.prototype_until, p.platform_fee_bps,
                p.rating, p.review_count, p.quality_flagged, p.approved_at,
                u.email
           FROM vendor_onboarding_profiles p
           LEFT JOIN users u ON u.id = p.user_id
          WHERE p.vendor_type = 'editing'
          ORDER BY p.approved_at DESC NULLS LAST, p.created_at DESC
          LIMIT 300`,
      );
      res.json({ vendors: r.rows });
    } catch (err) {
      console.error("[editing-vendors:list]", err);
      res.status(500).json({ error: "kunne_ikke_hente" });
    }
  });

  // Endre partner-type/fee/prototype-varighet for en eksisterende vendor.
  app.patch("/api/superadmin/editing/vendors/:userId/partner-type", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const partnerType = req.body?.partnerType === "standard" ? "standard"
        : req.body?.partnerType === "prototype" ? "prototype" : null;
      let prototypeUntil: string | null = null;
      if (partnerType === "prototype") {
        if (req.body?.prototypeUntil) prototypeUntil = new Date(req.body.prototypeUntil).toISOString();
        else if (Number.isFinite(Number(req.body?.prototypeMonths)) && Number(req.body.prototypeMonths) > 0) {
          const d = new Date(); d.setMonth(d.getMonth() + Number(req.body.prototypeMonths)); prototypeUntil = d.toISOString();
        }
      }
      const platformFeeBps = Number.isFinite(Number(req.body?.platformFeeBps))
        ? Math.max(0, Math.round(Number(req.body.platformFeeBps))) : null;
      const upd = await pool.query(
        `UPDATE vendor_onboarding_profiles
            SET partner_type=$2, prototype_until=$3, platform_fee_bps=$4, updated_at=now()
          WHERE user_id=$1 AND vendor_type='editing'
        RETURNING user_id, partner_type, prototype_until, platform_fee_bps`,
        [req.params.userId, partnerType, prototypeUntil, platformFeeBps],
      );
      if (!upd.rows[0]) return res.status(404).json({ error: "vendor_ikke_funnet" });
      res.json({ ok: true, vendor: upd.rows[0] });
    } catch (err) {
      console.error("[editing-vendors:partner-type]", err);
      res.status(500).json({ error: "kunne_ikke_oppdatere" });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TEST/diagnostikk (admin Betalingstest-fane) — PayPal-helse + escrow-simulering
  // ════════════════════════════════════════════════════════════════════
  app.get("/api/superadmin/editing/test/jobs", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT id, project_title, vendor_name, amount_cents, currency, status,
                payment_method, payment_status, payout_method, payout_status, payout_reference, created_at
           FROM editing_jobs ORDER BY created_at DESC LIMIT 25`,
      );
      res.json({ jobs: r.rows });
    } catch (err) {
      console.error("[editing/test/jobs]", err);
      res.status(500).json({ error: "kunne_ikke_hente" });
    }
  });

  // Simuler betalt: sett escrow 'held' uten faktisk betaling (kun test).
  app.post("/api/superadmin/editing/test/jobs/:id/simulate-paid", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `UPDATE editing_jobs SET payment_status='held', payment_method=COALESCE(payment_method,'test'), updated_at=NOW()
          WHERE id=$1 AND payment_status IS DISTINCT FROM 'released' RETURNING id, payment_status`,
        [req.params.id],
      );
      if (!r.rows[0]) return res.status(404).json({ error: "ikke_funnet_eller_released" });
      res.json({ ok: true, ...r.rows[0] });
    } catch (err) {
      console.error("[editing/test/simulate-paid]", err);
      res.status(500).json({ error: "kunne_ikke_simulere" });
    }
  });

  // PayPal-helse (OAuth) + valgfri test-payout til en sandbox-e-post.
  app.post("/api/superadmin/editing/test/paypal-ping", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const health = await paypalHealthCheck();
      let payout: { ok: boolean; batchId?: string; error?: string } | null = null;
      const email = req.body?.email ? String(req.body.email).trim() : "";
      if (email && health.ok) {
        const amountCents = Number.isFinite(Number(req.body?.amountCents)) ? Math.round(Number(req.body.amountCents)) : 100;
        payout = await paypalTestPayout(email, amountCents);
      }
      res.json({ health, payout });
    } catch (err) {
      console.error("[editing/test/paypal-ping]", err);
      res.status(500).json({ error: "kunne_ikke_teste" });
    }
  });

  // Legg til en LEAD (prospekt) — uten samtykke, godkjenner ingenting. Dedupe på e-post.
  app.post("/api/superadmin/editing-partner-applications/lead", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 255);
      const companyName = String(req.body?.companyName || "").trim().slice(0, 300);
      const country = String(req.body?.country || "NO").trim().toUpperCase().slice(0, 2);
      if (!email.includes("@") || !companyName) return res.status(400).json({ error: "mangler_felt" });
      const isForeign = country !== "NO";
      const existing = (await pool.query<{ id: string; status: string }>(
        `SELECT id, status FROM editing_partner_applications WHERE lower(contact_email)=lower($1) ORDER BY created_at DESC LIMIT 1`, [email],
      )).rows[0];
      if (existing) return res.json({ ok: true, id: existing.id, existed: true, status: existing.status });
      const r = await pool.query<{ id: string }>(
        `INSERT INTO editing_partner_applications
           (company_name, country, is_foreign, is_eea, contact_name, contact_email, notes,
            consent_contact, consent_privacy, status, locale, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,false,false,'lead',$8,'admin_lead') RETURNING id`,
        [companyName, country, isForeign, !isForeign /* enkel EØS-antakelse for lead */, String(req.body?.contactName || "").slice(0, 200) || companyName, email, String(req.body?.notes || "").slice(0, 4000), isForeign ? "en" : "no"],
      );
      res.json({ ok: true, id: r.rows[0].id });
    } catch (err) {
      console.error("[partner-apps:lead]", err);
      res.status(500).json({ error: "kunne_ikke_opprette_lead" });
    }
  });

  // Inviter et prospekt til å søke selv (e-post m/ forhåndsutfylt apply-lenke).
  app.post("/api/superadmin/editing-partner-applications/:id/invite", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const row = (await pool.query(
        `SELECT contact_email, company_name, is_foreign FROM editing_partner_applications WHERE id=$1`, [req.params.id],
      )).rows[0];
      if (!row) return res.status(404).json({ error: "ikke_funnet" });
      await sendInviteEmail(pool, { to: row.contact_email, companyName: row.company_name, isForeign: !!row.is_foreign, sentBy: s.userId });
      res.json({ ok: true });
    } catch (err) {
      console.error("[partner-apps:invite]", err);
      res.status(500).json({ error: "kunne_ikke_sende_invitasjon" });
    }
  });

  // Godkjenn — transaksjonelt: users-rad → profil approved → app approved.
  app.post("/api/superadmin/editing-partner-applications/:id/approve", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const appRow = (await client.query(
        `SELECT * FROM editing_partner_applications
          WHERE id = $1 AND status IN ('pending','reviewing') FOR UPDATE`,
        [req.params.id],
      )).rows[0];
      if (!appRow) { await client.query("ROLLBACK"); return res.status(404).json({ error: "ikke_funnet_eller_behandlet" }); }

      // Admin-beslutning: prototype-tester (0 % i en periode) vs. vanlig kunde (fee).
      const partnerType = req.body?.partnerType === "standard" ? "standard"
        : req.body?.partnerType === "prototype" ? "prototype" : null;
      let prototypeUntil: string | null = null;
      if (partnerType === "prototype") {
        if (req.body?.prototypeUntil) prototypeUntil = new Date(req.body.prototypeUntil).toISOString();
        else if (Number.isFinite(Number(req.body?.prototypeMonths)) && Number(req.body.prototypeMonths) > 0) {
          const d = new Date(); d.setMonth(d.getMonth() + Number(req.body.prototypeMonths)); prototypeUntil = d.toISOString();
        }
      }
      const platformFeeBps = Number.isFinite(Number(req.body?.platformFeeBps))
        ? Math.max(0, Math.round(Number(req.body.platformFeeBps))) : null;

      const email = String(appRow.contact_email).toLowerCase();
      // 1) Find-or-create users-rad (søker har aldri logget inn).
      let userId = (await client.query<{ id: string }>(
        `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email],
      )).rows[0]?.id;
      if (!userId) {
        userId = (await client.query<{ id: string }>(
          `INSERT INTO users (username, password, email, role, language, company_name)
           VALUES ($1, $2, $3, 'editing_vendor', $4, $5) RETURNING id`,
          [
            email,
            `magiclink_${crypto.randomBytes(24).toString("hex")}`, // ikke-innloggbar
            appRow.contact_email,
            appRow.is_foreign ? "en" : "no",
            appRow.company_name,
          ],
        )).rows[0].id;
      }

      // 2) Find-or-create vendor-profil (approved).
      const prof = (await client.query<{ id: string }>(
        `SELECT id FROM vendor_onboarding_profiles WHERE user_id = $1 LIMIT 1`, [userId],
      )).rows[0];
      if (prof) {
        await client.query(
          `UPDATE vendor_onboarding_profiles
              SET vendor_type='editing', approval_status='approved', approved_at=now(),
                  approved_by=$2, is_foreign=$3, country=$4, is_eea=$5,
                  partner_type=$6, prototype_until=$7, platform_fee_bps=$8, updated_at=now()
            WHERE user_id=$1`,
          [userId, s.userId, !!appRow.is_foreign, appRow.country, appRow.is_eea, partnerType, prototypeUntil, platformFeeBps],
        );
      } else {
        await client.query(
          // Eksplisitt id (ikke avhengig av kolonne-default — som tidligere var
          // feilsatt til den literale strengen 'gen_random_uuid()', se mig 0348).
          `INSERT INTO vendor_onboarding_profiles
             (id, user_id, vendor_type, vendor_name, business_info, approval_status, approved_at,
              approved_by, is_foreign, country, is_eea, partner_type, prototype_until, platform_fee_bps)
           VALUES ($10, $1, 'editing', $2, '{}'::jsonb, 'approved', now(), $3, $4, $5, $6, $7, $8, $9)`,
          [userId, appRow.company_name, s.userId, !!appRow.is_foreign, appRow.country, appRow.is_eea, partnerType, prototypeUntil, platformFeeBps, crypto.randomUUID()],
        );
      }

      // 3) Marker søknad godkjent + lenk vendor.
      await client.query(
        `UPDATE editing_partner_applications
            SET status='approved', vendor_user_id=$2, reviewed_by=$3, reviewed_at=now(),
                review_notes=COALESCE($4, review_notes), updated_at=now()
          WHERE id=$1`,
        [req.params.id, userId, s.userId, req.body?.notes || null],
      );
      await client.query("COMMIT");

      // 4) Mint magic-link + send velkomst-e-post (etter commit).
      const { jti, rawToken } = await mintPortalToken(pool, { vendorUserId: userId, email: appRow.contact_email, createdBy: s.userId });
      try {
        await sendWelcomeEmail(pool, {
          to: appRow.contact_email, companyName: appRow.company_name,
          isForeign: !!appRow.is_foreign, jti, rawToken, sentBy: s.userId,
          partnerType, prototypeUntil, platformFeeBps,
        });
      } catch (mailErr) {
        console.error("[partner-apps:approve] e-post feilet (ufarlig)", mailErr);
      }
      res.json({ ok: true, vendorUserId: userId, portalUrl: `${PORTAL_BASE}/partner-portal?jti=${jti}&t=${rawToken}` });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[partner-apps:approve]", err);
      res.status(500).json({ error: "kunne_ikke_godkjenne" });
    } finally {
      client.release();
    }
  });

  // Avvis (med retensjon for PII-sletting).
  app.post("/api/superadmin/editing-partner-applications/:id/reject", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      await pool.query(
        `UPDATE editing_partner_applications
            SET status='rejected', reviewed_by=$2, reviewed_at=now(),
                review_notes=$3, purge_after=now() + INTERVAL '30 days', updated_at=now()
          WHERE id=$1`,
        [req.params.id, s.userId, req.body?.notes || null],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[partner-apps:reject]", err);
      res.status(500).json({ error: "kunne_ikke_avvise" });
    }
  });

  // Send magic-link på nytt (tilbakekaller gamle først).
  app.post("/api/superadmin/editing/vendors/:userId/resend-link", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const u = (await pool.query<{ email: string; company_name: string; is_foreign: boolean }>(
        `SELECT u.email, p.vendor_name AS company_name, p.is_foreign
           FROM users u LEFT JOIN vendor_onboarding_profiles p ON p.user_id = u.id
          WHERE u.id = $1 LIMIT 1`,
        [req.params.userId],
      )).rows[0];
      if (!u?.email) return res.status(404).json({ error: "ikke_funnet" });
      await revokeVendorPortalTokens(pool, req.params.userId); // gamle lenker dør
      const { jti, rawToken } = await mintPortalToken(pool, { vendorUserId: req.params.userId, email: u.email, createdBy: s.userId });
      await sendWelcomeEmail(pool, { to: u.email, companyName: u.company_name || "", isForeign: !!u.is_foreign, jti, rawToken, sentBy: s.userId });
      res.json({ ok: true });
    } catch (err) {
      console.error("[partner-apps:resend]", err);
      res.status(500).json({ error: "kunne_ikke_sende" });
    }
  });

  // Tilbakekall partner-tilgang.
  app.post("/api/superadmin/editing/vendors/:userId/revoke", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      await pool.query(
        `UPDATE vendor_onboarding_profiles SET approval_status='revoked', updated_at=now() WHERE user_id=$1`,
        [req.params.userId],
      );
      await revokeVendorPortalTokens(pool, req.params.userId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[partner-apps:revoke]", err);
      res.status(500).json({ error: "kunne_ikke_tilbakekalle" });
    }
  });
}
