import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createLeadNote,
  listLeadNotes,
  setLeadFavorite,
} from "./lead-map-collaboration-service.js";
import {
  requestedLeadMapOrganizationId,
  resolveLeadOrganizationScope,
  sendLeadMapOrganizationScopeError,
} from "./lead-map-org-scope.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

export function registerLeadMapCollaborationRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}): void {
  const { app, pool, activeSessions } = deps;

  async function session(req: Request) {
    return resolveLeadMapSession(req, pool, activeSessions);
  }

  async function organizationId(req: Request, userId: string): Promise<string | null> {
    return resolveLeadOrganizationScope(
      pool,
      userId,
      req.params.id,
      requestedLeadMapOrganizationId(req),
    );
  }

  app.get(
    "/api/admin-room/lead-map/leads/:id/notes",
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const orgId = await organizationId(req, current.userId);
        if (!orgId) return res.status(409).json({ error: "workspace_scope_required" });
        const notes = await listLeadNotes(pool, {
          leadId: req.params.id,
          organizationId: orgId,
        });
        return res.json({ notes });
      } catch (error) {
        if (sendLeadMapOrganizationScopeError(error, res)) return;
        return res.status(500).json({ error: "notes_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/:id/notes",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
      if (!body || body.length > 20_000) {
        return res.status(400).json({ error: "invalid_note" });
      }
      try {
        const orgId = await organizationId(req, current.userId);
        if (!orgId) return res.status(409).json({ error: "workspace_scope_required" });
        const note = await createLeadNote(pool, {
          leadId: req.params.id,
          organizationId: orgId,
          authorUserId: current.userId,
          body,
          pinned: req.body?.pinned === true,
        });
        if (!note) return res.status(404).json({ error: "not_found" });
        return res.status(201).json({ note });
      } catch (error) {
        if (sendLeadMapOrganizationScopeError(error, res)) return;
        return res.status(500).json({ error: "note_create_failed", detail: "internal_error" });
      }
    },
  );

  app.put(
    "/api/admin-room/lead-map/leads/:id/favorite",
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (typeof req.body?.favorite !== "boolean") {
        return res.status(400).json({ error: "favorite_boolean_required" });
      }
      try {
        const orgId = await organizationId(req, current.userId);
        if (!orgId) return res.status(409).json({ error: "workspace_scope_required" });
        const favorite = await setLeadFavorite(pool, {
          leadId: req.params.id,
          organizationId: orgId,
          userId: current.userId,
          favorite: req.body.favorite,
        });
        if (favorite === null) return res.status(404).json({ error: "not_found" });
        return res.json({ favorite });
      } catch (error) {
        if (sendLeadMapOrganizationScopeError(error, res)) return;
        return res.status(500).json({ error: "favorite_failed", detail: "internal_error" });
      }
    },
  );
}
