/**
 * geo-visibility-routes.ts
 *
 * HTTP-API for GEO Visibility (docs/integration-audit/08). Samme
 * admin-guard-mønster som market-scan-routes (MI-admin-flaten).
 *
 *   POST   /api/geo-visibility/prompt-sets
 *          body: { industry, targetBrand, region?, targetDomain?,
 *                  competitorBrands?, projectId?, name?, count? }
 *          → { promptSet, prompts }  (status 'draft')
 *
 *   GET    /api/geo-visibility/prompt-sets           → { promptSets }
 *   GET    /api/geo-visibility/prompt-sets/:id       → { promptSet, prompts }
 *   POST   /api/geo-visibility/prompt-sets/:id/approve
 *   PATCH  /api/geo-visibility/prompt-sets/:id/prompts/:promptId
 *          body: { enabled }
 *   POST   /api/geo-visibility/prompt-sets/:id/run   (fire-and-forget)
 *   GET    /api/geo-visibility/prompt-sets/:id/report → GeoVisibilityReport
 *
 *   POST   /api/geo-visibility/cron/run-approved
 *          Header: x-cron-token — kjører alle approved sett (ukentlig
 *          GitHub Actions-cron, samme token-mønster som øvrige cron-ruter).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  approvePromptSet,
  generatePromptSet,
  getPromptSet,
  listPromptSets,
  setPromptEnabled,
} from "./geo-prompt-set-service.js";
import { computeReport, runProbe } from "./geo-probe-runner-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7).trim()) ?? null;
  }
  return null;
}

export function registerGeoVisibilityRoutes({
  app, pool, activeSessions, isAdminEmail,
}: Deps): void {
  function requireAdmin(req: Request, res: Response): SessionData | null {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "ikke_innlogget" });
      return null;
    }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    return session;
  }

  app.post("/api/geo-visibility/prompt-sets", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.industry !== "string" || b.industry.trim().length < 2) {
      return res.status(400).json({ error: "industry_pakrevd" });
    }
    if (typeof b.targetBrand !== "string" || b.targetBrand.trim().length < 2) {
      return res.status(400).json({ error: "targetBrand_pakrevd" });
    }
    try {
      const result = await generatePromptSet(pool, {
        workspaceOwnerUserId: session.userId,
        projectId: typeof b.projectId === "string" ? b.projectId : null,
        name: typeof b.name === "string" ? b.name : undefined,
        industry: b.industry.trim().slice(0, 120),
        region: typeof b.region === "string" ? b.region.slice(0, 80) : undefined,
        targetBrand: b.targetBrand.trim().slice(0, 120),
        targetDomain: typeof b.targetDomain === "string" ? b.targetDomain.slice(0, 200) : null,
        competitorBrands: Array.isArray(b.competitorBrands)
          ? b.competitorBrands.filter((c): c is string => typeof c === "string").slice(0, 15)
          : [],
        count: typeof b.count === "number" ? b.count : undefined,
      });
      return res.status(201).json(result);
    } catch (err) {
      console.error("[geo-visibility] generate failed", err);
      return res.status(500).json({ error: "generate_failed", detail: "internal_error" });
    }
  });

  app.get("/api/geo-visibility/prompt-sets", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const promptSets = await listPromptSets(pool, session.userId);
      return res.json({ promptSets });
    } catch {
      return res.status(500).json({ error: "list_failed" });
    }
  });

  app.get("/api/geo-visibility/prompt-sets/:id", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const result = await getPromptSet(pool, req.params.id, session.userId);
      if (!result) return res.status(404).json({ error: "not_found" });
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "fetch_failed" });
    }
  });

  app.post("/api/geo-visibility/prompt-sets/:id/approve", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const ok = await approvePromptSet(pool, req.params.id, session.userId);
      if (!ok) return res.status(409).json({ error: "not_draft_or_not_found" });
      return res.json({ approved: true });
    } catch {
      return res.status(500).json({ error: "approve_failed" });
    }
  });

  app.patch(
    "/api/geo-visibility/prompt-sets/:id/prompts/:promptId",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const enabled = (req.body as Record<string, unknown> | undefined)?.enabled;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled_pakrevd" });
      }
      try {
        const ok = await setPromptEnabled(
          pool, req.params.id, req.params.promptId, session.userId, enabled,
        );
        if (!ok) return res.status(404).json({ error: "not_found" });
        return res.json({ updated: true });
      } catch {
        return res.status(500).json({ error: "update_failed" });
      }
    },
  );

  app.post("/api/geo-visibility/prompt-sets/:id/run", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    // Fire-and-forget — panelet poller report-endepunktet
    void runProbe(pool, req.params.id, session.userId).catch((err) => {
      console.error("[geo-visibility] probe run failed", err);
    });
    return res.status(202).json({ started: true });
  });

  app.get("/api/geo-visibility/prompt-sets/:id/report", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const report = await computeReport(pool, req.params.id, session.userId);
      if (!report) return res.status(404).json({ error: "not_found" });
      return res.json({ report });
    } catch (err) {
      console.error("[geo-visibility] report failed", err);
      return res.status(500).json({ error: "report_failed" });
    }
  });

  // ── Ukentlig cron (GitHub Actions) ────────────────────────────────
  app.post("/api/geo-visibility/cron/run-approved", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.GEO_VISIBILITY_CRON_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const sets = await pool.query<{ id: string; workspace_owner_user_id: string }>(
        `SELECT id::text, workspace_owner_user_id
           FROM geo_prompt_sets WHERE status = 'approved'
          ORDER BY updated_at ASC LIMIT 20`,
      );
      // Fire-and-forget, men sekvensielt internt — LLM-kall er
      // kostnads-/rate-sensitive, så settene kjøres ett om gangen.
      const started = sets.rows.map((s) => s.id);
      void (async () => {
        for (const s of sets.rows) {
          try {
            await runProbe(pool, s.id, s.workspace_owner_user_id);
          } catch (err) {
            console.error(`[geo-visibility] cron run failed for ${s.id}`, err);
          }
        }
      })();
      return res.json({ started });
    } catch (err) {
      console.error("[geo-visibility] cron failed", err);
      return res.status(500).json({ error: "cron_failed" });
    }
  });
}
