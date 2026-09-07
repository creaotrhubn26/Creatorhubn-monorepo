/**
 * lead-map-project-routes.ts
 *
 * Prosjekt-konteksten for Lead Map. Lar brukeren velge hvilket
 * prosjekt (bedrift) hen jobber for, og henter sammendrag av
 * brand-kit + market scan + lead-counts for det aktive prosjektet.
 *
 * Visjon: Lead Map er målrettet søk etter kunder for ÉN bedrift om
 * gangen — Holy Crust → finn restauranter som trenger pizzaleveranse.
 * MedInnova → finn klinikker. Wave LM-Agent → finn byråer.
 *
 * Filter-strategi: alle eksisterende Lead Map-endepunkter respekterer
 * `?projectId=` query-param (eller body) når aktivt prosjekt er satt.
 * Vises i frontend som ProjectSelector + ProjectCard.
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestedOrganizationId(req: Request): string | null {
  const value =
    req.body?.organization_id ??
    req.body?.organizationId ??
    req.query?.organization_id ??
    req.query?.organizationId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveActiveOrganization(
  req: Request,
  res: Response,
  pool: Pick<Pool, "query">,
  userId: string,
): Promise<string | null> {
  const requested = requestedOrganizationId(req);
  if (requested && !UUID_RE.test(requested)) {
    res.status(400).json({
      error: "invalid_organization_id",
      message: "organization_id må være en gyldig UUID.",
    });
    return null;
  }

  const memberships = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM organization_members
      WHERE user_id = $1
        AND ($2::uuid IS NULL OR organization_id = $2::uuid)
      ORDER BY CASE WHEN role IN ('owner', 'admin') THEN 0 ELSE 1 END,
               joined_at ASC,
               organization_id ASC
      LIMIT 2`,
    [userId, requested],
  );
  if (memberships.rows.length === 0) {
    res.status(403).json({
      error: "ikke_medlem_av_org",
      ...(requested ? { organization_id: requested } : {}),
    });
    return null;
  }
  if (!requested && memberships.rows.length > 1) {
    res.status(400).json({
      error: "organization_id_required",
      message: "Velg hvilken organisasjon prosjektet tilhører.",
    });
    return null;
  }
  return memberships.rows[0].organization_id;
}

export function registerLeadMapProjectRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── POST /admin-room/lead-map/projects ──
  // Leadgrid-uavhengighet (Daniel 2026-08-05): prosjekter kunne før KUN
  // opprettes i The Role Room — Leadgrid oppretter nå sine egne. Fra og
  // med Fase 1 (0449_leadgrid_projects.sql) lever Leadgrid-prosjektene i
  // sin egen tabell leadgrid_projects — isolert fra Role Room-casting.
  // project_type 'b2b_sales' markerer dem som Leadgrid-prosjekter.
  app.post(
    "/api/admin-room/lead-map/projects",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const b = (req.body ?? {}) as Record<string, unknown>;
      const name = String(b.name ?? "").trim().slice(0, 200);
      if (name.length < 2) {
        return res.status(400).json({ error: "bad_request", message: "Prosjektnavn kreves" });
      }
      const description = typeof b.description === "string"
        ? b.description.slice(0, 1000) : null;

      let client: PoolClient | null = null;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        const orgId = await resolveActiveOrganization(
          req,
          res,
          client,
          session.userId,
        );
        if (!orgId) {
          await client.query("ROLLBACK");
          return;
        }
        const projectId = `leadgrid-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        await client.query(
          `INSERT INTO leadgrid_projects
             (id, organization_id, name, description, status, project_type,
              created_at, created_by, metadata)
           VALUES ($1, $2, $3, $4, 'active', 'b2b_sales', now(), $5, $6::jsonb)`,
          [projectId, orgId, name, description, session.userId,
           JSON.stringify({ leadgrid_source: "manuell" })]);
        await client.query(
          `INSERT INTO leadgrid_project_members
             (organization_id, project_id, user_id, role, invited_by, invited_at)
           VALUES ($1::uuid, $2, $3, 'owner', $3, NOW())
           ON CONFLICT (organization_id, project_id, user_id) DO UPDATE
             SET role = 'owner'`,
          [orgId, projectId, session.userId],
        );
        await client.query("COMMIT");
        return res.json({
          project: {
            id: projectId, organizationId: orgId, name, description, status: "active",
            hasBrandKit: false, leadCount: 0, competitorCount: 0,
          },
        });
      } catch (err) {
        if (client) await client.query("ROLLBACK").catch(() => undefined);
        console.error("[lead-map] project create failed:", err);
        return res.status(500).json({ error: "project_create_failed" });
      } finally {
        client?.release();
      }
    },
  );

  // ─── GET /admin-room/lead-map/projects ──
  // Liste prosjekter som brukeren har leads, brand-kit, eller scan på.
  // Returnerer projects som har AKTIVITET i Lead Map-kontekst.
  app.get(
    "/api/admin-room/lead-map/projects",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const orgId = requestedOrganizationId(req);
        if (orgId && !UUID_RE.test(orgId)) {
          return res.status(400).json({
            error: "invalid_organization_id",
            message: "organization_id må være en gyldig UUID.",
          });
        }
        const r = await pool.query<{
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          status: string | null;
          has_brand_kit: boolean;
          lead_count: number;
          competitor_count: number;
        }>(
          `SELECT p.id::text,
                  p.organization_id::text,
                  p.name,
                  p.description,
                  p.status,
                  EXISTS (
                    SELECT 1 FROM brand_kits bk WHERE bk.project_id = p.id
                  ) AS has_brand_kit,
                  COALESCE((
                    SELECT COUNT(*)::int FROM crm_customers c
                     WHERE c.project_id = p.id
                       AND c.organization_id = p.organization_id
                  ), 0) AS lead_count,
                  COALESCE((
                    SELECT COUNT(*)::int FROM market_scan_competitors mc
                      LEFT JOIN market_scans ms ON ms.id = mc.market_scan_id
                     WHERE (mc.project_id = p.id OR ms.project_id = p.id)
                  ), 0) AS competitor_count
             FROM leadgrid_projects p
             LEFT JOIN organization_members om
               ON om.organization_id = p.organization_id
              AND om.user_id = $1
             LEFT JOIN leadgrid_project_members pm
               ON pm.organization_id = p.organization_id
              AND pm.project_id = p.id
              AND pm.user_id = $1
            WHERE (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
              AND p.organization_id IS NOT NULL
              -- Leadgrid (Lead Map) viser kun B2B/lead-orienterte prosjekttyper.
              -- film/casting-prosjekter (TROLL, feature_film, documentary)
              -- hører hjemme i The Role Room og skjules her.
              AND (p.project_type IS NULL OR p.project_type NOT IN (
                'feature_film', 'documentary', 'film', 'short_film',
                'tv_series', 'commercial', 'music_video', 'casting'
              ))
              AND ($2::uuid IS NULL OR p.organization_id = $2::uuid)
              AND (
                p.created_by = $1
                OR pm.user_id IS NOT NULL
                OR (
                  om.user_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                      FROM leadgrid_user_permission_overrides denied
                     WHERE denied.organization_id = p.organization_id
                       AND denied.user_id = $1
                       AND denied.permission_key = 'projects.view_all'
                       AND denied.effect = 'revoke'
                  )
                  AND (
                    om.role = 'admin'
                    OR EXISTS (
                          SELECT 1 FROM role_permissions defaults
                           WHERE defaults.role = om.role
                             AND defaults.permission_key = 'projects.view_all'
                    )
                        OR EXISTS (
                          SELECT 1 FROM leadgrid_user_permission_overrides granted
                           WHERE granted.organization_id = p.organization_id
                             AND granted.user_id = $1
                             AND granted.permission_key = 'projects.view_all'
                             AND granted.effect = 'grant'
                        )
                  )
                )
              )
            ORDER BY p.created_at DESC
            LIMIT 50`,
          [session.userId, orgId],
        );
        return res.json({
          projects: r.rows.map((row) => ({
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            description: row.description,
            status: row.status,
            hasBrandKit: row.has_brand_kit,
            leadCount: row.lead_count,
            competitorCount: row.competitor_count,
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "projects_failed", detail: "internal_error" });
      }
    },
  );

  // ─── GET /admin-room/lead-map/projects/:id/summary ──
  // Full kontekst for ÉT prosjekt: bedriftens brand + posisjonering +
  // tone + målgruppe + siste market-scan-summary + lead-counts.
  app.get(
    "/api/admin-room/lead-map/projects/:id/summary",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      try {
        const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
        if (!project) return res.status(404).json({ error: "project_not_found" });

        // Brand Kit
        const bk = await pool.query<{
          id: string;
          source_url: string | null;
          brand_profile: Record<string, unknown> | null;
          last_scanned_at: string | null;
        }>(
          `SELECT id::text, source_url, brand_profile, last_scanned_at::text
             FROM brand_kits
            WHERE project_id = $1
            LIMIT 1`,
          [projectId],
        );

        // Siste Market Scan
        const ms = await pool.query<{
          id: string; name: string; market_query: string;
          status: string; confidence_summary: string;
          completed_at: string | null;
        }>(
          `SELECT id::text, name, market_query, status, confidence_summary,
                  completed_at::text
             FROM market_scans
            WHERE project_id = $1
              AND organization_id = $2::uuid
            ORDER BY created_at DESC LIMIT 1`,
          [projectId, project.organizationId],
        );

        // Lead counts grupert på status
        const counts = await pool.query<{ lead_status: string; n: number }>(
          `SELECT lead_status, COUNT(*)::int AS n
             FROM crm_customers
            WHERE project_id = $1 AND organization_id = $2::uuid
            GROUP BY lead_status`,
          [projectId, project.organizationId],
        );
        const statusCounts: Record<string, number> = {};
        let totalLeads = 0;
        for (const row of counts.rows) {
          statusCounts[row.lead_status] = row.n;
          totalLeads += row.n;
        }

        // Konkurrent-count
        const compCount = await pool.query<{ n: number }>(
          `SELECT COUNT(DISTINCT mc.id)::int AS n
             FROM market_scan_competitors mc
             LEFT JOIN market_scans ms ON ms.id = mc.market_scan_id
            WHERE (mc.project_id = $1 OR ms.project_id = $1)`,
          [projectId],
        );

        // Pakk ut brand-kit-felter til toppnivå for UI
        const bp = bk.rows[0]?.brand_profile ?? {};
        return res.json({
          project: {
            id: project.id,
            organizationId: project.organizationId,
            name: project.name,
            description: project.description,
            projectType: project.projectType ?? null,
            status: project.status,
          },
          brandKit: bk.rows[0]
            ? {
                id: bk.rows[0].id,
                sourceUrl: bk.rows[0].source_url,
                lastScannedAt: bk.rows[0].last_scanned_at,
                positioningSummary: (bp as Record<string, unknown>).positioning_summary ?? null,
                tone: (bp as Record<string, unknown>).tone ?? null,
                targetAudience: (bp as Record<string, unknown>).target_audience ?? null,
                valueProposition: (bp as Record<string, unknown>).value_proposition ?? null,
                // Logo: eksplisitt logoUrl fra brand_profile, ellers
                // Google favicon-tjeneste basert på source_url-domene.
                logoUrl: (() => {
                  const explicit = (bp as Record<string, unknown>).logoUrl
                    ?? (bp as Record<string, unknown>).logo_url;
                  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
                  if (bk.rows[0].source_url) {
                    try {
                      const host = new URL(bk.rows[0].source_url).host;
                      return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
                    } catch { /* noop */ }
                  }
                  return null;
                })(),
              }
            : null,
          marketScan: ms.rows[0]
            ? {
                id: ms.rows[0].id,
                name: ms.rows[0].name,
                marketQuery: ms.rows[0].market_query,
                status: ms.rows[0].status,
                confidence: ms.rows[0].confidence_summary,
                completedAt: ms.rows[0].completed_at,
              }
            : null,
          leads: {
            total: totalLeads,
            statusCounts,
          },
          competitorCount: compCount.rows[0]?.n ?? 0,
        });
      } catch (err) {
        return res.status(500).json({ error: "summary_failed", detail: "internal_error" });
      }
    },
  );

  // ─── PATCH /admin-room/lead-map/leads/:id/project ──
  // Flytt en lead mellom tilgjengelige kundeprosjekter. En lead uten prosjekt
  // blir utilgjengelig for den sentrale Leadgrid-ACL-en og er derfor ikke en
  // gyldig applikasjonstilstand.
  app.patch(
    "/api/admin-room/lead-map/leads/:id/project",
    requireLeadMapPermission("leads.update", {
      pool,
      activeSessions,
      // Authorize against the lead's persisted org, never a client-supplied target.
      resolveOrgId: async (req, db) => {
        const leadId = req.params.id?.trim();
        if (!leadId || !UUID_RE.test(leadId)) return null;
        const result = await db.query<{ organization_id: string | null }>(
          `SELECT organization_id::text
             FROM crm_customers
            WHERE id = $1::uuid
            LIMIT 1`,
          [leadId],
        );
        return result.rows[0]?.organization_id ?? null;
      },
    }),
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as { projectId?: unknown };
      if (
        typeof body.projectId !== "string"
        || body.projectId.trim().length === 0
        || body.projectId.trim().length > 255
      ) {
        return res.status(400).json({ error: "invalid_project_id" });
      }
      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) return res.status(404).json({ error: "lead_not_found" });

        const requestedProjectId = body.projectId.trim();
        const target = await loadAccessibleLeadgridProject(
          pool,
          requestedProjectId,
          session.userId,
        );
        if (!target || target.organizationId !== lead.organizationId) {
          return res.status(404).json({ error: "project_not_found" });
        }
        const targetProjectId = target.id;

        const r = await pool.query(
          `UPDATE crm_customers c
              SET project_id = $4
            WHERE c.id = $1::uuid
              AND c.organization_id = $2::uuid
              AND c.project_id = $3
          RETURNING id::text, project_id`,
          [lead.id, lead.organizationId, lead.projectId, targetProjectId],
        );
        if (r.rowCount === 0) {
          return res.status(409).json({ error: "lead_project_changed" });
        }
        return res.json({ ok: true, projectId: r.rows[0].project_id });
      } catch (err) {
        return res.status(500).json({ error: "assign_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /admin-room/lead-map/leads/bulk-assign-project ──
  // Bulk-tildel flere leads til samme prosjekt. Body:
  //   { leadIds: string[], projectId: string }
  app.post(
    "/api/admin-room/lead-map/leads/bulk-assign-project",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as { leadIds?: unknown; projectId?: unknown };
      if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
        return res.status(400).json({ error: "leadIds_array_kreves" });
      }
      const leadIds = [...new Set(body.leadIds.map((id) =>
        typeof id === "string" ? id.trim() : "",
      ))];
      if (leadIds.length > 500) {
        return res.status(400).json({ error: "max_500_per_bulk" });
      }
      if (leadIds.some((id) => !UUID_RE.test(id))) {
        return res.status(400).json({ error: "ugyldig_lead_id" });
      }
      if (
        typeof body.projectId !== "string"
        || body.projectId.trim().length === 0
        || body.projectId.trim().length > 255
      ) {
        return res.status(400).json({ error: "invalid_project_id" });
      }
      const organizationId = requestedOrganizationId(req);
      if (!organizationId || !UUID_RE.test(organizationId)) {
        return res.status(400).json({
          error: "organization_id_required",
          message: "Velg organisasjonen leadene tilhører.",
        });
      }
      try {
        const target = await loadAccessibleLeadgridProject(
          pool,
          body.projectId.trim(),
          session.userId,
        );
        if (!target || target.organizationId !== organizationId) {
          return res.status(404).json({ error: "project_not_found" });
        }
        const targetProjectId = target.id;

        const source = await pool.query<{ id: string; project_id: string }>(
          `SELECT id::text, project_id::text
             FROM crm_customers
            WHERE organization_id = $1::uuid
              AND id = ANY($2::uuid[])
              AND project_id IS NOT NULL`,
          [organizationId, leadIds],
        );
        if (source.rows.length !== leadIds.length) {
          return res.status(404).json({ error: "lead_not_found" });
        }

        const sourceProjectIds = [...new Set(source.rows.map((row) => row.project_id))];
        const sourceProjects = await Promise.all(sourceProjectIds.map((projectId) =>
          loadAccessibleLeadgridProject(pool, projectId, session.userId),
        ));
        if (sourceProjects.some((project) =>
          !project || project.organizationId !== organizationId
        )) {
          return res.status(404).json({ error: "lead_not_found" });
        }

        const expected = source.rows.map((row) => ({
          id: row.id,
          projectId: row.project_id,
        }));
        const result = await pool.query<{ updated: number }>(
          `WITH expected AS (
             SELECT (entry->>'id')::uuid AS id,
                    entry->>'projectId' AS project_id
               FROM jsonb_array_elements($3::jsonb) entry
           ), eligible AS (
             SELECT c.id
               FROM crm_customers c
               JOIN expected e ON e.id = c.id AND e.project_id = c.project_id
              WHERE c.organization_id = $1::uuid
           ), updated AS (
             UPDATE crm_customers c
                SET project_id = $2
              WHERE c.organization_id = $1::uuid
                AND c.id IN (SELECT id FROM eligible)
                AND (SELECT COUNT(*) FROM eligible) =
                    (SELECT COUNT(*) FROM expected)
             RETURNING c.id
           )
           SELECT COUNT(*)::int AS updated FROM updated`,
          [organizationId, targetProjectId, JSON.stringify(expected)],
        );
        const updated = result.rows[0]?.updated ?? 0;
        if (updated !== leadIds.length) {
          return res.status(409).json({ error: "lead_project_changed" });
        }
        return res.json({ ok: true, updated });
      } catch (err) {
        return res.status(500).json({ error: "bulk_assign_failed", detail: "internal_error" });
      }
    },
  );
}
