import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { readNumber, readString, readStringArray } from "./_shared";

export interface VideoRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  compatStoreGet: <T>(key: string) => Promise<T | null>;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  showcaseVideoCommentsKey: (videoId: string) => string;
  showcaseVideoSequencesKey: (projectId: string) => string;
}

export function setupVideoRoutes(deps: VideoRoutesDeps): void {
  const {
    app,
    requireUserSession,
    pool,
    compatStoreGet,
    compatStoreSet,
    showcaseVideoCommentsKey,
    showcaseVideoSequencesKey,
  } = deps;

  app.post("/api/video/export", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    res.json({
      success: true,
      jobId: crypto.randomUUID(),
      status: "queued",
      requestedAt: new Date().toISOString(),
      ...req.body,
    });
  });

  app.get("/api/video/timecoded-comments/:videoId", async (req, res) => {
    try {
      const { videoId } = req.params;
      if (!videoId) {
        return res.status(400).json({ error: "videoId er paakrevd" });
      }

      const comments =
        (await compatStoreGet<Array<Record<string, unknown>>>(
          showcaseVideoCommentsKey(videoId),
        )) || [];

      res.json(comments);
    } catch (error) {
      console.error("Error loading timecoded video comments:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke hente tidskodede kommentarer" });
    }
  });

  app.post("/api/video/timecoded-comments", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const videoId = readString(payload.videoId);
      if (!videoId) {
        return res.status(400).json({ error: "videoId er paakrevd" });
      }
      const existing =
        (await compatStoreGet<Array<Record<string, unknown>>>(
          showcaseVideoCommentsKey(videoId),
        )) || [];
      const comment = {
        id: crypto.randomUUID(),
        videoId,
        timecode: readNumber(payload.timecode) ?? 0,
        comment: readString(payload.comment) || "",
        version: readString(payload.version) || "v1",
        userId: readString(payload.userId) || "system",
        createdAt: new Date().toISOString(),
      };
      const next = [...existing, comment];
      await compatStoreSet(showcaseVideoCommentsKey(videoId), next);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating timecoded video comment:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke lagre tidskodet kommentar" });
    }
  });

  app.get("/api/video/sequences/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({ error: "projectId er paakrevd" });
      }

      const sequences =
        (await compatStoreGet<Array<Record<string, unknown>>>(
          showcaseVideoSequencesKey(projectId),
        )) || [];

      res.json(sequences);
    } catch (error) {
      console.error("Error loading video sequences:", error);
      res.status(500).json({ error: "Kunne ikke hente videosekvenser" });
    }
  });

  app.post("/api/video/sequences", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const projectId = readString(payload.projectId);
      if (!projectId) {
        return res.status(400).json({ error: "projectId er paakrevd" });
      }
      const existing =
        (await compatStoreGet<Array<Record<string, unknown>>>(
          showcaseVideoSequencesKey(projectId),
        )) || [];
      const sequence = {
        id: crypto.randomUUID(),
        projectId,
        sequenceName: readString(payload.sequenceName) || "Ny sekvens",
        chapters: readStringArray(payload.chapters),
        version: readString(payload.version) || "v1",
        createdAt: new Date().toISOString(),
      };
      const next = [...existing, sequence];
      await compatStoreSet(showcaseVideoSequencesKey(projectId), next);
      res.status(201).json(sequence);
    } catch (error) {
      console.error("Error creating video sequence:", error);
      res.status(500).json({ error: "Kunne ikke opprette videosekvens" });
    }
  });

  app.post("/api/video/generate-thumbnails", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const videoId = readString(req.body?.videoId);
      const count = readNumber(req.body?.count) ?? 5;
      if (!videoId) {
        return res.status(400).json({ error: "videoId er paakrevd" });
      }
      const result = await pool.query(
        `SELECT image_url, thumbnail_url FROM showcase_items WHERE id = $1 LIMIT 1`,
        [videoId],
      );
      const sourceUrl =
        readString(result.rows[0]?.thumbnail_url) ||
        readString(result.rows[0]?.image_url) ||
        "";
      const thumbnails = Array.from({ length: count }, (_, index) => ({
        id: `${videoId}-thumb-${index + 1}`,
        timecode: index * 15,
        url: sourceUrl,
        aiScore: Math.max(0.5, 1 - index * 0.08),
      }));
      res.json({ success: true, thumbnails });
    } catch (error) {
      console.error("Error generating video thumbnails:", error);
      res.status(500).json({ error: "Kunne ikke generere thumbnails" });
    }
  });
}
