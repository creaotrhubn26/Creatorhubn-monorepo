/**
 * ai-usage-routes.ts — per-org AI-forbruk (integrasjonsanalysen steg 9)
 *
 *   GET /api/integrations/ai-usage?days=30
 *       Admin, org-scopet. Summert per (leverandør, operasjon) + totaler.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getAiUsageSummary } from "./ai-usage.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7).trim()) ?? null;
  return null;
}

export function registerAiUsageRoutes({ app, pool, activeSessions, isAdminEmail }: Deps): void {
  app.get("/api/integrations/ai-usage", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });

    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.trunc(daysRaw), 1), 365) : 30;
    try {
      const rows = await getAiUsageSummary(pool, orgId, days);
      const totals = rows.reduce(
        (acc, r) => ({
          calls: acc.calls + r.calls,
          inputTokens: acc.inputTokens + r.input_tokens,
          outputTokens: acc.outputTokens + r.output_tokens,
        }),
        { calls: 0, inputTokens: 0, outputTokens: 0 },
      );
      return res.json({ days, rows, totals });
    } catch (err) {
      console.error("[ai-usage] summary failed", err);
      return res.status(500).json({ error: "summary_failed" });
    }
  });
}
