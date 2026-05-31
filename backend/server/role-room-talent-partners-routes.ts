/**
 * role-room-talent-partners-routes.ts
 *
 * Phase 2 e2e — alt-i-ett data for "Partners & Collaboration"-siden +
 * invite-flow. Bygger på migrasjon 209-211 + 213.
 *
 * Endpoints:
 *   GET    /api/role-room/talents/me/partners-overview
 *     → stats + partners (med agency-info + perms-matrix) + feed (siste audit)
 *
 *   POST   /api/role-room/talents/me/partner-invites
 *     → opprett invite-rad, returnerer token. (E-post-sending håndteres
 *       separat — for nå returnerer vi token-URL klar til kopiering.)
 *
 *   GET    /api/role-room/talents/me/partner-invites
 *     → liste over pending+sent invites
 *
 *   DELETE /api/role-room/talents/me/partner-invites/:id
 *     → cancel invite
 *
 *   GET    /api/role-room/partner-invites/:token  (public — accept-side)
 *   POST   /api/role-room/partner-invites/:token/accept
 *
 *   POST   /api/role-room/talents/me/consents/bulk-set
 *     → atomisk sett alle 4 scopes for én partner (Permissions Matrix-toggling)
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "node:crypto";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface RoleRoomTalentPartnersRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const VALID_PARTNER_TYPES = new Set([
  "stella_casting",
  "skuespillersenter",
  "production_company",
  "caster_individual",
  "workshop_provider",
]);

const MATRIX_SCOPES = [
  "media_portfolio", // → 'Profiles'-kolonnen viser om de kan se profil
  "self_tape_review", // → 'Self-Tapes'-kolonnen
  "audition_invitations", // → 'Auditions'-kolonnen
] as const;

/** Hent talent for en owner-user-id. Returnerer null hvis ingen profil. */
async function fetchTalentForUser(pool: Pool, userId: string) {
  const r = await pool.query(
    `SELECT * FROM talents WHERE owner_user_id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

/** Maskér en email til log/audit: "k***@stella.no". */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function setupRoleRoomTalentPartnersRoutes(
  deps: RoleRoomTalentPartnersRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET /partners-overview ─────────────────────────────────────────
  app.get("/api/role-room/talents/me/partners-overview", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) {
        return res.json({
          talent: null,
          stats: {
            activePartners: 0,
            sharedTalentPools: 0,
            pendingRequests: 0,
            gdprCompliantPercent: 100,
          },
          partners: [],
          feed: [],
        });
      }

      // Hent alle aktive consents + join til agency_orgs der relevant.
      // partner_ref kan være UUID til agency_orgs.id eller en e-post — vi
      // joiner på UUID-formet og faller tilbake til partner_display_name
      // for resten.
      const consentsResult = await pool.query(
        `SELECT
            c.id, c.partner_type, c.partner_ref, c.partner_display_name, c.scope,
            c.status, c.granted_at, c.expires_at,
            a.id  AS agency_id,
            a.name AS agency_name,
            a.slug AS agency_slug,
            a.contact_email AS agency_email,
            a.website_url AS agency_website,
            a.logo_url AS agency_logo,
            a.verified AS agency_verified
          FROM talent_consent_registry c
          LEFT JOIN agency_orgs a ON a.id::text = c.partner_ref
          WHERE c.talent_id = $1
            AND c.status = 'granted'
            AND (c.expires_at IS NULL OR c.expires_at > now())`,
        [talent.id],
      );

      // Aggreger per (partner_type, partner_ref) — hver unike partner.
      const byPartner = new Map<string, {
        key: string;
        partner_type: string;
        partner_ref: string;
        display_name: string;
        email: string | null;
        website: string | null;
        logo: string | null;
        verified: boolean;
        scopes: Set<string>;
        last_granted: string;
      }>();

      for (const row of consentsResult.rows) {
        const key = `${row.partner_type}::${row.partner_ref}`;
        const existing = byPartner.get(key);
        if (existing) {
          existing.scopes.add(row.scope);
          if (row.granted_at > existing.last_granted) {
            existing.last_granted = row.granted_at;
          }
        } else {
          byPartner.set(key, {
            key,
            partner_type: row.partner_type,
            partner_ref: row.partner_ref,
            display_name: row.agency_name || row.partner_display_name || row.partner_ref,
            email: row.agency_email || null,
            website: row.agency_website || null,
            logo: row.agency_logo || null,
            verified: row.agency_verified ?? false,
            scopes: new Set([row.scope]),
            last_granted: row.granted_at,
          });
        }
      }

      // Hent siste access fra audit-tabellen for "Last Activity"
      const auditResult = await pool.query(
        `SELECT partner_type, partner_ref, MAX(accessed_at) AS last_accessed
           FROM talent_access_audit
          WHERE talent_id = $1
          GROUP BY partner_type, partner_ref`,
        [talent.id],
      );
      const lastSeenByKey = new Map<string, string>();
      for (const r of auditResult.rows) {
        lastSeenByKey.set(`${r.partner_type}::${r.partner_ref}`, r.last_accessed);
      }

      // Bygg partners-arrayen i format frontend forstår
      const partners = Array.from(byPartner.values()).map((p) => {
        const last_activity = lastSeenByKey.get(p.key) || p.last_granted;
        const fullProfile = p.scopes.has("full_profile");
        const isCastingType = p.partner_type === "stella_casting" || p.partner_type === "caster_individual";
        return {
          id: p.partner_ref,
          partner_type: p.partner_type,
          role_label: isCastingType ? "Casting Partner" : "Professional Center",
          initials: p.display_name
            .split(/\s+/)
            .slice(0, 2)
            .map((s: string) => s[0] || "")
            .join("")
            .toUpperCase(),
          display_name: p.display_name,
          location: p.email ? p.email.split("@")[1] : null,
          email: p.email,
          website: p.website,
          logo: p.logo,
          verified: p.verified,
          scopes: Array.from(p.scopes),
          access_level: deriveAccessLevel(p.scopes, fullProfile),
          last_activity,
          perms: {
            profiles: fullProfile || p.scopes.has("media_portfolio") || p.scopes.has("basic_profile"),
            selftapes: fullProfile || p.scopes.has("self_tape_review"),
            workshops: fullProfile || p.scopes.has("workshop_access"),
            auditions: fullProfile || p.scopes.has("audition_invitations"),
          },
        };
      });
      partners.sort((a, b) => (a.last_activity < b.last_activity ? 1 : -1));

      // Pending invites count
      const pendingResult = await pool.query(
        `SELECT count(*)::int AS n FROM talent_partner_invites
          WHERE talent_id = $1 AND status = 'pending' AND expires_at > now()`,
        [talent.id],
      );
      const pendingRequests = pendingResult.rows[0]?.n ?? 0;

      // Feed: kombiner audit + invite-events + consent-events (siste ~20)
      const feedResult = await pool.query(
        `SELECT * FROM (
            SELECT
              'access' AS kind,
              a.id::text AS id,
              a.partner_type,
              a.partner_ref,
              (SELECT name FROM agency_orgs WHERE id::text = a.partner_ref) AS display_name,
              jsonb_build_object('scope', a.scope, 'endpoint', a.access_context->>'endpoint') AS details,
              a.accessed_at AS occurred_at,
              NULL::text AS badge
            FROM talent_access_audit a
            WHERE a.talent_id = $1
              AND a.accessed_at > now() - interval '30 days'
          UNION ALL
            SELECT
              'invite' AS kind,
              i.id::text,
              i.partner_type,
              NULL,
              COALESCE(i.partner_display_name, i.partner_email),
              jsonb_build_object('email', i.partner_email, 'scopes', i.scopes),
              i.created_at,
              CASE WHEN i.status = 'pending' THEN 'pending' ELSE NULL END
            FROM talent_partner_invites i
            WHERE i.talent_id = $1
              AND i.created_at > now() - interval '30 days'
          UNION ALL
            SELECT
              'consent_grant' AS kind,
              c.id::text,
              c.partner_type,
              c.partner_ref,
              COALESCE(c.partner_display_name, (SELECT name FROM agency_orgs WHERE id::text = c.partner_ref)),
              jsonb_build_object('scope', c.scope),
              c.granted_at,
              NULL::text
            FROM talent_consent_registry c
            WHERE c.talent_id = $1
              AND c.granted_at > now() - interval '30 days'
              AND c.status = 'granted'
        ) feed
        ORDER BY occurred_at DESC
        LIMIT 20`,
        [talent.id],
      );

      return res.json({
        talent: { id: talent.id, display_name: talent.display_name },
        stats: {
          activePartners: partners.length,
          sharedTalentPools: 0, // TODO: når talent_pools-tabell finnes
          pendingRequests,
          gdprCompliantPercent: 100,
        },
        partners,
        feed: feedResult.rows,
      });
    } catch (err) {
      console.error("[partners-overview] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente partners-oversikten", detail: String(err) });
    }
  });

  // ── POST /me/consents/bulk-set ─────────────────────────────────────
  // Atomisk sett 4 boolske perms for én partner. Trigget av matrix-checkbox.
  app.post("/api/role-room/talents/me/consents/bulk-set", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const { partner_type, partner_ref, partner_display_name, perms } = (req.body || {}) as {
      partner_type?: string;
      partner_ref?: string;
      partner_display_name?: string;
      perms?: { profiles?: boolean; selftapes?: boolean; workshops?: boolean; auditions?: boolean };
    };

    if (!partner_type || !VALID_PARTNER_TYPES.has(partner_type)) {
      return res.status(400).json({ error: "Ugyldig partner_type" });
    }
    if (!partner_ref) return res.status(400).json({ error: "partner_ref påkrevd" });
    if (!perms || typeof perms !== "object") return res.status(400).json({ error: "perms-objekt påkrevd" });

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil — opprett først" });

      // Mappet kolonner i UI → scopes i registry
      const mapping: Array<[keyof typeof perms, string]> = [
        ["profiles", "media_portfolio"],
        ["selftapes", "self_tape_review"],
        ["workshops", "workshop_access"],
        ["auditions", "audition_invitations"],
      ];

      // Sørg for at basic_profile alltid er på når noen perms er på
      const anyOn = Object.values(perms).some(Boolean);
      if (anyOn) {
        await pool.query(
          `INSERT INTO talent_consent_registry
             (talent_id, partner_type, partner_ref, partner_display_name, scope, status, granted_at, granted_by)
           VALUES ($1, $2, $3, $4, 'basic_profile', 'granted', now(), $5)
           ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
             status = 'granted', granted_at = now(),
             granted_by = EXCLUDED.granted_by, revoked_at = NULL, revoked_by = NULL,
             updated_at = now()`,
          [talent.id, partner_type, partner_ref, partner_display_name || null, session.userId],
        );
      }

      // For hver av de 4 perms — grant eller revoke
      for (const [uiKey, scope] of mapping) {
        if (perms[uiKey]) {
          await pool.query(
            `INSERT INTO talent_consent_registry
               (talent_id, partner_type, partner_ref, partner_display_name, scope, status, granted_at, granted_by)
             VALUES ($1, $2, $3, $4, $5, 'granted', now(), $6)
             ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
               status = 'granted', granted_at = now(),
               granted_by = EXCLUDED.granted_by, revoked_at = NULL, revoked_by = NULL,
               updated_at = now()`,
            [talent.id, partner_type, partner_ref, partner_display_name || null, scope, session.userId],
          );
        } else {
          await pool.query(
            `UPDATE talent_consent_registry
                SET status = 'revoked', revoked_at = now(), revoked_by = $4, updated_at = now()
              WHERE talent_id = $1 AND partner_type = $2 AND partner_ref = $3 AND scope = $5
                AND status = 'granted'`,
            [talent.id, partner_type, partner_ref, session.userId, scope],
          );
        }
      }

      return res.json({ ok: true, perms });
    } catch (err) {
      console.error("[consents/bulk-set] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere tillatelser", detail: String(err) });
    }
  });

  // ── POST /me/partner-invites ────────────────────────────────────────
  app.post("/api/role-room/talents/me/partner-invites", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const { partner_type, partner_email, partner_display_name, scopes, message } =
      (req.body || {}) as {
        partner_type?: string;
        partner_email?: string;
        partner_display_name?: string;
        scopes?: string[];
        message?: string;
      };

    if (!partner_type || !VALID_PARTNER_TYPES.has(partner_type)) {
      return res.status(400).json({ error: "Ugyldig partner_type" });
    }
    if (!partner_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partner_email)) {
      return res.status(400).json({ error: "Ugyldig partner-e-post" });
    }
    const finalScopes = Array.isArray(scopes) && scopes.length > 0 ? scopes : ["basic_profile"];

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil — opprett først" });

      const token = crypto.randomBytes(24).toString("hex");
      const r = await pool.query(
        `INSERT INTO talent_partner_invites
           (talent_id, partner_type, partner_email, partner_display_name, scopes, token, message, created_by)
         VALUES ($1, $2, LOWER($3), $4, $5::jsonb, $6, $7, $8)
         RETURNING id, token, expires_at, status, partner_email, partner_display_name, partner_type, scopes, created_at`,
        [
          talent.id,
          partner_type,
          partner_email.trim(),
          partner_display_name?.trim() || null,
          JSON.stringify(finalScopes),
          token,
          message?.trim() || null,
          session.userId,
        ],
      );
      const invite = r.rows[0];
      // Bygg accept-URL — frontend håndterer ruting
      const origin = (req.headers.origin as string) || `https://${req.headers.host}`;
      invite.acceptUrl = `${origin}/talents/partner-invite?token=${token}`;
      invite.maskedEmail = maskEmail(partner_email);
      return res.status(201).json({ invite });
    } catch (err) {
      console.error("[partner-invites POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å opprette invite", detail: String(err) });
    }
  });

  // ── GET /me/partner-invites ─────────────────────────────────────────
  app.get("/api/role-room/talents/me/partner-invites", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.json({ invites: [] });
      const r = await pool.query(
        `SELECT id, partner_type, partner_email, partner_display_name, scopes,
                status, message, created_at, expires_at, accepted_at, token
           FROM talent_partner_invites
          WHERE talent_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [talent.id],
      );
      return res.json({ invites: r.rows });
    } catch (err) {
      console.error("[partner-invites GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente invites" });
    }
  });

  // ── DELETE /me/partner-invites/:id ──────────────────────────────────
  app.delete("/api/role-room/talents/me/partner-invites/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { id } = req.params;
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil" });
      const r = await pool.query(
        `UPDATE talent_partner_invites
            SET status = 'cancelled', cancelled_at = now()
          WHERE id = $1 AND talent_id = $2 AND status = 'pending'
          RETURNING *`,
        [id, talent.id],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Invite ikke funnet eller allerede prosessert" });
      return res.json({ invite: r.rows[0] });
    } catch (err) {
      console.error("[partner-invites DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å avbryte invite" });
    }
  });

  // ── GET /partner-invites/:token  (public — for accept-side) ─────────
  app.get("/api/role-room/partner-invites/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const r = await pool.query(
        `SELECT i.id, i.partner_type, i.partner_email, i.partner_display_name, i.scopes,
                i.status, i.message, i.expires_at,
                t.display_name AS talent_name
           FROM talent_partner_invites i
           JOIN talents t ON t.id = i.talent_id
          WHERE i.token = $1 LIMIT 1`,
        [token],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Invite ikke funnet" });
      const invite = r.rows[0];
      if (new Date(invite.expires_at) < new Date()) {
        return res.json({ invite, expired: true });
      }
      return res.json({ invite });
    } catch (err) {
      console.error("[partner-invites/:token GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente invite" });
    }
  });

  // ── POST /partner-invites/:token/accept ─────────────────────────────
  app.post("/api/role-room/partner-invites/:token/accept", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) {
      return res.status(401).json({ error: "Du må logge inn for å akseptere invitasjonen" });
    }
    const { token } = req.params;
    try {
      const inv = await pool.query(
        `SELECT * FROM talent_partner_invites WHERE token = $1 LIMIT 1`,
        [token],
      );
      if (!inv.rowCount) return res.status(404).json({ error: "Invite ikke funnet" });
      const invite = inv.rows[0];
      if (invite.status !== "pending") {
        return res.status(409).json({ error: `Invite er allerede ${invite.status}` });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return res.status(410).json({ error: "Invite er utløpt" });
      }

      // Slå opp eller opprett agency_org basert på partner_email
      const emailLower = invite.partner_email.toLowerCase();
      let agency = await pool.query(
        `SELECT id FROM agency_orgs WHERE contact_email = $1 LIMIT 1`,
        [emailLower],
      );
      let agencyId: string;
      if (agency.rowCount) {
        agencyId = agency.rows[0].id;
      } else {
        const slug = emailLower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
        const newAgency = await pool.query(
          `INSERT INTO agency_orgs (type, name, slug, contact_email, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (slug) DO UPDATE SET contact_email = EXCLUDED.contact_email
           RETURNING id`,
          [invite.partner_type, invite.partner_display_name || emailLower, `${slug}-${crypto.randomBytes(3).toString("hex")}`, emailLower],
        );
        agencyId = newAgency.rows[0].id;
      }

      // Koble accepting user til agency
      await pool.query(
        `UPDATE users SET agency_org_id = $1, agency_role = COALESCE(agency_role, 'admin') WHERE id = $2`,
        [agencyId, session.userId],
      );

      // Grant consents på alle scopes i invite
      const scopesArr: string[] = Array.isArray(invite.scopes) ? invite.scopes : JSON.parse(invite.scopes);
      for (const scope of scopesArr) {
        await pool.query(
          `INSERT INTO talent_consent_registry
             (talent_id, partner_type, partner_ref, partner_display_name, scope, status, granted_at, granted_by)
           VALUES ($1, $2, $3, $4, $5, 'granted', now(), $6)
           ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
             status = 'granted', granted_at = now(),
             granted_by = EXCLUDED.granted_by, revoked_at = NULL, revoked_by = NULL,
             updated_at = now()`,
          [invite.talent_id, invite.partner_type, agencyId, invite.partner_display_name, scope, session.userId],
        );
      }

      // Marker invite som akseptert
      await pool.query(
        `UPDATE talent_partner_invites
            SET status = 'accepted', accepted_at = now(), accepted_by = $2, resolved_agency_org_id = $3
          WHERE id = $1`,
        [invite.id, session.userId, agencyId],
      );

      return res.json({ ok: true, agencyId, scopes: scopesArr });
    } catch (err) {
      console.error("[partner-invites/:token/accept] failed", err);
      return res.status(500).json({ error: "Klarte ikke å akseptere invite", detail: String(err) });
    }
  });
}

/** Utled human-readable access-level fra scope-settet. */
function deriveAccessLevel(scopes: Set<string>, fullProfile: boolean): "full" | "limited" | "custom" | "view_only" {
  if (fullProfile) return "full";
  const count = scopes.size;
  if (count >= 5) return "full";
  if (count <= 1) return "view_only";
  if (count === 2) return "limited";
  return "custom";
}
