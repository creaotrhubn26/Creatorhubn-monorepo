/**
 * lead-map-profile-routes.ts
 *
 * Profil-håndtering for Lead Map:
 *   - Org-profil (utvidet info om organisasjonen)
 *   - User-profil per org (tittel, territorium, kvote, kommisjon)
 *   - Salgs-team (Teamleder → Salgskonsulenter/Promotører)
 *
 * Endepunkter:
 *
 *   Org-profil:
 *     GET   /organizations/:id/profile
 *     PATCH /organizations/:id/profile     — kun admin
 *
 *   User-profil (under org):
 *     GET   /organizations/:id/members/:userId/profile
 *     PATCH /organizations/:id/members/:userId/profile
 *           — admin kan oppdatere alle; bruker kan oppdatere seg selv
 *     GET   /organizations/:id/profiles    — liste alle medlems-profiler
 *
 *   Salgs-team:
 *     GET    /organizations/:id/teams
 *     POST   /organizations/:id/teams              — admin/salgssjef
 *     PATCH  /organizations/:id/teams/:teamId      — admin/salgssjef/teamleder
 *     DELETE /organizations/:id/teams/:teamId      — admin/salgssjef
 *     POST   /organizations/:id/teams/:teamId/members  — sett team på medlem
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function getMemberRole(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<string | null> {
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId],
  );
  return r.rows[0]?.role ?? null;
}

const ADMIN_LIKE = new Set(["admin"]);
const SALES_LEAD = new Set(["admin", "salgssjef"]);
const TEAM_LEAD_OR_ABOVE = new Set(["admin", "salgssjef", "teamleder"]);

export function registerLeadMapProfileRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── POST /heartbeat ─────────────────────────────────────────────
  // Frontend kaller dette hvert 60s for å markere brukeren som online.
  // last_active_at i organization_members brukes til "online"-badge.
  // Hvis brukeren har samtykket til posisjonsdeling, kan body inneholde
  // lat/lng/accuracy_m + activity for live-pin på kartet.
  app.post(
    "/api/admin-room/lead-map/heartbeat",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        organization_id?: string;
        lat?: number; lng?: number; accuracy_m?: number;
        activity?: string;
        current_lead_id?: string;
        current_visit_id?: string;
      };
      if (!body.organization_id) {
        return res.status(400).json({ error: "mangler_organization_id" });
      }
      try {
        await pool.query(
          `UPDATE organization_members
              SET last_active_at = NOW()
            WHERE organization_id = $1 AND user_id = $2`,
          [body.organization_id, session.userId],
        );
        // Hvis posisjon sendt: krev consent + upsert
        if (typeof body.lat === "number" && typeof body.lng === "number") {
          const consentRes = await pool.query(
            `SELECT 1 FROM member_location_consent
              WHERE user_id = $1 AND organization_id = $2
                AND revoked_at IS NULL LIMIT 1`,
            [session.userId, body.organization_id],
          );
          if (consentRes.rowCount !== null && consentRes.rowCount > 0) {
            await pool.query(
              `INSERT INTO member_locations (
                 organization_id, user_id, lat, lng, accuracy_m,
                 activity, current_lead_id, current_visit_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (organization_id, user_id) DO UPDATE SET
                 lat = EXCLUDED.lat,
                 lng = EXCLUDED.lng,
                 accuracy_m = EXCLUDED.accuracy_m,
                 activity = EXCLUDED.activity,
                 current_lead_id = EXCLUDED.current_lead_id,
                 current_visit_id = EXCLUDED.current_visit_id,
                 updated_at = NOW()`,
              [
                body.organization_id, session.userId,
                body.lat, body.lng, body.accuracy_m ?? null,
                body.activity ?? "idle",
                body.current_lead_id ?? null,
                body.current_visit_id ?? null,
              ],
            );
          }
        }
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "heartbeat_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /location/consent ──────────────────────────────────────
  // Brukeren samtykker til at posisjonen kan deles med org
  app.post(
    "/api/admin-room/lead-map/organizations/:id/location/consent",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        await pool.query(
          `INSERT INTO member_location_consent (
             user_id, organization_id, ip_address, user_agent, consented_at
           ) VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, organization_id) DO UPDATE SET
             consented_at = NOW(),
             revoked_at = NULL,
             ip_address = EXCLUDED.ip_address,
             user_agent = EXCLUDED.user_agent`,
          [
            session.userId, req.params.id,
            String(req.ip ?? "").slice(0, 64),
            String(req.headers["user-agent"] ?? "").slice(0, 500),
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "consent_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /location/consent ────────────────────────────────────
  app.delete(
    "/api/admin-room/lead-map/organizations/:id/location/consent",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        await pool.query(
          `UPDATE member_location_consent
              SET revoked_at = NOW()
            WHERE user_id = $1 AND organization_id = $2`,
          [session.userId, req.params.id],
        );
        // Slett også cached posisjon
        await pool.query(
          `DELETE FROM member_locations
            WHERE organization_id = $1 AND user_id = $2`,
          [req.params.id, session.userId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "revoke_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /location/consent ───────────────────────────────────────
  // Sjekk min egen consent-status
  app.get(
    "/api/admin-room/lead-map/organizations/:id/location/consent",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{ consented_at: string | null; revoked_at: string | null }>(
          `SELECT consented_at::text, revoked_at::text
             FROM member_location_consent
            WHERE user_id = $1 AND organization_id = $2 LIMIT 1`,
          [session.userId, req.params.id],
        );
        const row = r.rows[0];
        return res.json({
          consented: Boolean(row && row.consented_at && !row.revoked_at),
          consentedAt: row?.consented_at ?? null,
          revokedAt: row?.revoked_at ?? null,
        });
      } catch (err) {
        return res.status(500).json({ error: "consent_status_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/member-locations ─────────────────────
  // Live-posisjoner for alle medlemmer som har samtykket og er aktive
  // siste 15 min. Bruker viser disse som avatar-pins på Lead Map-kartet.
  app.get(
    "/api/admin-room/lead-map/organizations/:id/member-locations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      // Caller må være medlem av org-en
      const memRes = await pool.query(
        `SELECT 1 FROM organization_members
          WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
        [req.params.id, session.userId],
      );
      if (memRes.rowCount === 0) {
        return res.status(403).json({ error: "ikke_medlem" });
      }
      try {
        const r = await pool.query<{
          user_id: string;
          lat: number; lng: number; accuracy_m: number | null;
          activity: string;
          current_lead_id: string | null;
          current_visit_id: string | null;
          updated_at: string;
          display_name: string | null;
          title: string | null;
          avatar_url: string | null;
          role: string;
          team_name: string | null;
        }>(
          `SELECT ml.user_id,
                  ml.lat, ml.lng, ml.accuracy_m,
                  ml.activity,
                  ml.current_lead_id, ml.current_visit_id,
                  ml.updated_at::text,
                  up.display_name, up.title, up.avatar_url,
                  om.role,
                  st.name AS team_name
             FROM member_locations ml
             JOIN organization_members om
               ON om.organization_id = ml.organization_id
              AND om.user_id = ml.user_id
             LEFT JOIN user_profiles up
               ON up.organization_id = ml.organization_id
              AND up.user_id = ml.user_id
             LEFT JOIN sales_teams st ON st.id = om.sales_team_id
            WHERE ml.organization_id = $1
              AND ml.is_sharing = TRUE
              AND ml.updated_at > NOW() - INTERVAL '15 minutes'
            ORDER BY ml.updated_at DESC`,
          [req.params.id],
        );
        return res.json({ locations: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "locations_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/profile ──────────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/profile",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role) return res.status(403).json({ error: "ikke_medlem" });
      try {
        const r = await pool.query<{
          id: string; owner_user_id: string | null;
          [k: string]: unknown;
        }>(
          `SELECT id::text, owner_user_id,
                  name, slug, plan, org_type,
                  description, website, industry, org_number,
                  phone, contact_email, address_line,
                  postal_code, city, country,
                  logo_url, brand_color, meta,
                  created_at::text, updated_at::text
             FROM organizations WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const row = r.rows[0];
        const isOwner = row.owner_user_id === session.userId;
        return res.json({
          profile: row,
          canEdit: ADMIN_LIKE.has(role),
          isOwner,
          // org_number + logo_url er låst til eier — frontend bruker dette
          ownerOnlyFields: ["org_number", "logo_url"],
        });
      } catch (err) {
        return res.status(500).json({ error: "profile_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /organizations/:id/profile ────────────────────────────
  app.patch(
    "/api/admin-room/lead-map/organizations/:id/profile",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role || !ADMIN_LIKE.has(role)) {
        return res.status(403).json({ error: "kun_admin_kan_endre_profil" });
      }
      // Sjekk eierskap — org_number + logo_url er låst til org-eier
      const ownerRes = await pool.query<{ owner_user_id: string | null }>(
        `SELECT owner_user_id FROM organizations WHERE id = $1`,
        [req.params.id],
      );
      const isOwner = ownerRes.rows[0]?.owner_user_id === session.userId;
      const OWNER_ONLY_FIELDS = new Set(["org_number", "logo_url"]);
      const allowed = [
        "name", "description", "website", "industry", "org_number",
        "phone", "contact_email", "address_line", "postal_code",
        "city", "country", "logo_url", "brand_color",
      ];
      const body = req.body as Record<string, unknown>;
      // Avvis tidlig hvis ikke-eier forsøker å endre eier-feltene
      for (const k of Object.keys(body)) {
        if (OWNER_ONLY_FIELDS.has(k) && !isOwner) {
          return res.status(403).json({
            error: "kun_eier_kan_endre_dette_feltet",
            field: k,
            ownerOnlyFields: ["org_number", "logo_url"],
          });
        }
      }
      const sets: string[] = [];
      const values: unknown[] = [req.params.id];
      let idx = 2;
      for (const key of allowed) {
        if (key in body) {
          sets.push(`${key} = $${idx++}`);
          values.push(body[key]);
        }
      }
      if (sets.length === 0) return res.json({ ok: true, updated: 0 });
      try {
        await pool.query(
          `UPDATE organizations
              SET ${sets.join(", ")}, updated_at = NOW()
            WHERE id = $1`,
          values,
        );
        return res.json({ ok: true, updated: sets.length });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/profiles ─────────────────────────────
  // Liste alle medlems-profiler i org
  app.get(
    "/api/admin-room/lead-map/organizations/:id/profiles",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role) return res.status(403).json({ error: "ikke_medlem" });
      try {
        const r = await pool.query(
          `SELECT om.user_id, om.role, om.sales_team_id::text,
                  om.last_active_at::text AS last_active_at,
                  -- Online = aktiv siste 5 min (samme heuristikk som Admin Room)
                  (om.last_active_at IS NOT NULL
                    AND om.last_active_at > NOW() - INTERVAL '5 minutes') AS is_online,
                  u.email AS user_email, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS user_name,
                  up.display_name, up.title, up.bio, up.avatar_url,
                  up.phone, up.contact_email AS profile_contact_email,
                  up.linkedin_url, up.territory,
                  up.quota_monthly_nok, up.commission_pct,
                  up.is_active,
                  st.name AS team_name
             FROM organization_members om
             LEFT JOIN users u ON u.id = om.user_id
             LEFT JOIN user_profiles up
               ON up.user_id = om.user_id AND up.organization_id = om.organization_id
             LEFT JOIN sales_teams st ON st.id = om.sales_team_id
            WHERE om.organization_id = $1
            ORDER BY
              CASE om.role
                WHEN 'admin' THEN 1
                WHEN 'salgssjef' THEN 2
                WHEN 'teamleder' THEN 3
                WHEN 'salgskonsulent' THEN 4
                WHEN 'promotor' THEN 5
                WHEN 'member' THEN 6
                WHEN 'viewer' THEN 7
                ELSE 8
              END,
              om.joined_at ASC`,
          [req.params.id],
        );
        return res.json({ profiles: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "profiles_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/members/:userId/profile ──────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/members/:userId/profile",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role) return res.status(403).json({ error: "ikke_medlem" });
      try {
        const r = await pool.query(
          `SELECT up.*, om.role AS org_role, om.sales_team_id::text,
                  u.email AS user_email, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS user_name
             FROM organization_members om
             LEFT JOIN users u ON u.id = om.user_id
             LEFT JOIN user_profiles up
               ON up.user_id = om.user_id AND up.organization_id = om.organization_id
            WHERE om.organization_id = $1 AND om.user_id = $2
            LIMIT 1`,
          [req.params.id, req.params.userId],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const canEdit = ADMIN_LIKE.has(role) || session.userId === req.params.userId;
        return res.json({ profile: r.rows[0], canEdit });
      } catch (err) {
        return res.status(500).json({ error: "profile_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /organizations/:id/members/:userId/profile ────────────
  app.patch(
    "/api/admin-room/lead-map/organizations/:id/members/:userId/profile",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const callerRole = await getMemberRole(pool, session.userId, req.params.id);
      if (!callerRole) return res.status(403).json({ error: "ikke_medlem" });
      const isSelf = session.userId === req.params.userId;
      if (!isSelf && !ADMIN_LIKE.has(callerRole)) {
        return res.status(403).json({ error: "kan_kun_endre_egen_profil" });
      }
      const allowed = [
        "display_name", "title", "bio", "avatar_url",
        "phone", "contact_email", "linkedin_url",
        "territory", "quota_monthly_nok", "quota_currency",
        "commission_pct", "is_active",
      ];
      const body = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [req.params.id, req.params.userId];
      let idx = 3;
      for (const key of allowed) {
        if (key in body) {
          sets.push(`${key} = $${idx++}`);
          values.push(body[key]);
        }
      }
      if (sets.length === 0) return res.json({ ok: true, updated: 0 });
      try {
        // Bruk INSERT ... ON CONFLICT for å opprette ved første endring
        const insertCols = ["organization_id", "user_id", ...allowed.filter((k) => k in body)];
        const insertVals = [req.params.id, req.params.userId, ...allowed.filter((k) => k in body).map((k) => body[k])];
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(", ");
        const updateSets = allowed.filter((k) => k in body).map((k) => `${k} = EXCLUDED.${k}`).join(", ");
        await pool.query(
          `INSERT INTO user_profiles (${insertCols.join(", ")})
           VALUES (${placeholders})
           ON CONFLICT (user_id, organization_id) DO UPDATE
             SET ${updateSets}, updated_at = NOW()`,
          insertVals,
        );
        return res.json({ ok: true, updated: sets.length });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/teams ────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/teams",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role) return res.status(403).json({ error: "ikke_medlem" });
      try {
        const r = await pool.query(
          `SELECT st.id::text, st.name, st.description, st.territory,
                  st.team_lead_user_id,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS team_lead_name, u.email AS team_lead_email,
                  (SELECT COUNT(*)::int FROM organization_members om
                    WHERE om.sales_team_id = st.id) AS member_count,
                  st.created_at::text, st.updated_at::text
             FROM sales_teams st
             LEFT JOIN users u ON u.id = st.team_lead_user_id
            WHERE st.organization_id = $1
            ORDER BY st.created_at ASC`,
          [req.params.id],
        );
        return res.json({
          teams: r.rows,
          canCreate: SALES_LEAD.has(role),
        });
      } catch (err) {
        return res.status(500).json({ error: "teams_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /organizations/:id/teams ───────────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/teams",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role || !SALES_LEAD.has(role)) {
        return res.status(403).json({ error: "kun_admin_eller_salgssjef" });
      }
      const body = req.body as {
        name?: string;
        description?: string;
        territory?: string;
        team_lead_user_id?: string;
      };
      if (!body.name?.trim()) return res.status(400).json({ error: "navn_kreves" });
      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO sales_teams (
             organization_id, name, description, territory, team_lead_user_id
           ) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
          [
            req.params.id,
            body.name.trim(),
            body.description ?? null,
            body.territory ?? null,
            body.team_lead_user_id ?? null,
          ],
        );
        // Hvis teamleder er angitt og er medlem, sett rollen til teamleder
        if (body.team_lead_user_id) {
          await pool.query(
            `UPDATE organization_members
                SET role = 'teamleder',
                    sales_team_id = $3
              WHERE organization_id = $1
                AND user_id = $2
                AND role NOT IN ('admin', 'salgssjef')`,
            [req.params.id, body.team_lead_user_id, r.rows[0].id],
          );
        }
        return res.json({ ok: true, teamId: r.rows[0].id });
      } catch (err) {
        return res.status(500).json({ error: "create_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /organizations/:id/teams/:teamId ──────────────────────
  app.patch(
    "/api/admin-room/lead-map/organizations/:id/teams/:teamId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role || !TEAM_LEAD_OR_ABOVE.has(role)) {
        return res.status(403).json({ error: "kun_admin_salgssjef_eller_teamleder" });
      }
      const body = req.body as {
        name?: string;
        description?: string;
        territory?: string;
        team_lead_user_id?: string;
      };
      const sets: string[] = [];
      const values: unknown[] = [req.params.teamId, req.params.id];
      let idx = 3;
      if (body.name !== undefined) { sets.push(`name = $${idx++}`); values.push(body.name); }
      if (body.description !== undefined) { sets.push(`description = $${idx++}`); values.push(body.description); }
      if (body.territory !== undefined) { sets.push(`territory = $${idx++}`); values.push(body.territory); }
      // Bare admin/salgssjef kan endre team-lead
      if (body.team_lead_user_id !== undefined && SALES_LEAD.has(role)) {
        sets.push(`team_lead_user_id = $${idx++}`);
        values.push(body.team_lead_user_id);
      }
      if (sets.length === 0) return res.json({ ok: true, updated: 0 });
      try {
        await pool.query(
          `UPDATE sales_teams
              SET ${sets.join(", ")}, updated_at = NOW()
            WHERE id = $1 AND organization_id = $2`,
          values,
        );
        return res.json({ ok: true, updated: sets.length });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /organizations/:id/teams/:teamId ─────────────────────
  app.delete(
    "/api/admin-room/lead-map/organizations/:id/teams/:teamId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role || !SALES_LEAD.has(role)) {
        return res.status(403).json({ error: "kun_admin_eller_salgssjef" });
      }
      try {
        await pool.query(
          `DELETE FROM sales_teams WHERE id = $1 AND organization_id = $2`,
          [req.params.teamId, req.params.id],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "delete_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /organizations/:id/teams/:teamId/members ───────────────
  // Sett team på en bruker (eller fjern med userId + sales_team_id=null)
  app.post(
    "/api/admin-room/lead-map/organizations/:id/teams/:teamId/members",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role || !TEAM_LEAD_OR_ABOVE.has(role)) {
        return res.status(403).json({ error: "kun_admin_salgssjef_eller_teamleder" });
      }
      const body = req.body as { userId?: string; remove?: boolean };
      if (!body.userId) return res.status(400).json({ error: "userId_kreves" });
      try {
        await pool.query(
          `UPDATE organization_members
              SET sales_team_id = $3
            WHERE organization_id = $1 AND user_id = $2`,
          [
            req.params.id,
            body.userId,
            body.remove ? null : req.params.teamId,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "team_assign_failed", detail: String(err) });
      }
    },
  );
}
