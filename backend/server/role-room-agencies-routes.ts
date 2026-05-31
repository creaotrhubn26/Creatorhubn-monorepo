/**
 * role-room-agencies-routes.ts
 *
 * B2B2Talent Phase 1.5 — partner-perspektivet. Agency-orgs (Stella Casting,
 * NSF, produksjonsselskap) leser talent-profiler kun via consent.
 *
 * Endpoints:
 *   - GET    /api/role-room/agencies                 — søkbar liste (for talent-dropdown)
 *   - GET    /api/role-room/agencies/:idOrSlug       — én agency (offentlig profil)
 *   - GET    /api/role-room/agency/me                — innlogget user sin agency
 *   - PUT    /api/role-room/agency/me                — oppdater agency-profil (kun admin)
 *   - GET    /api/role-room/agency/talents           — talents min agency har consent fra
 *   - GET    /api/role-room/agency/talents/:talentId — én talent (sjekk consent + log audit)
 *
 * Skjema: migrasjon 211 (agency_orgs + users.agency_org_id + users.agency_role).
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface RoleRoomAgenciesRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const EDITABLE_AGENCY_FIELDS = [
  "name",
  "contact_email",
  "website_url",
  "about",
  "logo_url",
] as const;

/** Hent agency-org for innlogget user. Returnerer null + role hvis ingen tilknytning. */
async function fetchAgencyForUser(
  pool: Pool,
  userId: string,
): Promise<{ agency: Record<string, unknown> | null; agencyRole: string | null }> {
  const r = await pool.query(
    `SELECT u.agency_org_id, u.agency_role,
            a.id, a.type, a.name, a.slug, a.contact_email, a.website_url, a.about,
            a.logo_url, a.verified, a.verified_at, a.status, a.metadata,
            a.created_at, a.updated_at
       FROM users u
       LEFT JOIN agency_orgs a ON a.id = u.agency_org_id
      WHERE u.id = $1
      LIMIT 1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row || !row.agency_org_id) return { agency: null, agencyRole: null };
  const { agency_org_id, agency_role, ...agency } = row;
  return { agency: { ...agency, id: agency_org_id }, agencyRole: agency_role };
}

export function setupRoleRoomAgenciesRoutes(deps: RoleRoomAgenciesRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET /agencies — søkbar liste (for talent-dropdown ved grant-consent) ──
  app.get("/api/role-room/agencies", async (req, res) => {
    // Krever session så vi unngår at hele agency-listen er offentlig scrape-bar.
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const typeFilter = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    try {
      const clauses: string[] = ["status = 'active'"];
      const vals: unknown[] = [];
      if (q) {
        vals.push(`%${q}%`);
        clauses.push(`(name ILIKE $${vals.length} OR slug ILIKE $${vals.length})`);
      }
      if (typeFilter) {
        vals.push(typeFilter);
        clauses.push(`type = $${vals.length}`);
      }
      vals.push(limit);
      const r = await pool.query(
        `SELECT id, type, name, slug, contact_email, website_url, about, logo_url, verified
           FROM agency_orgs
          WHERE ${clauses.join(" AND ")}
          ORDER BY verified DESC, name ASC
          LIMIT $${vals.length}`,
        vals,
      );
      return res.json({ agencies: r.rows });
    } catch (err) {
      console.error("[agencies GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente agencies" });
    }
  });

  // ── GET /agencies/:idOrSlug — offentlig agency-profil ──
  app.get("/api/role-room/agencies/:idOrSlug", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { idOrSlug } = req.params;
    // UUID-format-sjekk for å avgjøre om vi treffer på id eller slug.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    try {
      const r = await pool.query(
        isUuid
          ? `SELECT id, type, name, slug, contact_email, website_url, about, logo_url, verified, status
               FROM agency_orgs WHERE id = $1 LIMIT 1`
          : `SELECT id, type, name, slug, contact_email, website_url, about, logo_url, verified, status
               FROM agency_orgs WHERE slug = $1 LIMIT 1`,
        [idOrSlug],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Agency ikke funnet" });
      return res.json({ agency: r.rows[0] });
    } catch (err) {
      console.error("[agencies/:idOrSlug] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente agency" });
    }
  });

  // ── GET /agency/me — min agency (eller null) ──
  app.get("/api/role-room/agency/me", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const { agency, agencyRole } = await fetchAgencyForUser(pool, session.userId);
      return res.json({ agency, agencyRole });
    } catch (err) {
      console.error("[agency/me] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente agency-tilknytning" });
    }
  });

  // ── PUT /agency/me — oppdater agency-profil (kun admin) ──
  app.put("/api/role-room/agency/me", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const { agency, agencyRole } = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(404).json({ error: "Du tilhører ikke en agency" });
      if (agencyRole !== "admin") {
        return res.status(403).json({ error: "Kun agency-admin kan oppdatere profilen" });
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const field of EDITABLE_AGENCY_FIELDS) {
        if (field in body) patch[field] = body[field];
      }
      if (Object.keys(patch).length === 0) {
        return res.json({ agency });
      }
      const setClauses: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      for (const [k, v] of Object.entries(patch)) {
        setClauses.push(`${k} = $${i}`);
        vals.push(v ?? null);
        i += 1;
      }
      vals.push((agency as { id: string }).id);
      const r = await pool.query(
        `UPDATE agency_orgs SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
        vals,
      );
      return res.json({ agency: r.rows[0] });
    } catch (err) {
      console.error("[agency/me PUT] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere agency" });
    }
  });

  // ── GET /agency/talents — alle talents min agency har consent fra ──
  // Returnerer talent-data filtrert til scopes consent-en dekker.
  app.get("/api/role-room/agency/talents", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const { agency } = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });
      const agencyId = (agency as { id: string }).id;
      const agencyType = (agency as { type: string }).type;

      // Hent alle aktive consents der partner_type matches agency.type
      // og partner_ref er agency.id. Inkluder talent-felter consent dekker.
      const r = await pool.query(
        `SELECT
            t.id, t.display_name, t.city, t.country, t.bio,
            t.headshot_url, t.showreel_url, t.resume_url,
            t.age_range, t.playing_age_min, t.playing_age_max,
            t.gender, t.ethnicity, t.height_cm, t.hair_color, t.eye_color,
            t.skills, t.languages, t.dialects,
            t.availability_status, t.willing_to_travel,
            t.email, t.phone,
            t.agency_name, t.represented,
            t.external_links, t.profile_status,
            array_agg(c.scope) FILTER (WHERE c.scope IS NOT NULL) AS granted_scopes,
            min(c.granted_at) AS earliest_consent
           FROM talent_consent_registry c
           JOIN talents t ON t.id = c.talent_id
          WHERE c.status = 'granted'
            AND c.partner_type = $1
            AND c.partner_ref = $2
            AND (c.expires_at IS NULL OR c.expires_at > now())
            AND t.profile_status != 'archived'
          GROUP BY t.id
          ORDER BY t.updated_at DESC
          LIMIT 500`,
        [agencyType, agencyId],
      );

      // Maskér felter talenten IKKE har gitt scope for.
      const masked = r.rows.map((row) => maskTalentByScopes(row));

      // Logg listing-audit (én rad — vi logger ikke per-talent her for å unngå spam).
      try {
        await pool.query(
          `INSERT INTO talent_access_audit (talent_id, partner_type, partner_ref, scope, accessed_by, access_context)
           SELECT t.id, $1, $2, 'basic_profile', $3, $4
             FROM talent_consent_registry c
             JOIN talents t ON t.id = c.talent_id
            WHERE c.status = 'granted' AND c.partner_type = $1 AND c.partner_ref = $2
            LIMIT 500`,
          [agencyType, agencyId, session.userId, JSON.stringify({ endpoint: "/agency/talents" })],
        );
      } catch (auditErr) {
        // Audit-failure skal ikke blokkere svaret.
        console.warn("[agency/talents audit] failed", auditErr);
      }

      return res.json({ talents: masked, agency: { id: agencyId, type: agencyType } });
    } catch (err) {
      console.error("[agency/talents] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente talents" });
    }
  });

  // ── GET /agency/talents/:talentId — én talent (sjekk consent + log audit) ──
  app.get("/api/role-room/agency/talents/:talentId", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { talentId } = req.params;
    try {
      const { agency } = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });
      const agencyId = (agency as { id: string }).id;
      const agencyType = (agency as { type: string }).type;

      const consentResult = await pool.query(
        `SELECT scope FROM talent_consent_registry
          WHERE talent_id = $1
            AND partner_type = $2
            AND partner_ref = $3
            AND status = 'granted'
            AND (expires_at IS NULL OR expires_at > now())`,
        [talentId, agencyType, agencyId],
      );
      if (!consentResult.rowCount) {
        return res.status(403).json({ error: "Talenten har ikke gitt din agency tilgang" });
      }
      const grantedScopes = consentResult.rows.map((r) => r.scope as string);

      const t = await pool.query(`SELECT * FROM talents WHERE id = $1`, [talentId]);
      if (!t.rowCount) return res.status(404).json({ error: "Talent ikke funnet" });
      const talent = { ...t.rows[0], granted_scopes: grantedScopes };
      const masked = maskTalentByScopes(talent);

      // Logg per-talent audit
      await pool.query(
        `INSERT INTO talent_access_audit (talent_id, partner_type, partner_ref, scope, accessed_by, access_context)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          talentId,
          agencyType,
          agencyId,
          grantedScopes.join(",") || "basic_profile",
          session.userId,
          JSON.stringify({ endpoint: "/agency/talents/:id" }),
        ],
      );

      return res.json({ talent: masked });
    } catch (err) {
      console.error("[agency/talents/:id] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente talent" });
    }
  });
}

/**
 * Maskér felter talenten ikke har gitt scope for. full_profile låser opp alt.
 * basic_profile (default) gir kun navn + by + land + bio + represented.
 */
function maskTalentByScopes(row: Record<string, unknown>): Record<string, unknown> {
  const scopes = new Set<string>(
    Array.isArray(row.granted_scopes) ? (row.granted_scopes as string[]) : [],
  );
  const has = (s: string) => scopes.has("full_profile") || scopes.has(s);

  const masked: Record<string, unknown> = {
    id: row.id,
    display_name: row.display_name,
    city: row.city,
    country: row.country,
    bio: row.bio,
    represented: row.represented,
    profile_status: row.profile_status,
    granted_scopes: Array.from(scopes),
  };

  if (has("media_portfolio")) {
    masked.headshot_url = row.headshot_url;
    masked.showreel_url = row.showreel_url;
    masked.resume_url = row.resume_url;
  }
  if (has("contact_info")) {
    masked.email = row.email;
    masked.phone = row.phone;
    masked.agency_name = row.agency_name;
  }
  if (has("demographics")) {
    masked.age_range = row.age_range;
    masked.playing_age_min = row.playing_age_min;
    masked.playing_age_max = row.playing_age_max;
    masked.gender = row.gender;
    masked.ethnicity = row.ethnicity;
    masked.height_cm = row.height_cm;
    masked.hair_color = row.hair_color;
    masked.eye_color = row.eye_color;
  }
  if (has("availability")) {
    masked.availability_status = row.availability_status;
    masked.willing_to_travel = row.willing_to_travel;
  }
  if (has("basic_profile") || scopes.size === 0) {
    // basic_profile inkluderer kun det som allerede er i masked-default + skills/languages
    masked.skills = row.skills;
    masked.languages = row.languages;
    masked.dialects = row.dialects;
    masked.external_links = row.external_links;
  }

  return masked;
}
