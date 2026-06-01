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

/** Den nåværende vilkår-versjonen byråene må godta. Bump ved endring → krever re-accept. */
export const CURRENT_PARTNERSHIP_TERMS_VERSION = "1.0";

/** Demo-mode helpers — samme mønster som agency-search-routes. */
function isDemoRequest(req: express.Request): boolean {
  return req.query?.demo === "1" || req.query?.demo === "true";
}

function getDemoAgency() {
  return {
    id: "a2222222-2222-2222-2222-2222222222a2",
    type: "stella_casting",
    name: "Stella Casting (demo)",
    slug: "demo-stella-casting",
  };
}

type QualifiedAgency = {
  id: string;
  name: string;
  logo_url: string | null;
  type: string;
  contact_email: string | null;
  verified: boolean;
  partnerships_enabled: boolean;
  partnerships_paused_at: Date | null;
  partnerships_terms_accepted_at: Date | null;
  partnerships_terms_version: string | null;
  partnerships_closed_at: Date | null;
};

/** Sjekk at agency-profilen er kvalifisert nok for partnership-foresp. */
async function fetchQualifiedAgency(
  pool: Pool,
  agencyOrgId: string,
): Promise<QualifiedAgency | null> {
  const r = await pool.query(
    `SELECT id::text, name, logo_url, type, contact_email,
            COALESCE(verified, false) AS verified,
            COALESCE(partnerships_enabled, false) AS partnerships_enabled,
            partnerships_paused_at,
            partnerships_terms_accepted_at,
            partnerships_terms_version,
            partnerships_closed_at
       FROM agency_orgs
      WHERE id = $1 AND status = 'active' LIMIT 1`,
    [agencyOrgId],
  );
  return r.rows[0] ?? null;
}

/**
 * Returnerer en feilmelding hvis byrået ikke er tilgjengelig for nye
 * partnership-forespørsler. Returnerer null hvis OK.
 */
function checkAgencyAvailability(agency: QualifiedAgency): string | null {
  if (!agency.logo_url || !agency.contact_email) {
    return "Byrået må fullføre sin profil (logo + kontakt-e-post) før det kan inngå partnership";
  }
  if (agency.partnerships_closed_at) {
    return "Byrået har stengt for nye partnerships";
  }
  if (!agency.partnerships_terms_accepted_at) {
    return "Byrået har ikke godtatt vilkårene for partnership-systemet ennå";
  }
  if (agency.partnerships_terms_version !== CURRENT_PARTNERSHIP_TERMS_VERSION) {
    return "Byrået må godta oppdaterte vilkår før de kan inngå nye partnerships";
  }
  if (!agency.partnerships_enabled) {
    return "Byrået har ikke slått på tilgjengelighet for partnerships";
  }
  if (agency.partnerships_paused_at) {
    return "Byrået har midlertidig pauset partnerships";
  }
  return null;
}

async function logAvailabilityAudit(
  pool: Pool,
  data: {
    agencyOrgId: string;
    actorUserId: string;
    action: string;
    details?: Record<string, unknown>;
  },
) {
  await pool.query(
    `INSERT INTO agency_partnership_availability_audit
       (agency_org_id, actor_user_id, action, details)
     VALUES ($1::uuid, $2, $3, $4::jsonb)`,
    [data.agencyOrgId, data.actorUserId, data.action, JSON.stringify(data.details ?? {})],
  );
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

    // Validér at byrået faktisk har en kvalifisert + tilgjengelig profil.
    // Når byrået selv proposer er det OK at partnerships_enabled=FALSE (de
    // tar initiativ til en spesifikk produksjon før de slår på discoverability
    // bredt), men de må uansett ha godtatt vilkårene.
    const agency = await fetchQualifiedAgency(pool, agency_org_id);
    if (!agency) {
      return res.status(404).json({ error: "Byrå ikke funnet eller ikke aktivt" });
    }
    if (proposedBy === "production") {
      const unavail = checkAgencyAvailability(agency);
      if (unavail) {
        return res.status(409).json({ error: unavail });
      }
    } else {
      // Bryå selv proposer — minimum: profil + vilkår godtatt + ikke stengt
      if (!agency.logo_url || !agency.contact_email) {
        return res.status(409).json({
          error: "Byrået må fullføre sin profil (logo + kontakt-e-post) før partnership",
        });
      }
      if (agency.partnerships_closed_at) {
        return res.status(409).json({ error: "Byrået har stengt for partnerships" });
      }
      if (!agency.partnerships_terms_accepted_at) {
        return res.status(409).json({
          error: "Byrået må godta partnership-vilkårene før de kan initiere",
        });
      }
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

      // Fire-and-forget e-postvarsel til motparten. Aldri blokker
      // partnership-aksjonen hvis e-post feiler.
      void (async () => {
        try {
          const detail = await pool.query(
            `SELECT a.name AS agency_name, a.logo_url AS agency_logo_url, a.contact_email,
                    prod.email AS production_email,
                    prod.first_name || ' ' || prod.last_name AS production_name,
                    proposer.first_name || ' ' || proposer.last_name AS proposer_name
               FROM agency_production_partnerships p
               JOIN agency_orgs a ON a.id = p.agency_org_id
               JOIN users prod ON prod.id = p.production_user_id
               LEFT JOIN users proposer ON proposer.id = p.proposed_by_user_id
              WHERE p.id = $1`,
            [partnership.id],
          );
          const d = detail.rows[0];
          if (!d) return;
          const recipientEmail = proposedBy === "agency" ? d.production_email : d.contact_email;
          if (!recipientEmail) return;
          const { sendPartnershipProposed } = await import("./role-room-partnerships-emails");
          await sendPartnershipProposed(pool, {
            partnershipId: partnership.id,
            proposedBy,
            agencyName: d.agency_name,
            agencyLogoUrl: d.agency_logo_url,
            productionName: d.production_name || d.production_email,
            proposerName: d.proposer_name || (proposedBy === "agency" ? d.agency_name : d.production_name),
            message: partnership.message,
            recipientEmail,
            sentByUserId: session.userId,
          });
        } catch (mailErr) {
          console.error("[partnerships/propose] e-post feilet (uten å blokkere)", mailErr);
        }
      })();

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

      // Fire-and-forget e-postvarsel til proposeren ved aksept
      if (accept) {
        void (async () => {
          try {
            const detail = await pool.query(
              `SELECT a.name AS agency_name, a.contact_email,
                      prod.email AS production_email,
                      prod.first_name || ' ' || prod.last_name AS production_name
                 FROM agency_production_partnerships p
                 JOIN agency_orgs a ON a.id = p.agency_org_id
                 JOIN users prod ON prod.id = p.production_user_id
                WHERE p.id = $1`,
              [partnership.id],
            );
            const d = detail.rows[0];
            if (!d) return;
            // Proposeren er motpart av accepter-rollen
            const accepterRole: "agency" | "production" = isAgencyResponder ? "agency" : "production";
            const recipientEmail = accepterRole === "agency" ? d.production_email : d.contact_email;
            if (!recipientEmail) return;
            const { sendPartnershipAccepted } = await import("./role-room-partnerships-emails");
            await sendPartnershipAccepted(pool, {
              partnershipId: partnership.id,
              agencyName: d.agency_name,
              productionName: d.production_name || d.production_email,
              accepterRole,
              recipientEmail,
              sentByUserId: session.userId,
            });
          } catch (mailErr) {
            console.error("[partnerships/respond] e-post feilet (uten å blokkere)", mailErr);
          }
        })();
      }

      return res.json({ partnership: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/respond] failed", err);
      return res.status(500).json({ error: "Klarte ikke å svare på partnership" });
    }
  });

  // ── POST /:id/pause ──────────────────────────────────────────────
  // Per-partnership pause: én av partene pauser samarbeidet midlertidig.
  // Status forblir 'accepted' men paused_at settes → nye prosjekt-
  // invitasjoner blokkeres til pause oppheves.
  app.post("/api/role-room/partnerships/:id/pause", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { reason } = (req.body || {}) as { reason?: string };
    try {
      const cur = await pool.query(
        `SELECT * FROM agency_production_partnerships WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      const partnership = cur.rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });
      if (partnership.status !== "accepted") {
        return res.status(409).json({
          error: "Kun aksepterte partnerships kan pauses",
        });
      }
      const ctx = await resolveUserContext(pool, session.userId);
      const isAgencyAdmin = ctx.agencyOrgId === partnership.agency_org_id;
      const isProduction = session.userId === partnership.production_user_id;
      if (!isAgencyAdmin && !isProduction) {
        return res.status(403).json({ error: "Du er ikke part i partnership" });
      }
      const r = await pool.query(
        `UPDATE agency_production_partnerships
            SET paused_at = now(),
                paused_by_role = $1,
                paused_by_user_id = $2,
                paused_reason = $3
          WHERE id = $4
          RETURNING *`,
        [isAgencyAdmin ? "agency" : "production", session.userId, reason ?? null, req.params.id],
      );
      await logAudit(pool, {
        partnershipId: partnership.id,
        actorUserId: session.userId,
        action: "paused",
        details: { reason: reason ?? null, by_role: isAgencyAdmin ? "agency" : "production" },
      });
      return res.json({ partnership: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/pause] failed", err);
      return res.status(500).json({ error: "Klarte ikke å pause partnership" });
    }
  });

  // ── POST /:id/unpause ────────────────────────────────────────────
  // Den parten som pauset, gjenopptar samarbeidet.
  app.post("/api/role-room/partnerships/:id/unpause", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const cur = await pool.query(
        `SELECT * FROM agency_production_partnerships WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      const partnership = cur.rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });
      if (!partnership.paused_at) {
        return res.status(409).json({ error: "Partnership er ikke pauset" });
      }
      const ctx = await resolveUserContext(pool, session.userId);
      const isAgencyAdmin = ctx.agencyOrgId === partnership.agency_org_id;
      const isProduction = session.userId === partnership.production_user_id;
      // Begge parter kan oppheve pause uansett hvem som pauset — slik at
      // ingen blir låst inne av motpartens midlertidige stopp.
      if (!isAgencyAdmin && !isProduction) {
        return res.status(403).json({ error: "Du er ikke part i partnership" });
      }
      const r = await pool.query(
        `UPDATE agency_production_partnerships
            SET paused_at = NULL,
                paused_by_role = NULL,
                paused_by_user_id = NULL,
                paused_reason = NULL
          WHERE id = $1 RETURNING *`,
        [req.params.id],
      );
      await logAudit(pool, {
        partnershipId: partnership.id,
        actorUserId: session.userId,
        action: "unpaused",
      });
      return res.json({ partnership: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/unpause] failed", err);
      return res.status(500).json({ error: "Klarte ikke å gjenoppta partnership" });
    }
  });

  // ── POST /:id/revoke ─────────────────────────────────────────────
  // To-trinns flyt: første kall (uten confirm) returnerer pause-anbefaling
  // + konsekvens-summary. Andre kall med { confirm: true,
  // acknowledge_consequences: true } gjør faktisk revoke.
  app.post("/api/role-room/partnerships/:id/revoke", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { confirm, acknowledge_consequences, reason } = (req.body || {}) as {
      confirm?: boolean;
      acknowledge_consequences?: boolean;
      reason?: string;
    };
    try {
      const cur = await pool.query(
        `SELECT p.*, a.name AS agency_name,
                u.first_name || ' ' || u.last_name AS production_name
           FROM agency_production_partnerships p
           JOIN agency_orgs a ON a.id = p.agency_org_id
           JOIN users u ON u.id = p.production_user_id
          WHERE p.id = $1 LIMIT 1`,
        [req.params.id],
      );
      const partnership = cur.rows[0];
      if (!partnership) return res.status(404).json({ error: "Partnership ikke funnet" });

      const ctx = await resolveUserContext(pool, session.userId);
      const isAgencyAdmin = ctx.agencyOrgId === partnership.agency_org_id;
      const isProduction = session.userId === partnership.production_user_id;
      if (!isAgencyAdmin && !isProduction) {
        return res.status(403).json({ error: "Du er ikke part i partnership" });
      }

      // Anbefal pause når motpart-status er aktiv. Bare gjør revoke uten
      // dialog hvis ALLEREDE pending/declined (ingen konsekvens å advare om).
      const isActive = partnership.status === "accepted";
      if (isActive && (confirm !== true || acknowledge_consequences !== true)) {
        const invCount = await pool.query(
          `SELECT COUNT(*)::int AS n
             FROM partnership_project_invitations
            WHERE partnership_id = $1 AND status IN ('pending','accepted')`,
          [partnership.id],
        );
        return res.status(409).json({
          error: "Avslutning krever bekreftelse",
          recommendation: "pause",
          recommendation_reason:
            isAgencyAdmin
              ? `Bruker du pause beholder du relasjonen med ${partnership.production_name} — talentene dine forblir i deres register, men nye prosjekt-invitasjoner blokkeres. Aktiver igjen når du vil. Avslutter du, mister produksjonsselskapet umiddelbart tilgang til ALLE talentene dine, og dere må re-etablere relasjonen helt på nytt.`
              : `Bruker du pause beholder du relasjonen med ${partnership.agency_name} — du kan invitere dem igjen senere uten å starte fra null. Avslutter du, må byrået godkjenne på nytt for å samarbeide igjen.`,
          consequences: {
            active_project_invitations: invCount.rows[0]?.n ?? 0,
            counterparty: isAgencyAdmin ? partnership.production_name : partnership.agency_name,
            talents_will_disappear_for_counterparty: isAgencyAdmin,
            relationship_must_be_rebuilt: true,
          },
          to_confirm: {
            confirm: true,
            acknowledge_consequences: true,
            reason: "valgfri begrunnelse (lagres i audit-log)",
          },
          alternative_pause_endpoint: `/api/role-room/partnerships/${partnership.id}/pause`,
        });
      }

      const r = await pool.query(
        `UPDATE agency_production_partnerships
            SET status = 'revoked', revoked_at = now(), revoked_by_user_id = $1
          WHERE id = $2 RETURNING *`,
        [session.userId, req.params.id],
      );

      // Revoker også aktive prosjekt-invitasjoner for samme partnership
      await pool.query(
        `UPDATE partnership_project_invitations
            SET status = 'revoked', updated_at = now()
          WHERE partnership_id = $1 AND status IN ('pending','accepted')`,
        [partnership.id],
      );

      await logAudit(pool, {
        partnershipId: partnership.id,
        actorUserId: session.userId,
        action: "revoked",
        details: { reason: reason ?? null, by_role: isAgencyAdmin ? "agency" : "production" },
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
      if (partnership.paused_at) {
        return res.status(409).json({
          error: `Samarbeidet er midlertidig pauset av ${partnership.paused_by_role === "agency" ? "byrået" : "produksjonsteam"}. Nye prosjekt-invitasjoner er blokkert til pause oppheves.`,
        });
      }
      if (session.userId !== partnership.production_user_id) {
        return res
          .status(403)
          .json({ error: "Kun produksjonsteam-eier kan invitere byrået til prosjekter" });
      }
      // Sjekk også byrå-side global pause/stenging
      const agencyCheck = await fetchQualifiedAgency(pool, partnership.agency_org_id);
      if (agencyCheck) {
        const unavail = checkAgencyAvailability(agencyCheck);
        if (unavail) {
          return res.status(409).json({ error: unavail });
        }
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

      // Fire-and-forget e-postvarsel til byrå-admin
      const invitation = r.rows[0];
      void (async () => {
        try {
          const detail = await pool.query(
            `SELECT a.name AS agency_name, a.contact_email,
                    prod.first_name || ' ' || prod.last_name AS production_name,
                    proj.name AS project_name, proj.project_type,
                    proj.start_date, proj.end_date
               FROM agency_production_partnerships p
               JOIN agency_orgs a ON a.id = p.agency_org_id
               JOIN users prod ON prod.id = p.production_user_id
               JOIN casting_projects proj ON proj.id = $1
              WHERE p.id = $2`,
            [casting_project_id, partnership.id],
          );
          const d = detail.rows[0];
          if (!d || !d.contact_email) return;
          const { sendProjectInvitationSent } = await import("./role-room-partnerships-emails");
          await sendProjectInvitationSent(pool, {
            invitationId: invitation.id,
            partnershipId: partnership.id,
            agencyName: d.agency_name,
            productionName: d.production_name || "Produksjonsteam",
            projectName: d.project_name,
            projectType: d.project_type ?? null,
            startDate: d.start_date ? String(d.start_date) : null,
            endDate: d.end_date ? String(d.end_date) : null,
            roleCount: Array.isArray(role_ids) ? role_ids.length : null,
            notes: notes ?? null,
            expiresAt: computedExpires,
            recipientEmail: d.contact_email,
            sentByUserId: session.userId,
          });
        } catch (mailErr) {
          console.error("[partnerships/invite-project] e-post feilet (uten å blokkere)", mailErr);
        }
      })();

      return res.status(201).json({ invitation });
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

      // Fire-and-forget e-postvarsel til produksjon ved aksept
      if (accept) {
        void (async () => {
          try {
            const detail = await pool.query(
              `SELECT a.name AS agency_name,
                      prod.email AS production_email,
                      proj.name AS project_name
                 FROM partnership_project_invitations i
                 JOIN agency_production_partnerships p ON p.id = i.partnership_id
                 JOIN agency_orgs a ON a.id = p.agency_org_id
                 JOIN users prod ON prod.id = p.production_user_id
                 JOIN casting_projects proj ON proj.id = i.casting_project_id
                WHERE i.id = $1`,
              [inv.id],
            );
            const d = detail.rows[0];
            if (!d || !d.production_email) return;
            const { sendProjectInvitationAccepted } = await import("./role-room-partnerships-emails");
            await sendProjectInvitationAccepted(pool, {
              invitationId: inv.id,
              agencyName: d.agency_name,
              projectName: d.project_name,
              recipientEmail: d.production_email,
              sentByUserId: session.userId,
            });
          } catch (mailErr) {
            console.error("[partnerships/invitations/respond] e-post feilet (uten å blokkere)", mailErr);
          }
        })();
      }

      return res.json({ invitation: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/invitations/respond] failed", err);
      return res.status(500).json({ error: "Klarte ikke å svare på invitasjon" });
    }
  });

  // ── GET /invitations/incoming ────────────────────────────────────
  // Bryå ser prosjekt-invitasjoner.
  // ?status=pending|accepted|pending,accepted (default: 'pending,accepted'
  //  så byrå-admin også ser akseptede prosjekter for å foreslå talenter).
  app.get("/api/role-room/partnerships/invitations/incoming", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) {
      return res.json({ invitations: [] });
    }
    const statusParam = (req.query.status as string) || "pending,accepted";
    const allowedStatus = new Set(["pending", "accepted", "declined", "completed", "revoked", "expired"]);
    const wantedStatuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => allowedStatus.has(s));
    if (wantedStatuses.length === 0) wantedStatuses.push("pending");
    try {
      const r = await pool.query(
        `SELECT i.*, p.production_user_id, u.first_name || ' ' || u.last_name AS production_name,
                proj.name AS project_name, proj.start_date, proj.end_date, proj.project_type
           FROM partnership_project_invitations i
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
           JOIN users u ON u.id = p.production_user_id
           JOIN casting_projects proj ON proj.id = i.casting_project_id
          WHERE p.agency_org_id = $1::uuid
            AND i.status = ANY($2::text[])
            AND p.status = 'accepted'
          ORDER BY i.invited_at DESC`,
        [ctx.agencyOrgId, wantedStatuses],
      );
      return res.json({ invitations: r.rows });
    } catch (err) {
      console.error("[partnerships/invitations/incoming] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente innkommende invitasjoner" });
    }
  });

  // ── GET /availability ────────────────────────────────────────────
  // Byrå-admin sjekker egen tilgjengelighets-status.
  app.get("/api/role-room/partnerships/availability", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) {
      return res.status(403).json({ error: "Du tilhører ikke en agency" });
    }
    try {
      const r = await pool.query(
        `SELECT id::text, name, logo_url, contact_email,
                COALESCE(partnerships_enabled, false) AS partnerships_enabled,
                partnerships_paused_at, partnerships_paused_reason,
                partnerships_terms_accepted_at, partnerships_terms_version,
                partnerships_enabled_at, partnerships_closed_at
           FROM agency_orgs WHERE id = $1::uuid LIMIT 1`,
        [ctx.agencyOrgId],
      );
      const a = r.rows[0];
      if (!a) return res.status(404).json({ error: "Byrå ikke funnet" });
      const profileComplete = Boolean(a.logo_url && a.contact_email);
      const termsAccepted = Boolean(a.partnerships_terms_accepted_at);
      const termsCurrent = a.partnerships_terms_version === CURRENT_PARTNERSHIP_TERMS_VERSION;
      const enabled = Boolean(a.partnerships_enabled);
      const paused = Boolean(a.partnerships_paused_at);
      const closed = Boolean(a.partnerships_closed_at);
      let state: "not_started" | "needs_profile" | "needs_terms" | "needs_terms_update" | "disabled" | "paused" | "active" | "closed";
      if (closed) state = "closed";
      else if (!profileComplete) state = "needs_profile";
      else if (!termsAccepted) state = "needs_terms";
      else if (!termsCurrent) state = "needs_terms_update";
      else if (!enabled) state = "disabled";
      else if (paused) state = "paused";
      else state = "active";

      return res.json({
        agency: { id: a.id, name: a.name },
        state,
        profile_complete: profileComplete,
        terms_accepted: termsAccepted,
        terms_version_current: termsCurrent,
        terms_version_required: CURRENT_PARTNERSHIP_TERMS_VERSION,
        terms_version_accepted: a.partnerships_terms_version,
        terms_accepted_at: a.partnerships_terms_accepted_at,
        enabled,
        enabled_at: a.partnerships_enabled_at,
        paused,
        paused_at: a.partnerships_paused_at,
        paused_reason: a.partnerships_paused_reason,
        closed,
        closed_at: a.partnerships_closed_at,
      });
    } catch (err) {
      console.error("[partnerships/availability GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente tilgjengelighet" });
    }
  });

  // ── POST /availability/accept-terms ──────────────────────────────
  // Byrå godtar partnership-vilkårene (eller oppdatert versjon).
  app.post("/api/role-room/partnerships/availability/accept-terms", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });

    const { terms_version } = (req.body || {}) as { terms_version?: string };
    if (terms_version !== CURRENT_PARTNERSHIP_TERMS_VERSION) {
      return res.status(400).json({
        error: `Vilkår-versjon må være ${CURRENT_PARTNERSHIP_TERMS_VERSION}`,
        required_version: CURRENT_PARTNERSHIP_TERMS_VERSION,
      });
    }
    try {
      const r = await pool.query(
        `UPDATE agency_orgs
            SET partnerships_terms_accepted_at = now(),
                partnerships_terms_version = $1,
                partnerships_terms_accepted_by_user_id = $2
          WHERE id = $3::uuid
          RETURNING id::text, partnerships_terms_accepted_at, partnerships_terms_version`,
        [terms_version, session.userId, ctx.agencyOrgId],
      );
      await logAvailabilityAudit(pool, {
        agencyOrgId: ctx.agencyOrgId,
        actorUserId: session.userId,
        action: "terms_accepted",
        details: { version: terms_version },
      });
      return res.json({ agency: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/availability/accept-terms] failed", err);
      return res.status(500).json({ error: "Klarte ikke å registrere vilkår-godkjenning" });
    }
  });

  // ── POST /availability/enable ────────────────────────────────────
  // Byrå slår på discoverability. Krever vilkår godtatt + komplett profil.
  app.post("/api/role-room/partnerships/availability/enable", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });

    try {
      const cur = await fetchQualifiedAgency(pool, ctx.agencyOrgId);
      if (!cur) return res.status(404).json({ error: "Byrå ikke funnet" });
      if (cur.partnerships_closed_at) {
        return res.status(409).json({
          error: "Byrået er stengt. Kontakt support for å gjenåpne.",
        });
      }
      if (!cur.logo_url || !cur.contact_email) {
        return res.status(409).json({
          error: "Fullfør profilen (logo + kontakt-e-post) før du slår på discoverability",
        });
      }
      if (!cur.partnerships_terms_accepted_at || cur.partnerships_terms_version !== CURRENT_PARTNERSHIP_TERMS_VERSION) {
        return res.status(409).json({ error: "Godta gjeldende vilkår først" });
      }

      const r = await pool.query(
        `UPDATE agency_orgs
            SET partnerships_enabled = TRUE,
                partnerships_enabled_at = COALESCE(partnerships_enabled_at, now()),
                partnerships_enabled_by_user_id = COALESCE(partnerships_enabled_by_user_id, $1),
                partnerships_paused_at = NULL,
                partnerships_paused_reason = NULL,
                partnerships_paused_by_user_id = NULL
          WHERE id = $2::uuid
          RETURNING id::text, partnerships_enabled, partnerships_enabled_at`,
        [session.userId, ctx.agencyOrgId],
      );
      await logAvailabilityAudit(pool, {
        agencyOrgId: ctx.agencyOrgId,
        actorUserId: session.userId,
        action: "enabled",
      });
      return res.json({ agency: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/availability/enable] failed", err);
      return res.status(500).json({ error: "Klarte ikke å aktivere" });
    }
  });

  // ── POST /availability/pause ─────────────────────────────────────
  // Midlertidig pause: eksisterende partnerships fortsetter, men nye
  // partnership-foresp. og prosjekt-invitasjoner blokkeres.
  app.post("/api/role-room/partnerships/availability/pause", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });
    const { reason } = (req.body || {}) as { reason?: string };

    try {
      const r = await pool.query(
        `UPDATE agency_orgs
            SET partnerships_paused_at = now(),
                partnerships_paused_reason = $1,
                partnerships_paused_by_user_id = $2
          WHERE id = $3::uuid
          RETURNING id::text, partnerships_paused_at, partnerships_paused_reason`,
        [reason ?? null, session.userId, ctx.agencyOrgId],
      );
      await logAvailabilityAudit(pool, {
        agencyOrgId: ctx.agencyOrgId,
        actorUserId: session.userId,
        action: "paused",
        details: { reason: reason ?? null },
      });
      return res.json({ agency: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/availability/pause] failed", err);
      return res.status(500).json({ error: "Klarte ikke å pause" });
    }
  });

  // ── POST /availability/unpause ───────────────────────────────────
  app.post("/api/role-room/partnerships/availability/unpause", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });
    try {
      const r = await pool.query(
        `UPDATE agency_orgs
            SET partnerships_paused_at = NULL,
                partnerships_paused_reason = NULL,
                partnerships_paused_by_user_id = NULL
          WHERE id = $1::uuid
          RETURNING id::text, partnerships_enabled, partnerships_paused_at`,
        [ctx.agencyOrgId],
      );
      await logAvailabilityAudit(pool, {
        agencyOrgId: ctx.agencyOrgId,
        actorUserId: session.userId,
        action: "unpaused",
      });
      return res.json({ agency: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/availability/unpause] failed", err);
      return res.status(500).json({ error: "Klarte ikke å gjenoppta" });
    }
  });

  // ── POST /availability/close ─────────────────────────────────────
  // Permanent: stenger discoverability + revoker ALLE aktive partnerships
  // for byrået. To-trinns flyt: første kall (uten confirm) returnerer
  // konsekvens-summary + anbefaling om pause istedenfor. Andre kall med
  // { confirm: true, acknowledge_consequences: true } stenger faktisk.
  app.post("/api/role-room/partnerships/availability/close", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });
    const { confirm, acknowledge_consequences, reason } = (req.body || {}) as {
      confirm?: boolean;
      acknowledge_consequences?: boolean;
      reason?: string;
    };

    // Beregn konsekvenser
    const affected = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE p.status IN ('pending','accepted'))::int AS active_partnerships,
         COUNT(DISTINCT p.production_user_id) FILTER (WHERE p.status IN ('pending','accepted'))::int AS production_companies,
         (SELECT COUNT(*)::int FROM partnership_project_invitations i
            JOIN agency_production_partnerships p2 ON p2.id = i.partnership_id
           WHERE p2.agency_org_id = $1::uuid
             AND i.status IN ('pending','accepted')) AS active_invitations
       FROM agency_production_partnerships p
       WHERE p.agency_org_id = $1::uuid`,
      [ctx.agencyOrgId],
    );
    const cons = affected.rows[0];

    if (confirm !== true || acknowledge_consequences !== true) {
      return res.status(409).json({
        error: "Stenging krever bekreftelse",
        recommendation: "pause",
        recommendation_reason:
          "Pause beholder alle relasjoner mens du midlertidig blokkerer ny aktivitet. Aktiver igjen når du er klar. Stenging revoker ALT — talentene dine vil forsvinne fra produksjonsselskapenes registre, og du må re-etablere alle relasjoner manuelt etter eventuell gjenåpning.",
        consequences: {
          active_partnerships: cons.active_partnerships,
          production_companies: cons.production_companies,
          active_invitations: cons.active_invitations,
          talents_will_disappear_from_partners: true,
          relations_lost_permanently: true,
        },
        to_confirm: {
          confirm: true,
          acknowledge_consequences: true,
          reason: "valgfri begrunnelse (lagres i audit-log)",
        },
        alternative_pause_endpoint: "/api/role-room/partnerships/availability/pause",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const a = await client.query(
        `UPDATE agency_orgs
            SET partnerships_enabled = FALSE,
                partnerships_closed_at = now(),
                partnerships_closed_by_user_id = $1
          WHERE id = $2::uuid
          RETURNING id::text, partnerships_closed_at`,
        [session.userId, ctx.agencyOrgId],
      );
      const revoked = await client.query(
        `UPDATE agency_production_partnerships
            SET status = 'revoked',
                revoked_at = now(),
                revoked_by_user_id = $1
          WHERE agency_org_id = $2::uuid
            AND status IN ('pending', 'accepted')
          RETURNING id::text`,
        [session.userId, ctx.agencyOrgId],
      );
      // Sett pending prosjekt-invitasjoner til revoked også
      await client.query(
        `UPDATE partnership_project_invitations i
            SET status = 'revoked', updated_at = now()
           FROM agency_production_partnerships p
          WHERE i.partnership_id = p.id
            AND p.agency_org_id = $1::uuid
            AND i.status IN ('pending', 'accepted')`,
        [ctx.agencyOrgId],
      );
      await client.query("COMMIT");
      await logAvailabilityAudit(pool, {
        agencyOrgId: ctx.agencyOrgId,
        actorUserId: session.userId,
        action: "closed",
        details: {
          reason: reason ?? null,
          revoked_partnerships: revoked.rowCount,
        },
      });
      return res.json({
        agency: a.rows[0],
        revoked_partnerships_count: revoked.rowCount,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[partnerships/availability/close] failed", err);
      return res.status(500).json({ error: "Klarte ikke å stenge", detail: String(err) });
    } finally {
      client.release();
    }
  });

  // ── GET /discoverable-agencies ───────────────────────────────────
  // Produksjonsteam søker etter byråer å sende partnership-foresp. til.
  // Returnerer kun byråer som har slått på discoverability og ikke er
  // paused/stengt. Støtter type-filter (stella_casting, caster_individual osv).
  app.get("/api/role-room/partnerships/discoverable-agencies", async (req, res) => {
    const q = (req.query.q as string) || "";
    const type = (req.query.type as string) || "";
    const demo = req.query.demo === "1" || req.query.demo === "true";
    // Demo-mode bypass auth — gir produksjonsteam mulighet til å se hvilke
    // byråer som finnes uten å være innlogget (samme mønster som
    // /agency/talents/search?demo=1 i registry-flyten).
    if (!demo) {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    }
    try {
      const params: unknown[] = [];
      const where: string[] = [
        "a.status = 'active'",
        "COALESCE(a.partnerships_enabled, false) = TRUE",
        "a.partnerships_paused_at IS NULL",
        "a.partnerships_closed_at IS NULL",
        "a.partnerships_terms_accepted_at IS NOT NULL",
        "a.logo_url IS NOT NULL",
        `COALESCE(a.is_demo, FALSE) = ${demo ? "TRUE" : "FALSE"}`,
      ];
      if (q) {
        params.push(`%${q}%`);
        where.push(`a.name ILIKE $${params.length}`);
      }
      if (type) {
        params.push(type);
        where.push(`a.type = $${params.length}`);
      }
      const r = await pool.query(
        `SELECT a.id::text, a.name, a.type, a.slug, a.logo_url, a.about,
                a.website_url, a.verified, a.partnerships_enabled_at,
                (SELECT COUNT(DISTINCT c.talent_id)::int
                   FROM talent_consent_registry c
                  WHERE c.partner_type = a.type AND c.partner_ref = a.id::text
                    AND c.status = 'granted'
                    AND (c.expires_at IS NULL OR c.expires_at > now())
                ) AS talent_pool_size
           FROM agency_orgs a
          WHERE ${where.join(" AND ")}
          ORDER BY a.verified DESC, a.partnerships_enabled_at DESC NULLS LAST
          LIMIT 50`,
        params,
      );
      return res.json({ agencies: r.rows });
    } catch (err) {
      console.error("[partnerships/discoverable-agencies] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente byråer" });
    }
  });

  // ── GET /invitations/:invId/proposable-talents ────────────────────
  // Bryået søker i sitt EGNE register etter talenter å foreslå til
  // prosjektet. Filtreres på consent (talent har gitt byrået scope) +
  // valgfri q-søk.
  app.get("/api/role-room/partnerships/invitations/:invId/proposable-talents", async (req, res) => {
    const session = getActiveSession(req);
    const demo = isDemoRequest(req);
    let agencyOrgId: string | null = null;
    let agencyType: string | null = null;
    if (demo) {
      const a = getDemoAgency();
      agencyOrgId = a.id;
      agencyType = a.type;
    } else {
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const ctx = await resolveUserContext(pool, session.userId);
      if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });
      agencyOrgId = ctx.agencyOrgId;
      agencyType = ctx.agencyType;
    }

    const q = (req.query.q as string) || "";
    try {
      // Verifiser at invitasjonen tilhører byrået og er aksepterert
      const inv = await pool.query(
        `SELECT i.*, p.agency_org_id
           FROM partnership_project_invitations i
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
          WHERE i.id = $1 LIMIT 1`,
        [req.params.invId],
      );
      const invitation = inv.rows[0];
      if (!invitation) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      if (invitation.agency_org_id !== agencyOrgId) {
        return res.status(403).json({ error: "Du eier ikke denne invitasjonen" });
      }
      if (invitation.status !== "accepted") {
        return res.status(409).json({
          error: `Invitasjon-status er ${invitation.status}, kan ikke foreslå talenter`,
        });
      }

      const params: unknown[] = [agencyType, agencyOrgId, demo ? true : false];
      const where: string[] = [
        "c.partner_type = $1",
        "c.partner_ref = $2",
        "c.status = 'granted'",
        "(c.expires_at IS NULL OR c.expires_at > now())",
        "t.profile_status != 'archived'",
        "COALESCE(t.is_demo, FALSE) = $3",
      ];
      if (q) {
        params.push(`%${q}%`);
        where.push(`(t.display_name ILIKE $${params.length} OR t.city ILIKE $${params.length})`);
      }
      const r = await pool.query(
        `SELECT DISTINCT t.id::text, t.display_name, t.city, t.country,
                t.headshot_url, t.playing_age_min, t.playing_age_max, t.gender,
                t.availability_status,
                -- Allerede foreslått til denne invitasjonen?
                (SELECT COUNT(*) > 0 FROM partnership_talent_proposals ptp
                  WHERE ptp.invitation_id = $${params.length + 1}
                    AND ptp.talent_id = t.id
                    AND ptp.status IN ('pending','accepted')
                ) AS already_proposed
           FROM talent_consent_registry c
           JOIN talents t ON t.id = c.talent_id
          WHERE ${where.join(" AND ")}
          ORDER BY t.display_name
          LIMIT 100`,
        [...params, req.params.invId],
      );
      return res.json({ talents: r.rows });
    } catch (err) {
      console.error("[partnerships/proposable-talents] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente talenter" });
    }
  });

  // ── POST /invitations/:invId/talent-proposals ─────────────────────
  // Bryået foreslår en talent til en spesifikk rolle i prosjektet.
  // Body: { talent_id, casting_role_id?, agency_notes? }
  app.post("/api/role-room/partnerships/invitations/:invId/talent-proposals", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });

    const { talent_id, casting_role_id, agency_notes } = (req.body || {}) as {
      talent_id?: string;
      casting_role_id?: string;
      agency_notes?: string;
    };
    if (!talent_id) return res.status(400).json({ error: "talent_id er påkrevd" });

    try {
      // Verifiser at invitasjonen tilhører byrået + er aksepterert
      const inv = await pool.query(
        `SELECT i.*, p.agency_org_id, p.production_user_id, a.type AS agency_type
           FROM partnership_project_invitations i
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
           JOIN agency_orgs a ON a.id = p.agency_org_id
          WHERE i.id = $1 LIMIT 1`,
        [req.params.invId],
      );
      const invitation = inv.rows[0];
      if (!invitation) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      if (invitation.agency_org_id !== ctx.agencyOrgId) {
        return res.status(403).json({ error: "Du eier ikke denne invitasjonen" });
      }
      if (invitation.status !== "accepted") {
        return res.status(409).json({ error: "Invitasjonen er ikke akseptert" });
      }

      // Verifiser at byrået har gyldig consent til talenten
      const consent = await pool.query(
        `SELECT 1 FROM talent_consent_registry
          WHERE talent_id = $1::uuid AND partner_type = $2 AND partner_ref = $3
            AND status = 'granted' AND (expires_at IS NULL OR expires_at > now())
          LIMIT 1`,
        [talent_id, invitation.agency_type, ctx.agencyOrgId],
      );
      if (!consent.rowCount) {
        return res.status(403).json({
          error: "Talenten har ikke gitt byrået aktiv tilgang — kan ikke foreslås",
        });
      }

      // Hvis casting_role_id er angitt, verifiser at rollen tilhører prosjektet
      if (casting_role_id) {
        const roleCheck = await pool.query(
          `SELECT 1 FROM casting_roles
            WHERE id = $1 AND project_id = $2 LIMIT 1`,
          [casting_role_id, invitation.casting_project_id],
        );
        if (!roleCheck.rowCount) {
          return res.status(400).json({ error: "Rolle tilhører ikke dette prosjektet" });
        }
      }

      const r = await pool.query(
        `INSERT INTO partnership_talent_proposals
           (invitation_id, talent_id, casting_role_id, proposed_by_user_id,
            agency_notes, status, is_demo)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'pending',
                 COALESCE((SELECT is_demo FROM talents WHERE id = $2::uuid), FALSE))
         ON CONFLICT (invitation_id, talent_id, casting_role_id) DO UPDATE SET
           agency_notes = COALESCE(EXCLUDED.agency_notes, partnership_talent_proposals.agency_notes),
           status = CASE
             WHEN partnership_talent_proposals.status IN ('withdrawn','declined') THEN 'pending'
             ELSE partnership_talent_proposals.status
           END,
           updated_at = now()
         RETURNING *`,
        [req.params.invId, talent_id, casting_role_id ?? null, session.userId, agency_notes ?? null],
      );

      await logAudit(pool, {
        invitationId: req.params.invId,
        actorUserId: session.userId,
        action: "talent_proposed",
        details: { talent_id, casting_role_id: casting_role_id ?? null },
      });

      // Fire-and-forget e-postvarsel til produksjon
      const proposal = r.rows[0];
      void (async () => {
        try {
          const detail = await pool.query(
            `SELECT t.display_name AS talent_display_name,
                    a.name AS agency_name,
                    proj.name AS project_name,
                    cr.name AS role_name,
                    prod.email AS production_email
               FROM partnership_talent_proposals ptp
               JOIN talents t ON t.id = ptp.talent_id
               JOIN partnership_project_invitations i ON i.id = ptp.invitation_id
               JOIN agency_production_partnerships p ON p.id = i.partnership_id
               JOIN agency_orgs a ON a.id = p.agency_org_id
               JOIN casting_projects proj ON proj.id = i.casting_project_id
               JOIN users prod ON prod.id = p.production_user_id
               LEFT JOIN casting_roles cr ON cr.id = ptp.casting_role_id
              WHERE ptp.id = $1`,
            [proposal.id],
          );
          const d = detail.rows[0];
          if (!d || !d.production_email) return;
          const { sendTalentProposedByAgency } = await import("./role-room-partnerships-emails");
          await sendTalentProposedByAgency(pool, {
            proposalId: proposal.id,
            talentDisplayName: d.talent_display_name,
            agencyName: d.agency_name,
            projectName: d.project_name,
            roleName: d.role_name ?? null,
            agencyNotes: agency_notes ?? null,
            recipientEmail: d.production_email,
            sentByUserId: session.userId,
          });
        } catch (mailErr) {
          console.error("[partnerships/talent-proposals POST] e-post feilet (uten å blokkere)", mailErr);
        }
      })();

      return res.status(201).json({ proposal });
    } catch (err) {
      console.error("[partnerships/talent-proposals POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å foreslå talent", detail: String(err) });
    }
  });

  // ── GET /invitations/:invId/talent-proposals ──────────────────────
  // Bryå-perspektivet: alle proposals jeg har sendt for denne invitasjonen.
  app.get("/api/role-room/partnerships/invitations/:invId/talent-proposals", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });

    try {
      const inv = await pool.query(
        `SELECT i.id, p.agency_org_id
           FROM partnership_project_invitations i
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
          WHERE i.id = $1 LIMIT 1`,
        [req.params.invId],
      );
      if (!inv.rows[0]) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      if (inv.rows[0].agency_org_id !== ctx.agencyOrgId) {
        return res.status(403).json({ error: "Du eier ikke denne invitasjonen" });
      }

      const r = await pool.query(
        `SELECT ptp.*, t.display_name, t.headshot_url, t.city, t.country,
                t.playing_age_min, t.playing_age_max, t.gender, t.availability_status,
                cr.name AS role_name, cr.description AS role_description
           FROM partnership_talent_proposals ptp
           JOIN talents t ON t.id = ptp.talent_id
           LEFT JOIN casting_roles cr ON cr.id = ptp.casting_role_id
          WHERE ptp.invitation_id = $1::uuid
          ORDER BY ptp.created_at DESC`,
        [req.params.invId],
      );
      return res.json({ proposals: r.rows });
    } catch (err) {
      console.error("[partnerships/talent-proposals GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente forslag" });
    }
  });

  // ── POST /talent-proposals/:id/withdraw ───────────────────────────
  app.post("/api/role-room/partnerships/talent-proposals/:id/withdraw", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const ctx = await resolveUserContext(pool, session.userId);
    if (!ctx.agencyOrgId) return res.status(403).json({ error: "Du tilhører ikke en agency" });

    try {
      const cur = await pool.query(
        `SELECT ptp.*, p.agency_org_id
           FROM partnership_talent_proposals ptp
           JOIN partnership_project_invitations i ON i.id = ptp.invitation_id
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
          WHERE ptp.id = $1 LIMIT 1`,
        [req.params.id],
      );
      const proposal = cur.rows[0];
      if (!proposal) return res.status(404).json({ error: "Forslag ikke funnet" });
      if (proposal.agency_org_id !== ctx.agencyOrgId) {
        return res.status(403).json({ error: "Du eier ikke dette forslaget" });
      }
      if (proposal.status !== "pending") {
        return res.status(409).json({ error: `Status er ${proposal.status}, kan ikke trekkes` });
      }
      const r = await pool.query(
        `UPDATE partnership_talent_proposals
            SET status = 'withdrawn', withdrawn_at = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id],
      );
      await logAudit(pool, {
        invitationId: proposal.invitation_id,
        actorUserId: session.userId,
        action: "talent_proposal_withdrawn",
        details: { proposal_id: proposal.id },
      });
      return res.json({ proposal: r.rows[0] });
    } catch (err) {
      console.error("[partnerships/talent-proposals/withdraw] failed", err);
      return res.status(500).json({ error: "Klarte ikke å trekke forslag" });
    }
  });

  // ── POST /talent-proposals/:id/respond ────────────────────────────
  // Produksjon svarer på et talent-forslag (accept/decline).
  app.post("/api/role-room/partnerships/talent-proposals/:id/respond", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { accept, production_notes } = (req.body || {}) as {
      accept?: boolean;
      production_notes?: string;
    };
    if (typeof accept !== "boolean") {
      return res.status(400).json({ error: "accept (boolean) er påkrevd" });
    }
    try {
      const cur = await pool.query(
        `SELECT ptp.*, p.production_user_id
           FROM partnership_talent_proposals ptp
           JOIN partnership_project_invitations i ON i.id = ptp.invitation_id
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
          WHERE ptp.id = $1 LIMIT 1`,
        [req.params.id],
      );
      const proposal = cur.rows[0];
      if (!proposal) return res.status(404).json({ error: "Forslag ikke funnet" });
      if (session.userId !== proposal.production_user_id) {
        return res.status(403).json({ error: "Kun produksjonsteam-eier kan svare på forslag" });
      }
      if (proposal.status !== "pending") {
        return res.status(409).json({ error: `Status er ${proposal.status}, kan ikke svares på` });
      }

      const newStatus = accept ? "accepted" : "declined";
      const r = await pool.query(
        `UPDATE partnership_talent_proposals
            SET status = $1, production_notes = $2,
                responded_at = now(), response_user_id = $3
          WHERE id = $4 RETURNING *`,
        [newStatus, production_notes ?? null, session.userId, req.params.id],
      );

      await logAudit(pool, {
        invitationId: proposal.invitation_id,
        actorUserId: session.userId,
        action: accept ? "talent_proposal_accepted" : "talent_proposal_declined",
        details: { proposal_id: proposal.id, production_notes: production_notes ?? null },
      });

      // Fire-and-forget e-postvarsel til byrå (kontakt-e-post)
      const updated = r.rows[0];
      void (async () => {
        try {
          const detail = await pool.query(
            `SELECT t.display_name AS talent_display_name,
                    proj.name AS project_name,
                    prod.first_name || ' ' || prod.last_name AS production_name,
                    a.contact_email AS agency_email
               FROM partnership_talent_proposals ptp
               JOIN talents t ON t.id = ptp.talent_id
               JOIN partnership_project_invitations i ON i.id = ptp.invitation_id
               JOIN agency_production_partnerships p ON p.id = i.partnership_id
               JOIN agency_orgs a ON a.id = p.agency_org_id
               JOIN casting_projects proj ON proj.id = i.casting_project_id
               JOIN users prod ON prod.id = p.production_user_id
              WHERE ptp.id = $1`,
            [updated.id],
          );
          const d = detail.rows[0];
          if (!d || !d.agency_email) return;
          const { sendTalentProposalResponded } = await import("./role-room-partnerships-emails");
          await sendTalentProposalResponded(pool, {
            proposalId: updated.id,
            accepted: accept,
            talentDisplayName: d.talent_display_name,
            projectName: d.project_name,
            productionName: d.production_name || "Produksjonsteam",
            productionNotes: production_notes ?? null,
            recipientEmail: d.agency_email,
            sentByUserId: session.userId,
          });
        } catch (mailErr) {
          console.error("[partnerships/talent-proposals/respond] e-post feilet (uten å blokkere)", mailErr);
        }
      })();

      return res.json({ proposal: updated });
    } catch (err) {
      console.error("[partnerships/talent-proposals/respond] failed", err);
      return res.status(500).json({ error: "Klarte ikke å svare på forslag" });
    }
  });

  // ── GET /casting-projects/:projectId/incoming-talent-proposals ────
  // Produksjon ser alle proposals for et prosjekt på tvers av invitasjoner.
  app.get("/api/role-room/partnerships/casting-projects/:projectId/incoming-talent-proposals", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      // Verifiser at innlogget bruker eier prosjektet
      const proj = await pool.query(
        `SELECT id, created_by FROM casting_projects WHERE id = $1 LIMIT 1`,
        [req.params.projectId],
      );
      if (!proj.rows[0]) return res.status(404).json({ error: "Prosjekt ikke funnet" });
      if (proj.rows[0].created_by !== session.userId) {
        return res.status(403).json({ error: "Du eier ikke prosjektet" });
      }

      const r = await pool.query(
        `SELECT ptp.*, t.display_name, t.headshot_url, t.city, t.country,
                t.playing_age_min, t.playing_age_max, t.gender, t.availability_status,
                cr.name AS role_name, cr.description AS role_description,
                a.name AS agency_name, a.logo_url AS agency_logo_url,
                u.first_name || ' ' || u.last_name AS proposer_name
           FROM partnership_talent_proposals ptp
           JOIN partnership_project_invitations i ON i.id = ptp.invitation_id
           JOIN agency_production_partnerships p ON p.id = i.partnership_id
           JOIN agency_orgs a ON a.id = p.agency_org_id
           JOIN talents t ON t.id = ptp.talent_id
           LEFT JOIN casting_roles cr ON cr.id = ptp.casting_role_id
           LEFT JOIN users u ON u.id = ptp.proposed_by_user_id
          WHERE i.casting_project_id = $1
          ORDER BY ptp.created_at DESC`,
        [req.params.projectId],
      );
      return res.json({ proposals: r.rows });
    } catch (err) {
      console.error("[partnerships/incoming-talent-proposals] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente forslag" });
    }
  });
}
