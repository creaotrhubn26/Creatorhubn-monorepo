import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { desc, eq } from "drizzle-orm";
import * as schema from "../migrations/schema.js";
import { readString } from "./_shared";

export interface AudioRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  requireUserSession: (req: any, res: any) => any;
  getAudioBufferFromUrl: (audioUrl: string) => Promise<any>;
  seedFromString: (value: string) => number;
  generateWaveform: (samples: number, seed: number) => number[];
  generateSpectrum: (bins: number, seed: number) => number[];
  audioFileStore: Map<
    string,
    {
      filePath: string;
      mime: string;
      name: string;
      size: number;
      createdAt: number;
    }
  >;
}

export function setupAudioRoutes(deps: AudioRoutesDeps): void {
  const {
    app,
    pool,
    db,
    requireUserSession,
    getAudioBufferFromUrl,
    seedFromString,
    generateWaveform,
    generateSpectrum,
    audioFileStore,
  } = deps;

  app.get("/api/audio/file/:id", async (req, res) => {
    try {
      const file = audioFileStore.get(req.params.id);
      if (!file) return res.status(404).json({ error: "Audio file not found" });
      res.setHeader("Content-Type", file.mime);
      res.sendFile(file.filePath);
    } catch (error) {
      console.error("Audio file fetch error:", error);
      res.status(500).json({ error: "Failed to load audio file" });
    }
  });

  app.post("/api/audio/waveform/analyze", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const audioUrl = readString(req.body?.audioUrl) || "";
      const samples = Number(req.body?.samples || 100);
      if (!audioUrl)
        return res
          .status(400)
          .json({ success: false, error: "Missing audioUrl" });
      const seed = seedFromString(audioUrl);
      const waveformData = generateWaveform(
        Math.max(10, Math.min(samples, 2000)),
        seed,
      );
      res.json({ success: true, waveformData });
    } catch (error) {
      console.error("Waveform analyze error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to analyze waveform" });
    }
  });

  app.post("/api/audio/loudness", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const audioUrl = readString(req.body?.audioUrl) || "";
      if (!audioUrl)
        return res
          .status(400)
          .json({ success: false, error: "Missing audioUrl" });
      const { size } = await getAudioBufferFromUrl(audioUrl);
      const base = Math.log10(size + 1);
      const momentary = -23 + (base % 6) - 3;
      const shortTerm = momentary + 1.5;
      const integrated = momentary + 0.5;
      const truePeak = -1 * (base % 2) - 3;
      const loudnessRange = Math.min(15, 5 + (base % 10));

      res.json({
        success: true,
        metrics: {
          momentaryLUFS: Number(momentary.toFixed(2)),
          shortTermLUFS: Number(shortTerm.toFixed(2)),
          integratedLUFS: Number(integrated.toFixed(2)),
          truePeak: Number(truePeak.toFixed(2)),
          loudnessRange: Number(loudnessRange.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("Loudness error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to compute loudness" });
    }
  });

  app.post("/api/audio/spectral-analysis", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const audioUrl = readString(req.body?.audioUrl) || "";
      const fftSize = Number(req.body?.fftSize || 2048);
      if (!audioUrl)
        return res
          .status(400)
          .json({ success: false, error: "Missing audioUrl" });
      const bins = Math.max(64, Math.min(Math.floor(fftSize / 2), 4096));
      const spectrum = generateSpectrum(bins, seedFromString(audioUrl));
      res.json({ success: true, spectrum });
    } catch (error) {
      console.error("Spectral analysis error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to analyze spectrum" });
    }
  });

  app.post("/api/audio/compare-reference", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const mixUrl = readString(req.body?.mixUrl) || "";
      const referenceUrl = readString(req.body?.referenceUrl) || "";
      if (!mixUrl || !referenceUrl) {
        return res
          .status(400)
          .json({ success: false, error: "Missing mixUrl or referenceUrl" });
      }
      const mixBuffer = await getAudioBufferFromUrl(mixUrl);
      const refBuffer = await getAudioBufferFromUrl(referenceUrl);
      const sizeDiff = Math.abs(mixBuffer.size - refBuffer.size);
      const maxSize = Math.max(mixBuffer.size, refBuffer.size, 1);
      const similarity = 1 - Math.min(1, sizeDiff / maxSize);
      const metrics = {
        lufsMatch: Number((0.5 + similarity * 0.5).toFixed(2)),
        spectralSimilarity: Number(similarity.toFixed(2)),
        dynamicRangeMatch: Number((0.4 + similarity * 0.6).toFixed(2)),
        recommendations:
          similarity > 0.8
            ? ["Mixen matcher referansen godt."]
            : ["Juster EQ for bedre match."],
      };
      res.json({ success: true, metrics });
    } catch (error) {
      console.error("Reference compare error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to compare reference" });
    }
  });

  app.post("/api/audio/match-levels", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const mixUrl = readString(req.body?.mixUrl) || "";
      const referenceUrl = readString(req.body?.referenceUrl) || "";
      if (!mixUrl || !referenceUrl) {
        return res
          .status(400)
          .json({ success: false, error: "Missing mixUrl or referenceUrl" });
      }
      const mixBuffer = await getAudioBufferFromUrl(mixUrl);
      const refBuffer = await getAudioBufferFromUrl(referenceUrl);
      const mixVolume = mixBuffer.size >= refBuffer.size ? 90 : 100;
      const refVolume = mixBuffer.size >= refBuffer.size ? 100 : 90;
      res.json({ success: true, mixVolume, refVolume });
    } catch (error) {
      console.error("Level match error:", error);
      res.status(500).json({ success: false, error: "Failed to match levels" });
    }
  });

  app.get("/api/audio/versions/:projectId", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const rows = await db
        .select()
        .from(schema.projectVersionHistory)
        .where(eq(schema.projectVersionHistory.projectId, projectId))
        .orderBy(desc(schema.projectVersionHistory.createdAt));

      const versions = rows.map((row, index) => ({
        id: row.id,
        projectId: row.projectId,
        versionNumber: rows.length - index,
        name: row.versionName,
        description: row.description || "",
        audioUrl: String(
          (row.snapshotData as { audioUrl?: string })?.audioUrl || "",
        ),
        settings:
          (row.snapshotData as { settings?: Record<string, unknown> })
            ?.settings || {},
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        createdBy: row.userId,
      }));

      res.json({ success: true, versions });
    } catch (error) {
      console.error("Version history error:", error);
      res.status(500).json({ success: false, error: "Failed to load versions" });
    }
  });

  app.post("/api/audio/versions", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { projectId, name, description, audioUrl, settings, userId } =
        req.body || {};
      if (!projectId || !name || !audioUrl) {
        return res.status(400).json({ success: false, error: "Missing fields" });
      }
      const id = crypto.randomUUID();
      const [row] = await db
        .insert(schema.projectVersionHistory)
        .values({
          id,
          projectId,
          userId: userId || "system",
          projectType: "audio",
          versionName: name,
          description,
          snapshotData: { audioUrl, settings },
        })
        .returning();
      res.json({ success: true, version: row });
    } catch (error) {
      console.error("Save version error:", error);
      res.status(500).json({ success: false, error: "Failed to save version" });
    }
  });

  app.delete("/api/audio/versions/:id", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const id = req.params.id;
      await db
        .delete(schema.projectVersionHistory)
        .where(eq(schema.projectVersionHistory.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete version error:", error);
      res.status(500).json({ success: false, error: "Failed to delete version" });
    }
  });
}
