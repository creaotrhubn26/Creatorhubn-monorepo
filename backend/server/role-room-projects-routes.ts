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
 * Tilgang: ÅPEN (ingen auth) — matcher eksisterende oppførsel før
 * ekstrakt.
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

import { getProjectItems, setProjectItems } from "./_shared";
import type { RoleRoomLiveSetService } from "./role-room-live-set-service";

export interface RoleRoomProjectsRoutesDeps {
  app: express.Application;
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

  app.get("/api/role-room/projects/:projectId/offers", async (req, res) => {
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
    if (!requireUserSession(req, res)) return;
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
    if (!requireUserSession(req, res)) return;
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
    if (!requireUserSession(req, res)) return;
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
