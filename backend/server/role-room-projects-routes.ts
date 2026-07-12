/**
 * role-room-projects-routes.ts
 *
 * Setup-funksjon for /api/role-room/projects/:projectId/* — 8 endpoints
 * som henter eller publiserer prosjekt-bundlede ressurser (offers,
 * contracts, project-agreements, og live-set sessions/events) for et
 * gitt prosjekt.
 *
 * 8 endpoints:
 *   GET    /:projectId/offers
 *   GET    /:projectId/contracts
 *   GET    /:projectId/project-agreements
 *   POST   /:projectId/live-set/sessions
 *   POST   /:projectId/live-set/events/batch
 *   GET    /:projectId/live-set/events
 *   POST   /:projectId/live-set/sync/ack
 *   GET    /:projectId/live-set/health
 *
 * Tilgang: AUTH + prosjekt-medlemskap. Alle GET/POST-endpoints (unntatt
 * den statiske live-set/health-proben) krever innlogget bruker som er
 * eier eller medlem av prosjektet (requireProjectAccess →
 * canAccessRoleRoomProject). Tidligere var offers/contracts/project-
 * agreements-GETene helt åpne (uauth cross-tenant lesing av
 * kompensasjon/vilkår + motparts-PII).
 *
 * Mode-relevans: live-set endpoints brukes primært i Produksjonsteam-
 * mode (shooting-day-flyt), mens offers/contracts/agreements er mode-
 * agnostiske (alle modes som signerer kontrakter).
 *
 * Service-laget:
 *   - Live-set Maps + getters/setters i ./role-room-live-set-service.ts
 *     (instansieres internt; deps gis via routes-modulens deps)
 *
 * Delt state (passes via deps):
 *   - legacyOffersByProject / legacyContractsByProject /
 *     legacyProjectAgreementsByProject Maps — DELT med /api/casting og
 *     andre /api/role-room-endpoints, derfor passes via deps og forblir
 *     i index.ts.
 *   - compatStoreGet + dbLegacy*Key — felles compat-store API.
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { createRoleRoomLiveSetService } from "./role-room-live-set-service";
 *   import { setupRoleRoomProjectsRoutes } from "./role-room-projects-routes";
 *
 *   const liveSetService = createRoleRoomLiveSetService({
 *     compatStoreGet, compatStoreSet,
 *     dbLegacyLiveSetSessionsKey, dbLegacyLiveSetEventsKey,
 *   });
 *
 *   setupRoleRoomProjectsRoutes({
 *     app,
 *     compatStoreGet,
 *     legacyOffersByProject,
 *     legacyContractsByProject,
 *     legacyProjectAgreementsByProject,
 *     dbLegacyOffersKey,
 *     dbLegacyContractsKey,
 *     dbLegacyProjectAgreementsKey,
 *     liveSetService,
 *   });
 */

import type express from "express";
import type { Pool } from "pg";

import { getProjectItems, setProjectItems } from "./_shared";
import type { RoleRoomLiveSetService } from "./role-room-live-set-service";

/**
 * Authorize a user as a member of a role-room (casting) project. Mirrors the
 * canonical role-room access predicate used across role-room-routes (e.g.
 * role-room-routes.ts client-comments): the caller is a member iff they created
 * the project (casting_projects.created_by) or hold an RBAC role row
 * (casting_user_roles.user_id). Matches user_id only — identical to the existing
 * gate — so Live Set access is neither looser nor stricter than the rest of
 * role-room. Fails closed on error.
 */
export async function canAccessRoleRoomProject(
  pool: Pool,
  userId: string,
  projectId: string,
): Promise<boolean> {
  if (!userId || !projectId) return false;
  try {
    const owner = await pool.query(
      `SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2 LIMIT 1`,
      [projectId, userId],
    );
    if ((owner.rowCount ?? 0) > 0) return true;
    const member = await pool.query(
      `SELECT 1 FROM casting_user_roles WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
      [projectId, userId],
    );
    return (member.rowCount ?? 0) > 0;
  } catch (e) {
    console.error("[role-room] canAccessRoleRoomProject error:", e);
    return false; // fail closed
  }
}

export interface RoleRoomProjectsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  legacyOffersByProject: Map<string, unknown[]>;
  legacyContractsByProject: Map<string, unknown[]>;
  legacyProjectAgreementsByProject: Map<string, unknown[]>;
  dbLegacyOffersKey: (projectId: string) => string;
  dbLegacyContractsKey: (projectId: string) => string;
  dbLegacyProjectAgreementsKey: (projectId: string) => string;
  // Service-instans deles med index.ts (casting DELETE rydder live-set-
  // state via samme instans). Derfor instansieres den NOT inne i routes-
  // modulen.
  liveSetService: RoleRoomLiveSetService;
}

export function setupRoleRoomProjectsRoutes(
  deps: RoleRoomProjectsRoutesDeps,
): void {
  const {
    app,
    pool,
    requireUserSession,
    compatStoreGet,
    legacyOffersByProject,
    legacyContractsByProject,
    legacyProjectAgreementsByProject,
    dbLegacyOffersKey,
    dbLegacyContractsKey,
    dbLegacyProjectAgreementsKey,
    liveSetService,
  } = deps;

  // Authenticate the caller AND authorize them as a member of the addressed
  // role-room project before ANY project-bundled resource is read or written —
  // Live Set state as well as the offers/contracts/project-agreements lists.
  // Previously the write endpoints only checked requireUserSession (any
  // authenticated user could inject roll/cut/note events into ANOTHER
  // production's live set), GET /live-set/events was fully public, and the
  // offers/contracts/project-agreements GETs were fully public too (anyone
  // could read a project's compensation, terms and counterparty PII by
  // supplying its projectId). Returns the userId on success; on failure it has
  // already written the 401/403 response, so the caller must `return`.
  async function requireProjectAccess(req: any, res: any): Promise<string | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const userId = String(session.userId ?? session.user_id ?? session.id ?? "");
    const projectId = String(req.params.projectId ?? "");
    if (!userId || !projectId || !(await canAccessRoleRoomProject(pool, userId, projectId))) {
      res.status(403).json({ error: "forbidden" });
      return null;
    }
    return userId;
  }

  app.get("/api/role-room/projects/:projectId/offers", async (req, res) => {
    if (!(await requireProjectAccess(req, res))) return;
    const projectId = req.params.projectId;
    const dbOffers = await compatStoreGet<unknown[]>(dbLegacyOffersKey(projectId));
    if (Array.isArray(dbOffers)) {
      setProjectItems(legacyOffersByProject, projectId, dbOffers);
      res.json({ offers: dbOffers });
      return;
    }
    res.json({ offers: getProjectItems(legacyOffersByProject, projectId) });
  });

  app.get("/api/role-room/projects/:projectId/contracts", async (req, res) => {
    if (!(await requireProjectAccess(req, res))) return;
    const projectId = req.params.projectId;
    const dbContracts = await compatStoreGet<unknown[]>(
      dbLegacyContractsKey(projectId),
    );
    if (Array.isArray(dbContracts)) {
      setProjectItems(legacyContractsByProject, projectId, dbContracts);
      res.json({ contracts: dbContracts });
      return;
    }
    res.json({ contracts: getProjectItems(legacyContractsByProject, projectId) });
  });

  app.get(
    "/api/role-room/projects/:projectId/project-agreements",
    async (req, res) => {
      if (!(await requireProjectAccess(req, res))) return;
      const projectId = req.params.projectId;
      const dbAgreements = await compatStoreGet<unknown[]>(
        dbLegacyProjectAgreementsKey(projectId),
      );
      if (Array.isArray(dbAgreements)) {
        setProjectItems(
          legacyProjectAgreementsByProject,
          projectId,
          dbAgreements,
        );
        res.json({ agreements: dbAgreements });
        return;
      }
      res.json({
        agreements: getProjectItems(legacyProjectAgreementsByProject, projectId),
      });
    },
  );

  app.post(
    "/api/role-room/projects/:projectId/live-set/sessions",
    async (req, res) => {
    if (!(await requireProjectAccess(req, res))) return;
      const projectId = req.params.projectId;
      const payload = req.body || {};
      const current = await liveSetService.getLegacyLiveSetSessions(projectId);
      const sessionId =
        typeof payload.sessionId === "string" && payload.sessionId.trim()
          ? payload.sessionId
          : `live-set-session-${Date.now()}`;
      const session = {
        sessionId,
        projectId,
        operatorId:
          typeof payload.operatorId === "string"
            ? payload.operatorId
            : "unknown-operator",
        deviceId:
          typeof payload.deviceId === "string"
            ? payload.deviceId
            : "unknown-device",
        shootingDayId:
          typeof payload.shootingDayId === "string"
            ? payload.shootingDayId
            : undefined,
        startedAt: new Date().toISOString(),
        metadata:
          payload.metadata && typeof payload.metadata === "object"
            ? payload.metadata
            : {},
      };
      const next = [
        ...current.filter(
          (entry): entry is { sessionId?: string } =>
            Boolean(entry) && typeof entry === "object",
        ).filter((entry) => entry?.sessionId !== sessionId),
        session,
      ];
      await liveSetService.replaceLegacyLiveSetSessions(projectId, next);
      res.json({ success: true, session });
    },
  );

  app.post(
    "/api/role-room/projects/:projectId/live-set/events/batch",
    async (req, res) => {
    if (!(await requireProjectAccess(req, res))) return;
      const projectId = req.params.projectId;
      const payload = req.body || {};
      const incoming = Array.isArray(payload.events) ? payload.events : [];
      if (!incoming.length) {
        res.json({
          success: true,
          ackedEventIds: [],
          rejected: [],
          conflicts: [],
          serverTime: new Date().toISOString(),
        });
        return;
      }

      const current = await liveSetService.getLegacyLiveSetEvents(projectId);
      const byId = new Map<string, unknown>(
        current.map((event) => {
          const e = event as { eventId?: string; id?: string } | null;
          return [String(e?.eventId || e?.id || ""), event];
        }),
      );
      const ackedEventIds: string[] = [];

      for (const rawEvent of incoming) {
        const eventId =
          typeof rawEvent?.eventId === "string" && rawEvent.eventId.trim()
            ? rawEvent.eventId
            : `live-set-event-${Date.now()}-${ackedEventIds.length}`;
        byId.set(eventId, {
          ...rawEvent,
          eventId,
          projectId,
          sessionId:
            typeof rawEvent?.sessionId === "string"
              ? rawEvent.sessionId
              : payload.sessionId,
          capturedAt:
            typeof rawEvent?.capturedAt === "string"
              ? rawEvent.capturedAt
              : new Date().toISOString(),
        });
        ackedEventIds.push(eventId);
      }

      const next = Array.from(byId.values()).sort((left, right) => {
        const l = left as { capturedAt?: string; seq?: number } | null;
        const r = right as { capturedAt?: string; seq?: number } | null;
        const leftTime = Date.parse(String(l?.capturedAt || "")) || 0;
        const rightTime = Date.parse(String(r?.capturedAt || "")) || 0;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return Number(l?.seq || 0) - Number(r?.seq || 0);
      });

      await liveSetService.replaceLegacyLiveSetEvents(projectId, next);
      res.json({
        success: true,
        ackedEventIds,
        rejected: [],
        conflicts: [],
        serverTime: new Date().toISOString(),
      });
    },
  );

  app.get(
    "/api/role-room/projects/:projectId/live-set/events",
    async (req, res) => {
      if (!(await requireProjectAccess(req, res))) return;
      const projectId = req.params.projectId;
      const since = typeof req.query.since === "string" ? req.query.since : "";
      const sinceTime = since ? Date.parse(since) : NaN;
      const current = await liveSetService.getLegacyLiveSetEvents(projectId);
      const events = Number.isFinite(sinceTime)
        ? current.filter((event) => {
            const e = event as { capturedAt?: string } | null;
            const capturedAt = Date.parse(String(e?.capturedAt || ""));
            return Number.isFinite(capturedAt) ? capturedAt > sinceTime : true;
          })
        : current;
      const latestEvent =
        events.length > 0
          ? events[events.length - 1]
          : current[current.length - 1];
      const latestCapturedAt =
        latestEvent && typeof latestEvent === "object"
          ? (latestEvent as { capturedAt?: unknown }).capturedAt
          : undefined;
      res.json({
        success: true,
        events,
        conflicts: [],
        serverCursor:
          typeof latestCapturedAt === "string" ? latestCapturedAt : undefined,
      });
    },
  );

  app.post(
    "/api/role-room/projects/:projectId/live-set/sync/ack",
    async (req, res) => {
    if (!(await requireProjectAccess(req, res))) return;
      const projectId = req.params.projectId;
      const payload = req.body || {};
      const eventIds = Array.isArray(payload.eventIds)
        ? payload.eventIds.map((value: unknown) => String(value))
        : [];
      const current = await liveSetService.getLegacyLiveSetEvents(projectId);
      const known = new Set(
        current.map((event) => {
          const e = event as { eventId?: string; id?: string } | null;
          return String(e?.eventId || e?.id || "");
        }),
      );
      const ackedEventIds = eventIds.filter((eventId: string) =>
        known.has(eventId),
      );
      const unknownEventIds = eventIds.filter(
        (eventId: string) => !known.has(eventId),
      );
      res.json({ success: true, ackedEventIds, unknownEventIds });
    },
  );

  app.get(
    "/api/role-room/projects/:projectId/live-set/health",
    async (_req, res) => {
      res.json({
        success: true,
        status: "ok",
        dependencies: {
          db: "ok",
          weatherUpstream: "ok",
          websocket: "degraded",
        },
        timestamp: new Date().toISOString(),
      });
    },
  );
}
