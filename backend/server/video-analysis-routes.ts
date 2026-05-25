import express from "express";
import type { Multer } from "multer";
import { readString } from "./_shared";

export interface VideoAnalysisRoutesDeps {
  app: express.Application;
  videoSourceUpload: Multer;
  persistVideoAnalysisUpload: (
    file: Express.Multer.File,
  ) => Promise<string>;
  normalizeStoryArcV2LanguageHint: (
    value: string | null,
  ) => string | null;
  createVideoAnalysisJob: (
    type: "transcribe" | "scene-detection",
    input: any,
  ) => any;
  runTranscriptionJob: (jobId: string) => Promise<void>;
  runSceneDetectionJob: (jobId: string) => Promise<void>;
  getVideoAnalysisJob: (jobId: string) => Promise<any>;
  patchVideoAnalysisJob: (jobId: string, patch: any) => void;
  videoAnalysisJobControllers: Map<string, AbortController>;
}

export function setupVideoAnalysisRoutes(
  deps: VideoAnalysisRoutesDeps,
): void {
  const {
    app,
    videoSourceUpload,
    persistVideoAnalysisUpload,
    normalizeStoryArcV2LanguageHint,
    createVideoAnalysisJob,
    runTranscriptionJob,
    runSceneDetectionJob,
    getVideoAnalysisJob,
    patchVideoAnalysisJob,
    videoAnalysisJobControllers,
  } = deps;

  app.post(
    "/api/video-analysis/upload-source",
    videoSourceUpload.single("video"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ success: false, error: "Missing video upload" });
        }

        const uploadedPath = await persistVideoAnalysisUpload(req.file);
        return res.status(201).json({
          success: true,
          video_path: uploadedPath,
        });
      } catch (error) {
        console.error("Video analysis upload error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to upload video source";
        return res.status(500).json({ success: false, error: message });
      }
    },
  );

  app.post(
    "/api/video-analysis/transcribe",
    videoSourceUpload.single("video"),
    async (req, res) => {
      try {
        let videoPath =
          readString(req.body?.video_path) || readString(req.body?.videoPath);
        let cleanupSourcePath: string | undefined;
        if (!videoPath && req.file) {
          cleanupSourcePath = await persistVideoAnalysisUpload(req.file);
          videoPath = cleanupSourcePath;
        }
        if (!videoPath) {
          return res
            .status(400)
            .json({ success: false, error: "Missing video_path" });
        }

        const language = normalizeStoryArcV2LanguageHint(
          readString(req.body?.language),
        );
        const job = createVideoAnalysisJob("transcribe", {
          videoPath,
          language,
          threshold: 0.3,
          minSceneLenSeconds: 0.5,
          cleanupSourcePath,
        });

        void runTranscriptionJob(job.id);

        return res.status(202).json({
          success: true,
          job_id: job.id,
          status: job.status,
        });
      } catch (error) {
        console.error("Video transcription enqueue error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to queue transcription job",
        });
      }
    },
  );

  app.get("/api/video-analysis/transcribe/:jobId", async (req, res) => {
    const jobId = req.params.jobId;
    const job = await getVideoAnalysisJob(jobId);

    if (!job || job.type !== "transcribe") {
      return res
        .status(404)
        .json({ success: false, error: "Transcription job not found" });
    }

    return res.json({
      success: true,
      job_id: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      warnings: job.warnings,
      error: job.error,
      updated_at: job.updatedAt,
    });
  });

  app.post(
    "/api/video-analysis/scene-detection",
    videoSourceUpload.single("video"),
    async (req, res) => {
      try {
        let videoPath =
          readString(req.body?.video_path) || readString(req.body?.videoPath);
        let cleanupSourcePath: string | undefined;
        if (!videoPath && req.file) {
          cleanupSourcePath = await persistVideoAnalysisUpload(req.file);
          videoPath = cleanupSourcePath;
        }
        if (!videoPath) {
          return res
            .status(400)
            .json({ success: false, error: "Missing video_path" });
        }

        const thresholdRaw = Number(req.body?.threshold);
        const threshold = Number.isFinite(thresholdRaw)
          ? Math.max(
              0.05,
              Math.min(
                0.95,
                thresholdRaw > 1 ? thresholdRaw / 100 : thresholdRaw,
              ),
            )
          : 0.3;

        const minSceneLenRaw = Number(req.body?.min_scene_len);
        const minSceneLenSeconds =
          Number.isFinite(minSceneLenRaw) && minSceneLenRaw > 0
            ? Math.max(0.25, minSceneLenRaw / 30)
            : 0.5;

        const job = createVideoAnalysisJob("scene-detection", {
          videoPath,
          language: null,
          threshold,
          minSceneLenSeconds,
          cleanupSourcePath,
        });

        void runSceneDetectionJob(job.id);

        return res.status(202).json({
          success: true,
          job_id: job.id,
          status: job.status,
        });
      } catch (error) {
        console.error("Scene detection enqueue error:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to queue scene detection job",
        });
      }
    },
  );

  app.get(
    "/api/video-analysis/scene-detection/:jobId",
    async (req, res) => {
      const jobId = req.params.jobId;
      const job = await getVideoAnalysisJob(jobId);

      if (!job || job.type !== "scene-detection") {
        return res
          .status(404)
          .json({ success: false, error: "Scene detection job not found" });
      }

      return res.json({
        success: true,
        job_id: job.id,
        status: job.status,
        progress: job.progress,
        result: job.result,
        warnings: job.warnings,
        error: job.error,
        updated_at: job.updatedAt,
      });
    },
  );

  app.post(
    "/api/video-analysis/scene-detection/:jobId/cancel",
    async (req, res) => {
      const jobId = req.params.jobId;
      const job = await getVideoAnalysisJob(jobId);
      if (!job || job.type !== "scene-detection") {
        return res
          .status(404)
          .json({ success: false, error: "Scene detection job not found" });
      }

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        return res.json({
          success: true,
          job_id: job.id,
          status: job.status,
          progress: job.progress,
        });
      }

      const controller = videoAnalysisJobControllers.get(jobId);
      if (controller) {
        controller.abort();
      }
      patchVideoAnalysisJob(jobId, {
        status: "cancelled",
        progress: 100,
        error: "Cancelled by user",
      });

      return res.json({
        success: true,
        job_id: job.id,
        status: "cancelled",
        progress: 100,
      });
    },
  );
}
