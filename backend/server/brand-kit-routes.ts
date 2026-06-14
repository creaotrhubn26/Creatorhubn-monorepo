/**
 * brand-kit-routes.ts
 *
 * Per-prosjekt Brand Kit-API. Brukes som baseline for Market Intelligence
 * Scanner og Campaign Builder.
 *
 *   GET  /api/role-room/brand-kit/:projectId
 *        — hent eksisterende Brand Kit (eller 404)
 *   POST /api/role-room/brand-kit/:projectId/scan
 *        — kjør ny website-scan og lagre/oppdater Brand Kit
 *        body: { url: string }
 *   PATCH /api/role-room/brand-kit/:projectId
 *        — sett/oppdater brukerens overrides
 *        body: { overrides: Partial<BrandProfile> }
 *
 * Auth: krever admin-session (samme mønster som lead-map-routes / admin-only
 * for nå). Kan utvides til prosjekt-team-tilgang i en senere fase.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  getBrandKit,
  runBrandScan,
  saveBrandKitOverrides,
} from "./brand-kit-service.js";

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
    const token = auth.slice(7).trim();
    return activeSessions.get(token) ?? null;
  }
  return null;
}

export function registerBrandKitRoutes({
  app,
  pool,
  activeSessions,
  isAdminEmail,
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

  app.get("/api/role-room/brand-kit/:projectId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const kit = await getBrandKit(pool, req.params.projectId);
      if (!kit) {
        return res.status(404).json({ error: "brand_kit_not_found" });
      }
      return res.json({ brandKit: kit });
    } catch (err) {
      console.error("[brand-kit] GET failed", err);
      return res
        .status(500)
        .json({ error: "brand_kit_fetch_failed", detail: String(err) });
    }
  });

  app.post("/api/role-room/brand-kit/:projectId/scan", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { url?: string };
    if (!body.url || typeof body.url !== "string") {
      return res.status(400).json({ error: "mangler_url" });
    }
    try {
      const kit = await runBrandScan(pool, {
        projectId: req.params.projectId,
        workspaceOwnerUserId: session.userId,
        url: body.url,
      });
      return res.json({ brandKit: kit });
    } catch (err) {
      console.error("[brand-kit] scan failed", err);
      return res
        .status(500)
        .json({ error: "brand_scan_failed", detail: String(err) });
    }
  });

  app.patch("/api/role-room/brand-kit/:projectId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const body = (req.body ?? {}) as { overrides?: Record<string, unknown> };
    if (!body.overrides || typeof body.overrides !== "object") {
      return res.status(400).json({ error: "mangler_overrides" });
    }
    try {
      const kit = await saveBrandKitOverrides(pool, {
        projectId: req.params.projectId,
        overrides: body.overrides as Parameters<
          typeof saveBrandKitOverrides
        >[1]["overrides"],
      });
      return res.json({ brandKit: kit });
    } catch (err) {
      console.error("[brand-kit] PATCH failed", err);
      return res
        .status(500)
        .json({ error: "brand_kit_update_failed", detail: String(err) });
    }
  });
}
