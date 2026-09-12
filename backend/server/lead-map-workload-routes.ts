/**
 * lead-map-workload-routes.ts
 *
 * "Min arbeidsliste" + lead-tildeling for salgskonsulent.
 *
 * Endepunkter:
 *
 *   GET    /me/workload?organization_id=...&lat=...&lng=...
 *     → mine assigned leads + distanse fra current location + Claude-rank
 *
 *   GET    /me/quota?organization_id=...
 *     → kvote-progresjon denne måneden + målsetning + projection
 *
 *   POST   /leads/:id/assign       — tildel lead til konsulent
 *          { user_id, reason? }    krever leads.assign
 *
 *   POST   /leads/:id/release      — frigi lead (assigned_user_id = NULL)
 *          krever leads.assign
 *
 *   POST   /leads/auto-assign      — auto-tildel u-tildelte leads basert
 *          på territorium-match + roundrobin. Krever leads.assign.
 *
 *   POST   /me/quota               — bruker setter egen kvote (eller
 *          admin/teamleder setter på vegne av andre)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { notifyLeadAssigned } from "./lead-map-notification-service.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import {
  loadOrgTerritories,
  resolveLeadTerritories,
  pickBestTerritory,
  type LeadGeo,
} from "./leadgrid-territory-service.js";

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
    return activeSessions.get(auth.slice(7)) ?? null;
  }
  return null;
}

/** Haversine — km mellom to lat/lng */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function requestedProjectId(req: Request): string | null {
  const value = req.query.project_id ?? req.query.projectId
    ?? req.body?.project_id ?? req.body?.projectId;
  if (typeof value !== "string") return null;
  const projectId = value.trim();
  return projectId && projectId.length <= 255 ? projectId : null;
}

async function authorizeProject(
  pool: Pool,
  res: Response,
  userId: string,
  projectId: string | null,
  permission?: string,
): Promise<LeadgridAccessibleProject | null> {
  if (!projectId) {
    res.status(400).json({ error: "project_id_required" });
    return null;
  }
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  if (permission) {
    const access = await resolveEffectivePermissions(
      pool,
      project.organizationId,
      userId,
    );
    if (!access.permissions.has(permission)) {
      res.status(403).json({ error: "mangler_tillatelse", required: permission });
      return null;
    }
  }
  return project;
}

async function requireOrganizationMembership(
  pool: Pool,
  res: Response,
  organizationId: string,
  userId: string,
): Promise<{ role: string; permissions: Set<string> } | null> {
  const access = await resolveEffectivePermissions(pool, organizationId, userId);
  if (!access.role) {
    res.status(404).json({ error: "organization_not_found" });
    return null;
  }
  return { role: access.role, permissions: access.permissions };
}

export function registerLeadMapWorkloadRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /me/workload ───────────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/me/workload",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const lat = req.query.lat ? Number(req.query.lat) : null;
      const lng = req.query.lng ? Number(req.query.lng) : null;
      try {
        const project = await authorizeProject(
          pool,
          res,
          session.userId,
          requestedProjectId(req),
        );
        if (!project) return;
        const requestedOrgId = typeof req.query.organization_id === "string"
          ? req.query.organization_id.trim()
          : null;
        if (requestedOrgId && requestedOrgId !== project.organizationId) {
          return res.status(404).json({ error: "project_not_found" });
        }
        const r = await pool.query<{
          id: string; name: string; lead_category: string | null;
          lead_status: string;
          address: string | null; city: string | null;
          latitude: number | null; longitude: number | null;
          phone: string | null; email: string | null;
          website_url: string | null; logo_url: string | null;
          ai_opportunity_score: number | null;
          claude_recommendation_rank: number | null;
          claude_recommendation_reason: string | null;
          next_follow_up_at: string | null;
          last_contacted_at: string | null;
          assigned_at: string | null;
        }>(
          `SELECT c.id::text, c.name, c.lead_category, c.lead_status,
                  c.address, c.city, c.latitude, c.longitude,
                  c.phone, c.email, c.website_url,
                  COALESCE(to_jsonb(c) ->> 'logo_url', NULL) AS logo_url,
                  c.ai_opportunity_score,
                  c.claude_recommendation_rank,
                  c.claude_recommendation_reason,
                  c.next_follow_up_at::text,
                  c.last_contacted_at::text,
                  c.assigned_at::text
             FROM crm_customers c
            WHERE c.assigned_user_id = $1
              AND c.organization_id = $2::uuid
              AND c.project_id = $3
              AND c.lead_status NOT IN ('won', 'lost', 'do_not_contact')
            ORDER BY
              -- Prioritet 1: forfalt follow-up
              CASE WHEN c.next_follow_up_at IS NOT NULL
                    AND c.next_follow_up_at < NOW() THEN 0 ELSE 1 END,
              -- Prioritet 2: Claude-rank
              COALESCE(c.claude_recommendation_rank, 9999),
              -- Prioritet 3: AI opportunity
              COALESCE(c.ai_opportunity_score, 0) DESC,
              -- Prioritet 4: sist contact
              c.last_contacted_at ASC NULLS FIRST
            LIMIT 200`,
          [session.userId, project.organizationId, project.id],
        );
        // Beriket med distanse hvis koord. sendt
        const enriched = r.rows.map((row) => {
          let distanceKm: number | null = null;
          if (lat !== null && lng !== null && row.latitude && row.longitude) {
            distanceKm = haversineKm(lat, lng, Number(row.latitude), Number(row.longitude));
          }
          return { ...row, distance_km: distanceKm };
        });
        // Re-sortér på distanse hvis bruker er nær (under 50km) for å
        // gi "kort kjørerute først"-modus
        if (lat !== null && lng !== null) {
          enriched.sort((a, b) => {
            if (a.distance_km === null && b.distance_km === null) return 0;
            if (a.distance_km === null) return 1;
            if (b.distance_km === null) return -1;
            // Boost Claude-rank-1 over avstand
            const aBoost = a.claude_recommendation_rank === 1 ? -1000 : 0;
            const bBoost = b.claude_recommendation_rank === 1 ? -1000 : 0;
            return (a.distance_km + aBoost) - (b.distance_km + bBoost);
          });
        }
        return res.json({
          leads: enriched,
          totalAssigned: enriched.length,
          organizationId: project.organizationId,
          projectId: project.id,
          sortedByDistance: lat !== null && lng !== null,
        });
      } catch (err) {
        return res.status(500).json({ error: "workload_failed", detail: "internal_error" });
      }
    },
  );

  // ─── GET /me/quota ──────────────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/me/quota",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id.trim()
        : "";
      if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
      const ym = yearMonth();
      try {
        if (!(await requireOrganizationMembership(pool, res, orgId, session.userId))) {
          return;
        }
        // Mål: lead_quota_targets > user_profiles.quota_monthly_nok > 0
        const targetRes = await pool.query<{
          target_nok: string | null;
          target_won_deals: number | null;
          target_meetings_booked: number | null;
        }>(
          `SELECT target_nok, target_won_deals, target_meetings_booked
             FROM lead_quota_targets
            WHERE organization_id = $1 AND user_id = $2 AND year_month = $3
            LIMIT 1`,
          [orgId, session.userId, ym],
        );
        const profileRes = await pool.query<{
          quota_monthly_nok: string | null;
          commission_pct: string | null;
        }>(
          `SELECT quota_monthly_nok, commission_pct
             FROM user_profiles
            WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
          [orgId, session.userId],
        );
        const targetNok = Number(
          targetRes.rows[0]?.target_nok
            ?? profileRes.rows[0]?.quota_monthly_nok
            ?? 0,
        );
        const commissionPct = Number(profileRes.rows[0]?.commission_pct ?? 0);

        // Achieved: sum estimated_value for won-leads denne måneden
        const wonRes = await pool.query<{ achieved_nok: string; won_count: number }>(
          `SELECT COALESCE(SUM(estimated_value), 0)::text AS achieved_nok,
                  COUNT(*)::int AS won_count
             FROM crm_customers
           WHERE assigned_user_id = $1
              AND organization_id = $2::uuid
              AND lead_status = 'won'
              AND to_char(updated_at, 'YYYY-MM') = $3`,
          [session.userId, orgId, ym],
        );

        // Meetings booked denne måneden (online_meeting + physical-visits)
        const meetingsRes = await pool.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n
             FROM crm_visits v
             JOIN crm_customers c ON c.id = v.customer_id
            WHERE c.assigned_user_id = $1
              AND c.organization_id = $2::uuid
              AND v.visit_type IN ('online_meeting', 'physical')
              AND to_char(v.visit_datetime, 'YYYY-MM') = $3`,
          [session.userId, orgId, ym],
        );

        const achievedNok = Number(wonRes.rows[0]?.achieved_nok ?? 0);
        const wonCount = wonRes.rows[0]?.won_count ?? 0;
        const meetings = meetingsRes.rows[0]?.n ?? 0;
        const pct = targetNok > 0 ? Math.round((achievedNok / targetNok) * 100) : null;

        // Projection: ekstrapolér ut måneden basert på days_elapsed
        const now = new Date();
        const dayOfMonth = now.getUTCDate();
        const daysInMonth = new Date(
          now.getUTCFullYear(), now.getUTCMonth() + 1, 0,
        ).getUTCDate();
        const projectedNok = dayOfMonth > 0
          ? Math.round((achievedNok / dayOfMonth) * daysInMonth)
          : 0;

        return res.json({
          yearMonth: ym,
          targetNok,
          achievedNok,
          remainingNok: Math.max(0, targetNok - achievedNok),
          progressPct: pct,
          projectedNok,
          wonCount,
          meetingsBooked: meetings,
          commissionEarnedNok: Math.round(achievedNok * commissionPct / 100),
        });
      } catch (err) {
        return res.status(500).json({ error: "quota_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /leads/:id/assign ─────────────────────────────────────
  app.post(
    "/api/admin-room/lead-map/leads/:id/assign",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as { user_id?: string; reason?: string };
      if (!body.user_id) return res.status(400).json({ error: "mangler_user_id" });
      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) return res.status(404).json({ error: "lead_ikke_funnet" });
        const requestedScope = requestedProjectId(req);
        if (requestedScope && requestedScope !== lead.projectId) {
          return res.status(404).json({ error: "lead_ikke_funnet" });
        }
        const requestedOrg = typeof req.body?.organization_id === "string"
          ? req.body.organization_id.trim()
          : null;
        if (requestedOrg && requestedOrg !== lead.organizationId) {
          return res.status(404).json({ error: "lead_ikke_funnet" });
        }
        const callerAccess = await resolveEffectivePermissions(
          pool,
          lead.organizationId,
          session.userId,
        );
        if (!callerAccess.permissions.has("leads.assign")) {
          return res.status(403).json({
            error: "mangler_tillatelse",
            required: "leads.assign",
          });
        }
        const targetProject = await loadAccessibleLeadgridProject(
          pool,
          lead.projectId,
          body.user_id,
        );
        if (
          !targetProject
          || targetProject.organizationId !== lead.organizationId
        ) {
          return res.status(400).json({ error: "mottaker_mangler_prosjekttilgang" });
        }
        const prev = await pool.query<{
          assigned_user_id: string | null;
        }>(
          `SELECT assigned_user_id
             FROM crm_customers
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [lead.id, lead.organizationId, lead.projectId],
        );
        if (prev.rows.length === 0) {
          return res.status(404).json({ error: "lead_ikke_funnet" });
        }
        const fromUserId = prev.rows[0].assigned_user_id;
        const updated = await pool.query(
          `UPDATE crm_customers
              SET assigned_user_id = $4,
                  assigned_at = NOW(),
                  assigned_by_user_id = $5
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [
            lead.id,
            lead.organizationId,
            lead.projectId,
            body.user_id,
            session.userId,
          ],
        );
        if (updated.rowCount !== null && updated.rowCount !== 1) {
          return res.status(409).json({ error: "lead_scope_changed" });
        }
        await pool.query(
          `INSERT INTO lead_assignment_log (
             lead_id, organization_id, from_user_id, to_user_id,
             assigned_by_user_id, reason
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            lead.id, lead.organizationId, fromUserId, body.user_id,
            session.userId, body.reason ?? "manual",
          ],
        );
        // Fire-and-forget varsel — blokkerer ikke svaret hvis SMTP henger
        setImmediate(() => {
          void notifyLeadAssigned(pool, {
            leadId: req.params.id,
            fromUserId,
            toUserId: body.user_id ?? "",
            triggeredByUserId: session.userId,
          });
        });
        return res.json({ ok: true, fromUserId, toUserId: body.user_id });
      } catch (err) {
        return res.status(500).json({ error: "assign_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /leads/:id/release ────────────────────────────────────
  app.post(
    "/api/admin-room/lead-map/leads/:id/release",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) return res.status(404).json({ error: "lead_ikke_funnet" });
        const requestedScope = requestedProjectId(req);
        if (requestedScope && requestedScope !== lead.projectId) {
          return res.status(404).json({ error: "lead_ikke_funnet" });
        }
        const callerAccess = await resolveEffectivePermissions(
          pool,
          lead.organizationId,
          session.userId,
        );
        if (!callerAccess.permissions.has("leads.assign")) {
          return res.status(403).json({
            error: "mangler_tillatelse",
            required: "leads.assign",
          });
        }
        const prev = await pool.query<{ assigned_user_id: string | null }>(
          `SELECT assigned_user_id
             FROM crm_customers
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [lead.id, lead.organizationId, lead.projectId],
        );
        if (prev.rows.length === 0) {
          return res.status(404).json({ error: "lead_ikke_funnet" });
        }
        const updated = await pool.query(
          `UPDATE crm_customers
              SET assigned_user_id = NULL
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [lead.id, lead.organizationId, lead.projectId],
        );
        if (updated.rowCount !== null && updated.rowCount !== 1) {
          return res.status(409).json({ error: "lead_scope_changed" });
        }
        await pool.query(
          `INSERT INTO lead_assignment_log (
             lead_id, organization_id, from_user_id,
             assigned_by_user_id, reason
           ) VALUES ($1, $2, $3, $4, 'release')`,
          [
            lead.id,
            lead.organizationId,
            prev.rows[0].assigned_user_id,
            session.userId,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "release_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /leads/auto-assign ────────────────────────────────────
  // Auto-tildel u-tildelte leads basert på territorium-match + roundrobin
  app.post(
    "/api/admin-room/lead-map/leads/auto-assign",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        organization_id?: string;
        project_id?: string;
        strategy?: "territory" | "round_robin";
        limit?: number;
      };
      const strategy = body.strategy ?? "territory";
      const limit = Math.max(1, Math.min(body.limit ?? 50, 200));
      try {
        const project = await authorizeProject(
          pool,
          res,
          session.userId,
          requestedProjectId(req),
          "leads.assign",
        );
        if (!project) return;
        if (
          body.organization_id
          && body.organization_id.trim() !== project.organizationId
        ) {
          return res.status(404).json({ error: "project_not_found" });
        }
        const orgId = project.organizationId;
        // Hent u-tildelte leads i det autoriserte prosjektet, inkl. geo for
        // autoritativ grid-matching (polygon + kommune/postnummer).
        const leadsRes = await pool.query<{
          id: string; city: string | null; address: string | null;
          latitude: number | null; longitude: number | null;
          postal_code: string | null; municipality_code: string | null;
        }>(
          `SELECT c.id::text, c.city, c.address,
                  c.latitude, c.longitude, c.postal_code, c.municipality_code
             FROM crm_customers c
            WHERE c.assigned_user_id IS NULL
              AND c.organization_id = $1::uuid
              AND c.project_id = $2
              AND c.lead_status NOT IN ('won', 'lost', 'do_not_contact')
            ORDER BY c.created_at DESC
            LIMIT $3`,
          [orgId, project.id, limit],
        );
        // Hent tilgjengelige salgs-konsulenter + territory
        const sellersRes = await pool.query<{
          user_id: string;
          territory: string | null;
          role: string;
        }>(
          `SELECT om.user_id,
                  up.territory,
                  om.role
             FROM organization_members om
             LEFT JOIN user_profiles up
               ON up.user_id = om.user_id
              AND up.organization_id = om.organization_id
            WHERE om.organization_id = $1
              AND om.role IN ('salgskonsulent', 'salgssjef', 'teamleder', 'promotor')
              AND (up.is_active IS NULL OR up.is_active = TRUE)`,
          [orgId],
        );
        if (sellersRes.rows.length === 0) {
          return res.status(400).json({ error: "ingen_tilgjengelige_selgere" });
        }
        const sellerAccess = await Promise.all(
          sellersRes.rows.map(async (seller) => ({
            seller,
            project: await loadAccessibleLeadgridProject(
              pool,
              project.id,
              seller.user_id,
            ),
          })),
        );
        const eligibleSellers = sellerAccess
          .filter((entry) =>
            entry.project?.organizationId === project.organizationId)
          .map((entry) => entry.seller);
        if (eligibleSellers.length === 0) {
          return res.status(400).json({ error: "ingen_selgere_med_prosjekttilgang" });
        }
        // Autoritative grids for org-en (polygon + kommune/postnummer).
        const territories = await loadOrgTerritories(pool, orgId);
        const availableSellers = new Set(eligibleSellers.map((s) => s.user_id));

        const assignments: Array<{ leadId: string; userId: string; matchType: string }> = [];
        let roundRobinIdx = 0;
        for (const lead of leadsRes.rows) {
          let seller: typeof sellersRes.rows[0] | undefined;
          let matchType = "round_robin";
          if (strategy === "territory") {
            // 1) Autoritativ grid: match på polygon ELLER admin-enhet, og
            //    tildel territoriets eier (hvis den er en tilgjengelig selger).
            const leadGeo: LeadGeo = {
              latitude: lead.latitude != null ? Number(lead.latitude) : null,
              longitude: lead.longitude != null ? Number(lead.longitude) : null,
              postalCode: lead.postal_code,
              municipalityCode: lead.municipality_code,
            };
            const matched = resolveLeadTerritories(leadGeo, territories).filter(
              (t) => t.assignedUserId && availableSellers.has(t.assignedUserId),
            );
            const best = pickBestTerritory(matched);
            if (best?.assignedUserId) {
              seller = eligibleSellers.find((s) => s.user_id === best.assignedUserId);
              if (seller) matchType = "auto_territory";
            }
            // 2) Fallback: gammel fritekst-territory-match (bakoverkompat).
            if (!seller && (lead.city || lead.address)) {
              const haystack = `${lead.city ?? ""} ${lead.address ?? ""}`.toLowerCase();
              seller = eligibleSellers.find((s) =>
                s.territory && haystack.includes(s.territory.toLowerCase().split(/[\s,]+/)[0]),
              );
              if (seller) matchType = "auto_territory";
            }
          }
          if (!seller) {
            seller = eligibleSellers[roundRobinIdx % eligibleSellers.length];
            roundRobinIdx += 1;
            matchType = "auto_round_robin";
          }
          const updated = await pool.query(
            `UPDATE crm_customers
                SET assigned_user_id = $4,
                    assigned_at = NOW(),
                    assigned_by_user_id = $5
              WHERE id = $1::uuid
                AND organization_id = $2::uuid
                AND project_id = $3
                AND assigned_user_id IS NULL`,
            [
              lead.id,
              project.organizationId,
              project.id,
              seller.user_id,
              session.userId,
            ],
          );
          if (updated.rowCount !== null && updated.rowCount !== 1) {
            continue;
          }
          await pool.query(
            `INSERT INTO lead_assignment_log (
               lead_id, organization_id, to_user_id,
               assigned_by_user_id, reason
             ) VALUES ($1, $2, $3, $4, $5)`,
            [lead.id, orgId, seller.user_id, session.userId, matchType],
          );
          assignments.push({ leadId: lead.id, userId: seller.user_id, matchType });
        }
        return res.json({
          ok: true,
          assigned: assignments.length,
          assignments,
          projectId: project.id,
        });
      } catch (err) {
        return res.status(500).json({ error: "auto_assign_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /me/quota ─────────────────────────────────────────────
  // Bruker setter egen kvote, eller admin/salgssjef/teamleder setter på vegne
  app.post(
    "/api/admin-room/lead-map/me/quota",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        organization_id?: string;
        target_user_id?: string;
        target_nok?: number;
        target_won_deals?: number;
        target_meetings_booked?: number;
        year_month?: string;
      };
      if (!body.organization_id) {
        return res.status(400).json({ error: "mangler_organization_id" });
      }
      const organizationId = body.organization_id.trim();
      if (!organizationId) {
        return res.status(400).json({ error: "mangler_organization_id" });
      }
      const targetUserId = body.target_user_id ?? session.userId;
      const ym = body.year_month ?? yearMonth();
      try {
        const callerAccess = await requireOrganizationMembership(
          pool,
          res,
          organizationId,
          session.userId,
        );
        if (!callerAccess) return;
        if (
          targetUserId !== session.userId
          && !["admin", "salgssjef", "teamleder"].includes(callerAccess.role)
        ) {
          return res.status(403).json({ error: "ikke_tillatt_for_andre" });
        }
        const targetMembership = await pool.query(
          `SELECT 1
             FROM organization_members
            WHERE organization_id = $1::uuid
              AND user_id = $2
            LIMIT 1`,
          [organizationId, targetUserId],
        );
        if (!targetMembership.rowCount) {
          return res.status(400).json({ error: "maalbruker_ikke_medlem" });
        }
        await pool.query(
          `INSERT INTO lead_quota_targets (
             organization_id, user_id, year_month,
             target_nok, target_won_deals, target_meetings_booked,
             set_by_user_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (organization_id, user_id, year_month) DO UPDATE SET
             target_nok = EXCLUDED.target_nok,
             target_won_deals = EXCLUDED.target_won_deals,
             target_meetings_booked = EXCLUDED.target_meetings_booked,
             updated_at = NOW()`,
          [
            organizationId, targetUserId, ym,
            body.target_nok ?? 0,
            body.target_won_deals ?? null,
            body.target_meetings_booked ?? null,
            session.userId,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "quota_save_failed", detail: "internal_error" });
      }
    },
  );
}
