/**
 * leadgrid-territory-routes.ts
 *
 * REST-endepunkter for LeadGrid territorie-grids ("hold deg i din grid").
 *
 * Mount-path: /api/leadgrid/territories/*
 *
 * Auth: session via activeSessions + RBAC via requireLeadMapPermission
 *   - territories.view          → liste / check / overlaps
 *   - territories.manage        → create / update / delete
 *   - territories.view_breaches → brudd-loggen
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  loadOrgTerritories,
  loadUserTerritories,
  resolveLeadTerritories,
  pickBestTerritory,
  detectAdminOverlaps,
  leadMatchesTerritory,
  recordBreach,
  computeCoverage,
  summarizeManagerStats,
  type LeadGeo,
  type CoverageLead,
  type ManagerMember,
  type TerritoryRow,
  type BreachKind,
} from "./leadgrid-territory-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request, activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function orgIdFromLead(pool: Pool, leadId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ organization_id: string | null }>(
      `SELECT organization_id::text FROM crm_customers WHERE id = $1::uuid LIMIT 1`,
      [leadId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

async function resolveOrgIdSmart(
  req: Request, pool: Pool, userId: string,
): Promise<string | null> {
  const explicit =
    req.body?.organization_id ?? req.body?.organizationId ??
    req.query?.organization_id ?? req.query?.organizationId;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const leadId =
    (typeof req.query?.leadId === "string" && req.query.leadId) ||
    (typeof req.query?.lead_id === "string" && req.query.lead_id) || null;
  if (leadId) {
    const o = await orgIdFromLead(pool, leadId);
    if (o) return o;
  }
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'salgssjef' THEN 2 ELSE 3 END,
                 joined_at ASC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

async function loadLeadGeo(pool: Pool, leadId: string): Promise<LeadGeo | null> {
  const r = await pool.query<{
    latitude: number | null; longitude: number | null;
    postal_code: string | null; municipality_code: string | null;
  }>(
    `SELECT latitude, longitude, postal_code, municipality_code
       FROM crm_customers WHERE id = $1::uuid LIMIT 1`,
    [leadId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    postalCode: row.postal_code,
    municipalityCode: row.municipality_code,
  };
}

export function registerLeadgridTerritoryRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };

  const permView = requireLeadMapPermission("territories.view", common);
  const permManage = requireLeadMapPermission("territories.manage", common);
  const permBreaches = requireLeadMapPermission("territories.view_breaches", common);

  // ─── GET /api/leadgrid/territories ────────────────────────────────
  app.get("/api/leadgrid/territories", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ territories: [] });
    try {
      const r = await pool.query(
        `SELECT t.id::text, t.organization_id::text, t.name, t.assigned_user_id,
                t.sales_team_id::text, t.geometry, t.municipalities, t.postal_codes,
                t.center_lat, t.center_lng, t.radius_m,
                t.priority, t.active, t.effective_from, t.effective_to,
                u.email AS assigned_email
           FROM lead_territories t
           LEFT JOIN users u ON u.id = t.assigned_user_id
          WHERE t.organization_id = $1::uuid
          ORDER BY t.priority DESC, t.created_at DESC`,
        [orgId],
      );
      return res.json({ territories: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  // ─── GET /api/leadgrid/territories/mine ───────────────────────────
  // Kun den innloggede selgerens egne grids (direkte tildelt ELLER via
  // team). iPad henter denne og gjør on-device geofence-sjekk lokalt.
  app.get("/api/leadgrid/territories/mine", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ territories: [] });
    try {
      const r = await pool.query(
        `SELECT t.id::text, t.name, t.geometry, t.municipalities, t.postal_codes,
                t.center_lat, t.center_lng, t.radius_m, t.priority, t.active,
                t.assigned_user_id
           FROM lead_territories t
          WHERE t.organization_id = $1::uuid AND t.active = TRUE
            AND (
              t.assigned_user_id = $2
              OR t.sales_team_id IN (
                SELECT sales_team_id FROM organization_members
                 WHERE organization_id = $1::uuid AND user_id = $2
                   AND sales_team_id IS NOT NULL
              )
            )
          ORDER BY t.priority DESC`,
        [orgId, session.userId],
      );
      return res.json({ territories: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "mine_failed", detail: String(err) });
    }
  });

  // ─── POST /api/leadgrid/territories ───────────────────────────────
  app.post("/api/leadgrid/territories", permManage, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });

    const b = req.body as {
      name?: string;
      assigned_user_id?: string | null;
      sales_team_id?: string | null;
      geometry?: unknown;
      municipalities?: string[];
      postal_codes?: string[];
      center_lat?: number | null;
      center_lng?: number | null;
      radius_m?: number | null;
      priority?: number;
      effective_from?: string | null;
      effective_to?: string | null;
    };
    if (!b.name || b.name.trim().length < 2) {
      return res.status(400).json({ error: "navn_kreves" });
    }
    const municipalities = Array.isArray(b.municipalities) ? b.municipalities : [];
    const postalCodes = Array.isArray(b.postal_codes) ? b.postal_codes : [];
    const hasCircle =
      typeof b.center_lat === "number" && typeof b.center_lng === "number" &&
      typeof b.radius_m === "number" && b.radius_m > 0;
    if (b.geometry == null && municipalities.length === 0 && postalCodes.length === 0 && !hasCircle) {
      return res.status(400).json({ error: "grid_uten_definisjon" });
    }

    try {
      const r = await pool.query<{ id: string }>(
        `INSERT INTO lead_territories
           (organization_id, name, assigned_user_id, sales_team_id, geometry,
            municipalities, postal_codes, center_lat, center_lng, radius_m,
            priority, effective_from, effective_to, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id::text`,
        [
          orgId, b.name.trim(), b.assigned_user_id ?? null, b.sales_team_id ?? null,
          b.geometry != null ? JSON.stringify(b.geometry) : null,
          municipalities, postalCodes,
          hasCircle ? b.center_lat : null,
          hasCircle ? b.center_lng : null,
          hasCircle ? b.radius_m : null,
          b.priority ?? 100,
          b.effective_from ?? null, b.effective_to ?? null, session.userId,
        ],
      );
      // Overlapp-advarsel (informativ, blokkerer ikke).
      const all = await loadOrgTerritories(pool, orgId);
      const overlaps = detectAdminOverlaps(all).filter(
        (o) => o.a === r.rows[0].id || o.b === r.rows[0].id,
      );
      return res.status(201).json({ id: r.rows[0].id, overlaps });
    } catch (err) {
      return res.status(500).json({ error: "create_failed", detail: String(err) });
    }
  });

  // ─── PATCH /api/leadgrid/territories/:id ──────────────────────────
  app.patch("/api/leadgrid/territories/:id", permManage, async (req: Request, res: Response) => {
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const push = (col: string, val: unknown, cast = "") => {
      sets.push(`${col} = $${i}${cast}`); vals.push(val); i++;
    };
    if (typeof b.name === "string") push("name", b.name.trim());
    if ("assigned_user_id" in b) push("assigned_user_id", b.assigned_user_id ?? null);
    if ("sales_team_id" in b) push("sales_team_id", b.sales_team_id ?? null);
    if ("geometry" in b) push("geometry", b.geometry != null ? JSON.stringify(b.geometry) : null, "::jsonb");
    if (Array.isArray(b.municipalities)) push("municipalities", b.municipalities);
    if (Array.isArray(b.postal_codes)) push("postal_codes", b.postal_codes);
    if ("center_lat" in b) push("center_lat", b.center_lat ?? null);
    if ("center_lng" in b) push("center_lng", b.center_lng ?? null);
    if ("radius_m" in b) push("radius_m", b.radius_m ?? null);
    if (typeof b.priority === "number") push("priority", b.priority);
    if (typeof b.active === "boolean") push("active", b.active);
    if ("effective_from" in b) push("effective_from", b.effective_from ?? null);
    if ("effective_to" in b) push("effective_to", b.effective_to ?? null);
    if (sets.length === 0) return res.status(400).json({ error: "ingen_endringer" });
    sets.push("updated_at = NOW()");
    vals.push(req.params.id);
    try {
      const r = await pool.query(
        `UPDATE lead_territories SET ${sets.join(", ")} WHERE id = $${i}::uuid RETURNING id::text`,
        vals,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ id: r.rows[0].id });
    } catch (err) {
      return res.status(500).json({ error: "update_failed", detail: String(err) });
    }
  });

  // ─── DELETE /api/leadgrid/territories/:id (soft) ──────────────────
  app.delete("/api/leadgrid/territories/:id", permManage, async (req: Request, res: Response) => {
    try {
      const r = await pool.query(
        `UPDATE lead_territories SET active = FALSE, updated_at = NOW()
          WHERE id = $1::uuid RETURNING id::text`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "delete_failed", detail: String(err) });
    }
  });

  // ─── GET /api/leadgrid/territories/overlaps ───────────────────────
  app.get("/api/leadgrid/territories/overlaps", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ overlaps: [] });
    try {
      const all = await loadOrgTerritories(pool, orgId);
      return res.json({ overlaps: detectAdminOverlaps(all) });
    } catch (err) {
      return res.status(500).json({ error: "overlaps_failed", detail: String(err) });
    }
  });

  // ─── GET /api/leadgrid/territories/check ──────────────────────────
  // Brukes av selger-UI: er denne lead-en (eller posisjonen) i MIN grid?
  // ?leadId=<uuid>  eller  ?lat=..&lng=..
  app.get("/api/leadgrid/territories/check", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ in_grid: true, matched_territory_id: null, conflicting_user_id: null });

    try {
      let lead: LeadGeo | null = null;
      const leadId = typeof req.query.leadId === "string" ? req.query.leadId : null;
      if (leadId) {
        lead = await loadLeadGeo(pool, leadId);
      } else if (req.query.lat && req.query.lng) {
        lead = {
          latitude: Number(req.query.lat),
          longitude: Number(req.query.lng),
          postalCode: typeof req.query.postal_code === "string" ? req.query.postal_code : null,
          municipalityCode: typeof req.query.municipality_code === "string" ? req.query.municipality_code : null,
        };
      }
      if (!lead) return res.status(400).json({ error: "mangler_lead_eller_posisjon" });

      const [own, all] = await Promise.all([
        loadUserTerritories(pool, orgId, session.userId),
        loadOrgTerritories(pool, orgId),
      ]);
      // Ingen grid satt for brukeren ⇒ ingen håndheving.
      const inGrid = own.length === 0 || own.some((t) => leadMatchesTerritory(lead as LeadGeo, t));
      const best = pickBestTerritory(resolveLeadTerritories(lead, all));

      // Myk håndheving: når en selger med egen grid jobber med en lead
      // utenfor sonen, logg det (throttlet til ett event per lead per
      // 60 min). Aldri kastende; svaret påvirkes ikke.
      if (own.length > 0 && !inGrid && leadId) {
        void (async () => {
          try {
            const dup = await pool.query<{ n: string }>(
              `SELECT COUNT(*)::text AS n FROM lead_territory_events
                WHERE user_id = $1 AND lead_id = $2::uuid
                  AND event_kind = 'lead_access_out_of_grid'
                  AND created_at > NOW() - INTERVAL '60 minutes'`,
              [session.userId, leadId],
            );
            if (Number(dup.rows[0]?.n ?? 0) > 0) return;
            await recordBreach(pool, {
              organizationId: orgId,
              userId: session.userId,
              kind: "lead_access_out_of_grid",
              leadId,
              territoryId: best?.id ?? null,
              detail: { conflicting_user_id: best?.assignedUserId ?? null },
            });
          } catch { /* ignore */ }
        })();
      }

      return res.json({
        in_grid: inGrid,
        enforced: own.length > 0,
        matched_territory_id: best?.id ?? null,
        conflicting_user_id: inGrid ? null : best?.assignedUserId ?? null,
      });
    } catch (err) {
      return res.status(500).json({ error: "check_failed", detail: String(err) });
    }
  });

  // ─── GET /api/leadgrid/territories/coverage ───────────────────────
  // Manager-oversikt: hvor mange leads dekkes av grids, foreldreløse,
  // overlapp, og leads per grid.
  app.get("/api/leadgrid/territories/coverage", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ coverage: null });
    try {
      const territories = await loadOrgTerritories(pool, orgId);
      // Org-leads med koordinater: direkte organization_id ELLER via prosjekt.
      const leadsRes = await pool.query<{
        id: string; name: string | null;
        latitude: number | null; longitude: number | null;
        postal_code: string | null; municipality_code: string | null;
      }>(
        // FIX (2026-06-22): crm_customers har ikke organization_id —
        // bruk owner_user_id IN organization_members (PR #837/#848).
        `SELECT c.id::text, c.name, c.latitude, c.longitude,
                c.postal_code, c.municipality_code
           FROM crm_customers c
           LEFT JOIN casting_projects cp ON cp.id = c.project_id
          WHERE (c.owner_user_id IN (
                    SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid
                 )
                 OR cp.organization_id = $1::uuid)
            AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL`,
        [orgId],
      );
      const leads: CoverageLead[] = leadsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        postalCode: r.postal_code,
        municipalityCode: r.municipality_code,
      }));
      const coverage = computeCoverage(leads, territories);
      return res.json({ coverage, adminOverlaps: detectAdminOverlaps(territories) });
    } catch (err) {
      return res.status(500).json({ error: "coverage_failed", detail: String(err) });
    }
  });

  // ─── GET /api/leadgrid/territories/dashboard ──────────────────────
  // Leder-dashboard: sone-ytelse per selger (brudd, in/out-besøk, in/out-leads,
  // «ute nå»). Periode: this_month | last_30d (default) | ytd.
  app.get("/api/leadgrid/territories/dashboard", permBreaches, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ sellers: [], period: "last_30d" });

    const period = ["this_month", "last_30d", "ytd"].includes(String(req.query.period))
      ? String(req.query.period) : "last_30d";
    const now = new Date();
    const since =
      period === "this_month" ? new Date(now.getFullYear(), now.getMonth(), 1)
      : period === "ytd" ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    try {
      const membersRes = await pool.query<{
        user_id: string; display_name: string | null; email: string | null;
        role: string | null; team_name: string | null; territory_label: string | null;
        sales_team_id: string | null;
      }>(
        `SELECT om.user_id,
                COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
                         u.username, u.email, om.user_id) AS display_name,
                u.email, om.role, st.name AS team_name,
                up.territory AS territory_label, om.sales_team_id::text
           FROM organization_members om
           JOIN users u ON u.id = om.user_id
           LEFT JOIN user_profiles up ON up.user_id = om.user_id AND up.organization_id = om.organization_id
           LEFT JOIN sales_teams st ON st.id = om.sales_team_id
          WHERE om.organization_id = $1::uuid
            AND om.role IN ('salgskonsulent', 'promotor', 'teamleder')`,
        [orgId],
      );
      const memberIds = membersRes.rows.map((m) => m.user_id);
      if (memberIds.length === 0) return res.json({ sellers: [], period });

      const [breaches, visits, leads, locations, orgTerritories] = await Promise.all([
        pool.query<{ user_id: string; event_kind: string; count: number }>(
          `SELECT user_id, event_kind, COUNT(*)::int AS count
             FROM lead_territory_events
            WHERE organization_id = $1::uuid AND created_at >= $2
            GROUP BY user_id, event_kind`, [orgId, since.toISOString()]),
        pool.query<{ user_id: string; total: number; out_of_grid: number }>(
          `SELECT user_id, COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE out_of_grid)::int AS out_of_grid
             FROM crm_visits
            WHERE user_id = ANY($1) AND visit_datetime >= $2
            GROUP BY user_id`, [memberIds, since.toISOString()]),
        pool.query<{ user_id: string; latitude: any; longitude: any; postal_code: string | null; municipality_code: string | null }>(
          `SELECT assigned_user_id AS user_id, latitude, longitude, postal_code, municipality_code
             FROM crm_customers
            WHERE assigned_user_id = ANY($1)
              AND latitude IS NOT NULL AND longitude IS NOT NULL`, [memberIds]),
        pool.query<{ user_id: string; lat: any; lng: any }>(
          `SELECT user_id, lat, lng FROM member_locations
            WHERE organization_id = $1::uuid AND is_sharing = TRUE`, [orgId]),
        loadOrgTerritories(pool, orgId),
      ]);

      // Grids per bruker: direkte tildelt ELLER via teamet brukeren er i.
      const territoriesByUser: Record<string, TerritoryRow[]> = {};
      for (const m of membersRes.rows) {
        territoriesByUser[m.user_id] = orgTerritories.filter(
          (t) => t.assignedUserId === m.user_id ||
                 (t.salesTeamId != null && t.salesTeamId === m.sales_team_id),
        );
      }

      const members: ManagerMember[] = membersRes.rows.map((m) => ({
        userId: m.user_id, displayName: m.display_name, email: m.email,
        role: m.role, teamName: m.team_name, territoryLabel: m.territory_label,
      }));

      const sellers = summarizeManagerStats(members, {
        breachRows: breaches.rows.map((r) => ({ user_id: r.user_id, event_kind: r.event_kind as BreachKind, count: r.count })),
        visitRows: visits.rows,
        assignedLeads: leads.rows.map((r) => ({
          userId: r.user_id,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          postalCode: r.postal_code, municipalityCode: r.municipality_code,
        })),
        locations: locations.rows.map((r) => ({ user_id: r.user_id, lat: Number(r.lat), lng: Number(r.lng) })),
        territoriesByUser,
      });

      return res.json({ period, sellers });
    } catch (err) {
      return res.status(500).json({ error: "dashboard_failed", detail: String(err) });
    }
  });

  // ─── GET /api/leadgrid/territories/breaches ───────────────────────
  app.get("/api/leadgrid/territories/breaches", permBreaches, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.json({ breaches: [] });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    try {
      const r = await pool.query(
        `SELECT e.id::text, e.user_id, e.event_kind, e.lead_id::text, e.territory_id::text,
                e.detail, e.created_at,
                u.email AS user_email, c.name AS lead_name, t.name AS territory_name
           FROM lead_territory_events e
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN crm_customers c ON c.id = e.lead_id
           LEFT JOIN lead_territories t ON t.id = e.territory_id
          WHERE e.organization_id = $1::uuid
          ORDER BY e.created_at DESC
          LIMIT $2`,
        [orgId, limit],
      );
      return res.json({ breaches: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "breaches_failed", detail: String(err) });
    }
  });
}
