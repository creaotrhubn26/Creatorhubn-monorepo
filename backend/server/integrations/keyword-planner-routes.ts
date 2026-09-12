/**
 * keyword-planner-routes.ts
 *
 *   POST /api/integrations/keyword-demand/lookup
 *        Admin-session. Body: { keywords: string[], customerId? }
 *        → { results, apiCalls, signalsInserted } — cache-først
 *        (30 dager i normalized_signals), deretter Keyword Planner.
 *
 * Volumene er Googles estimater (isEstimated=true) og lagres som
 * searches_per_month — aldri blandbart med relative Trends-indekser.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { lookupKeywordDemand } from "./keyword-planner-adapter.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function registerKeywordPlannerRoutes({
  app, pool, activeSessions, isAdminEmail,
}: Deps): void {
  app.post("/api/integrations/keyword-demand/lookup", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === "string")
      : [];
    if (keywords.length === 0) {
      return res.status(400).json({ error: "keywords_pakrevd" });
    }

    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!UUID_PATTERN.test(orgId)) {
        return res.status(409).json({ error: "ingen_organisasjon" });
      }
      const result = await lookupKeywordDemand(pool, {
        producerUserId: session.userId,
        organizationId: orgId,
        customerId: typeof body.customerId === "string" ? body.customerId : undefined,
        keywords,
      });
      return res.json(result);
    } catch (err) {
      console.error("[keyword-demand] lookup failed", err);
      return res.status(502).json({ error: "lookup_failed", detail: String(err).slice(0, 200) });
    }
  });
}
