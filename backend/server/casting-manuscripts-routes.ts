/**
 * casting-manuscripts-routes.ts
 *
 * Setup-funksjon for /api/casting/manuscripts/* og deres sub-entiteter
 * (scenes, dialogue, acts, revisions). 17 endpoints totalt:
 *
 *   Manuscripts (5):
 *     GET    /manuscripts                         — list, filtrer på projectId
 *     POST   /manuscripts                         — upsert
 *     GET    /manuscripts/:manuscriptId           — hent én
 *     PUT    /manuscripts/:manuscriptId           — oppdater
 *     DELETE /manuscripts/:manuscriptId           — slett (cascade)
 *
 *   Scenes (2):
 *     GET    /manuscripts/:manuscriptId/scenes    — list
 *     POST   /scenes                              — upsert
 *
 *   Dialogue (3):
 *     GET    /manuscripts/:manuscriptId/dialogue  — list
 *     POST   /dialogue                            — upsert
 *     DELETE /dialogue/:dialogueId                — slett
 *
 *   Revisions (2):
 *     GET    /manuscripts/:manuscriptId/revisions — list
 *     POST   /revisions                           — upsert
 *
 *   Acts (5):
 *     GET    /manuscripts/:manuscriptId/acts      — list
 *     POST   /acts                                — upsert
 *     GET    /acts/:actId                         — hent én
 *     PUT    /acts/:actId                         — oppdater
 *     DELETE /acts/:actId                         — slett
 *
 * Tilgang: ÅPEN (matcher eksisterende oppførsel).
 *
 * Service-laget: `./casting-manuscripts-service.ts` (instansiert i
 * index.ts og passet via deps slik at casting-projects DELETE-handler
 * også kan kalle `clearManuscriptState` ved prosjekt-cascade-rydding).
 *
 * **Robustness-noter (forbedringer vs. opprinnelig kode):**
 *
 *   - Alle handlere har konsistent try/catch med 500-fallback (mange av
 *     de opprinnelige hadde ingen feilhåndtering — uventet feil ville
 *     krasje requesten uten respons).
 *   - Input-validering returnerer 400 med klar melding for manglende
 *     manuscriptId (eksisterende oppførsel) og uventet payload-form
 *     (ny defensiv sjekk — req.body skal være object).
 *   - Sub-helper `readManuscriptId` slår sammen camelCase + snake_case-
 *     parsing-mønsteret som var duplisert i scenes/dialogue/acts/
 *     revisions-POST.
 *
 * **Ikke endret (samme oppførsel som før):**
 *   - ID-generering: bruker newEntityId() fra _shared-ids (crypto.randomUUID
 *     under panseret — gammel `${prefix}-${Date.now()}`-bug ryddet 2026-05).
 *   - Ingen optimistic concurrency control (mulig forbedring: If-Match +
 *     version-felt for å forhindre concurrent overwrites).
 *   - DELETE-cascade for manuscripts er ikke atomisk på DB-nivå
 *     (compatStore-laget støtter ikke transaksjoner ennå)
 *   - Status-codes: 200 ved oppdatering, 201 ved opprettelse (bevart)
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { createCastingManuscriptsService } from "./casting-manuscripts-service";
 *   import { setupCastingManuscriptsRoutes } from "./casting-manuscripts-routes";
 *
 *   const manuscriptsService = createCastingManuscriptsService({
 *     compatStoreGet, compatStoreSet, compatStoreDelete, compatStoreListByPrefix,
 *   });
 *
 *   setupCastingManuscriptsRoutes({ app, manuscriptsService });
 *
 *   // I casting-DELETE-handler:
 *   //   const manuscripts = await manuscriptsService.listManuscripts(projectId);
 *   //   for (const m of manuscripts) {
 *   //     await manuscriptsService.clearManuscriptState(m.id);
 *   //   }
 */

import type express from "express";

import {
  checkIfMatch,
  sendPreconditionFailed,
  setEtagHeader,
} from "./_shared-concurrency.js";
import {
  notifyStoryboardMentions,
  listMentions,
  markMentionsRead,
  registerStoryboardDeviceToken,
} from "./storyboard-mention-service";
import type { CastingManuscriptRevisionsService } from "./casting-manuscript-revisions-service.js";
import type { CastingManuscriptsService } from "./casting-manuscripts-service";
import { computeManuscriptLockState } from "./casting-manuscripts-service.js";
import {
  exportFdx,
  exportFountain,
  parseFdx,
  parseFountain,
  type ParsedScreenplay,
} from "./casting-screenplay-formats.js";
import { newEntityId } from "./_shared-ids.js";
import { userOwnsCastingProjectViaStore } from "./casting-project-ownership.js";

export interface CastingManuscriptsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  /** Compat-store accessor — used to verify project ownership before
   *  serving/mutating manuscript content (cross-tenant scoping). */
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  manuscriptsService: CastingManuscriptsService;
  /**
   * Service for revisjons-historikk (diff/restore-API). Trenger
   * manuscriptsService internt for å lese/skrive revisions-array.
   */
  revisionsService: CastingManuscriptRevisionsService;
  /** Valgfri PG-pool — aktiverer @mention-varsling på frame-kommentarer. */
  pool?: import("pg").Pool;
}

/**
 * Henter manuscriptId fra payload — støtter både camelCase (manuscriptId)
 * og snake_case (manuscript_id) for bakoverkompatibilitet med eldre
 * klienter.
 */
function readManuscriptId(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const camel =
    typeof payload.manuscriptId === "string" ? payload.manuscriptId.trim() : "";
  if (camel) return camel;
  const snake =
    typeof payload.manuscript_id === "string"
      ? payload.manuscript_id.trim()
      : "";
  return snake;
}

/**
 * Henter projectId med samme dual-naming-pattern, brukes ved manuscript-
 * opprettelse for å sette `projectId`/`project_id`-felt.
 */
function readProjectId(payload: any, fallback = ""): string {
  if (!payload || typeof payload !== "object") return fallback;
  const camel =
    typeof payload.projectId === "string" ? payload.projectId.trim() : "";
  if (camel) return camel;
  const snake =
    typeof payload.project_id === "string" ? payload.project_id.trim() : "";
  return snake || fallback;
}

// ── Presence (multi-viewer) ──────────────────────────────────────────
// In-memory presence pr. manus: hvem har det åpent akkurat nå (alle, ikke
// bare den som holder skrive-låsen). Hver klient pinger jevnlig; en oppføring
// utløper når den ikke er sett innen TTL. Bevisst in-memory (samme rasjonal som
// låsen) — presence er flyktig og trenger ikke persistens.
const MANUSCRIPT_PRESENCE_TTL_MS = 45_000;
interface PresenceEntry { userId: string; displayName: string; lastSeenMs: number }
const manuscriptPresence = new Map<string, Map<string, PresenceEntry>>();

function recordManuscriptPresence(
  manuscriptId: string,
  userId: string,
  displayName: string,
  nowMs: number,
): void {
  let room = manuscriptPresence.get(manuscriptId);
  if (!room) {
    room = new Map<string, PresenceEntry>();
    manuscriptPresence.set(manuscriptId, room);
  }
  room.set(userId, { userId, displayName, lastSeenMs: nowMs });
}

function listManuscriptPresence(
  manuscriptId: string,
  nowMs: number,
): Array<{ userId: string; displayName: string; lastSeenAt: string }> {
  const room = manuscriptPresence.get(manuscriptId);
  if (!room) return [];
  const active: Array<{ userId: string; displayName: string; lastSeenAt: string }> = [];
  for (const [userId, entry] of room) {
    if (nowMs - entry.lastSeenMs > MANUSCRIPT_PRESENCE_TTL_MS) {
      room.delete(userId);
      continue;
    }
    active.push({
      userId,
      displayName: entry.displayName,
      lastSeenAt: new Date(entry.lastSeenMs).toISOString(),
    });
  }
  if (room.size === 0) manuscriptPresence.delete(manuscriptId);
  return active;
}

export function setupCastingManuscriptsRoutes(
  deps: CastingManuscriptsRoutesDeps,
): void {
  const { app, requireUserSession, compatStoreGet, manuscriptsService, revisionsService, pool } = deps;

  // Manuscript content (full screenplay text, dialogue, revisions) is
  // tenant-private. These read endpoints were unauthenticated — anyone who
  // knew/guessed a manuscriptId could read another production's script. Gate
  // on a session AND ownership of the manuscript's project.
  async function readProjectIdOfManuscript(
    manuscriptId: string,
  ): Promise<string | null> {
    const m = (await manuscriptsService.getManuscript(manuscriptId)) as
      | Record<string, unknown>
      | null;
    if (!m) return null;
    const pid =
      typeof m.projectId === "string"
        ? m.projectId
        : typeof m.project_id === "string"
          ? m.project_id
          : null;
    return pid;
  }

  async function ensureManuscriptOwner(
    req: any,
    res: any,
    manuscriptId: string,
  ): Promise<boolean> {
    const session = requireUserSession(req, res);
    if (!session) return false;
    const projectId = await readProjectIdOfManuscript(manuscriptId);
    if (
      !projectId ||
      !(await userOwnsCastingProjectViaStore(compatStoreGet, projectId, session.userId))
    ) {
      res.status(404).json({ error: "not_found" });
      return false;
    }
    return true;
  }

  // ── Manuscripts ────────────────────────────────────────────────────

  app.get("/api/casting/manuscripts", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const projectId =
        typeof req.query.projectId === "string" && req.query.projectId.trim()
          ? req.query.projectId.trim()
          : undefined;
      // Require a project scope and verify ownership — an unscoped list would
      // return every tenant's manuscripts.
      if (!projectId) {
        res.status(400).json({ error: "projectId_required" });
        return;
      }
      if (
        !(await userOwnsCastingProjectViaStore(compatStoreGet, projectId, session.userId))
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const manuscripts = await manuscriptsService.listManuscripts(projectId);
      res.json(manuscripts);
    } catch (error) {
      console.error("Error listing manuscripts:", error);
      res.status(500).json({ error: "Could not list manuscripts" });
    }
  });

  app.post("/api/casting/manuscripts", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("manuscript");
      const now = new Date().toISOString();
      const existing = (await manuscriptsService.getManuscript(manuscriptId)) || {};
      const projectId = readProjectId(
        payload,
        readProjectId(existing, "default-project"),
      );
      const manuscript = {
        ...existing,
        ...payload,
        id: manuscriptId,
        projectId,
        project_id: projectId,
        createdAt: existing.createdAt || now,
        updatedAt: now,
      };
      const stored = await manuscriptsService.replaceManuscript(
        manuscriptId,
        manuscript,
      );
      setEtagHeader(res, stored);
      res.status(201).json(stored);
    } catch (error) {
      console.error("Error creating manuscript:", error);
      res.status(500).json({ error: "Could not create manuscript" });
    }
  });

  app.get("/api/casting/manuscripts/:manuscriptId", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
      const manuscript = await manuscriptsService.getManuscript(
        req.params.manuscriptId,
      );
      setEtagHeader(res, manuscript);
      res.json(manuscript);
    } catch (error) {
      console.error("Error fetching manuscript:", error);
      res.status(500).json({ error: "Could not fetch manuscript" });
    }
  });

  app.put("/api/casting/manuscripts/:manuscriptId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const manuscriptId = req.params.manuscriptId;
      const existing =
        (await manuscriptsService.getManuscript(manuscriptId)) || {};
      // Lock enforcement: hvis en ANNEN bruker holder en gyldig lås → 409.
      // Utløpt lås blokkerer ikke; neste acquire overskriver den.
      const lockState = computeManuscriptLockState(existing);
      if (lockState.held && lockState.lockedBy !== session.userId) {
        return res.status(409).json({
          error: "locked_by_other",
          lockedBy: lockState.lockedBy,
          lockedAt: lockState.lockedAt,
          expiresAt: lockState.expiresAt,
        });
      }
      // F1 enforcement: hvis klient sender If-Match med stale version → 412.
      // Klienter som IKKE sender header passerer uendret (backwards-compat).
      const currentVersion =
        typeof existing.version === "number" ? existing.version : undefined;
      const ifMatchCheck = checkIfMatch(req, currentVersion);
      if (!ifMatchCheck.matches) {
        return sendPreconditionFailed(res, currentVersion);
      }
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const now = new Date().toISOString();
      const projectId = readProjectId(
        payload,
        readProjectId(existing, "default-project"),
      );
      const manuscript = {
        ...existing,
        ...payload,
        id: manuscriptId,
        projectId,
        project_id: projectId,
        createdAt: existing.createdAt || now,
        updatedAt: now,
      };
      const stored = await manuscriptsService.replaceManuscript(
        manuscriptId,
        manuscript,
      );
      setEtagHeader(res, stored);
      res.json(stored);
    } catch (error) {
      console.error("Error updating manuscript:", error);
      res.status(500).json({ error: "Could not update manuscript" });
    }
  });

  app.delete("/api/casting/manuscripts/:manuscriptId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const manuscriptId = req.params.manuscriptId;
      const existing = await manuscriptsService.getManuscript(manuscriptId);
      // Lock enforcement: identisk med PUT.
      const lockState = computeManuscriptLockState(existing);
      if (lockState.held && lockState.lockedBy !== session.userId) {
        return res.status(409).json({
          error: "locked_by_other",
          lockedBy: lockState.lockedBy,
          lockedAt: lockState.lockedAt,
          expiresAt: lockState.expiresAt,
        });
      }
      // F1 enforcement: hvis klient sender If-Match med stale version → 412.
      const currentVersion =
        existing && typeof existing.version === "number"
          ? existing.version
          : undefined;
      const ifMatchCheck = checkIfMatch(req, currentVersion);
      if (!ifMatchCheck.matches) {
        return sendPreconditionFailed(res, currentVersion);
      }
      await manuscriptsService.clearManuscriptState(manuscriptId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting manuscript:", error);
      res.status(500).json({ error: "Could not delete manuscript" });
    }
  });

  // ── Lock management ────────────────────────────────────────────────

  app.post("/api/casting/manuscripts/:manuscriptId/lock", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const force = body.force === true;
      const result = await manuscriptsService.acquireLock(
        req.params.manuscriptId,
        session.userId,
        { force },
      );
      if (!result.ok) {
        return res.status(409).json({
          error: "locked_by_other",
          lockedBy: result.conflict.lockedBy,
          lockedAt: result.conflict.lockedAt,
          expiresAt: result.conflict.expiresAt,
        });
      }
      res.json({ lock: result.lock });
    } catch (error) {
      console.error("Error acquiring manuscript lock:", error);
      res.status(500).json({ error: "Could not acquire lock" });
    }
  });

  app.post("/api/casting/manuscripts/:manuscriptId/lock/heartbeat", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await manuscriptsService.heartbeatLock(
        req.params.manuscriptId,
        session.userId,
      );
      if (!result.ok) {
        return res.status(409).json({
          error: "locked_by_other",
          lockedBy: result.conflict.lockedBy,
          lockedAt: result.conflict.lockedAt,
          expiresAt: result.conflict.expiresAt,
        });
      }
      res.json({ lock: result.lock });
    } catch (error) {
      console.error("Error heartbeat manuscript lock:", error);
      res.status(500).json({ error: "Could not heartbeat lock" });
    }
  });

  app.delete("/api/casting/manuscripts/:manuscriptId/lock", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await manuscriptsService.releaseLock(
        req.params.manuscriptId,
        session.userId,
      );
      res.json({ released: result.released, lock: result.lock });
    } catch (error) {
      console.error("Error releasing manuscript lock:", error);
      res.status(500).json({ error: "Could not release lock" });
    }
  });

  app.get("/api/casting/manuscripts/:manuscriptId/lock", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const lock = await manuscriptsService.getLock(req.params.manuscriptId);
      res.json({ lock });
    } catch (error) {
      console.error("Error reading manuscript lock:", error);
      res.status(500).json({ error: "Could not read lock" });
    }
  });

  // ── Presence (hvem har manuset åpent nå) ───────────────────────────

  app.post("/api/casting/manuscripts/:manuscriptId/presence", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const displayName =
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName.trim()
          : session.userId;
      const nowMs = Date.now();
      recordManuscriptPresence(req.params.manuscriptId, session.userId, displayName, nowMs);
      // Returner alle andre aktive (ekskluder seg selv) så klienten slipper ekstra GET.
      const others = listManuscriptPresence(req.params.manuscriptId, nowMs)
        .filter((p) => p.userId !== session.userId);
      res.json({ presence: others });
    } catch (error) {
      console.error("Error recording manuscript presence:", error);
      res.status(500).json({ error: "Could not record presence" });
    }
  });

  app.get("/api/casting/manuscripts/:manuscriptId/presence", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const others = listManuscriptPresence(req.params.manuscriptId, Date.now())
        .filter((p) => p.userId !== session.userId);
      res.json({ presence: others });
    } catch (error) {
      console.error("Error listing manuscript presence:", error);
      res.status(500).json({ error: "Could not list presence" });
    }
  });

  // ── Scenes ─────────────────────────────────────────────────────────

  app.get("/api/casting/manuscripts/:manuscriptId/scenes", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
      // ETag fra manuscript-version (bumpes ved hver scene-mutasjon):
      // klienter som poller slipper å laste hele scenelisten (thumbs +
      // underlag = MB) når ingenting er endret.
      const manuscript = await manuscriptsService.getManuscript(
        req.params.manuscriptId,
      );
      const version = (manuscript as { version?: number } | null)?.version ?? 0;
      const etag = `W/"scenes-${req.params.manuscriptId}-${version}"`;
      // Netlify-proxyen foran Render stripper standard betingede headere
      // (If-None-Match når aldri origin) — aksepter custom header i tillegg.
      const clientTag =
        req.headers["if-none-match"] ?? req.headers["x-if-none-match"];
      if (clientTag === etag) {
        res.status(304).end();
        return;
      }
      const scenes = await manuscriptsService.getScenes(req.params.manuscriptId);
      res.setHeader("ETag", etag);
      res.json(scenes);
    } catch (error) {
      console.error("Error listing scenes:", error);
      res.status(500).json({ error: "Could not list scenes" });
    }
  });

  app.post("/api/casting/scenes", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }

      const current = await manuscriptsService.getScenes(manuscriptId);
      const sceneId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("scene");
      const existingIndex = current.findIndex((scene) => scene?.id === sceneId);
      const existing = existingIndex >= 0 ? current[existingIndex] : null;
      const now = new Date().toISOString();
      const scene = {
        ...(existing || {}),
        ...payload,
        id: sceneId,
        manuscriptId,
        manuscript_id: manuscriptId,
        createdAt: existing?.createdAt || payload.createdAt || now,
        updatedAt: now,
      } as Record<string, unknown>;
      // Tegne-historikk også på hele-scene-upsert (web-lagringsveien):
      // match innkommende frames mot eksisterende på id.
      const existingFrames: any[] = Array.isArray((existing as any)?.storyboardFrames)
        ? (existing as any).storyboardFrames
        : [];
      if (Array.isArray((scene as any).storyboardFrames) && existingFrames.length) {
        (scene as any).storyboardFrames = (scene as any).storyboardFrames.map(
          (frame: any) =>
            manuscriptsService.withDrawingHistory(
              existingFrames.find((candidate) => candidate?.id === frame?.id),
              frame,
            ),
        );
      }
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = scene;
      } else {
        next.push(scene);
      }
      await manuscriptsService.replaceScenes(manuscriptId, next);
      res.status(existingIndex >= 0 ? 200 : 201).json(scene);
    } catch (error) {
      if ((error as Error)?.name === "CompatStoreUnavailableError") {
        // Databasen er nede: IKKE lat som suksess — klienten beholder
        // lokal backup og prøver igjen (autosynk).
        res.status(503).json({ error: "storage_unavailable" });
        return;
      }
      console.error("Error upserting scene:", error);
      res.status(500).json({ error: "Could not save scene" });
    }
  });

  // Slett én scene (iPad-appen; web sletter via egne flows).
  app.delete("/api/casting/scenes/:sceneId", async (req, res) => {
    try {
      const manuscriptId =
        typeof req.query.manuscriptId === "string" ? req.query.manuscriptId : "";
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (!(await ensureManuscriptOwner(req, res, manuscriptId))) return;
      const current = await manuscriptsService.getScenes(manuscriptId);
      const next = current.filter((scene) => scene?.id !== req.params.sceneId);
      if (next.length === current.length) {
        res.status(404).json({ error: "scene_not_found" });
        return;
      }
      await manuscriptsService.replaceScenes(manuscriptId, next);
      res.json({ ok: true });
    } catch (error) {
      if ((error as Error)?.name === "CompatStoreUnavailableError") {
        res.status(503).json({ error: "storage_unavailable" });
        return;
      }
      console.error("Error deleting scene:", error);
      res.status(500).json({ error: "Could not delete scene" });
    }
  });

  // Per-frame patch (iPad-appen): unngår hele-scene-POST per strøk-lagring
  // — payload er kun frame-feltene som endres.
  // ── Storyboard @mention-varsler (in-app-kilden for iPad + web) ──
  app.get("/api/casting/storyboard-mentions", async (req, res) => {
    try {
      if (!requireUserSession(req, res)) return;
      if (!pool) {
        res.json({ mentions: [] });
        return;
      }
      const name = typeof req.query.name === "string" ? req.query.name : "";
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const mentions = await listMentions(pool, name, req.query.unread === "1");
      res.json({ mentions });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/casting/storyboard-mentions/read", async (req, res) => {
    try {
      if (!requireUserSession(req, res)) return;
      if (!pool) {
        res.json({ updated: 0 });
        return;
      }
      const name = typeof req.body?.name === "string" ? req.body.name : "";
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const updated = await markMentionsRead(pool, name);
      res.json({ updated });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // APNs-token for Storyboard Studio (push når appen er lukket).
  app.post("/api/role-room/storyboard/device-token", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      if (!pool) {
        res.json({ ok: false, reason: "no_pool" });
        return;
      }
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!token) {
        res.status(400).json({ error: "token is required" });
        return;
      }
      await registerStoryboardDeviceToken(pool, session.userId, token, {
        deviceName: typeof req.body?.deviceName === "string" ? req.body.deviceName : undefined,
        appVersion: typeof req.body?.appVersion === "string" ? req.body.appVersion : undefined,
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/casting/frames", async (req, res) => {
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId =
        typeof payload.manuscriptId === "string" ? payload.manuscriptId : "";
      const sceneId = typeof payload.sceneId === "string" ? payload.sceneId : "";
      const frameId = typeof payload.frameId === "string" ? payload.frameId : "";
      const fields =
        payload.fields && typeof payload.fields === "object" ? payload.fields : null;
      if (!manuscriptId || !sceneId || !frameId || !fields) {
        res.status(400).json({
          error: "manuscriptId, sceneId, frameId and fields are required",
        });
        return;
      }
      if (!(await ensureManuscriptOwner(req, res, manuscriptId))) return;
      // @mention-varsling: snapshot kommentarene FØR patch for diff.
      let mentionBaseline: Array<Record<string, unknown>> | null = null;
      let mentionTeam: string | null = null;
      let mentionShot: string | undefined;
      if (pool && Array.isArray((fields as any).comments)) {
        try {
          const scenesBefore = await manuscriptsService.getScenes(manuscriptId);
          const sceneBefore = scenesBefore.find((s: any) => s?.id === sceneId) as any;
          const frameBefore = (sceneBefore?.storyboardFrames ?? []).find(
            (f: any) => f?.id === frameId,
          );
          mentionBaseline = Array.isArray(frameBefore?.comments)
            ? frameBefore.comments
            : [];
          mentionShot = frameBefore?.shotNumber;
          mentionTeam =
            typeof (scenesBefore[0] as any)?.hubTeam === "string"
              ? (scenesBefore[0] as any).hubTeam
              : null;
        } catch {
          mentionBaseline = null;
        }
      }
      const result = await manuscriptsService.patchFrame(
        manuscriptId,
        sceneId,
        frameId,
        fields,
      );
      if (pool && result && mentionBaseline) {
        let team: Array<{ name: string; email?: string }> = [];
        try {
          team = mentionTeam ? JSON.parse(mentionTeam) : [];
        } catch {
          team = [];
        }
        // Fire-and-forget — varslingsfeil skal aldri feile lagringen.
        void notifyStoryboardMentions(
          pool,
          { manuscriptId, sceneId, frameId, shotNumber: mentionShot },
          mentionBaseline,
          (fields as any).comments,
          team,
        );
      }
      if (!result) {
        res.status(404).json({ error: "frame_not_found" });
        return;
      }
      res.json(result);
    } catch (error) {
      if ((error as Error)?.name === "CompatStoreUnavailableError") {
        res.status(503).json({ error: "storage_unavailable" });
        return;
      }
      console.error("Error patching frame:", error);
      res.status(500).json({ error: "Could not patch frame" });
    }
  });

  // ── Dialogue ───────────────────────────────────────────────────────

  app.get("/api/casting/manuscripts/:manuscriptId/dialogue", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
      const dialogue = await manuscriptsService.getDialogue(
        req.params.manuscriptId,
      );
      res.json(dialogue);
    } catch (error) {
      console.error("Error listing dialogue:", error);
      res.status(500).json({ error: "Could not list dialogue" });
    }
  });

  app.post("/api/casting/dialogue", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }

      const current = await manuscriptsService.getDialogue(manuscriptId);
      const dialogueId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("dialogue");
      const existingIndex = current.findIndex((line) => line?.id === dialogueId);
      const existing = existingIndex >= 0 ? current[existingIndex] : null;
      const now = new Date().toISOString();
      const dialogueLine = {
        ...(existing || {}),
        ...payload,
        id: dialogueId,
        manuscriptId,
        manuscript_id: manuscriptId,
        createdAt: existing?.createdAt || payload.createdAt || now,
        updatedAt: now,
      };
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = dialogueLine;
      } else {
        next.push(dialogueLine);
      }
      await manuscriptsService.replaceDialogue(manuscriptId, next);
      res.status(existingIndex >= 0 ? 200 : 201).json(dialogueLine);
    } catch (error) {
      console.error("Error upserting dialogue:", error);
      res.status(500).json({ error: "Could not save dialogue" });
    }
  });

  app.delete("/api/casting/dialogue/:dialogueId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const dialogueId = req.params.dialogueId;
      const location =
        await manuscriptsService.findDialogueLocation(dialogueId);
      if (!location) {
        // Eksisterende oppførsel: 200 OK selv om id ikke finnes
        res.json({ ok: true });
        return;
      }
      const current = await manuscriptsService.getDialogue(location.manuscriptId);
      const next = current.filter((item) => item?.id !== dialogueId);
      await manuscriptsService.replaceDialogue(location.manuscriptId, next);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting dialogue:", error);
      res.status(500).json({ error: "Could not delete dialogue" });
    }
  });

  // ── Revisions ──────────────────────────────────────────────────────

  app.get(
    "/api/casting/manuscripts/:manuscriptId/revisions",
    async (req, res) => {
      try {
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
        const revisions = await manuscriptsService.getRevisions(
          req.params.manuscriptId,
        );
        res.json(revisions);
      } catch (error) {
        console.error("Error listing revisions:", error);
        res.status(500).json({ error: "Could not list revisions" });
      }
    },
  );

  app.post("/api/casting/revisions", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }

      const current = await manuscriptsService.getRevisions(manuscriptId);
      const revisionId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("revision");
      const existingIndex = current.findIndex(
        (revision) => revision?.id === revisionId,
      );
      const existing = existingIndex >= 0 ? current[existingIndex] : null;
      const now = new Date().toISOString();
      const revision = {
        ...(existing || {}),
        ...payload,
        id: revisionId,
        manuscriptId,
        manuscript_id: manuscriptId,
        createdAt: existing?.createdAt || payload.createdAt || now,
        updatedAt: now,
      };
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = revision;
      } else {
        next.push(revision);
      }
      await manuscriptsService.replaceRevisions(manuscriptId, next);
      res.status(existingIndex >= 0 ? 200 : 201).json(revision);
    } catch (error) {
      console.error("Error upserting revision:", error);
      res.status(500).json({ error: "Could not save revision" });
    }
  });

  // ── Revisions: diff/restore-API (F6) ──────────────────────────────
  //
  // 3 nye endpoints adresserer pain point fra screenplay-marked:
  // versjons-historikk + diff + restore er minimum-feature i Final Draft,
  // Fade In og WriterDuet men har ofte buggy implementasjon. Vi bruker
  // RFC 6902 JSON Patch som diff-format (standardisert, lett å rendre
  // i frontend).

  app.get(
    "/api/casting/manuscripts/:manuscriptId/revisions/:revisionId",
    async (req, res) => {
      try {
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
        const revision = await revisionsService.getRevisionById(
          req.params.manuscriptId,
          req.params.revisionId,
        );
        if (!revision) {
          res.status(404).json({ error: "Revision not found" });
          return;
        }
        res.json(revision);
      } catch (error) {
        console.error("Error fetching revision:", error);
        res.status(500).json({ error: "Could not fetch revision" });
      }
    },
  );

  app.get(
    "/api/casting/manuscripts/:manuscriptId/revisions/diff",
    async (req, res) => {
      try {
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
        const fromId =
          typeof req.query.from === "string" ? req.query.from.trim() : "";
        const toId =
          typeof req.query.to === "string" ? req.query.to.trim() : "";
        if (!fromId || !toId) {
          res
            .status(400)
            .json({ error: "Query params 'from' og 'to' er påkrevd." });
          return;
        }
        const diff = await revisionsService.diffRevisions(
          req.params.manuscriptId,
          fromId,
          toId,
        );
        if (!diff) {
          res
            .status(404)
            .json({ error: "En eller begge revisjoner finnes ikke." });
          return;
        }
        res.json(diff);
      } catch (error) {
        console.error("Error diffing revisions:", error);
        res.status(500).json({ error: "Could not compute diff" });
      }
    },
  );

  app.post(
    "/api/casting/manuscripts/:manuscriptId/restore-revision/:revisionId",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const result = await revisionsService.restoreRevision(
          req.params.manuscriptId,
          req.params.revisionId,
        );
        if (!result) {
          res.status(404).json({
            error: "Kilde-revisjonen finnes ikke (eller manuscript-en mangler).",
          });
          return;
        }
        setEtagHeader(res, result.manuscript);
        res.json({
          success: true,
          markerRevisionId: result.markerRevisionId,
          manuscript: result.manuscript,
        });
      } catch (error) {
        console.error("Error restoring revision:", error);
        res.status(500).json({ error: "Could not restore revision" });
      }
    },
  );

  // ── Screenplay format import/export (F7) ──────────────────────────
  //
  // Adresserer pain point fra screenplay-marked: ingen interop mellom
  // Final Draft (FDX), Highland/WriterDuet (Fountain) og våre interne
  // entiteter. To nye endpoints — begge stateless (parsing/emitting i
  // module, ingen direkte oppdatering av manuscripts-service).
  //
  // Klienten kan kalle import, motta ParsedScreenplay, og selv beslutte
  // om/hvordan å persistere via eksisterende /scenes + /dialogue-endpoints.

  app.post(
    "/api/casting/manuscripts/:manuscriptId/import",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const contentType =
          (req.headers["content-type"] ?? "").toString().toLowerCase();
        const rawBody =
          typeof req.body === "string"
            ? req.body
            : req.body && typeof req.body === "object" && "text" in req.body
              ? String((req.body as Record<string, unknown>).text ?? "")
              : "";

        if (!rawBody.trim()) {
          res.status(400).json({
            error:
              "Tom payload. Send body som rå tekst (text/vnd.fountain eller application/xml) eller JSON med 'text'-felt.",
          });
          return;
        }

        let parsed: ParsedScreenplay;
        if (contentType.includes("xml") || rawBody.trim().startsWith("<")) {
          parsed = parseFdx(rawBody);
        } else {
          parsed = parseFountain(rawBody);
        }

        res.json({
          manuscriptId: req.params.manuscriptId,
          format: contentType.includes("xml") ? "fdx" : "fountain",
          parsed,
          scenesCount: parsed.scenes.length,
          dialogueCount: parsed.scenes.reduce(
            (sum, scene) => sum + scene.dialogue.length,
            0,
          ),
          notice:
            "Endpoint er stateless — klient er ansvarlig for å lagre via /scenes og /dialogue ved behov.",
        });
      } catch (error) {
        console.error("Error importing screenplay:", error);
        res.status(500).json({ error: "Could not parse screenplay input" });
      }
    },
  );

  app.get(
    "/api/casting/manuscripts/:manuscriptId/export",
    async (req, res) => {
      try {
        // Eierskap-vakt (som søsken-lese-endepunkter :299/:513/:567) — uten den kunne
        // hvem som helst med en manuscriptId laste ned et annet kundes manus (IDOR).
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
        const format =
          typeof req.query.format === "string"
            ? req.query.format.toLowerCase()
            : "fountain";
        if (format !== "fountain" && format !== "fdx") {
          res.status(400).json({
            error: "format må være 'fountain' eller 'fdx'",
          });
          return;
        }

        // Hent state fra service-laget og bygg ParsedScreenplay
        const manuscriptId = req.params.manuscriptId;
        const manuscript = await manuscriptsService.getManuscript(manuscriptId);
        const scenes = await manuscriptsService.getScenes(manuscriptId);
        const dialogue = await manuscriptsService.getDialogue(manuscriptId);

        // Klienter lagrer scenes som flate entiteter. For roundtrip-eksport
        // grupperes dialog i scenes når payload har sceneId-link; ellers
        // bundles alt under en default-scene basert på første scene-heading.
        const parsedSceneMap = new Map<string, {
          heading: string;
          action: string[];
          dialogue: ParsedScreenplay["scenes"][number]["dialogue"];
        }>();

        for (const scene of scenes) {
          const id = typeof scene.id === "string" ? scene.id : "unknown";
          parsedSceneMap.set(id, {
            heading:
              typeof scene.heading === "string" && scene.heading
                ? scene.heading
                : typeof scene.title === "string"
                  ? scene.title
                  : id,
            action: Array.isArray(scene.action)
              ? (scene.action as string[])
              : typeof scene.action === "string"
                ? [scene.action]
                : [],
            dialogue: [],
          });
        }

        for (const line of dialogue) {
          const sceneId =
            typeof line.sceneId === "string"
              ? line.sceneId
              : typeof line.scene_id === "string"
                ? line.scene_id
                : null;
          const character =
            typeof line.character === "string" ? line.character : "UNKNOWN";
          const text = typeof line.text === "string" ? line.text : "";
          const parenthetical =
            typeof line.parenthetical === "string" && line.parenthetical
              ? line.parenthetical
              : undefined;
          const dlg = { character, text, parenthetical };
          if (sceneId && parsedSceneMap.has(sceneId)) {
            parsedSceneMap.get(sceneId)!.dialogue.push(dlg);
          } else {
            // Ingen scene-link: opprett (eller bruk) en standardscene.
            const fallbackKey = "__unlinked__";
            if (!parsedSceneMap.has(fallbackKey)) {
              parsedSceneMap.set(fallbackKey, {
                heading: "UNTITLED",
                action: [],
                dialogue: [],
              });
            }
            parsedSceneMap.get(fallbackKey)!.dialogue.push(dlg);
          }
        }

        const screenplay: ParsedScreenplay = {
          title:
            (manuscript && typeof manuscript.title === "string"
              ? manuscript.title
              : undefined) ?? undefined,
          author:
            (manuscript && typeof manuscript.author === "string"
              ? manuscript.author
              : undefined) ?? undefined,
          scenes: Array.from(parsedSceneMap.values()),
        };

        if (format === "fdx") {
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.send(exportFdx(screenplay));
        } else {
          res.setHeader("Content-Type", "text/vnd.fountain; charset=utf-8");
          res.send(exportFountain(screenplay));
        }
      } catch (error) {
        console.error("Error exporting screenplay:", error);
        res.status(500).json({ error: "Could not export screenplay" });
      }
    },
  );

  // ── Acts ───────────────────────────────────────────────────────────

  app.get("/api/casting/manuscripts/:manuscriptId/acts", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId))) return;
      const acts = await manuscriptsService.getActs(req.params.manuscriptId);
      res.json(acts);
    } catch (error) {
      console.error("Error listing acts:", error);
      res.status(500).json({ error: "Could not list acts" });
    }
  });

  app.post("/api/casting/acts", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }

      const current = await manuscriptsService.getActs(manuscriptId);
      const actId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("act");
      const existingIndex = current.findIndex((act) => act?.id === actId);
      const existing = existingIndex >= 0 ? current[existingIndex] : null;
      const now = new Date().toISOString();
      const act = {
        ...(existing || {}),
        ...payload,
        id: actId,
        manuscriptId,
        manuscript_id: manuscriptId,
        createdAt: existing?.createdAt || payload.createdAt || now,
        updatedAt: now,
      };
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = act;
      } else {
        next.push(act);
      }
      await manuscriptsService.replaceActs(manuscriptId, next);
      res.status(existingIndex >= 0 ? 200 : 201).json(act);
    } catch (error) {
      console.error("Error upserting act:", error);
      res.status(500).json({ error: "Could not save act" });
    }
  });

  app.get("/api/casting/acts/:actId", async (req, res) => {
    try {
      const actId = req.params.actId;
      const location = await manuscriptsService.findActLocation(actId);
      if (!location) {
        res.json(null);
        return;
      }
      if (!(await ensureManuscriptOwner(req, res, location.manuscriptId))) return;
      const acts = await manuscriptsService.getActs(location.manuscriptId);
      res.json(acts[location.index] || null);
    } catch (error) {
      console.error("Error fetching act:", error);
      res.status(500).json({ error: "Could not fetch act" });
    }
  });

  app.put("/api/casting/acts/:actId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const actId = req.params.actId;
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const location = await manuscriptsService.findActLocation(actId);
      const manuscriptIdFromPayload = readManuscriptId(payload);
      const manuscriptId = location?.manuscriptId || manuscriptIdFromPayload;
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }

      const acts = await manuscriptsService.getActs(manuscriptId);
      const existingIndex = location
        ? location.index
        : acts.findIndex((act) => act?.id === actId);
      const existing = existingIndex >= 0 ? acts[existingIndex] : null;
      const now = new Date().toISOString();
      const act = {
        ...(existing || {}),
        ...payload,
        id: actId,
        manuscriptId,
        manuscript_id: manuscriptId,
        createdAt: existing?.createdAt || payload.createdAt || now,
        updatedAt: now,
      };
      const next = [...acts];
      if (existingIndex >= 0) {
        next[existingIndex] = act;
      } else {
        next.push(act);
      }
      await manuscriptsService.replaceActs(manuscriptId, next);
      res.json(act);
    } catch (error) {
      console.error("Error updating act:", error);
      res.status(500).json({ error: "Could not update act" });
    }
  });

  app.delete("/api/casting/acts/:actId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const actId = req.params.actId;
      const location = await manuscriptsService.findActLocation(actId);
      if (!location) {
        res.json({ ok: true });
        return;
      }
      const acts = await manuscriptsService.getActs(location.manuscriptId);
      const next = acts.filter((act) => act?.id !== actId);
      await manuscriptsService.replaceActs(location.manuscriptId, next);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting act:", error);
      res.status(500).json({ error: "Could not delete act" });
    }
  });
}
