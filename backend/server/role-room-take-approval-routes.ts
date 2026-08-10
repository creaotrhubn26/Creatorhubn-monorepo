/**
 * role-room-take-approval-routes.ts
 *
 * REST-flate for godkjenning av take (REVIEW-modus).
 *
 * Rutene er tynne — tilstandsmaskinen ligger i
 * role-room-take-approval-service.ts. Feilkodene derfra oversettes til
 * HTTP-statuser her, slik at skjermen kan skille «ulovlig overgang» fra
 * «låst» fra «mangler begrunnelse» uten å lese meldingsteksten.
 *
 *   GET   /api/role-room/projects/:projectId/takes/approvals
 *   GET   /api/role-room/projects/:projectId/takes/approvals/summary
 *   POST  /api/role-room/projects/:projectId/takes/:source/:ref/approval
 *   PUT   /api/role-room/projects/:projectId/takes/:source/:ref/favorite
 *   GET   /api/role-room/projects/:projectId/takes/favorites
 */

import type express from "express";
import type { Pool } from "pg";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import {
  APPROVAL_ACTIONS,
  APPROVAL_STATUSES,
  ApprovalError,
  applyAction,
  availableActions,
  getApprovalSummary,
  listApprovals,
  listFavorites,
  setFavorite,
  type ApprovalAction,
  type ApprovalStatus,
  type TakeSource,
} from "./role-room-take-approval-service.js";

export interface TakeApprovalRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const SOURCES: TakeSource[] = ["take_log", "media"];

/** Tjenestens feilkoder → HTTP. Ingen av dem er 500. */
const ERROR_STATUS: Record<string, number> = {
  note_required: 400,
  illegal_transition: 409,
  locked: 409,
  nothing_to_lock: 409,
  not_locked: 409,
};

export function setupRoleRoomTakeApprovalRoutes(deps: TakeApprovalRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  async function guard(req: any, res: any): Promise<{ userId: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    if (!(await canAccessRoleRoomProject(pool, session.userId, String(req.params.projectId ?? "")))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return null;
    }
    return session;
  }

  app.get("/api/role-room/projects/:projectId/takes/approvals", async (req, res) => {
    if (!(await guard(req, res))) return;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !APPROVAL_STATUSES.includes(status as ApprovalStatus)) {
      res.status(400).json({ error: `Ukjent status: ${status}` });
      return;
    }
    try {
      const result = await listApprovals(pool, String(req.params.projectId), {
        sceneId: typeof req.query.sceneId === "string" ? req.query.sceneId : undefined,
        status: status as ApprovalStatus | undefined,
        limit: Number(req.query.limit) || undefined,
        offset: Number(req.query.offset) || undefined,
      });
      res.json({
        ...result,
        // Hva som kan gjøres nå følger med raden, slik at skjermen slipper å
        // reimplementere tilstandsmaskinen for å tegne knappene.
        approvals: result.approvals.map((a) => ({
          ...a,
          availableActions: availableActions(a.status, a.locked),
        })),
      });
    } catch (err) {
      console.error("[take-approval] liste feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente godkjenninger." });
    }
  });

  app.get("/api/role-room/projects/:projectId/takes/approvals/summary", async (req, res) => {
    if (!(await guard(req, res))) return;
    try {
      res.json(
        await getApprovalSummary(
          pool,
          String(req.params.projectId),
          typeof req.query.sceneId === "string" ? req.query.sceneId : undefined,
        ),
      );
    } catch (err) {
      console.error("[take-approval] oppsummering feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente status." });
    }
  });

  app.post("/api/role-room/projects/:projectId/takes/:source/:ref/approval", async (req, res) => {
    const session = await guard(req, res);
    if (!session) return;

    const source = String(req.params.source) as TakeSource;
    if (!SOURCES.includes(source)) {
      res.status(400).json({ error: "source må være take_log eller media." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (!APPROVAL_ACTIONS.includes(action as ApprovalAction)) {
      res.status(400).json({ error: `Ukjent handling: ${action || "(mangler)"}` });
      return;
    }

    try {
      const result = await applyAction(pool, {
        projectId: String(req.params.projectId),
        takeSource: source,
        takeRef: String(req.params.ref),
        sceneId: typeof body.sceneId === "string" ? body.sceneId : null,
        action: action as ApprovalAction,
        note: typeof body.note === "string" ? body.note : null,
        actorId: session.userId,
      });
      res.json({
        ...result,
        availableActions: availableActions(result.approval.status, result.approval.locked),
      });
    } catch (err) {
      if (err instanceof ApprovalError) {
        res.status(ERROR_STATUS[err.code] ?? 400).json({ error: err.message, code: err.code });
        return;
      }
      console.error("[take-approval] handling feilet:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere godkjenningen." });
    }
  });

  app.put("/api/role-room/projects/:projectId/takes/:source/:ref/favorite", async (req, res) => {
    const session = await guard(req, res);
    if (!session) return;

    const source = String(req.params.source) as TakeSource;
    if (!SOURCES.includes(source)) {
      res.status(400).json({ error: "source må være take_log eller media." });
      return;
    }
    try {
      const favorite = await setFavorite(pool, {
        projectId: String(req.params.projectId),
        takeSource: source,
        takeRef: String(req.params.ref),
        userId: session.userId,
        favorite: (req.body ?? {}).favorite !== false,
      });
      res.json({ favorite });
    } catch (err) {
      console.error("[take-approval] favoritt feilet:", err);
      res.status(500).json({ error: "Kunne ikke lagre favoritten." });
    }
  });

  app.get("/api/role-room/projects/:projectId/takes/favorites", async (req, res) => {
    const session = await guard(req, res);
    if (!session) return;
    try {
      // Favoritter er per bruker — alltid den innloggede, aldri en oppgitt id.
      res.json({ favorites: await listFavorites(pool, String(req.params.projectId), session.userId) });
    } catch (err) {
      console.error("[take-approval] favorittliste feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente favoritter." });
    }
  });
}
