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
}): Promise<void> {
  const portalUrl = `${PORTAL_BASE}/partner-portal?jti=${args.jti}&t=${encodeURIComponent(args.rawToken)}`;
  const guideUrl = `${PORTAL_BASE}/partner-portal/guide`;
  const no = !args.isForeign;
  const subject = no
    ? "Velkommen som Creatorhub-partner – aktiver portal-tilgangen din"
    : "Welcome to the Creatorhub Partner Program – activate your portal access";
  const headline = no ? "Søknaden din er godkjent" : "Your application is approved";
  const body = no
    ? `Gratulerer, ${args.companyName}! Du er godkjent som Creatorhub redigeringspartner. Klikk knappen under for å logge inn i partnerportalen og fullføre verifiseringen (compliance, lagring og betaling). Lenken er personlig og gyldig i 14 dager.`
    : `Congratulations, ${args.companyName}! You have been approved as a Creatorhub editing partner. Click the button below to sign in to your partner portal and complete verification (compliance, storage and payments). The link is personal and valid for 14 days.`;
  const { html, text } = composeEmail({
    category: "general",
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
                  approved_by=$2, is_foreign=$3, country=$4, is_eea=$5, updated_at=now()
            WHERE user_id=$1`,
          [userId, s.userId, !!appRow.is_foreign, appRow.country, appRow.is_eea],
        );
      } else {
        await client.query(
          `INSERT INTO vendor_onboarding_profiles
             (user_id, vendor_type, vendor_name, business_info, approval_status, approved_at,
              approved_by, is_foreign, country, is_eea)
           VALUES ($1, 'editing', $2, '{}'::jsonb, 'approved', now(), $3, $4, $5, $6)`,
          [userId, appRow.company_name, s.userId, !!appRow.is_foreign, appRow.country, appRow.is_eea],
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
