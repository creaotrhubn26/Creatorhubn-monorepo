/**
 * role-room-partnerships-routes.ts
 *
 * Agency ↔ Production team partnership-system.
 *
 * Datamodell (migrate 222):
 *  - agency_production_partnerships (overordnet relasjon)
 *  - partnership_project_invitations (per-prosjekt scope)
 *  - partnership_audit (GDPR-bevisbarhet)
 *
 * Flyt:
 *  1. Agency ELLER produksjon initierer (POST /propose) — status pending.
 *  2. Motparten godkjenner/avslår (POST /:id/respond) — status accepted/declined.
 *  3. Produksjon inviterer bryået til et SPESIFIKT casting_project
 *     (POST /:id/invite-project med role_ids).
 *  4. Bryået ser invitasjoner (GET /invitations/incoming) + foreslår talenter
 *     (eksisterende agency_talent_proposals).
 *
 * Endpoints:
 *   POST   /api/role-room/partnerships/propose
 *   GET    /api/role-room/partnerships/mine        — partnerships hvor jeg er part
 *   POST   /api/role-room/partnerships/:id/respond — { accept: boolean, reason? }
 *   POST   /api/role-room/partnerships/:id/revoke
 *   POST   /api/role-room/partnerships/:id/invite-project
 *                                                  — { casting_project_id, role_ids?, notes? }
 *   GET    /api/role-room/partnerships/:id/invitations
 *   POST   /api/role-room/partnerships/invitations/:invId/respond
 *                                                  — bryået svarer på prosjekt-invitasjon
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomPartnershipsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type PartnershipRole = "agency_admin" | "production_owner" | null;

interface UserContext {
  userId: string;
  agencyOrgId: string | null;
  agencyName: string | null;
  agencyLogoUrl: string | null;
  agencyType: string | null;
}

async function resolveUserContext(pool: Pool, userId: string): Promise<UserContext> {
  const r = await pool.query(
    `SELECT u.id AS user_id,
            u.agency_org_id::text AS agency_org_id,
            a.name AS agency_name,
            a.logo_url AS agency_logo_url,
            a.type AS agency_type
       FROM users u
       LEFT JOIN agency_orgs a ON a.id = u.agency_org_id
      WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  const row = r.rows[0] ?? {};
  return {
    userId,
    agencyOrgId: row.agency_org_id ?? null,
    agencyName: row.agency_name ?? null,
    agencyLogoUrl: row.agency_logo_url ?? null,
    agencyType: row.agency_type ?? null,
  };
}

/** Sjekk at agency-profilen er kvalifisert nok for partnership-foresp. */
async function fetchQualifiedAgency(
  pool: Pool,
  agencyOrgId: string,
): Promise<
  | { id: string; name: string; logo_url: string | null; type: string; contact_email: string | null; verified: boolean }
  | null
> {
  const r = await pool.query(
    `SELECT id::text, name, logo_url, type, contact_email, COALESCE(verified, false) AS verified
       FROM agency_orgs
      WHERE id = $1 AND status = 'active' LIMIT 1`,
    [agencyOrgId],
  );
  return r.rows[0] ?? null;
}

async function logAudit(
  pool: Pool,
  data: {
    partnershipId?: string | null;
    invitationId?: string | null;
    actorUserId: string;
    action: string;
    details?: Record<string, unknown>;
  },
) {
  await pool.query(
    `INSERT INTO partnership_audit
       (partnership_id, invitation_id, actor_user_id, action, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      data.partnershipId ?? null,
      data.invitationId ?? null,
      data.actorUserId,
      data.action,
      JSON.stringify(data.details ?? {}),
    ],
  );
}

export function setupRoleRoomPartnershipsRoutes(deps: RoleRoomPartnershipsRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── POST /propose ────────────────────────────────────────────────
  // Body: { agency_org_id, production_user_id, message? }
  // Sjekker proposer ER agency-admin på agency_org_id ELLER ER production_user_id.
  app.post("/api/role-room/partnerships/propose", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const { agency_org_id, production_user_id, message } = (req.body || {}) as {
      agency_org_id?: string;
      production_user_id?: string;
      message?: string;
    };

    if (!agency_org_id || !production_user_id) {
      return res
        .status(400)
        .json({ error: "agency_org_id og production_user_id er påkrevd" });
    }

    const ctx = await resolveUserContext(pool, session.userId);
    let proposedBy: "agency" | "production";
    if (ctx.agencyOrgId === agency_org_id) {
      proposedBy = "agency";
    } else if (session.userId === production_user_id) {
      proposedBy = "production";
    } else {
      return res.status(403).json({
        error:
          "Du må enten være agency-admin på det aktuelle byrået eller være produksjonsteam-eieren for å initiere",
      });
    }

    // Validér at byrået faktisk har en kvalifisert profil
    const agency = await fetchQualifiedAgency(pool, agency_org_id);
    if (!agency) {
      return res.status(404).json({ error: "Byrå ikke funnet eller ikke aktivt" });
    }
    if (!agency.logo_url || !agency.contact_email) {
      return res.status(409).json({
        error:
          "Byrået må fullføre sin profil (logo + kontakt-e-post) før det kan inngå partnership",
      });
    }

    try {
      const r = await pool.query(
        `INSERT INTO agency_production_partnerships
           (agency_org_id, production_user_id, proposed_by,
            proposed_by_user_id, message, status)
         VALUES ($1::uuid, $2, $3, $4, $5, 'pending')
         ON CONFLICT (agency_org_id, production_user_id) DO UPDATE SET
           proposed_by = EXCLUDED.proposed_by,
           proposed_by_user_id = EXCLUDED.proposed_by_user_id,
           message = COALESCE(EXCLUDED.message, agency_production_partnerships.message),
           status = CASE
             WHEN agency_production_partnerships.status = 'revoked' THEN 'pending'
             ELSE agency_production_partnerships.status
           END,
           updated_at = now()
         RETURNING *`,
        [agency_org_id, production_user_id, proposedBy, session.userId, message ?? null],
      );
      const partnership = r.rows[0];
      await logAudit(pool, {
        partnershipId: partnership.id,
        actorUserId: session.userId,
        action: "proposed",
        details: { proposed_by: proposedBy },
      });
      return res.status(201).json({ partnership });
    } catch (err) {
      console.error("[partnerships/propose] failed", err);
      return res.status(500).json({ error: "Klarte ikke å foreslå partnership", detail: String(err) });
    }
  });

  // ── GET /mine ────────────────────────────────────────────────────
  // Returnerer partnerships der jeg er enten agency-admin eller produksjon.
  // For agency-side: alle med matchende agency_org_id.
  // For produksjon-side: alle med matchende production_user_id.
  app.get("/api/role-room/partnerships/mine", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    const role = (req.query.role as string) || "auto"; // 'agency' | 'production' | 'auto'

    try {
      let sql: string;
      let params: unknown[];
      if (role === "agency" && ctx.agencyOrgId) {
        sql = `SELECT p.*, a.name AS agency_name, a.logo_url AS agency_logo_url,
                      a.type AS agency_type,
                      u.first_name || ' ' || u.last_name AS production_name,
                      u.email AS production_email
                 FROM agency_production_partnerships p
                 JOIN agency_orgs a ON a.id = p.agency_org_id
                 JOIN users u ON u.id = p.production_user_id
                WHERE p.agency_org_id = $1::uuid
                ORDER BY p.updated_at DESC`;
        params = [ctx.agencyOrgId];
      } else if (role === "production") {
        sql = `SELECT p.*, a.name AS agency_name, a.logo_url AS agency_logo_url,
                      a.type AS agency_type,
                      u.first_name || ' ' || u.last_name AS production_name,
                      u.email AS production_email
                 FROM agency_production_partnerships p
                 JOIN agency_orgs a ON a.id = p.agency_org_id
                 JOIN users u ON u.id = p.production_user_id
                WHERE p.production_user_id = $1
                ORDER BY p.updated_at DESC`;
        params = [session.userId];
      } else {
        sql = `SELECT p.*, a.name AS agency_name, a.logo_url AS agency_logo_url,
                      a.type AS agency_type,
                      u.first_name || ' ' || u.last_name AS production_name,
                      u.email AS production_email
                 FROM agency_production_partnerships p
                 JOIN agency_orgs a ON a.id = p.agency_org_id
                 JOIN users u ON u.id = p.production_user_id
                WHERE (p.agency_org_id = $1::uuid OR p.production_user_id = $2)
                ORDER BY p.updated_at DESC`;
        params = [ctx.agencyOrgId ?? "00000000-0000-0000-0000-000000000000", session.userId];
      }
      const r = await pool.query(sql, params);
      return res.json({ partnerships: r.rows });
    } catch (err) {
      console.error("[partnerships/mine] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente partnerships" });
    }
  });

  // ── POST /:id/respond ────────────────────────────────────────────
  // Body: { accept: boolean, reason? }
  // Sjekker at responder IKKE er proposer (motparten må godkjenne).
  app.post("/api/role-room/partnerships/:id/respond", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { accept, reason } = (req.body || {}) as { accept?: boolean; reason?: string };
    if (typeof accept !== "boolean") {
      return res.status(400).json({ error: "accept (boolean) er påkrevd" });
    }

    try {
      const cur = await pool.query(
        `SELECT * FROM agency_production_partnerships WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      const partnership = cur.rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });
      if (partnership.status !== "pending") {
        return res.status(409).json({ error: `Partnership-status er ${partnership.status}, kan ikke svares på` });
      }

      // Verifiser at responder er motparten
      const ctx = await resolveUserContext(pool, session.userId);
      const isAgencyResponder = ctx.agencyOrgId === partnership.agency_org_id;
      const isProductionResponder = session.userId === partnership.production_user_id;
      const proposedByAgency = partnership.proposed_by === "agency";
      const proposedByProduction = partnership.proposed_by === "production";

      const validResponder =
        (proposedByAgency && isProductionResponder) ||
        (proposedByProduction && isAgencyResponder);

      if (!validResponder) {
        return res.status(403).json({
          error: "Bare motparten av forslaget kan svare på det",
        });
      }

      const newStatus = accept ? "accepted" : "declined";
      const r = await pool.query(
        `UPDATE agency_production_partnerships
            SET status = $1, responded_at = now(), response_user_id = $2,
                message = COALESCE($3, message)
          WHERE id = $4
          RETURNING *`,
        [newStatus, session.userId, reason ?? null, req.params.id],
      );

      await logAudit(pool, {
        partnershipId: partnership.id,
        actorUserId: session.userId,
        action: accept ? "accepted" : "declined",
        details: { reason: reason ?? null },
      });

      return res.json({ partnership: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/respond] failed", err);
      return res.status(500).json({ error: "Klarte ikke å svare på partnership" });
    }
  });

  // ── POST /:id/revoke ─────────────────────────────────────────────
  app.post("/api/role-room/partnerships/:id/revoke", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const cur = await pool.query(
        `SELECT * FROM agency_production_partnerships WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      const partnership = cur.rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });

      const ctx = await resolveUserContext(pool, session.userId);
      const isPart =
        ctx.agencyOrgId === partnership.agency_org_id ||
        session.userId === partnership.production_user_id;
      if (!isPart) return res.status(403).json({ error: "Du er ikke part i partnership" });

      const r = await pool.query(
        `UPDATE agency_production_partnerships
            SET status = 'revoked', revoked_at = now(), revoked_by_user_id = $1
          WHERE id = $2 RETURNING *`,
        [session.userId, req.params.id],
      );

      await logAudit(pool, {
        partnershipId: partnership.id,
        actorUserId: session.userId,
        action: "revoked",
      });

      return res.json({ partnership: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/revoke] failed", err);
      return res.status(500).json({ error: "Klarte ikke å trekke tilbake partnership" });
    }
  });

  // ── POST /:id/invite-project ─────────────────────────────────────
  // Kun produksjonsteam kan invitere et byrå til et SPESIFIKT casting_project.
  // Body: { casting_project_id, role_ids?, notes?, expires_at? }
  app.post("/api/role-room/partnerships/:id/invite-project", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { casting_project_id, role_ids, notes, expires_at } = (req.body || {}) as {
      casting_project_id?: string;
      role_ids?: string[];
      notes?: string;
      expires_at?: string;
    };

    if (!casting_project_id) {
      return res.status(400).json({ error: "casting_project_id er påkrevd" });
    }

    try {
      const cur = await pool.query(
        `SELECT * FROM agency_production_partnerships WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      const partnership = cur.rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });
      if (partnership.status !== "accepted") {
        return res.status(409).json({
          error: "Partnership må være akseptert før prosjekter kan inviteres",
        });
      }
      if (session.userId !== partnership.production_user_id) {
        return res
          .status(403)
          .json({ error: "Kun produksjonsteam-eier kan invitere byrået til prosjekter" });
      }

      // Hent default-utløp fra casting_project.end_date + 14d hvis ikke spesifisert
      let computedExpires: string | null = expires_at ?? null;
      if (!computedExpires) {
        const proj = await pool.query(
          `SELECT end_date FROM casting_projects WHERE id = $1 LIMIT 1`,
          [casting_project_id],
        );
        const endDate = proj.rows[0]?.end_date as Date | null;
        if (endDate) {
          const exp = new Date(endDate);
          exp.setDate(exp.getDate() + 14);
          computedExpires = exp.toISOString();
        }
      }

      const r = await pool.query(
        `INSERT INTO partnership_project_invitations
           (partnership_id, casting_project_id, invited_by_user_id,
            role_ids, notes, expires_at, status)
         VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, 'pending')
         ON CONFLICT (partnership_id, casting_project_id) DO UPDATE SET
           role_ids = EXCLUDED.role_ids,
           notes = EXCLUDED.notes,
           expires_at = EXCLUDED.expires_at,
           status = CASE
             WHEN partnership_project_invitations.status IN ('revoked','expired','declined')
               THEN 'pending'
             ELSE partnership_project_invitations.status
           END,
           updated_at = now()
         RETURNING *`,
        [
          req.params.id,
          casting_project_id,
          session.userId,
          JSON.stringify(role_ids ?? null),
          notes ?? null,
          computedExpires,
        ],
      );

      await logAudit(pool, {
        partnershipId: partnership.id,
        invitationId: r.rows[0].id,
        actorUserId: session.userId,
        action: "project_invited",
        details: { casting_project_id, role_ids: role_ids ?? null },
      });

      return res.status(201).json({ invitation: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/invite-project] failed", err);
      return res.status(500).json({ error: "Klarte ikke å invitere prosjekt", detail: String(err) });
    }
  });

  // ── GET /:id/invitations ─────────────────────────────────────────
  app.get("/api/role-room/partnerships/:id/invitations", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const partnership = (
        await pool.query(
          `SELECT * FROM agency_production_partnerships WHERE id = $1 LIMIT 1`,
          [req.params.id],
        )
      ).rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });

      const ctx = await resolveUserContext(pool, session.userId);
      const isPart =
        ctx.agencyOrgId === partnership.agency_org_id ||
        session.userId === partnership.production_user_id;
      if (!isPart) return res.status(403).json({ error: "Du er ikke part i partnership" });

      const r = await pool.query(
        `SELECT i.*, p.name AS project_name, p.status AS project_status,
                p.start_date, p.end_date, p.project_type
           FROM partnership_project_invitations i
           JOIN casting_projects p ON p.id = i.casting_project_id
          WHERE i.partnership_id = $1::uuid
          ORDER BY i.invited_at DESC`,
        [req.params.id],
      );
      return res.json({ invitations: r.rows });
    } catch (err) {
      console.error("[partnerships/:id/invitations] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente invitasjoner" });
    }
  });

  // ── POST /invitations/:invId/respond ─────────────────────────────
  // Bryå svarer på et casting-prosjekt-invitasjon.
  app.post("/api/role-room/partnerships/invitations/:invId/respond", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { accept } = (req.body || {}) as { accept?: boolean };
    if (typeof accept !== "boolean") {
      return res.status(400).json({ error: "accept (boolean) er påkrevd" });
    }

    try {
      const inv = (
        await pool.query(
          `SELECT i.*, p.agency_org_id, p.production_user_id
             FROM partnership_project_invitations i
             JOIN agency_production_partnerships p ON p.id = i.partnership_id
            WHERE i.id = $1 LIMIT 1`,
          [req.params.invId],
        )
      ).rows[0];
      if (!inv) return res.status(404).json({ error: "Invitasjon ikke funnet" });

      const ctx = await resolveUserContext(pool, session.userId);
      if (ctx.agencyOrgId !== inv.agency_org_id) {
        return res
          .status(403)
          .json({ error: "Bare byrå-admin kan svare på prosjekt-invitasjoner" });
      }
      if (inv.status !== "pending") {
        return res.status(409).json({ error: `Status er ${inv.status}, kan ikke svares på` });
      }

      const newStatus = accept ? "accepted" : "declined";
      const r = await pool.query(
        `UPDATE partnership_project_invitations
            SET status = $1, responded_at = now()
          WHERE id = $2 RETURNING *`,
        [newStatus, req.params.invId],
      );

      await logAudit(pool, {
        partnershipId: inv.partnership_id,
        invitationId: inv.id,
        actorUserId: session.userId,
        action: accept ? "project_invitation_accepted" : "project_invitation_declined",
      });

      return res.json({ invitation: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/invitations/respond] failed", err);
      return res.status(500).json({ error: "Klarte ikke å svare på invitasjon" });
    }
  });

  // ── GET /invitations/incoming ────────────────────────────────────
  // Bryå ser alle prosjekt-invitasjoner som er pending for dem.
  app.get("/api/role-room/partnerships/invitations/incoming", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) {
      return res.json({ invitations: [] });
    }
    try {
      const r = await pool.query(
        `SELECT i.*, p.production_user_id, u.first_name || ' ' || u.last_name AS production_name,
                proj.name AS project_name, proj.start_date, proj.end_date, proj.project_type
           FROM partnership_project_invitations i
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
           JOIN users u ON u.id = p.production_user_id
           JOIN casting_projects proj ON proj.id = i.casting_project_id
          WHERE p.agency_org_id = $1::uuid
            AND i.status = 'pending'
            AND p.status = 'accepted'
          ORDER BY i.invited_at DESC`,
        [ctx.agencyOrgId],
      );
      return res.json({ invitations: r.rows });
    } catch (err) {
      console.error("[partnerships/invitations/incoming] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente innkommende invitasjoner" });
    }
  });
}
