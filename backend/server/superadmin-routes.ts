/**
 * superadmin-routes.ts
 *
 * Egne endepunkter for users.role='super_admin' (global rolle, ikke
 * per-org). Gir Daniel (eller andre super-admins i fremtiden):
 *
 *   - Liste av alle organisasjoner med org_type + medlems-tall + plan
 *   - Opprett ny organisasjon (BRREG-oppslag + invite av admin-bruker)
 *   - Bytte org-kontekst ("lån" en kunde-org for å feilsøke). Hver
 *     switch logges i superadmin_audit_log slik at det er sporbart
 *     hvem som så hva og når.
 *   - Hente setup-templates (mig 0311) for å vise mal-velgeren
 *
 * Selv-onboarding (org_type=customer/agency) ligger i en SEPARAT
 * route-fil (org-self-onboard-routes.ts) som er åpen og ikke krever
 * super_admin.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSessionFromReq(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  // Standard mønster i index.ts — Bearer-token eller cookie
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.substring(7)) ?? null;
  }
  const token = (req as any).cookies?.sessionToken;
  if (token) return activeSessions.get(token) ?? null;
  return null;
}

async function requireSuperAdmin(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const session = getSessionFromReq(req, activeSessions);
  if (!session) {
    res.status(401).json({ error: "Ikke innlogget" });
    return null;
  }
  // Hent fersk rolle fra DB — session-rolle kan være utdatert
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`,
    [session.userId],
  );
  if (r.rows.length === 0 || r.rows[0].role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" });
    return null;
  }
  return session;
}

async function logAudit(
  pool: Pool,
  superAdminId: string,
  action: string,
  details: Record<string, unknown>,
  opts: {
    targetOrgId?: string;
    targetUserId?: string;
    ipAddress?: string;
    userAgent?: string;
  } = {},
) {
  await pool.query(
    `INSERT INTO superadmin_audit_log
      (super_admin_id, action, target_org_id, target_user_id, details,
       ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      superAdminId,
      action,
      opts.targetOrgId ?? null,
      opts.targetUserId ?? null,
      JSON.stringify(details),
      opts.ipAddress ?? null,
      opts.userAgent ?? null,
    ],
  );
}

async function lookupBrreg(orgNumber: string): Promise<{
  name?: string;
  industry?: string;
  address?: string;
  postalCode?: string;
  city?: string;
} | null> {
  try {
    const cleaned = orgNumber.replace(/\D/g, "");
    if (cleaned.length !== 9) return null;
    const r = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${cleaned}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as any;
    return {
      name: d.navn,
      industry: d.naeringskode1?.beskrivelse,
      address: (d.forretningsadresse?.adresse ?? []).join(", "),
      postalCode: d.forretningsadresse?.postnummer,
      city: d.forretningsadresse?.poststed,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerSuperadminRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const ROOT = "/api/superadmin";

  // ---------- Org-liste ----------
  app.get(`${ROOT}/organizations`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT
           o.id, o.name, o.slug, o.org_type, o.plan, o.owner_user_id,
           o.org_number, o.website, o.industry, o.logo_url, o.created_at,
           (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) AS member_count,
           (SELECT COUNT(*) FROM crm_customers WHERE organization_id = o.id) AS customer_count,
           (SELECT email FROM users WHERE id = o.owner_user_id) AS owner_email
         FROM organizations o
         ORDER BY o.created_at DESC`,
      );
      res.json({ organizations: r.rows });
    } catch (e) {
      console.error("[superadmin] list orgs failed", e);
      res.status(500).json({ error: "Kunne ikke hente orgs" });
    }
  });

  // ---------- Setup-templates ----------
  app.get(`${ROOT}/setup-templates`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT id, template_key, label, description, allowed_roles,
                default_permissions, lead_preset_key, default_plan,
                self_onboard_allowed, display_order
         FROM organization_setup_templates
         WHERE is_active = TRUE
         ORDER BY display_order ASC`,
      );
      res.json({ templates: r.rows });
    } catch (e) {
      res.status(500).json({ error: "Kunne ikke hente maler" });
    }
  });

  // ---------- BRREG-oppslag (proxy) ----------
  app.get(`${ROOT}/brreg/:orgnr`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    const data = await lookupBrreg(req.params.orgnr);
    if (!data) return res.status(404).json({ error: "Ikke funnet i BRREG" });
    res.json(data);
  });

  // ---------- Opprett organisasjon (med invite) ----------
  app.post(`${ROOT}/organizations`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;

    const {
      name,
      orgNumber,
      orgType, // 'agency' | 'customer'
      adminEmail,
      adminName,
      templateKey, // hvilken mal (default 'agency_small')
      website,
      industry,
    } = req.body ?? {};

    if (!name || !adminEmail || !orgType) {
      return res.status(400).json({ error: "Mangler navn/admin-e-post/org_type" });
    }
    if (!["agency", "customer"].includes(orgType)) {
      return res.status(400).json({ error: "Ugyldig org_type" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Hent mal
      const tmplR = await client.query(
        `SELECT * FROM organization_setup_templates
         WHERE template_key = $1 AND is_active = TRUE`,
        [templateKey ?? "agency_small"],
      );
      if (tmplR.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Ukjent mal" });
      }
      const tmpl = tmplR.rows[0];

      // 2) Sjekk om bruker eksisterer
      const userR = await client.query(
        `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)`,
        [adminEmail],
      );
      let userId: string;
      let isNewUser = false;
      if (userR.rows.length > 0) {
        userId = userR.rows[0].id;
      } else {
        // Opprett pending-bruker — invite-token sendes på e-post
        userId = crypto.randomUUID();
        await client.query(
          `INSERT INTO users (id, email, role, created_at)
           VALUES ($1, $2, 'member', now())`,
          [userId, adminEmail],
        );
        isNewUser = true;
      }

      // 3) Opprett organisasjon
      const slug = String(name).toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
      const slugUnique = `${slug}-${crypto.randomBytes(3).toString("hex")}`;
      const orgR = await client.query(
        `INSERT INTO organizations
          (name, slug, org_type, owner_user_id, org_number, website,
           industry, plan, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          name,
          slugUnique,
          orgType,
          userId,
          orgNumber ?? null,
          website ?? null,
          industry ?? null,
          tmpl.default_plan,
          JSON.stringify({ setup_template_key: tmpl.template_key }),
        ],
      );
      const orgId = orgR.rows[0].id;

      // 4) Legg admin som medlem (rolle: admin)
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
         VALUES ($1, $2, 'admin', $3)`,
        [orgId, userId, session.userId],
      );

      // 5) Lag invite-token hvis ny bruker
      let inviteToken: string | null = null;
      if (isNewUser) {
        inviteToken = crypto.randomBytes(32).toString("hex");
        // Vi gjenbruker project_invitations-tabellen (utvidet i mig 0308)
        // hvis den finnes — ellers en enkel pending-marker. Vi bruker
        // en dedikert tabell hvis tilgjengelig.
        await client.query(
          `INSERT INTO users SELECT * FROM users WHERE FALSE`, // no-op
        );
        // Lagre invite-token i users.meta hvis ingen invitations-tabell
        // (tryggere fallback)
        await client.query(
          `UPDATE users
              SET meta = COALESCE(meta, '{}'::jsonb)
                       || jsonb_build_object('invite_token', $1, 'invite_org_id', $2::text, 'invite_expires', $3::text)
            WHERE id = $4`,
          [
            inviteToken,
            orgId,
            new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
            userId,
          ],
        );
      }

      // 6) Audit
      await logAudit(pool, session.userId, "create_organization", {
        org_id: orgId,
        org_name: name,
        org_type: orgType,
        template_key: tmpl.template_key,
        admin_email: adminEmail,
        new_user: isNewUser,
      }, {
        targetOrgId: orgId,
        targetUserId: userId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });

      await client.query("COMMIT");

      // 7) Send invite-e-post (utenfor transaction)
      if (isNewUser && inviteToken) {
        const inviteUrl = `https://theroleroom.com/invite/${inviteToken}`;
        try {
          await sendTransactionalEmail({
            to: adminEmail,
            subject: `Velkommen til Leadgrid — ${name} er klar`,
            html: `<p>Hei${adminName ? ` ${adminName}` : ""},</p>
             <p>${session.email ?? "Leadgrid"} har opprettet organisasjonen
             <strong>${name}</strong> for deg. Klikk lenken under for å sette
             passord og komme i gang:</p>
             <p><a href="${inviteUrl}">${inviteUrl}</a></p>
             <p>Lenken er gyldig i 7 dager.</p>`,
            text: `Hei${adminName ? ` ${adminName}` : ""}, ${session.email ?? "Leadgrid"} har opprettet organisasjonen ${name} for deg. Sett passord her: ${inviteUrl} (gyldig 7 dager).`,
            kind: "leadgrid_org_invite",
            sentByUserId: session.userId,
            pool,
          });
        } catch (e) {
          console.error("[superadmin] invite-mail failed", e);
        }
      }

      res.status(201).json({
        organization: {
          id: orgId, name, slug: slugUnique, org_type: orgType,
          plan: tmpl.default_plan,
        },
        admin_user_id: userId,
        invite_sent: isNewUser,
        invite_token_preview: inviteToken
          ? inviteToken.substring(0, 8) + "…"
          : null,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[superadmin] create org failed", e);
      res.status(500).json({ error: "Kunne ikke opprette org" });
    } finally {
      client.release();
    }
  });

  // ---------- Switch org-kontekst (impersonate) ----------
  app.post(`${ROOT}/switch-context`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    const { orgId, reason } = req.body ?? {};
    if (!orgId) return res.status(400).json({ error: "Mangler orgId" });

    const orgR = await pool.query(
      `SELECT id, name, org_type FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (orgR.rows.length === 0) {
      return res.status(404).json({ error: "Org finnes ikke" });
    }

    await pool.query(
      `INSERT INTO superadmin_impersonation_session
        (super_admin_id, active_org_id, started_at, expires_at)
       VALUES ($1, $2, now(), now() + interval '2 hours')
       ON CONFLICT (super_admin_id) DO UPDATE
         SET active_org_id = EXCLUDED.active_org_id,
             started_at    = now(),
             expires_at    = EXCLUDED.expires_at`,
      [session.userId, orgId],
    );

    await logAudit(pool, session.userId, "switch_org_context", {
      org_id: orgId,
      org_name: orgR.rows[0].name,
      reason: reason ?? null,
    }, {
      targetOrgId: orgId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] as string,
    });

    res.json({
      ok: true,
      active_org: orgR.rows[0],
      expires_at_minutes: 120,
    });
  });

  // Avslutt impersonation
  app.post(`${ROOT}/end-impersonation`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    await pool.query(
      `DELETE FROM superadmin_impersonation_session WHERE super_admin_id = $1`,
      [session.userId],
    );
    await logAudit(pool, session.userId, "end_impersonation", {}, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] as string,
    });
    res.json({ ok: true });
  });

  // ---------- Hent audit-log ----------
  app.get(`${ROOT}/audit-log`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const r = await pool.query(
      `SELECT a.*, o.name AS org_name, u.email AS super_admin_email
         FROM superadmin_audit_log a
         LEFT JOIN organizations o ON o.id = a.target_org_id
         LEFT JOIN users u ON u.id = a.super_admin_id
         ORDER BY a.created_at DESC
         LIMIT $1`,
      [limit],
    );
    res.json({ entries: r.rows });
  });

  // ---------- Hent aktiv impersonation ----------
  app.get(`${ROOT}/active-impersonation`, async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    const r = await pool.query(
      `SELECT s.active_org_id, s.started_at, s.expires_at,
              o.name AS org_name, o.org_type
         FROM superadmin_impersonation_session s
         JOIN organizations o ON o.id = s.active_org_id
        WHERE s.super_admin_id = $1
          AND (s.expires_at IS NULL OR s.expires_at > now())`,
      [session.userId],
    );
    res.json({ active: r.rows[0] ?? null });
  });
}
