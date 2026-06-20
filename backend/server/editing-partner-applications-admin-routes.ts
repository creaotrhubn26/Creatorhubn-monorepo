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
          `INSERT INTO vendor_onboarding_profiles
             (user_id, vendor_type, vendor_name, business_info, approval_status, approved_at,
              approved_by, is_foreign, country, is_eea, partner_type, prototype_until, platform_fee_bps)
           VALUES ($1, 'editing', $2, '{}'::jsonb, 'approved', now(), $3, $4, $5, $6, $7, $8, $9)`,
          [userId, appRow.company_name, s.userId, !!appRow.is_foreign, appRow.country, appRow.is_eea, partnerType, prototypeUntil, platformFeeBps],
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
