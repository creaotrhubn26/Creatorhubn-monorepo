/**
 * role-room-agency-proposals-routes.ts
 *
 * Phase 7.5 — reverse-consent: agency foreslår talent → talent godkjenner
 * via e-post-lenke FØR profilen havner i registeret.
 *
 * GDPR-kjernen: agency kan ALDRI tvinge en talent inn i sitt register.
 * Talent får full informasjon (hvem foreslo, hvilke scopes ble bedt om,
 * hvilken rolle/kontekst) før de aksepterer.
 *
 * Endpoints:
 *   POST   /api/role-room/agency/talent-proposals
 *     body: { proposed_email, proposed_display_name?, requested_scopes?,
 *             personal_message?, context_role? }
 *     → genererer token + lagrer pending-rad. Returnerer acceptUrl.
 *
 *   GET    /api/role-room/agency/talent-proposals
 *     → liste over agency's pending+accepted proposals
 *
 *   DELETE /api/role-room/agency/talent-proposals/:id
 *     → cancel
 *
 *   GET    /api/role-room/talent-proposals/:token (public — for talent å lookup-e)
 *
 *   POST   /api/role-room/talent-proposals/:token/accept (krever auth)
 *     → 1. Hvis talent-profil mangler: opprett en
 *       2. Grant consent på alle requested_scopes
 *       3. Marker proposal accepted
 *
 *   POST   /api/role-room/talent-proposals/:token/decline
 *     → marker declined (kan være med eller uten auth)
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "node:crypto";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
}

export interface RoleRoomAgencyProposalsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const VALID_SCOPES = new Set([
  "basic_profile", "media_portfolio", "contact_info", "demographics",
  "availability", "audition_invitations", "self_tape_review", "full_profile",
  "workshop_access",
]);

async function fetchAgencyForUser(pool: Pool, userId: string) {
  const r = await pool.query(
    `SELECT a.id, a.type, a.name, a.slug, u.agency_role
       FROM users u JOIN agency_orgs a ON a.id = u.agency_org_id
      WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export function setupRoleRoomAgencyProposalsRoutes(
  deps: RoleRoomAgencyProposalsRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  // ── POST /agency/talent-proposals — agency foreslår ────────────────
  app.post("/api/role-room/agency/talent-proposals", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const { proposed_email, proposed_display_name, proposed_phone, requested_scopes, personal_message, context_role } =
      (req.body || {}) as Record<string, unknown>;

    if (typeof proposed_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposed_email)) {
      return res.status(400).json({ error: "Ugyldig proposed_email" });
    }
    const scopes = Array.isArray(requested_scopes) && requested_scopes.length > 0
      ? requested_scopes.filter((s) => typeof s === "string" && VALID_SCOPES.has(s))
      : ["basic_profile", "audition_invitations"];
    if (scopes.length === 0) {
      return res.status(400).json({ error: "Minst én gyldig scope kreves" });
    }

    try {
      const agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });

      const token = crypto.randomBytes(24).toString("hex");

      // INSERT med ON CONFLICT for å sikre vi ikke spam-foreslår samme
      const r = await pool.query(
        `INSERT INTO agency_talent_proposals
           (agency_org_id, proposed_by_user_id, proposed_email, proposed_display_name,
            proposed_phone, requested_scopes, personal_message, context_role, token)
         VALUES ($1, $2, LOWER($3), $4, $5, $6::jsonb, $7, $8, $9)
         ON CONFLICT (agency_org_id, LOWER(proposed_email))
           WHERE status = 'pending'
           DO NOTHING
         RETURNING *`,
        [
          agency.id,
          session.userId,
          (proposed_email as string).trim(),
          typeof proposed_display_name === "string" ? proposed_display_name : null,
          typeof proposed_phone === "string" ? proposed_phone : null,
          JSON.stringify(scopes),
          typeof personal_message === "string" ? personal_message.trim() : null,
          typeof context_role === "string" ? context_role.trim() : null,
          token,
        ],
      );

      if (!r.rowCount) {
        // Pending finnes allerede
        const existing = await pool.query(
          `SELECT id, token, status, created_at, expires_at
             FROM agency_talent_proposals
            WHERE agency_org_id = $1 AND LOWER(proposed_email) = LOWER($2)
              AND status = 'pending' LIMIT 1`,
          [agency.id, proposed_email],
        );
        return res.status(409).json({
          error: "Du har allerede en pending invitasjon til denne e-posten",
          existing: existing.rows[0] ?? null,
        });
      }

      const proposal = r.rows[0];
      const origin = (req.headers.origin as string) || `https://${req.headers.host}`;
      proposal.acceptUrl = `${origin}/talents/registry-invite?token=${token}`;

      // TODO: send e-post automatisk når SendGrid/Postmark er koblet til.
      // For nå returnerer vi acceptUrl så agency kan kopiere manuelt.

      return res.status(201).json({ proposal });
    } catch (err) {
      console.error("[agency/talent-proposals POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å sende forslag", detail: String(err) });
    }
  });

  // ── GET /agency/talent-proposals ────────────────────────────────────
  app.get("/api/role-room/agency/talent-proposals", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.json({ proposals: [] });
      const r = await pool.query(
        `SELECT id, proposed_email, proposed_display_name, requested_scopes,
                status, personal_message, context_role, created_at, expires_at,
                accepted_at, declined_at, resolved_talent_id, token
           FROM agency_talent_proposals
          WHERE agency_org_id = $1
          ORDER BY created_at DESC LIMIT 200`,
        [agency.id],
      );
      return res.json({ proposals: r.rows });
    } catch (err) {
      console.error("[agency/talent-proposals GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente forslag" });
    }
  });

  // ── DELETE /agency/talent-proposals/:id ─────────────────────────────
  app.delete("/api/role-room/agency/talent-proposals/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });
      const r = await pool.query(
        `UPDATE agency_talent_proposals
            SET status = 'cancelled', cancelled_at = now()
          WHERE id = $1 AND agency_org_id = $2 AND status = 'pending'
          RETURNING id`,
        [req.params.id, agency.id],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Forslag ikke funnet eller allerede prosessert" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[agency/talent-proposals DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å avbryte" });
    }
  });

  // ── GET /talent-proposals/:token (public — talent lookup-er) ────────
  app.get("/api/role-room/talent-proposals/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const r = await pool.query(
        `SELECT p.id, p.proposed_email, p.proposed_display_name, p.requested_scopes,
                p.status, p.personal_message, p.context_role, p.expires_at,
                a.name AS agency_name, a.type AS agency_type, a.about AS agency_about,
                a.verified AS agency_verified
           FROM agency_talent_proposals p
           JOIN agency_orgs a ON a.id = p.agency_org_id
          WHERE p.token = $1 LIMIT 1`,
        [token],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Forslag ikke funnet" });
      const proposal = r.rows[0];
      const expired = new Date(proposal.expires_at) < new Date();
      return res.json({ proposal, expired });
    } catch (err) {
      console.error("[talent-proposals/:token] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente forslag" });
    }
  });

  // ── POST /talent-proposals/:token/accept ────────────────────────────
  app.post("/api/role-room/talent-proposals/:token/accept", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) {
      return res.status(401).json({ error: "Du må logge inn for å akseptere forslaget" });
    }
    const { token } = req.params;
    try {
      const lookup = await pool.query(
        `SELECT * FROM agency_talent_proposals WHERE token = $1 LIMIT 1`,
        [token],
      );
      if (!lookup.rowCount) return res.status(404).json({ error: "Forslag ikke funnet" });
      const proposal = lookup.rows[0];
      if (proposal.status !== "pending") {
        return res.status(409).json({ error: `Forslaget er allerede ${proposal.status}` });
      }
      if (new Date(proposal.expires_at) < new Date()) {
        return res.status(410).json({ error: "Forslaget er utløpt" });
      }

      // Steg 1: finn eller opprett talent for den autoriserte brukeren
      let talent = (await pool.query(
        `SELECT * FROM talents WHERE owner_user_id = $1 AND COALESCE(is_demo, FALSE) = FALSE LIMIT 1`,
        [session.userId],
      )).rows[0];

      if (!talent) {
        const created = await pool.query(
          `INSERT INTO talents
             (owner_user_id, display_name, email, profile_status)
           VALUES ($1, $2, $3, 'draft')
           RETURNING *`,
          [
            session.userId,
            proposal.proposed_display_name || session.name || session.email || proposal.proposed_email,
            proposal.proposed_email,
          ],
        );
        talent = created.rows[0];
      }

      // Steg 2: agency-info for consent
      const agency = (await pool.query(
        `SELECT id, type, name FROM agency_orgs WHERE id = $1 LIMIT 1`,
        [proposal.agency_org_id],
      )).rows[0];

      // Steg 3: grant consent på alle requested scopes
      const scopes: string[] = Array.isArray(proposal.requested_scopes)
        ? proposal.requested_scopes
        : JSON.parse(proposal.requested_scopes);

      for (const scope of scopes) {
        await pool.query(
          `INSERT INTO talent_consent_registry
             (talent_id, partner_type, partner_ref, partner_display_name, scope,
              status, granted_at, granted_by, request_context)
           VALUES ($1, $2, $3, $4, $5, 'granted', now(), $6, $7::jsonb)
           ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
             status = 'granted', granted_at = now(),
             granted_by = EXCLUDED.granted_by, revoked_at = NULL, revoked_by = NULL,
             updated_at = now()`,
          [
            talent.id,
            agency.type,
            agency.id,
            agency.name,
            scope,
            session.userId,
            JSON.stringify({ via: "agency_proposal", proposal_id: proposal.id }),
          ],
        );
      }

      // Steg 4: marker akseptert
      await pool.query(
        `UPDATE agency_talent_proposals
            SET status = 'accepted', accepted_at = now(),
                resolved_talent_id = $2, resolved_user_id = $3
          WHERE id = $1`,
        [proposal.id, talent.id, session.userId],
      );

      return res.json({ ok: true, talentId: talent.id, scopesGranted: scopes });
    } catch (err) {
      console.error("[talent-proposals accept] failed", err);
      return res.status(500).json({ error: "Klarte ikke å akseptere forslaget", detail: String(err) });
    }
  });

  // ── POST /talent-proposals/:token/decline ───────────────────────────
  app.post("/api/role-room/talent-proposals/:token/decline", async (req, res) => {
    const { token } = req.params;
    try {
      const r = await pool.query(
        `UPDATE agency_talent_proposals
            SET status = 'declined', declined_at = now()
          WHERE token = $1 AND status = 'pending'
          RETURNING id`,
        [token],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Forslag ikke funnet eller allerede prosessert" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[talent-proposals decline] failed", err);
      return res.status(500).json({ error: "Klarte ikke å avslå" });
    }
  });
}
