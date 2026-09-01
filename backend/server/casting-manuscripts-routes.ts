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
 * Tilgang: autentisert og prosjektavgrenset. Alle manuscript- og
 * subressursruter verifiserer at sesjonen kan åpne manuscriptets prosjekt
 * før data leses eller muteres.
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
  normalizeShotFramingState,
  shotFramingFingerprint,
} from "../../frontend/shared/storyboard-shot-framing.js";

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
import {
  userOwnsCastingProjectViaStore,
} from "./casting-project-ownership.js";
import { viewerMeetsTabLevel } from "./role-room-tab-access.js";
import {
  mirrorManuscriptToProductionTables,
  mirrorSceneToProductionTables,
  NormalizedManuscriptIdentityConflictError,
  NormalizedSceneIdentityConflictError,
} from "./casting-production-data-mirror.js";
import {
  enforceFramePatchAIStaleAuthority,
  importedRasterMirror,
  nativeFrameSourceChangeReason,
  preserveAbsentShotFraming,
  preserveCameraMotionEnvelope,
  type NativeFrameSourceChangeReason,
} from "./storyboard-frame-compat.js";
import {
  CAMERA_MOTION_ENVELOPE_FIELDS,
  cameraMotionFramingFingerprintFromFrameV1,
  cameraMotionShotDurationFromFrameV1,
  cameraMotionWriteHTTPStatus,
  revalidateCameraMotionDependencyV1,
} from "./storyboard-camera-motion.js";
import {
  storyboardPaintoverStateForFrame,
} from "./storyboard-paintover-contract.js";
import {
  frameDurationWriteHTTPStatus,
  reconcileLegacyFrameDurationWriteV1,
  storyboardMediaTimesEqualV1,
  type ReconcileLegacyFrameDurationResultV1,
} from "./storyboard-shot-duration.js";

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
interface PresenceEntry {
  userId: string;
  displayName: string;
  lastSeenMs: number;
}
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
  const active: Array<{
    userId: string;
    displayName: string;
    lastSeenAt: string;
  }> = [];
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
  const {
    app,
    requireUserSession,
    compatStoreGet,
    manuscriptsService,
    revisionsService,
    pool,
  } = deps;

  async function canAccessProject(
    projectId: string | null | undefined,
    userId: string | null | undefined,
    need: "view" | "manage" = "view",
  ): Promise<boolean> {
    if (!projectId || !userId) return false;
    if (pool) {
      try {
        const canonical = await pool.query<{ can_access: boolean }>(
          `SELECT (
             cp.created_by = $2
             OR EXISTS (
               SELECT 1
                 FROM casting_user_roles cur
                WHERE cur.project_id = cp.id
                  AND cur.user_id = $2
                  AND cur.deactivated_at IS NULL
                  AND (cur.expires_at IS NULL OR cur.expires_at > NOW())
             )
           ) AS can_access
             FROM casting_projects cp
            WHERE cp.id = $1
            LIMIT 1`,
          [projectId, userId],
        );
        // A canonical project is authoritative. A removed or expired member
        // must not regain access through stale compat-store membership.
        if (canonical.rows[0]) {
          if (canonical.rows[0].can_access !== true) return false;
          return viewerMeetsTabLevel(
            pool,
            projectId,
            userId,
            "storyboard",
            need,
          );
        }
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code ?? "")
            : "";
        if (code !== "42P01" && code !== "42703") return false;
        // Legacy-only installs may not have the canonical membership columns.
        // The owner-only compat check below remains fail-closed for members.
      }
    }
    return userOwnsCastingProjectViaStore(compatStoreGet, projectId, userId);
  }

  // Manuscript content (full screenplay text, dialogue, revisions) is
  // tenant-private. These read endpoints were unauthenticated — anyone who
  // knew/guessed a manuscriptId could read another production's script. Gate
  // on a session AND ownership of the manuscript's project.
  async function readProjectIdOfManuscript(
    manuscriptId: string,
  ): Promise<string | null> {
    const m = (await manuscriptsService.getManuscript(manuscriptId)) as Record<
      string,
      unknown
    > | null;
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
    need: "view" | "manage" = "view",
  ): Promise<boolean> {
    const session = requireUserSession(req, res);
    if (!session) return false;
    return ensureManuscriptAccess(res, manuscriptId, session.userId, need);
  }

  async function ensureManuscriptAccess(
    res: any,
    manuscriptId: string,
    userId: string | null | undefined,
    need: "view" | "manage" = "view",
  ): Promise<boolean> {
    const projectId = await readProjectIdOfManuscript(manuscriptId);
    if (!projectId || !(await canAccessProject(projectId, userId, need))) {
      res.status(404).json({ error: "not_found" });
      return false;
    }
    return true;
  }

  async function normalizedManuscriptIdentityMatches(
    manuscriptId: string,
    projectId: string,
  ): Promise<boolean> {
    if (!pool) return true;
    const normalized = await pool.query<{ project_id: string }>(
      `SELECT project_id
         FROM casting_manuscripts
        WHERE id = $1
        LIMIT 1`,
      [manuscriptId],
    );
    return !normalized.rows[0] || normalized.rows[0].project_id === projectId;
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
      if (!(await canAccessProject(projectId, session.userId))) {
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
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("manuscript");
      const now = new Date().toISOString();
      const existing =
        (await manuscriptsService.getManuscript(manuscriptId)) || {};
      // POST is create-only. Client-generated UUIDs are supported for offline
      // sync, but an existing id must never be adopted into another project.
      if (Object.keys(existing).length > 0) {
        const existingProjectId = readProjectId(existing, "");
        if (
          !existingProjectId ||
          !(await canAccessProject(existingProjectId, session.userId))
        ) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        res.status(409).json({ error: "manuscript_already_exists" });
        return;
      }
      const projectId = readProjectId(
        payload,
        "default-project",
      );
      if (
        !projectId ||
        !(await canAccessProject(projectId, session.userId, "manage"))
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (
        !(await normalizedManuscriptIdentityMatches(manuscriptId, projectId))
      ) {
        res.status(409).json({ error: "manuscript_identity_conflict" });
        return;
      }
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
      if (pool) await mirrorManuscriptToProductionTables(pool, stored);
      setEtagHeader(res, stored);
      res.status(201).json(stored);
    } catch (error) {
      if (error instanceof NormalizedManuscriptIdentityConflictError) {
        res.status(409).json({ error: "manuscript_identity_conflict" });
        return;
      }
      console.error("Error creating manuscript:", error);
      res.status(500).json({ error: "Could not create manuscript" });
    }
  });

  app.get("/api/casting/manuscripts/:manuscriptId", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
        return;
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
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;
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
      if (projectId !== readProjectId(existing, "")) {
        res.status(409).json({
          error: "project_reassignment_requires_dedicated_operation",
        });
        return;
      }
      if (
        !(await normalizedManuscriptIdentityMatches(manuscriptId, projectId))
      ) {
        res.status(409).json({ error: "manuscript_identity_conflict" });
        return;
      }
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
      if (pool) await mirrorManuscriptToProductionTables(pool, stored);
      setEtagHeader(res, stored);
      res.json(stored);
    } catch (error) {
      if (error instanceof NormalizedManuscriptIdentityConflictError) {
        res.status(409).json({ error: "manuscript_identity_conflict" });
        return;
      }
      console.error("Error updating manuscript:", error);
      res.status(500).json({ error: "Could not update manuscript" });
    }
  });

  app.delete("/api/casting/manuscripts/:manuscriptId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const manuscriptId = req.params.manuscriptId;
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;
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
      if (
        !(await ensureManuscriptAccess(
          res,
          req.params.manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
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

  app.post(
    "/api/casting/manuscripts/:manuscriptId/lock/heartbeat",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        if (
          !(await ensureManuscriptAccess(
            res,
            req.params.manuscriptId,
            session.userId,
            "manage",
          ))
        )
          return;
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
    },
  );

  app.delete(
    "/api/casting/manuscripts/:manuscriptId/lock",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        if (
          !(await ensureManuscriptAccess(
            res,
            req.params.manuscriptId,
            session.userId,
            "manage",
          ))
        )
          return;
        const result = await manuscriptsService.releaseLock(
          req.params.manuscriptId,
          session.userId,
        );
        res.json({ released: result.released, lock: result.lock });
      } catch (error) {
        console.error("Error releasing manuscript lock:", error);
        res.status(500).json({ error: "Could not release lock" });
      }
    },
  );

  app.get("/api/casting/manuscripts/:manuscriptId/lock", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      if (
        !(await ensureManuscriptAccess(
          res,
          req.params.manuscriptId,
          session.userId,
        ))
      )
        return;
      const lock = await manuscriptsService.getLock(req.params.manuscriptId);
      res.json({ lock });
    } catch (error) {
      console.error("Error reading manuscript lock:", error);
      res.status(500).json({ error: "Could not read lock" });
    }
  });

  // ── Presence (hvem har manuset åpent nå) ───────────────────────────

  app.post(
    "/api/casting/manuscripts/:manuscriptId/presence",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        if (
          !(await ensureManuscriptAccess(
            res,
            req.params.manuscriptId,
            session.userId,
          ))
        )
          return;
        const body =
          req.body && typeof req.body === "object"
            ? (req.body as Record<string, unknown>)
            : {};
        const displayName =
          typeof body.displayName === "string" && body.displayName.trim()
            ? body.displayName.trim()
            : session.userId;
        const nowMs = Date.now();
        recordManuscriptPresence(
          req.params.manuscriptId,
          session.userId,
          displayName,
          nowMs,
        );
        // Returner alle andre aktive (ekskluder seg selv) så klienten slipper ekstra GET.
        const others = listManuscriptPresence(
          req.params.manuscriptId,
          nowMs,
        ).filter((p) => p.userId !== session.userId);
        res.json({ presence: others });
      } catch (error) {
        console.error("Error recording manuscript presence:", error);
        res.status(500).json({ error: "Could not record presence" });
      }
    },
  );

  app.get(
    "/api/casting/manuscripts/:manuscriptId/presence",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        if (
          !(await ensureManuscriptAccess(
            res,
            req.params.manuscriptId,
            session.userId,
          ))
        )
          return;
        const others = listManuscriptPresence(
          req.params.manuscriptId,
          Date.now(),
        ).filter((p) => p.userId !== session.userId);
        res.json({ presence: others });
      } catch (error) {
        console.error("Error listing manuscript presence:", error);
        res.status(500).json({ error: "Could not list presence" });
      }
    },
  );

  // ── Scenes ─────────────────────────────────────────────────────────

  app.get("/api/casting/manuscripts/:manuscriptId/scenes", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
        return;
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
      const scenes = await manuscriptsService.getScenes(
        req.params.manuscriptId,
      );
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
      if (!(await ensureManuscriptOwner(req, res, manuscriptId, "manage")))
        return;

      const manuscript = await manuscriptsService.getManuscript(manuscriptId);
      const projectId = readProjectId(manuscript, "");
      if (!projectId) {
        res.status(400).json({ error: "projectId is required" });
        return;
      }
      const submittedProjectId = readProjectId(payload, "");
      if (submittedProjectId && submittedProjectId !== projectId) {
        res.status(409).json({ error: "scene_project_mismatch" });
        return;
      }

      const sceneId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("scene");
      if (pool) {
        const normalizedIdentity = await pool.query<{
          project_id: string;
          manuscript_id: string | null;
        }>(
          `SELECT project_id, manuscript_id
             FROM casting_scenes
            WHERE id = $1
            LIMIT 1`,
          [sceneId],
        );
        const existingIdentity = normalizedIdentity.rows[0];
        if (
          existingIdentity &&
          (existingIdentity.project_id !== projectId ||
            existingIdentity.manuscript_id !== manuscriptId)
        ) {
          res.status(409).json({ error: "scene_identity_conflict" });
          return;
        }
      }
      let durationFailure:
        | Extract<ReconcileLegacyFrameDurationResultV1, { ok: false }>
        | undefined;
      const mutation = await manuscriptsService.mutateScenes(
        manuscriptId,
        (current) => {
          const existingIndex = current.findIndex(
            (scene) => scene?.id === sceneId,
          );
          const existing = existingIndex >= 0 ? current[existingIndex] : null;
          const now = new Date().toISOString();
          const scene = {
            ...(existing || {}),
            ...payload,
            id: sceneId,
            projectId,
            project_id: projectId,
            manuscriptId,
            manuscript_id: manuscriptId,
            createdAt: existing?.createdAt || payload.createdAt || now,
            updatedAt: now,
          } as Record<string, unknown>;
          // Read, history merge and replacement all happen while holding the
          // same cross-worker compat-store lock as per-frame PATCH.
          const existingFrames: any[] = Array.isArray(
            (existing as any)?.storyboardFrames,
          )
            ? (existing as any).storyboardFrames
            : [];
          const sourceChangeReasons = new Map<
            string,
            NativeFrameSourceChangeReason
          >();
          if (Array.isArray((scene as any).storyboardFrames)) {
            (scene as any).storyboardFrames = (
              scene as any
            ).storyboardFrames.map((frame: any) => {
              if (durationFailure) {
                return (
                  existingFrames.find((item) => item?.id === frame?.id) ?? frame
                );
              }
              const existingFrame = existingFrames.find(
                (candidate) => candidate?.id === frame?.id,
              );
              const sourceChangeReason: NativeFrameSourceChangeReason | null =
                typeof frame?.id !== "string"
                  ? null
                  : !existingFrame
                    ? "source-document-changed"
                    : nativeFrameSourceChangeReason(existingFrame, frame);
              const sourceChanged = sourceChangeReason !== null;
              if (sourceChangeReason) {
                sourceChangeReasons.set(frame.id, sourceChangeReason);
              }
              const framingProtected = preserveAbsentShotFraming(
                existingFrame,
                frame,
              ) as Record<string, unknown>;
              const motionProtected = preserveCameraMotionEnvelope(
                existingFrame,
                framingProtected,
              ) as Record<string, unknown>;
              const durationProtected = reconcileLegacyFrameDurationWriteV1(
                existingFrame,
                motionProtected,
              );
              if (!durationProtected.ok) {
                durationFailure = durationProtected;
                return existingFrame ?? frame;
              }
              let protectedFrame = durationProtected.frame;
              const framingChanged =
                Boolean(existingFrame) &&
                cameraMotionFramingFingerprintFromFrameV1(existingFrame) !==
                  cameraMotionFramingFingerprintFromFrameV1(protectedFrame);
              const previousDuration = existingFrame
                ? cameraMotionShotDurationFromFrameV1(existingFrame)
                : null;
              const nextDuration = existingFrame
                ? cameraMotionShotDurationFromFrameV1(protectedFrame)
                : null;
              const durationChanged =
                Boolean(existingFrame) &&
                (previousDuration === null || nextDuration === null
                  ? previousDuration !== nextDuration
                  : !storyboardMediaTimesEqualV1(
                      previousDuration,
                      nextDuration,
                    ));
              const motionDependencyReason = framingChanged
                ? "framing"
                : durationChanged
                  ? "duration"
                  : null;
              if (motionDependencyReason) {
                const motionPatch = revalidateCameraMotionDependencyV1(
                  existingFrame,
                  protectedFrame,
                  motionDependencyReason,
                  now,
                );
                if (Object.keys(motionPatch).length > 0) {
                  const effectiveFrame = { ...protectedFrame, ...motionPatch };
                  const aiPaintoverState = storyboardPaintoverStateForFrame(
                    existingFrame.aiPaintoverState,
                    { colorChanged: false, atmosphereChanged: false },
                    effectiveFrame,
                  );
                  aiPaintoverState.videoStale = true;
                  protectedFrame = {
                    ...effectiveFrame,
                    aiPaintoverState,
                  };
                }
              }
              const sourceUpdatedAt = sourceChanged
                ? now
                : typeof existingFrame?.sourceUpdatedAt === "string"
                  ? existingFrame.sourceUpdatedAt
                  : typeof existingFrame?.updatedAt === "string"
                    ? existingFrame.updatedAt
                    : now;
              return manuscriptsService.withDrawingHistory(
                existingFrame,
                sourceChanged
                  ? { ...protectedFrame, updatedAt: now, sourceUpdatedAt }
                  : { ...protectedFrame, sourceUpdatedAt },
              );
            });
          }
          if (durationFailure) {
            return { result: null };
          }
          const next = [...current];
          if (existingIndex >= 0) next[existingIndex] = scene;
          else next.push(scene);
          return {
            scenes: next,
            result: {
              scene,
              existingIndex,
              frameSnapshots: ((scene as any).storyboardFrames ?? [])
                .filter((frame: any) => typeof frame?.id === "string")
                .map((frame: any) => ({
                  id: frame.id as string,
                  updatedAt:
                    typeof frame.updatedAt === "string" ? frame.updatedAt : now,
                  sourceUpdatedAt:
                    typeof frame.sourceUpdatedAt === "string"
                      ? frame.sourceUpdatedAt
                      : now,
                  sourceChanged: sourceChangeReasons.has(frame.id),
                  sourceChangeReason: sourceChangeReasons.get(frame.id) ?? null,
                })),
            },
          };
        },
      );
      if (durationFailure) {
        res.status(frameDurationWriteHTTPStatus(durationFailure.error)).json({
          error: durationFailure.error,
          ...(durationFailure.currentShotDuration
            ? { currentShotDuration: durationFailure.currentShotDuration }
            : {}),
          ...(durationFailure.currentDurationRevision !== undefined
            ? {
                currentDurationRevision:
                  durationFailure.currentDurationRevision,
              }
            : {}),
        });
        return;
      }
      if (!mutation) throw new Error("scene_duration_guard_failed");
      const { scene, existingIndex, frameSnapshots } = mutation;
      if (pool) {
        await mirrorSceneToProductionTables(pool, scene, projectId);
        // Legacy whole-scene writers cannot be trusted with AI approval
        // authority. Mirror source edits into the normalized storyboard row
        // so animation/generation gates see the same stale state as iPad.
        for (const snapshot of frameSnapshots) {
          const frameId = snapshot.id;
          const storedFrame = ((scene as any).storyboardFrames ?? []).find(
            (frame: any) => frame?.id === frameId,
          );
          const normalizedFraming = normalizeShotFramingState(
            storedFrame?.shotFraming,
          );
          const metadataPatch: Record<string, unknown> = {
            compatFrameUpdatedAt: snapshot.updatedAt,
            compatSourceUpdatedAt: snapshot.sourceUpdatedAt,
          };
          if (
            storedFrame?.aiPaintoverState &&
            typeof storedFrame.aiPaintoverState === "object" &&
            !Array.isArray(storedFrame.aiPaintoverState)
          ) {
            metadataPatch.aiPaintoverState = storedFrame.aiPaintoverState;
          }
          for (const key of CAMERA_MOTION_ENVELOPE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(storedFrame ?? {}, key)) {
              metadataPatch[key] = storedFrame[key];
            }
          }
          if (normalizedFraming) {
            metadataPatch.currentFramingFingerprint =
              shotFramingFingerprint(normalizedFraming);
          }
          await pool.query(
            `UPDATE casting_storyboards
                SET metadata = COALESCE(metadata, '{}'::jsonb)
                    || $3::jsonb
                    || CASE
                      WHEN $4::boolean
                        OR COALESCE(metadata->>'compatSourceUpdatedAt','') <> $5::text
                      THEN jsonb_build_object(
                        'aiOutputStale',true,
                        'aiOutputStaleReason',$6::text,
                        'sourceRevision',
                        (CASE
                          WHEN COALESCE(metadata->>'sourceRevision', '') ~ '^[0-9]+$'
                            THEN (metadata->>'sourceRevision')::int
                          ELSE 0
                        END) + 1
                      )
                      ELSE '{}'::jsonb
                    END,
                    updated_at = NOW()
              WHERE project_id=$1 AND frame_id=$2`,
            [
              projectId,
              frameId,
              JSON.stringify(metadataPatch),
              snapshot.sourceChanged,
              snapshot.sourceUpdatedAt,
              snapshot.sourceChangeReason ?? "source-document-changed",
            ],
          );
        }
      }
      res.status(existingIndex >= 0 ? 200 : 201).json(scene);
    } catch (error) {
      if (error instanceof NormalizedSceneIdentityConflictError) {
        res.status(409).json({ error: "scene_identity_conflict" });
        return;
      }
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
        typeof req.query.manuscriptId === "string"
          ? req.query.manuscriptId
          : "";
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (!(await ensureManuscriptOwner(req, res, manuscriptId, "manage")))
        return;
      const deleted = await manuscriptsService.mutateScenes(
        manuscriptId,
        (current) => {
          const next = current.filter(
            (scene) => scene?.id !== req.params.sceneId,
          );
          return next.length === current.length
            ? { result: false }
            : { scenes: next, result: true };
        },
      );
      if (!deleted) {
        res.status(404).json({ error: "scene_not_found" });
        return;
      }
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

  function cameraMotionSidecarPatch(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of CAMERA_MOTION_ENVELOPE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        patch[key] = source[key];
      }
    }
    return patch;
  }

  const cameraMotionServerOwnedKeys = CAMERA_MOTION_ENVELOPE_FIELDS.filter(
    (key) => key !== "cameraMotionTrack",
  );

  async function sendFrameCameraMotionPatch(
    req: any,
    res: any,
    identifiers: {
      manuscriptId: string;
      sceneId: string;
      frameId: string;
    },
    write: Record<string, unknown>,
  ): Promise<void> {
    const { manuscriptId, sceneId, frameId } = identifiers;
    if (!manuscriptId || !sceneId || !frameId) {
      res.status(400).json({
        error: "manuscriptId, sceneId and frameId are required",
      });
      return;
    }
    if (!(await ensureManuscriptOwner(req, res, manuscriptId, "manage")))
      return;
    const result = await manuscriptsService.patchFrameCameraMotion(
      manuscriptId,
      sceneId,
      frameId,
      write,
    );
    if (!result) {
      res.status(404).json({ error: "frame_not_found" });
      return;
    }
    if (!result.ok) {
      const status = cameraMotionWriteHTTPStatus(result.error);
      if (status === 409) {
        res.status(status).json({
          error: result.error,
          currentCameraMotionTrack: result.currentCameraMotionTrack,
          currentCameraMotionRevision: result.currentCameraMotionRevision,
          currentCameraMotionUpdatedAt: result.currentCameraMotionUpdatedAt,
          currentCameraMotionFingerprint:
            result.currentCameraMotionFingerprint,
          currentCameraMotionBaseFramingFingerprint:
            result.currentCameraMotionBaseFramingFingerprint,
          currentCameraMotionStatus: result.currentCameraMotionStatus,
        });
      } else {
        res.status(status).json({ error: result.error });
      }
      return;
    }
    if (pool) {
      const projectId = await readProjectIdOfManuscript(manuscriptId);
      if (projectId) {
        const metadataPatch: Record<string, unknown> = {
          ...cameraMotionSidecarPatch(result),
          compatFrameUpdatedAt: result.updatedAt,
        };
        if (result.sourceUpdatedAt) {
          metadataPatch.compatSourceUpdatedAt = result.sourceUpdatedAt;
        }
        if (result.aiPaintoverState) {
          metadataPatch.aiPaintoverState = result.aiPaintoverState;
        }
        await pool.query(
          `UPDATE casting_storyboards
              SET metadata=COALESCE(metadata,'{}'::jsonb) || $3::jsonb,
                  updated_at=NOW()
            WHERE project_id=$1 AND frame_id=$2`,
          [projectId, frameId, JSON.stringify(metadataPatch)],
        );
      }
    }
    res.json({
      cameraMotionTrack: result.cameraMotionTrack,
      cameraMotionRevision: result.cameraMotionRevision,
      cameraMotionUpdatedAt: result.cameraMotionUpdatedAt,
      cameraMotionFingerprint: result.cameraMotionFingerprint,
      cameraMotionBaseFramingFingerprint:
        result.cameraMotionBaseFramingFingerprint,
      cameraMotionStatus: result.cameraMotionStatus,
      changed: result.changed,
      updatedAt: result.updatedAt,
      ...(result.sourceUpdatedAt
        ? { sourceUpdatedAt: result.sourceUpdatedAt }
        : {}),
      ...(result.aiPaintoverState
        ? { aiPaintoverState: result.aiPaintoverState }
        : {}),
    });
  }

  app.patch("/api/casting/frames/camera-motion", async (req, res) => {
    try {
      const payload =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      if (
        cameraMotionServerOwnedKeys.some((key) =>
          Object.prototype.hasOwnProperty.call(payload, key),
        )
      ) {
        res.status(400).json({ error: "camera_motion_revision_server_owned" });
        return;
      }
      await sendFrameCameraMotionPatch(
        req,
        res,
        {
          manuscriptId:
            typeof payload.manuscriptId === "string"
              ? payload.manuscriptId
              : "",
          sceneId: typeof payload.sceneId === "string" ? payload.sceneId : "",
          frameId: typeof payload.frameId === "string" ? payload.frameId : "",
        },
        {
          ...(Object.prototype.hasOwnProperty.call(payload, "cameraMotionTrack")
            ? { cameraMotionTrack: payload.cameraMotionTrack }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(
            payload,
            "expectedMotionRevision",
          )
            ? { expectedMotionRevision: payload.expectedMotionRevision }
            : {}),
        },
      );
    } catch (error) {
      if ((error as Error)?.name === "CompatStoreUnavailableError") {
        res.status(503).json({ error: "storage_unavailable" });
        return;
      }
      console.error("Error patching frame camera motion:", error);
      res.status(500).json({ error: "Could not patch frame camera motion" });
    }
  });

  const durationWriteKeys = [
    "shotDuration",
    "duration",
    "durationSec",
    "expectedDurationRevision",
  ] as const;

  function pickDurationWrite(
    fields: Record<string, unknown>,
    envelope: Record<string, unknown> = fields,
  ): Record<string, unknown> {
    const write: Record<string, unknown> = {};
    for (const key of ["shotDuration", "duration", "durationSec"] as const) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        write[key] = fields[key];
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, "expectedDurationRevision")
    ) {
      write.expectedDurationRevision = fields.expectedDurationRevision;
    } else if (
      Object.prototype.hasOwnProperty.call(envelope, "expectedDurationRevision")
    ) {
      write.expectedDurationRevision = envelope.expectedDurationRevision;
    }
    return write;
  }

  async function sendFrameDurationPatch(
    req: any,
    res: any,
    identifiers: {
      manuscriptId: string;
      sceneId: string;
      frameId: string;
    },
    write: Record<string, unknown>,
  ): Promise<void> {
    const { manuscriptId, sceneId, frameId } = identifiers;
    if (!manuscriptId || !sceneId || !frameId) {
      res.status(400).json({
        error: "manuscriptId, sceneId and frameId are required",
      });
      return;
    }
    if (!(await ensureManuscriptOwner(req, res, manuscriptId, "manage")))
      return;
    const result = await manuscriptsService.patchFrameDuration(
      manuscriptId,
      sceneId,
      frameId,
      write,
    );
    if (!result) {
      res.status(404).json({ error: "frame_not_found" });
      return;
    }
    if (!result.ok) {
      res.status(frameDurationWriteHTTPStatus(result.error)).json({
        error: result.error,
        ...(result.currentShotDuration
          ? { currentShotDuration: result.currentShotDuration }
          : {}),
        ...(result.currentDurationRevision !== undefined
          ? { currentDurationRevision: result.currentDurationRevision }
          : {}),
      });
      return;
    }
    if (pool && result.changed) {
      const projectId = await readProjectIdOfManuscript(manuscriptId);
      if (projectId) {
        // Duration is not Pencil source truth, but every completed video is
        // timed against it. Mirror the invalidation into the normalized AI
        // authority in the same request path as the compat-frame update.
        await pool.query(
          `UPDATE casting_storyboards
              SET metadata=COALESCE(metadata,'{}'::jsonb)
                  || jsonb_build_object(
                    'aiPaintoverState',
                    COALESCE(metadata->'aiPaintoverState','{}'::jsonb)
                      || jsonb_build_object('videoStale',true),
                    'compatFrameUpdatedAt',$3::text,
                    'shotDuration',$4::jsonb,
                    'durationRevision',$5::int
                  ) || $6::jsonb,
                  updated_at=NOW()
            WHERE project_id=$1 AND frame_id=$2`,
          [
            projectId,
            frameId,
            result.updatedAt,
            JSON.stringify(result.shotDuration),
            result.durationRevision,
            JSON.stringify(cameraMotionSidecarPatch(result)),
          ],
        );
      }
    }
    res.json({
      shotDuration: result.shotDuration,
      durationRevision: result.durationRevision,
      duration: result.duration,
      durationSec: result.durationSec,
      changed: result.changed,
      updatedAt: result.updatedAt,
      ...cameraMotionSidecarPatch(result),
      ...(result.sourceUpdatedAt
        ? { sourceUpdatedAt: result.sourceUpdatedAt }
        : {}),
      ...(result.aiPaintoverState
        ? { aiPaintoverState: result.aiPaintoverState }
        : {}),
    });
  }

  app.patch("/api/casting/frames/duration", async (req, res) => {
    try {
      const payload =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      if (Object.prototype.hasOwnProperty.call(payload, "durationRevision")) {
        res.status(400).json({ error: "duration_revision_server_owned" });
        return;
      }
      await sendFrameDurationPatch(
        req,
        res,
        {
          manuscriptId:
            typeof payload.manuscriptId === "string"
              ? payload.manuscriptId
              : "",
          sceneId: typeof payload.sceneId === "string" ? payload.sceneId : "",
          frameId: typeof payload.frameId === "string" ? payload.frameId : "",
        },
        pickDurationWrite(payload),
      );
    } catch (error) {
      if ((error as Error)?.name === "CompatStoreUnavailableError") {
        res.status(503).json({ error: "storage_unavailable" });
        return;
      }
      console.error("Error patching frame duration:", error);
      res.status(500).json({ error: "Could not patch frame duration" });
    }
  });

  // Per-frame patch (iPad-appen): unngår hele-scene-POST per strøk-lagring
  // — payload er kun frame-feltene som endres.
  // ── Storyboard @mention-varsler (in-app-kilden for iPad + web) ──
  app.get("/api/casting/storyboard-mentions", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      if (!pool) {
        res.json({ mentions: [] });
        return;
      }
      // Recipient identity is session-bound; query parameters are never an
      // authorization capability.
      const mentions = await listMentions(
        pool,
        session.userId,
        req.query.unread === "1",
      );
      res.json({ mentions });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/casting/storyboard-mentions/read", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      if (!pool) {
        res.json({ updated: 0 });
        return;
      }
      const updated = await markMentionsRead(pool, session.userId);
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
      const token =
        typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!token) {
        res.status(400).json({ error: "token is required" });
        return;
      }
      await registerStoryboardDeviceToken(pool, session.userId, token, {
        deviceName:
          typeof req.body?.deviceName === "string"
            ? req.body.deviceName
            : undefined,
        appVersion:
          typeof req.body?.appVersion === "string"
            ? req.body.appVersion
            : undefined,
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
      const sceneId =
        typeof payload.sceneId === "string" ? payload.sceneId : "";
      const frameId =
        typeof payload.frameId === "string" ? payload.frameId : "";
      let fields =
        payload.fields &&
        typeof payload.fields === "object" &&
        !Array.isArray(payload.fields)
          ? { ...payload.fields }
          : null;
      const baseUpdatedAt =
        typeof payload.baseUpdatedAt === "string"
          ? payload.baseUpdatedAt
          : undefined;
      const baseStrokesJSON =
        typeof payload.baseStrokesJSON === "string"
          ? payload.baseStrokesJSON
          : undefined;
      const hasBaseShotFraming = Object.prototype.hasOwnProperty.call(
        payload,
        "baseShotFraming",
      );
      const hasBaseLayerState = Object.prototype.hasOwnProperty.call(
        payload,
        "baseLayerState",
      );
      let baseShotFraming:
        ReturnType<typeof normalizeShotFramingState> | null | undefined;
      if (hasBaseShotFraming) {
        if (payload.baseShotFraming === null) {
          baseShotFraming = null;
        } else {
          baseShotFraming = normalizeShotFramingState(payload.baseShotFraming);
          if (!baseShotFraming) {
            res.status(400).json({ error: "invalid_base_shot_framing" });
            return;
          }
        }
      }
      let baseLayerState: Record<string, unknown> | null | undefined;
      if (hasBaseLayerState) {
        if (payload.baseLayerState === null) {
          baseLayerState = null;
        } else if (
          payload.baseLayerState &&
          typeof payload.baseLayerState === "object" &&
          !Array.isArray(payload.baseLayerState)
        ) {
          baseLayerState = { ...payload.baseLayerState };
        } else {
          res.status(400).json({ error: "invalid_base_layer_state" });
          return;
        }
      }
      if (!manuscriptId || !sceneId || !frameId || !fields) {
        res.status(400).json({
          error: "manuscriptId, sceneId, frameId and fields are required",
        });
        return;
      }
      const genericMotionEnvelopes = [fields, payload];
      if (
        genericMotionEnvelopes.some((envelope) =>
          cameraMotionServerOwnedKeys.some((key) =>
            Object.prototype.hasOwnProperty.call(envelope, key),
          ),
        )
      ) {
        res.status(400).json({ error: "camera_motion_revision_server_owned" });
        return;
      }
      if (
        genericMotionEnvelopes.some(
          (envelope) =>
            Object.prototype.hasOwnProperty.call(
              envelope,
              "cameraMotionTrack",
            ) || Object.prototype.hasOwnProperty.call(
              envelope,
              "expectedMotionRevision",
            ),
        )
      ) {
        res.status(400).json({ error: "camera_motion_requires_dedicated_patch" });
        return;
      }
      if (Object.prototype.hasOwnProperty.call(fields, "durationRevision")) {
        res.status(400).json({ error: "duration_revision_server_owned" });
        return;
      }
      const hasDurationWrite = durationWriteKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(fields, key),
      );
      if (hasDurationWrite) {
        const unrelatedFields = Object.keys(fields).filter(
          (field) => !durationWriteKeys.some((key) => key === field),
        );
        if (unrelatedFields.length > 0) {
          res.status(400).json({
            error: "duration_requires_dedicated_patch",
          });
          return;
        }
        await sendFrameDurationPatch(
          req,
          res,
          { manuscriptId, sceneId, frameId },
          pickDurationWrite(fields, payload),
        );
        return;
      }
      let currentFramingFingerprint: string | undefined;
      if (Object.prototype.hasOwnProperty.call(fields, "shotFraming")) {
        const normalizedShotFraming = normalizeShotFramingState(
          fields.shotFraming,
        );
        if (!normalizedShotFraming) {
          res.status(400).json({ error: "invalid_shot_framing" });
          return;
        }
        currentFramingFingerprint = shotFramingFingerprint(
          normalizedShotFraming,
        );
        normalizedShotFraming.intentFingerprint = currentFramingFingerprint;
        fields.shotFraming = normalizedShotFraming;
      }
      const sourceChangeRequested =
        currentFramingFingerprint !== undefined ||
        Object.prototype.hasOwnProperty.call(fields, "drawingData") ||
        Object.prototype.hasOwnProperty.call(fields, "strokesJSON");
      fields = enforceFramePatchAIStaleAuthority(fields, false);
      const session = requireUserSession(req, res);
      if (!session) return;
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;
      const manuscriptProjectId = pool
        ? await readProjectIdOfManuscript(manuscriptId)
        : null;
      // @mention-varsling: snapshot kommentarene FØR patch for diff.
      let mentionBaseline: Array<Record<string, unknown>> | null = null;
      let mentionShot: string | undefined;
      if (pool && Array.isArray((fields as any).frameComments)) {
        try {
          const scenesBefore = await manuscriptsService.getScenes(manuscriptId);
          const sceneBefore = scenesBefore.find(
            (s: any) => s?.id === sceneId,
          ) as any;
          const frameBefore = (sceneBefore?.storyboardFrames ?? []).find(
            (f: any) => f?.id === frameId,
          );
          mentionBaseline = Array.isArray(frameBefore?.frameComments)
            ? frameBefore.frameComments
            : [];
          mentionShot = frameBefore?.shotNumber;
        } catch {
          mentionBaseline = null;
        }
      }
      const result = await manuscriptsService.patchFrame(
        manuscriptId,
        sceneId,
        frameId,
        fields,
        {
          baseUpdatedAt,
          baseStrokesJSON,
          ...(hasBaseShotFraming ? { baseShotFraming } : {}),
          ...(hasBaseLayerState ? { baseLayerState } : {}),
          sourceDocumentChanged: sourceChangeRequested,
        },
      );
      if (result?.conflict) {
        res.status(409).json({
          error: "frame_version_conflict",
          currentUpdatedAt: result.currentUpdatedAt,
          currentStrokesJSON: result.currentStrokesJSON,
          currentShotFraming: result.currentShotFraming,
          currentLayerState: result.currentLayerState,
          currentAiPaintoverState: result.currentAiPaintoverState,
        });
        return;
      }
      if (
        result &&
        result.shotFraming !== undefined &&
        Object.prototype.hasOwnProperty.call(fields, "shotFraming")
      ) {
        currentFramingFingerprint = shotFramingFingerprint(result.shotFraming);
      }
      let authoritativeSourceRevision: number | undefined;
      if (pool && result && manuscriptProjectId) {
        const sourceDocumentChanged = result.sourceChanged === true;
        const importedRaster = importedRasterMirror(
          fields,
          sourceDocumentChanged,
        );
        const metadataPatch: Record<string, unknown> = {
          compatFrameUpdatedAt: result.updatedAt,
          compatSourceUpdatedAt: result.sourceUpdatedAt ?? result.updatedAt,
          ...cameraMotionSidecarPatch(result),
        };
        if (result.aiPaintoverState) {
          metadataPatch.aiPaintoverState = result.aiPaintoverState;
        }
        if (currentFramingFingerprint) {
          metadataPatch.currentFramingFingerprint = currentFramingFingerprint;
        }
        if (sourceDocumentChanged || (fields as any).aiOutputStale === true) {
          metadataPatch.aiOutputStale = true;
          metadataPatch.aiOutputStaleReason =
            result.sourceChangeReason ??
            (fields as any).aiOutputStaleReason ??
            "source-document-changed";
        }
        if (Object.keys(metadataPatch).length) {
          // casting_storyboards is the server-authoritative gate used by AI
          // approval and animation. Mirroring here closes the window where a
          // slow/stale native client could approve output for an older crop.
          const mirroredStoryboard = await pool.query(
            `UPDATE casting_storyboards
               SET metadata=COALESCE(metadata,'{}'::jsonb) || $1::jsonb
                 || CASE WHEN $4::boolean THEN jsonb_build_object(
                      'sourceRevision',
                      CASE
                        WHEN COALESCE(metadata->>'sourceRevision','') ~ '^[0-9]+$'
                          THEN (metadata->>'sourceRevision')::bigint + 1
                        ELSE 1
                      END
                    ) ELSE '{}'::jsonb END,
                   image_data=CASE WHEN $5::boolean THEN $6::text ELSE image_data END,
                   workflow_level=CASE WHEN $5::boolean
                     THEN CASE WHEN $6::text IS NULL THEN 'drawn' ELSE 'image-reference' END
                     ELSE workflow_level END,
                   updated_at=NOW()
             WHERE project_id=$2 AND frame_id=$3
             RETURNING metadata->>'sourceRevision' AS source_revision`,
            [
              JSON.stringify(metadataPatch),
              manuscriptProjectId,
              frameId,
              sourceDocumentChanged,
              importedRaster.shouldMirror,
              importedRaster.imageData,
            ],
          );
          const mirroredRevision = Number(
            mirroredStoryboard.rows[0]?.source_revision,
          );
          if (Number.isSafeInteger(mirroredRevision) && mirroredRevision >= 0) {
            authoritativeSourceRevision = mirroredRevision;
          }
        }
      }
      if (
        pool &&
        result &&
        mentionBaseline &&
        manuscriptProjectId
      ) {
        // Fire-and-forget — varslingsfeil skal aldri feile lagringen.
        void notifyStoryboardMentions(
          pool,
          {
            projectId: manuscriptProjectId,
            manuscriptId,
            sceneId,
            frameId,
            authorUserId: session.userId,
            shotNumber: mentionShot,
          },
          mentionBaseline,
          (fields as any).frameComments,
        );
      }
      if (!result) {
        res.status(404).json({ error: "frame_not_found" });
        return;
      }
      res.json({
        ...result,
        ...(authoritativeSourceRevision !== undefined
          ? { sourceRevision: authoritativeSourceRevision }
          : {}),
      });
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

  app.get(
    "/api/casting/manuscripts/:manuscriptId/dialogue",
    async (req, res) => {
      try {
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
          return;
        const dialogue = await manuscriptsService.getDialogue(
          req.params.manuscriptId,
        );
        res.json(dialogue);
      } catch (error) {
        console.error("Error listing dialogue:", error);
        res.status(500).json({ error: "Could not list dialogue" });
      }
    },
  );

  app.post("/api/casting/dialogue", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;

      const current = await manuscriptsService.getDialogue(manuscriptId);
      const dialogueId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("dialogue");
      const existingIndex = current.findIndex(
        (line) => line?.id === dialogueId,
      );
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
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const dialogueId = req.params.dialogueId;
      const manuscriptId =
        typeof req.query.manuscriptId === "string"
          ? req.query.manuscriptId.trim()
          : "";
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;
      const current = await manuscriptsService.getDialogue(manuscriptId);
      const next = current.filter((item) => item?.id !== dialogueId);
      if (next.length !== current.length) {
        await manuscriptsService.replaceDialogue(manuscriptId, next);
      }
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
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
          return;
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
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;

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
    "/api/casting/manuscripts/:manuscriptId/revisions/diff",
    async (req, res) => {
      try {
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
          return;
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

  app.get(
    "/api/casting/manuscripts/:manuscriptId/revisions/:revisionId",
    async (req, res) => {
      try {
        if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
          return;
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

  app.post(
    "/api/casting/manuscripts/:manuscriptId/restore-revision/:revisionId",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        if (
          !(await ensureManuscriptAccess(
            res,
            req.params.manuscriptId,
            session.userId,
            "manage",
          ))
        )
          return;
        const result = await revisionsService.restoreRevision(
          req.params.manuscriptId,
          req.params.revisionId,
        );
        if (!result) {
          res.status(404).json({
            error:
              "Kilde-revisjonen finnes ikke (eller manuscript-en mangler).",
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
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        if (
          !(await ensureManuscriptAccess(
            res,
            req.params.manuscriptId,
            session.userId,
          ))
        )
          return;
        const contentType = (req.headers["content-type"] ?? "")
          .toString()
          .toLowerCase();
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

  app.get("/api/casting/manuscripts/:manuscriptId/export", async (req, res) => {
    try {
      // Eierskap-vakt (som søsken-lese-endepunkter :299/:513/:567) — uten den kunne
      // hvem som helst med en manuscriptId laste ned et annet kundes manus (IDOR).
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
        return;
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
      const parsedSceneMap = new Map<
        string,
        {
          heading: string;
          action: string[];
          dialogue: ParsedScreenplay["scenes"][number]["dialogue"];
        }
      >();

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
  });

  // ── Acts ───────────────────────────────────────────────────────────

  app.get("/api/casting/manuscripts/:manuscriptId/acts", async (req, res) => {
    try {
      if (!(await ensureManuscriptOwner(req, res, req.params.manuscriptId)))
        return;
      const acts = await manuscriptsService.getActs(req.params.manuscriptId);
      res.json(acts);
    } catch (error) {
      console.error("Error listing acts:", error);
      res.status(500).json({ error: "Could not list acts" });
    }
  });

  app.post("/api/casting/acts", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;

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
      const manuscriptId =
        typeof req.query.manuscriptId === "string"
          ? req.query.manuscriptId.trim()
          : "";
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (!(await ensureManuscriptOwner(req, res, manuscriptId)))
        return;
      const acts = await manuscriptsService.getActs(manuscriptId);
      res.json(acts.find((act) => act?.id === actId) || null);
    } catch (error) {
      console.error("Error fetching act:", error);
      res.status(500).json({ error: "Could not fetch act" });
    }
  });

  app.put("/api/casting/acts/:actId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const actId = req.params.actId;
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const manuscriptId = readManuscriptId(payload);
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;

      const acts = await manuscriptsService.getActs(manuscriptId);
      const existingIndex = acts.findIndex((act) => act?.id === actId);
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
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const actId = req.params.actId;
      const manuscriptId =
        typeof req.query.manuscriptId === "string"
          ? req.query.manuscriptId.trim()
          : "";
      if (!manuscriptId) {
        res.status(400).json({ error: "manuscriptId is required" });
        return;
      }
      if (
        !(await ensureManuscriptAccess(
          res,
          manuscriptId,
          session.userId,
          "manage",
        ))
      )
        return;
      const acts = await manuscriptsService.getActs(manuscriptId);
      const next = acts.filter((act) => act?.id !== actId);
      if (next.length !== acts.length) {
        await manuscriptsService.replaceActs(manuscriptId, next);
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting act:", error);
      res.status(500).json({ error: "Could not delete act" });
    }
  });
}
