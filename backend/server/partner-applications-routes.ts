/**
 * partner-applications-routes.ts
 *
 * Partnerskaps-søknads-flyt:
 *   1. Org-admin søker  → POST /api/leadgrid/partner-applications
 *   2. Superadmin inviterer → POST /api/superadmin/partner-applications/invite
 *   3. Superadmin reviewer → GET /api/superadmin/partner-applications
 *   4. Superadmin godkjenner → POST .../:id/approve
 *      → kopierer til leadgrid_partners (status='approved')
 *      → oppgraderer plan via partner_benefits
 *      → sender bekreftelses-mail
 *   5. Superadmin avslår   → POST .../:id/reject + begrunnelse
 *
 * Vilkår-tekst hentes fra partner_terms_versions (versjon registreres
 * i applikasjonen for bevisbarhet).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { notifyAdmins } from "./admin-notify";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response, pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, activeSessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id=$1`, [s.userId]);
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" }); return null;
  }
  return s;
}

// Default scopes per partner-type ved auto-key-generering
const DEFAULT_SCOPES_BY_PARTNER_TYPE: Record<string, string[]> = {
  integration: [
    "customers.read", "customers.write", "needs.read", "signals.read",
    "deliverables.read", "organizations.read", "webhooks.read",
  ],
  reseller: ["organizations.read", "customers.read"],
  strategic: [
    "customers.read", "customers.write", "needs.read", "signals.read",
    "deliverables.read", "organizations.read", "webhooks.read",
  ],
  customer: [],  // kunder får ikke API-tilgang som default
};

async function autoGenerateApiKey(
  pool: Pool,
  opts: {
    organizationId: string;
    partnerType: string;
    partnerName: string;
    createdBy: string;
  },
): Promise<{ raw_key: string; key_id: string } | null> {
  const scopes = DEFAULT_SCOPES_BY_PARTNER_TYPE[opts.partnerType] ?? [];
  if (scopes.length === 0) return null;

  const env = process.env.NODE_ENV === "production" ? "live" : "test";
  const rawKey = `lg_${env}_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawKey.substring(0, 12);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const r = await pool.query<{ id: string }>(
    `INSERT INTO partner_api_keys
      (organization_id, key_prefix, key_hash, name, scopes, created_by)
     VALUES ($1, $2, $3, $4, $5::text[], $6)
     RETURNING id::text`,
    [
      opts.organizationId, keyPrefix, keyHash,
      `${opts.partnerName} (auto-generated)`,
      scopes, opts.createdBy,
    ],
  );
  return { raw_key: rawKey, key_id: r.rows[0].id };
}

async function applyPartnerBenefits(
  pool: Pool, organizationId: string, partnerType: string,
): Promise<{ plan_upgraded: boolean; api_access: boolean }> {
  const benefitR = await pool.query<{
    auto_upgrade_to_plan: string | null;
    override_auto_onboards: number | null;
    override_max_customers: number | null;
    grants_api_access: boolean;
  }>(
    `SELECT auto_upgrade_to_plan, override_auto_onboards,
            override_max_customers, grants_api_access
       FROM partner_benefits WHERE partner_type = $1`,
    [partnerType],
  );
  if (benefitR.rows.length === 0) return { plan_upgraded: false, api_access: false };
  const b = benefitR.rows[0];

  let planUpgraded = false;
  if (b.auto_upgrade_to_plan) {
    await pool.query(
      `UPDATE organizations SET plan = $1, plan_started_at = COALESCE(plan_started_at, now())
        WHERE id = $2 AND plan != $1`,
      [b.auto_upgrade_to_plan, organizationId],
    );
    planUpgraded = true;
  }

  // Override-kvoter lagres i organizations.meta som "plan_overrides"
  if (b.override_auto_onboards != null || b.override_max_customers != null) {
    await pool.query(
      `UPDATE organizations
          SET meta = COALESCE(meta, '{}'::jsonb) ||
                     jsonb_build_object('plan_overrides',
                       jsonb_build_object(
                         'max_auto_onboards_per_month', $2::int,
                         'max_active_customers', $3::int,
                         'reason', 'partner_benefit'
                       ))
        WHERE id = $1`,
      [organizationId, b.override_auto_onboards, b.override_max_customers],
    );
  }

  return { plan_upgraded: planUpgraded, api_access: b.grants_api_access };
}

export function registerPartnerApplicationsRoutes({
  app, pool, activeSessions,
}: Deps): void {

  // ---------- Hent aktiv vilkår-versjon (public) ----------
  app.get("/api/leadgrid/partner-terms", async (_req, res) => {
    const r = await pool.query(
      `SELECT version, body_md, effective_at
         FROM partner_terms_versions WHERE is_current = TRUE
         ORDER BY effective_at DESC LIMIT 1`,
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ingen vilkår satt" });
    res.json(r.rows[0]);
  });

  // ---------- Org-admin: send søknad ----------
  app.post("/api/leadgrid/partner-applications", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const {
      organizationId, partnerType, proposedTagline, reason,
      proposedLogoUrl, termsVersion, agreedToTerms,
    } = req.body ?? {};
    if (!organizationId || !partnerType) {
      return res.status(400).json({ error: "organizationId og partnerType påkrevd" });
    }
    if (!agreedToTerms) {
      return res.status(400).json({ error: "Du må godta vilkårene" });
    }
    // Sjekk at brukeren er admin i org'en
    const adminR = await pool.query(
      `SELECT 1 FROM organization_members
        WHERE organization_id = $1 AND user_id = $2 AND role = 'admin'`,
      [organizationId, session.userId],
    );
    if (adminR.rows.length === 0) {
      return res.status(403).json({ error: "Kun org-admin kan søke om partnerskap" });
    }
    // Sjekk at ingen pending søknad finnes
    const existR = await pool.query(
      `SELECT id FROM partner_applications
        WHERE organization_id = $1 AND status = 'pending'`,
      [organizationId],
    );
    if (existR.rows.length > 0) {
      return res.status(409).json({
        error: "Det finnes allerede en pending søknad",
        application_id: existR.rows[0].id,
      });
    }

    try {
      const r = await pool.query(
        `INSERT INTO partner_applications
          (organization_id, applicant_user_id, origin, partner_type,
           proposed_logo_url, proposed_tagline, reason,
           terms_version, consent_at, consent_ip, consent_user_agent,
           status)
         VALUES ($1, $2, 'application', $3, $4, $5, $6,
                 $7, now(), $8, $9, 'pending')
         RETURNING id, created_at`,
        [
          organizationId, session.userId, partnerType,
          proposedLogoUrl ?? null, proposedTagline ?? null, reason ?? null,
          termsVersion ?? null,
          req.ip ?? null, (req.headers["user-agent"] as string) ?? null,
        ],
      );

      // Varsel til admins (e-post til super_admins + innboks-rad)
      void notifyAdmins(pool, {
        type: "leadgrid_partner_application",
        source: "Leadgrid · partner-søknad (org-admin)",
        title: `Ny partner-søknad (${partnerType})`,
        summary: `Org: ${organizationId}${proposedTagline ? ` · ${proposedTagline}` : ""}${reason ? ` · ${reason}` : ""}`,
        link: "/admin",
        cta: (req.body && req.body.cta) || null,
        page: req.get("referer") || (req.body && req.body.page) || null,
        utm: (req.body && req.body.utm) || null,
        relatedId: r.rows[0].id,
      });

      res.status(201).json({ application_id: r.rows[0].id, status: "pending" });
    } catch (e) {
      console.error("[partner-app] create", e);
      res.status(500).json({ error: "Kunne ikke opprette søknad" });
    }
  });

  // ---------- Org: hent egen status ----------
  app.get("/api/leadgrid/partner-applications/my", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: "orgId påkrevd" });
    const r = await pool.query(
      `SELECT pa.id, pa.status, pa.partner_type, pa.proposed_tagline,
              pa.reason, pa.terms_version, pa.created_at, pa.reviewed_at,
              pa.review_notes, pa.origin,
              lp.id AS partner_id, lp.is_active AS partner_active,
              lp.show_on_landing
         FROM partner_applications pa
         LEFT JOIN leadgrid_partners lp ON lp.id = pa.created_partner_id
        WHERE pa.organization_id = $1
        ORDER BY pa.created_at DESC LIMIT 5`,
      [orgId],
    );
    res.json({ applications: r.rows });
  });

  // ---------- Org: trekk tilbake søknad ----------
  app.post("/api/leadgrid/partner-applications/:id/withdraw", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    // Verifiser at brukeren er org-admin for søknaden
    const r = await pool.query(
      `UPDATE partner_applications
          SET status = 'withdrawn', updated_at = now()
        WHERE id = $1
          AND status = 'pending'
          AND organization_id IN (
            SELECT organization_id FROM organization_members
             WHERE user_id = $2 AND role = 'admin'
          )
        RETURNING id`,
      [req.params.id, session.userId],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet eller ikke tillatt" });
    res.json({ ok: true });
  });

  // ---------- Superadmin: liste alle ----------
  app.get("/api/superadmin/partner-applications", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const status = (req.query.status as string) || "pending";
    try {
      const r = await pool.query(
        `SELECT pa.*,
                o.name AS org_name, o.org_type, o.plan,
                o.logo_url AS org_logo_url, o.website AS org_website,
                u.email AS applicant_email
           FROM partner_applications pa
           JOIN organizations o ON o.id = pa.organization_id
           LEFT JOIN users u ON u.id = pa.applicant_user_id
          WHERE pa.status = $1
          ORDER BY pa.created_at DESC
          LIMIT 100`,
        [status],
      );
      res.json({ applications: r.rows });
    } catch (err) {
      // Graceful: tabell/kolonne mangler → tom liste (iPad viser "Ingen søknader").
      console.warn("[partner-applications] list failed:", (err as Error).message);
      res.json({ applications: [] });
    }
  });

  // ---------- Superadmin: inviter org til partnerskap ----------
  app.post("/api/superadmin/partner-applications/invite", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { organizationId, partnerType, message } = req.body ?? {};
    if (!organizationId || !partnerType) {
      return res.status(400).json({ error: "organizationId og partnerType påkrevd" });
    }
    const orgR = await pool.query<{ name: string; contact_email: string | null }>(
      `SELECT name, contact_email FROM organizations WHERE id = $1`,
      [organizationId],
    );
    if (orgR.rows.length === 0) return res.status(404).json({ error: "Org finnes ikke" });

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    try {
      const r = await pool.query(
        `INSERT INTO partner_applications
          (organization_id, origin, partner_type, status,
           invitation_token, invitation_expires_at, review_notes)
         VALUES ($1, 'invitation', $2, 'pending', $3, $4, $5)
         RETURNING id`,
        [organizationId, partnerType, inviteToken, expiresAt, message ?? null],
      );

      // Send e-post til org-eier
      const recipient = orgR.rows[0].contact_email;
      if (recipient) {
        const acceptUrl = `${PUBLIC_BASE}/leadgrid/partner-invitation/${inviteToken}`;
        try {
          await sendTransactionalEmail({
            to: recipient,
            subject: `Du er invitert som Leadgrid-partner`,
            html: `<p>Hei,</p>
                   <p>${orgR.rows[0].name} er invitert som <strong>${partnerType}</strong>-partner i Leadgrid.</p>
                   ${message ? `<blockquote>${message}</blockquote>` : ""}
                   <p><a href="${acceptUrl}">Klikk her for å se vilkårene og akseptere</a></p>
                   <p>Lenken er gyldig i 14 dager.</p>`,
            text: `${orgR.rows[0].name} er invitert som ${partnerType}-partner. Aksepter: ${acceptUrl}`,
            kind: "partner_invitation",
            sentByUserId: s.userId,
            pool,
          });
        } catch (e) { console.error("[partner-invite mail]", e); }
      }
      res.status(201).json({ application_id: r.rows[0].id, invitation_token_preview: inviteToken.substring(0, 8) + "…" });
    } catch (e) {
      console.error("[partner-invite]", e);
      res.status(500).json({ error: "Kunne ikke invitere" });
    }
  });

  // ---------- Public: aksepter invitasjon via token ----------
  app.post("/api/leadgrid/partner-invitation/:token/accept", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Logg inn først" });
    const { agreedToTerms, termsVersion, proposedTagline, proposedLogoUrl } = req.body ?? {};
    if (!agreedToTerms) return res.status(400).json({ error: "Du må godta vilkårene" });

    // Hent invite + sjekk medlemskap
    const r = await pool.query(
      `UPDATE partner_applications
          SET applicant_user_id = $1,
              proposed_tagline = COALESCE($2, proposed_tagline),
              proposed_logo_url = COALESCE($3, proposed_logo_url),
              terms_version = $4,
              consent_at = now(),
              consent_ip = $5,
              consent_user_agent = $6,
              updated_at = now()
        WHERE invitation_token = $7
          AND status = 'pending'
          AND invitation_expires_at > now()
          AND organization_id IN (
            SELECT organization_id FROM organization_members
             WHERE user_id = $1 AND role = 'admin'
          )
        RETURNING id, organization_id, partner_type`,
      [
        session.userId, proposedTagline ?? null, proposedLogoUrl ?? null,
        termsVersion ?? null, req.ip ?? null,
        (req.headers["user-agent"] as string) ?? null,
        req.params.token,
      ],
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Ugyldig eller utløpt invitasjon, eller du er ikke org-admin" });
    }
    res.json({ ok: true, application_id: r.rows[0].id, status: "pending_review" });
  });

  // ---------- Superadmin: godkjenn ----------
  app.post("/api/superadmin/partner-applications/:id/approve", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { notes } = req.body ?? {};

    const appR = await pool.query<{
      organization_id: string; partner_type: string;
      proposed_logo_url: string | null; proposed_tagline: string | null;
    }>(
      `SELECT organization_id, partner_type, proposed_logo_url, proposed_tagline
         FROM partner_applications WHERE id = $1 AND status = 'pending'`,
      [req.params.id],
    );
    if (appR.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const a = appR.rows[0];

    // Hent org-info for navn + fallback logo
    const orgR = await pool.query<{ name: string; logo_url: string | null; website: string | null; contact_email: string | null }>(
      `SELECT name, logo_url, website, contact_email
         FROM organizations WHERE id = $1`,
      [a.organization_id],
    );
    if (orgR.rows.length === 0) return res.status(404).json({ error: "Org finnes ikke" });
    const org = orgR.rows[0];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // 1) Opprett leadgrid_partners-rad (status=approved)
      const slug = String(org.name).toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        + "-" + crypto.randomBytes(3).toString("hex");
      const partnerR = await client.query<{ id: string }>(
        `INSERT INTO leadgrid_partners
          (name, slug, logo_url, website, tagline, partner_type,
           organization_id, display_order, is_active, show_on_landing,
           status, approved_at, approved_by, consent_at, consent_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 100, TRUE, TRUE,
                 'approved', now(), $8, now(), 'partner_application')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          org.name, slug,
          a.proposed_logo_url ?? org.logo_url,
          org.website,
          a.proposed_tagline,
          a.partner_type,
          a.organization_id,
          s.userId,
        ],
      );
      const partnerId = partnerR.rows[0]?.id ?? null;

      // 2) Oppdater søknaden
      await client.query(
        `UPDATE partner_applications
            SET status = 'approved', reviewed_by = $1, reviewed_at = now(),
                review_notes = $2, created_partner_id = $3, updated_at = now()
          WHERE id = $4`,
        [s.userId, notes ?? null, partnerId, req.params.id],
      );
      await client.query("COMMIT");

      // 3) Anvend benefits (utenfor TX — plan-update er idempotent)
      const benefits = await applyPartnerBenefits(pool, a.organization_id, a.partner_type);

      // 3b) Auto-generere API-key hvis partner-type gir API-tilgang
      let apiKeyResult: { raw_key: string; key_id: string } | null = null;
      if (benefits.api_access) {
        try {
          apiKeyResult = await autoGenerateApiKey(pool, {
            organizationId: a.organization_id,
            partnerType: a.partner_type,
            partnerName: org.name,
            createdBy: s.userId,
          });
        } catch (e) {
          console.error("[partner-approve auto-key]", e);
        }
      }

      // 4) Bekreftelses-mail (inkl raw API-key hvis generert)
      if (org.contact_email) {
        const apiKeySection = apiKeyResult ? `
          <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;" />
          <h3 style="color:#7c3aed;">Deres API-key</h3>
          <p>Her er nøkkelen — kopier den nå, vi sender den ikke igjen:</p>
          <pre style="background:#0a0512;color:#9be15d;padding:16px;border-radius:8px;
                       font-family:monospace;font-size:13px;overflow-wrap:break-word;
                       word-break:break-all;white-space:pre-wrap;">${apiKeyResult.raw_key}</pre>
          <p>Bruk den i <code>Authorization: Bearer ...</code>-headeren.
          Full dokumentasjon: <a href="${PUBLIC_BASE}/leadgrid/utviklere">${PUBLIC_BASE}/leadgrid/utviklere</a></p>
          <p style="color:#888;font-size:13px;">
          Trenger du en ny nøkkel? Be om det på e-post — vi genererer en ny og tilbakekaller den gamle.
          </p>` : "";

        try {
          await sendTransactionalEmail({
            to: org.contact_email,
            subject: `Velkommen som Leadgrid-partner — ${org.name}`,
            html: `<p>Hei,</p>
                   <p>Vi har godkjent partnerskaps-søknaden fra <strong>${org.name}</strong>.
                   Dere er nå offisielt en <strong>${a.partner_type}</strong>-partner.</p>
                   ${benefits.plan_upgraded ? "<p>Plan-oppgraderingen er aktivert automatisk.</p>" : ""}
                   <p>Logoen deres vises nå på <a href="${PUBLIC_BASE}/leadgrid">theroleroom.com/leadgrid</a>.</p>
                   ${apiKeySection}
                   <p>Velkommen ombord!</p>`,
            text: `Vi har godkjent partnerskaps-søknaden fra ${org.name}. Velkommen som ${a.partner_type}-partner.${apiKeyResult ? `\n\nDeres API-key: ${apiKeyResult.raw_key}\nDokumentasjon: ${PUBLIC_BASE}/leadgrid/utviklere` : ""}`,
            kind: "partner_application_approved",
            sentByUserId: s.userId,
            pool,
          });
        } catch (e) { console.error("[partner-approve mail]", e); }
      }

      res.json({
        ok: true,
        partner_id: partnerId,
        plan_upgraded: benefits.plan_upgraded,
        api_access_granted: benefits.api_access,
        api_key_generated: !!apiKeyResult,
        api_key_preview: apiKeyResult ? apiKeyResult.raw_key.substring(0, 16) + "…" : null,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[partner-approve]", e);
      res.status(500).json({ error: "Kunne ikke godkjenne" });
    } finally {
      client.release();
    }
  });

  // ---------- Superadmin: avslå ----------
  app.post("/api/superadmin/partner-applications/:id/reject", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { reason } = req.body ?? {};
    if (!reason) return res.status(400).json({ error: "reason påkrevd" });

    const r = await pool.query<{ organization_id: string }>(
      `UPDATE partner_applications
          SET status = 'rejected', reviewed_by = $1, reviewed_at = now(),
              review_notes = $2, updated_at = now()
        WHERE id = $3 AND status = 'pending'
        RETURNING organization_id`,
      [s.userId, reason, req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });

    // Send mail
    const orgR = await pool.query<{ name: string; contact_email: string | null }>(
      `SELECT name, contact_email FROM organizations WHERE id = $1`,
      [r.rows[0].organization_id],
    );
    if (orgR.rows[0]?.contact_email) {
      try {
        await sendTransactionalEmail({
          to: orgR.rows[0].contact_email,
          subject: `Vedrørende din Leadgrid-partner-søknad`,
          html: `<p>Hei,</p>
                 <p>Etter en gjennomgang av søknaden fra <strong>${orgR.rows[0].name}</strong>
                 har vi besluttet å ikke gå videre med partnerskapet på dette tidspunktet.</p>
                 <p><strong>Begrunnelse:</strong> ${reason}</p>
                 <p>Dere er selvfølgelig fortsatt velkomne som vanlig Leadgrid-kunde.
                 Ta gjerne kontakt om dere har spørsmål.</p>`,
          text: `Vi har avslått partner-søknaden for ${orgR.rows[0].name}. Begrunnelse: ${reason}`,
          kind: "partner_application_rejected",
          sentByUserId: s.userId,
          pool,
        });
      } catch (e) { console.error("[partner-reject mail]", e); }
    }

    res.json({ ok: true });
  });

  // ---------- Superadmin: tilbakekall partnerskap ----------
  app.post("/api/superadmin/partners/:id/revoke", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { reason } = req.body ?? {};
    await pool.query(
      `UPDATE leadgrid_partners
          SET status = 'revoked', is_active = FALSE, show_on_landing = FALSE,
              updated_at = now()
        WHERE id = $1`,
      [req.params.id],
    );
    res.json({ ok: true });
  });
}
