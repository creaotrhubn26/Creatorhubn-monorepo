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

export function registerLeadMapProjectRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /admin-room/lead-map/projects ──
  // Liste prosjekter som brukeren har leads, brand-kit, eller scan på.
  // Returnerer projects som har AKTIVITET i Lead Map-kontekst.
  app.get(
    "/api/admin-room/lead-map/projects",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{
          id: string;
          name: string;
          description: string | null;
          status: string | null;
          has_brand_kit: boolean;
          lead_count: number;
          competitor_count: number;
        }>(
          `SELECT p.id::text,
                  p.name,
                  p.description,
                  p.status,
                  EXISTS (
                    SELECT 1 FROM brand_kits bk WHERE bk.project_id = p.id
                  ) AS has_brand_kit,
                  COALESCE((
                    SELECT COUNT(*)::int FROM crm_customers c
                     WHERE c.project_id = p.id AND c.owner_user_id = $1
                  ), 0) AS lead_count,
                  COALESCE((
                    SELECT COUNT(*)::int FROM market_scan_competitors mc
                      LEFT JOIN market_scans ms ON ms.id = mc.market_scan_id
                     WHERE (mc.project_id = p.id OR ms.project_id = p.id)
                  ), 0) AS competitor_count
             FROM casting_projects p
            WHERE p.created_by = $1
               OR EXISTS (
                 SELECT 1 FROM brand_kits bk
                  WHERE bk.project_id = p.id
                    AND bk.workspace_owner_user_id = $1
               )
               OR EXISTS (
                 SELECT 1 FROM crm_customers c
                  WHERE c.project_id = p.id AND c.owner_user_id = $1
               )
            ORDER BY p.created_at DESC
            LIMIT 50`,
          [session.userId],
        );
        return res.json({
          projects: r.rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            status: row.status,
            hasBrandKit: row.has_brand_kit,
            leadCount: row.lead_count,
            competitorCount: row.competitor_count,
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "projects_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /admin-room/lead-map/projects/:id/summary ──
  // Full kontekst for ÉT prosjekt: bedriftens brand + posisjonering +
  // tone + målgruppe + siste market-scan-summary + lead-counts.
  app.get(
    "/api/admin-room/lead-map/projects/:id/summary",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      try {
        // Prosjekt-info
        const pr = await pool.query<{
          id: string; name: string; description: string | null;
          project_type: string | null; genre: string | null; status: string;
        }>(
          `SELECT id::text, name, description, project_type, genre, status
             FROM casting_projects WHERE id = $1 LIMIT 1`,
          [projectId],
        );
        if (pr.rows.length === 0) return res.status(404).json({ error: "project_not_found" });
        const project = pr.rows[0];

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
              AND workspace_owner_user_id = $2
            ORDER BY created_at DESC LIMIT 1`,
          [projectId, session.userId],
        );

        // Lead counts grupert på status
        const counts = await pool.query<{ lead_status: string; n: number }>(
          `SELECT lead_status, COUNT(*)::int AS n
             FROM crm_customers
            WHERE project_id = $1 AND owner_user_id = $2
            GROUP BY lead_status`,
          [projectId, session.userId],
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
            name: project.name,
            description: project.description,
            projectType: project.project_type,
            genre: project.genre,
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
        return res.status(500).json({ error: "summary_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /admin-room/lead-map/leads/:id/project ──
  // Tilordne / fjerne prosjekt på en lead. Inkluderer scope-sjekk.
  app.patch(
    "/api/admin-room/lead-map/leads/:id/project",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as { projectId?: string | null };
      try {
        const r = await pool.query(
          `UPDATE crm_customers
              SET project_id = $3
            WHERE id = $1 AND owner_user_id = $2
          RETURNING id::text, project_id`,
          [req.params.id, session.userId, body.projectId ?? null],
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "lead_not_found" });
        return res.json({ ok: true, projectId: r.rows[0].project_id });
      } catch (err) {
        return res.status(500).json({ error: "assign_failed", detail: String(err) });
      }
    },
  );
}
