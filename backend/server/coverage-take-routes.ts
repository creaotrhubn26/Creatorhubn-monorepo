/**
 * coverage-take-routes.ts
 *
 * HTTP-laget for casting_takes — upload-flow, listing, status, og oppdatering.
 * Følger samme konvensjoner som ai-suggestion-routes.ts.
 *
 * Endepunkter:
 *   POST   /api/role-room/takes/upload-url    — opprett take + signed PUT-URL
 *   POST   /api/role-room/takes/:id/confirm   — bekreft upload, queue analyse
 *   GET    /api/role-room/projects/:projectId/takes  — list per prosjekt
 *   GET    /api/role-room/scenes/:sceneId/takes      — list per scene
 *   GET    /api/role-room/shots/:shotListId/:shotIndex/takes  — list per shot
 *   GET    /api/role-room/takes/:id           — hent én + signed read URL
 *   PATCH  /api/role-room/takes/:id           — oppdater tagging/notater
 *   DELETE /api/role-room/takes/:id           — slett media + rad
 *
 * Arkitekturreferanse:
 *   backend/server/coverage-take-service.ts
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createTakeUploadUrl,
  confirmTakeUpload,
  getTake,
  listTakesForScene,
  listTakesForProject,
  listTakesForShot,
  updateTake,
  deleteTake,
  presignTakeReadUrl,
  type CreateUploadUrlInput,
  type UpdateTakeInput,
} from "./coverage-take-service.js";

const HEADER_USER = "x-role-room-user-id";

function readUserId(req: Request): string | null {
  const header = req.header(HEADER_USER);
  if (typeof header === "string" && header.trim().length > 0) return header.trim();
  return null;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = readUserId(req);
  if (!userId) {
    res.status(401).json({ error: "user-id-header mangler" });
    return null;
  }
  return userId;
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

export interface CoverageTakeRoutesDeps {
  app: Express;
  pool: Pool;
}

export function setupCoverageTakeRoutes(deps: CoverageTakeRoutesDeps): void {
  const { app, pool } = deps;

  // ── Upload URL ────────────────────────────────────────────────────
  app.post("/api/role-room/takes/upload-url", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;

    const body = (req.body ?? {}) as Partial<CreateUploadUrlInput>;
    if (!body.projectId || typeof body.projectId !== "string") {
      res.status(400).json({ error: "projectId er påkrevd" });
      return;
    }
    if (!body.filename || typeof body.filename !== "string") {
      res.status(400).json({ error: "filename er påkrevd" });
      return;
    }
    if (!body.mimeType || typeof body.mimeType !== "string") {
      res.status(400).json({ error: "mimeType er påkrevd" });
      return;
    }
    const sizeBytes = parsePositiveInt(body.sizeBytes);
    if (sizeBytes === undefined) {
      res.status(400).json({ error: "sizeBytes er påkrevd og må være positiv" });
      return;
    }
    if (sizeBytes > 5 * 1024 * 1024 * 1024) {
      res.status(413).json({ error: "Fil for stor (maks 5GB per take)" });
      return;
    }

    try {
      const result = await createTakeUploadUrl(pool, {
        projectId: body.projectId,
        sceneId: typeof body.sceneId === "string" ? body.sceneId : undefined,
        shotListId: typeof body.shotListId === "string" ? body.shotListId : undefined,
        shotIndex: parsePositiveInt(body.shotIndex),
        takeNumber: parsePositiveInt(body.takeNumber),
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes,
        mediaType: body.mediaType === "audio" ? "audio" : "video",
        notes: typeof body.notes === "string" ? body.notes : undefined,
        markedCircled: body.markedCircled === true,
        uploadedBy: userId,
      });
      res.status(201).json(result);
    } catch (err) {
      console.error("[coverage-take-routes] upload-url error:", err);
      res.status(500).json({ error: "Kunne ikke generere upload-URL" });
    }
  });

  // ── Confirm upload ────────────────────────────────────────────────
  app.post("/api/role-room/takes/:id/confirm", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;

    const takeId = req.params.id;
    const body = (req.body ?? {}) as { durationSec?: number; capturedAt?: string };

    try {
      const take = await confirmTakeUpload(pool, takeId, {
        durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
        capturedAt: typeof body.capturedAt === "string" ? body.capturedAt : undefined,
      });
      if (!take) {
        res.status(409).json({ error: "Take er ikke i pending-status" });
        return;
      }
      res.json(take);
    } catch (err) {
      console.error("[coverage-take-routes] confirm error:", err);
      res.status(500).json({ error: "Kunne ikke bekrefte upload" });
    }
  });

  // ── List per prosjekt ─────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/takes", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      const takes = await listTakesForProject(pool, req.params.projectId);
      res.json(takes);
    } catch (err) {
      console.error("[coverage-take-routes] list-project error:", err);
      res.status(500).json({ error: "Kunne ikke hente takes" });
    }
  });

  // ── List per scene ────────────────────────────────────────────────
  app.get("/api/role-room/scenes/:sceneId/takes", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      const takes = await listTakesForScene(pool, req.params.sceneId);
      res.json(takes);
    } catch (err) {
      console.error("[coverage-take-routes] list-scene error:", err);
      res.status(500).json({ error: "Kunne ikke hente takes" });
    }
  });

  // ── List per shot ─────────────────────────────────────────────────
  app.get("/api/role-room/shots/:shotListId/:shotIndex/takes", async (req, res) => {
    if (!requireUser(req, res)) return;
    const shotIndex = parsePositiveInt(req.params.shotIndex);
    if (shotIndex === undefined) {
      res.status(400).json({ error: "shotIndex må være et positivt tall" });
      return;
    }
    try {
      const takes = await listTakesForShot(pool, req.params.shotListId, shotIndex);
      res.json(takes);
    } catch (err) {
      console.error("[coverage-take-routes] list-shot error:", err);
      res.status(500).json({ error: "Kunne ikke hente takes" });
    }
  });

  // ── Get one + signed read URL ─────────────────────────────────────
  app.get("/api/role-room/takes/:id", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      const take = await getTake(pool, req.params.id);
      if (!take) {
        res.status(404).json({ error: "Take ikke funnet" });
        return;
      }
      // Inkluder presigned playback-URL i respons så frontend kan spille
      // direkte uten ekstra rountrip
      const playbackUrl = await presignTakeReadUrl(take.mediaKey);
      res.json({ ...take, playbackUrl });
    } catch (err) {
      console.error("[coverage-take-routes] get error:", err);
      res.status(500).json({ error: "Kunne ikke hente take" });
    }
  });

  // ── Patch (tagging, notater, circled) ─────────────────────────────
  app.patch("/api/role-room/takes/:id", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as Partial<UpdateTakeInput>;
    const patch: UpdateTakeInput = {};
    if (body.shotListId !== undefined) {
      patch.shotListId = typeof body.shotListId === "string" || body.shotListId === null
        ? body.shotListId
        : undefined;
    }
    if (body.shotIndex !== undefined) {
      patch.shotIndex = body.shotIndex === null ? null : parsePositiveInt(body.shotIndex) ?? undefined;
    }
    if (body.takeNumber !== undefined) {
      patch.takeNumber = parsePositiveInt(body.takeNumber);
    }
    if (body.notes !== undefined) {
      patch.notes = typeof body.notes === "string" || body.notes === null ? body.notes : undefined;
    }
    if (body.markedCircled !== undefined) {
      patch.markedCircled = body.markedCircled === true;
    }

    try {
      const take = await updateTake(pool, req.params.id, patch);
      if (!take) {
        res.status(404).json({ error: "Take ikke funnet" });
        return;
      }
      res.json(take);
    } catch (err) {
      console.error("[coverage-take-routes] update error:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere take" });
    }
  });

  // ── Delete ────────────────────────────────────────────────────────
  app.delete("/api/role-room/takes/:id", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      const deleted = await deleteTake(pool, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Take ikke funnet" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error("[coverage-take-routes] delete error:", err);
      res.status(500).json({ error: "Kunne ikke slette take" });
    }
  });
}
