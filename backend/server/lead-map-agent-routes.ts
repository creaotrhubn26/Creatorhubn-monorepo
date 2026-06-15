/**
 * lead-map-agent-routes.ts
 *
 * Bro mellom Lead Map (CRM-leads) og Role Room Agent (Brand Kit +
 * Market Scan + Outreach). Hver lead på kartet kan nå hente og kjøre
 * full Agent-analyse direkte fra detail-panelet.
 *
 * Endepunkter:
 *   GET  /api/admin-room/lead-map/leads/:id/agent-context
 *        → { lead, brandKit?, marketScan?, counts: {...} }
 *        Slår opp eksisterende analyser via soft-kobling:
 *          brand_kits.project_id = `lead-${leadId}`
 *          market_scans.name LIKE '%lead.name%' AND workspace_owner = scope
 *
 *   POST /api/admin-room/lead-map/leads/:id/run-agent-scan
 *        → kjør Brand Kit-scan (krever lead.websiteUrl) og opprett ny
 *          Market Scan på lead.name + lead.city. Returnerer ID-er.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getBrandKit, runBrandScan } from "./brand-kit-service.js";
import {
  createMarketScan,
  getMarketScan,
  getScanCompetitors,
  getScanFunnelStages,
  getScanTechniques,
  getScanTechStack,
  getScanOpportunities,
} from "./market-intelligence/market-scan-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const s = activeSessions.get(token);
    if (s) return s;
  }
  return null;
}

export function registerLeadMapAgentRoutes({ app, pool, activeSessions }: Deps): void {
  // GET /agent-context — hent eksisterende Agent-analyse for én lead
  app.get(
    "/api/admin-room/lead-map/leads/:id/agent-context",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const leadId = req.params.id;
      try {
        // 1. Hent lead m/ scope-sjekk
        const leadRes = await pool.query<{
          id: string; name: string; city: string | null;
          website_url: string | null;
        }>(
          `SELECT id::text, name, city, website_url
             FROM crm_customers
            WHERE id = $1 AND owner_user_id = $2
            LIMIT 1`,
          [leadId, session.userId],
        );
        if (leadRes.rows.length === 0) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        const lead = leadRes.rows[0];

        // 2. Brand Kit via project_id = `lead-${leadId}` (soft kobling)
        const projectId = `lead-${lead.id}`;
        const brandKit = await getBrandKit(pool, projectId);

        // 3. Market Scan via fuzzy name match (case-insensitive)
        const scanRes = await pool.query<{ id: string }>(
          `SELECT id::text
             FROM market_scans
            WHERE workspace_owner_user_id = $1
              AND name ILIKE $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [session.userId, `%${lead.name}%`],
        );

        let marketScan = null;
        let counts = { competitors: 0, funnels: 0, techniques: 0, techStack: 0, opportunities: 0 };
        if (scanRes.rows.length > 0) {
          const scanId = scanRes.rows[0].id;
          marketScan = await getMarketScan(pool, scanId);
          const [comp, fun, tech, stack, opp] = await Promise.all([
            getScanCompetitors(pool, scanId),
            getScanFunnelStages(pool, scanId),
            getScanTechniques(pool, scanId),
            getScanTechStack(pool, scanId),
            getScanOpportunities(pool, scanId),
          ]);
          counts = {
            competitors: comp.length,
            funnels: fun.length,
            techniques: tech.length,
            techStack: stack.length,
            opportunities: opp.length,
          };
        }

        return res.json({
          lead: { id: lead.id, name: lead.name, city: lead.city, websiteUrl: lead.website_url },
          brandKit: brandKit
            ? {
                id: brandKit.id,
                sourceUrl: brandKit.sourceUrl,
                hasProfile: !!brandKit.brandProfile && Object.keys(brandKit.brandProfile).length > 0,
                lastScannedAt: brandKit.lastScannedAt,
                summary: brandKit.brandProfile?.positioning_summary ?? null,
                tone: brandKit.brandProfile?.tone ?? null,
                palette: brandKit.brandProfile?.color_palette ?? null,
              }
            : null,
          marketScan: marketScan
            ? {
                id: marketScan.id,
                name: marketScan.name,
                status: marketScan.status,
                confidence: marketScan.confidenceSummary,
                lastRunAt: marketScan.lastRunAt,
                marketQuery: marketScan.marketQuery,
              }
            : null,
          counts,
        });
      } catch (err) {
        console.error("[lead-map-agent] context failed", err);
        return res.status(500).json({ error: "context_failed", detail: String(err) });
      }
    },
  );

  // POST /run-agent-scan — trigger Brand Kit + Market Scan på leadens info
  app.post(
    "/api/admin-room/lead-map/leads/:id/run-agent-scan",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const leadId = req.params.id;
      try {
        const leadRes = await pool.query<{
          id: string; name: string; city: string | null; country: string | null;
          website_url: string | null; category: string | null;
        }>(
          `SELECT id::text, name, city, country, website_url, category
             FROM crm_customers
            WHERE id = $1 AND owner_user_id = $2
            LIMIT 1`,
          [leadId, session.userId],
        );
        if (leadRes.rows.length === 0) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        const lead = leadRes.rows[0];

        const projectId = `lead-${lead.id}`;
        let brandKitId: string | null = null;

        // 1. Brand Kit — krever website
        if (lead.website_url) {
          try {
            const bk = await runBrandScan(pool, {
              projectId,
              workspaceOwnerUserId: session.userId,
              url: lead.website_url,
            });
            brandKitId = bk.id;
          } catch (e) {
            console.warn("[lead-map-agent] brand scan failed", e);
          }
        }

        // 2. Market Scan — alltid mulig (Claude jobber på navn+region selv uten URL)
        const region = [lead.city, lead.country].filter(Boolean).join(", ") || undefined;
        const scan = await createMarketScan(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: null,
          brandKitId,
          name: lead.name,
          marketQuery: `Konkurrenter og markedslandskap for ${lead.name}${
            lead.category ? ` (${lead.category})` : ""
          }`,
          region: region ?? null,
          industry: lead.category ?? null,
          targetAudience: null,
          goal: "Lead Map auto-scan — konkurrenter, posisjonering, opportunities",
        });

        return res.json({
          ok: true,
          brandKitId,
          marketScanId: scan.id,
          message:
            "Agent-scan startet. Kjør deretter `/api/market-scans/{id}/run` for å fullføre Claude-analyse.",
        });
      } catch (err) {
        console.error("[lead-map-agent] run failed", err);
        return res.status(500).json({ error: "run_failed", detail: String(err) });
      }
    },
  );
}
