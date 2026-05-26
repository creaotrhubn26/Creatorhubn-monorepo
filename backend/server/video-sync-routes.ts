import express from "express";
import crypto from "crypto";

export interface VideoSyncRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  videoSyncJobs: Map<string, any>;
  videoSyncJobControllers: Map<string, AbortController>;
  persistVideoSyncJob: (job: any) => void;
  getVideoSyncJob: (jobId: string) => Promise<any>;
  patchVideoSyncJob: (jobId: string, patch: any) => void;
  runVideoSyncJob: (jobId: string) => Promise<void>;
}

export function setupVideoSyncRoutes(deps: VideoSyncRoutesDeps): void {
  const {
    app,
    requireUserSession,
    videoSyncJobs,
    videoSyncJobControllers,
    persistVideoSyncJob,
    getVideoSyncJob,
    patchVideoSyncJob,
    runVideoSyncJob,
  } = deps;

  app.post("/api/video-sync/sync-clips", (req, res) => {
    if (!requireUserSession(req, res)) return;
    const clipIds = Array.isArray(req.body?.clipIds)
      ? req.body.clipIds
          .map((clipId: unknown) =>
            typeof clipId === "string" ? clipId.trim() : "",
          )
          .filter(Boolean)
      : [];
    const referenceClipIdRaw = req.body?.referenceClipId;
    const referenceClipId =
      typeof referenceClipIdRaw === "string" &&
      referenceClipIdRaw.trim().length > 0
        ? referenceClipIdRaw.trim()
        : "";

    if (clipIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: "At least two clipIds are required",
      });
    }

    if (!referenceClipId) {
      return res.status(400).json({
        success: false,
        error: "referenceClipId is required",
      });
    }

    const nowIso = new Date().toISOString();
    const jobId = crypto.randomUUID();
    const job: any = {
      id: jobId,
      status: "queued",
      createdAt: nowIso,
      updatedAt: nowIso,
      storyArcId:
        typeof req.body?.storyArcId === "string"
          ? req.body.storyArcId
          : null,
      clipIds,
      referenceClipId,
      clips: [],
      progress: 0,
      error: null,
      sync_results: null,
    };
    videoSyncJobs.set(jobId, job);
    persistVideoSyncJob(job);
    videoSyncJobControllers.set(jobId, new AbortController());

    return res.status(202).json({
      success: true,
      jobId,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      },
    });
  });

  app.post("/api/video-sync/submit-clips", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const jobIdRaw = req.body?.jobId;
    const jobId =
      typeof jobIdRaw === "string" && jobIdRaw.trim().length > 0
        ? jobIdRaw.trim()
        : "";
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: "jobId is required",
      });
    }

    const job = await getVideoSyncJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Sync job not found",
      });
    }
    if (job.status === "cancelled") {
      return res.status(409).json({
        success: false,
        error: "Sync job is cancelled",
      });
    }

    const rawClips = Array.isArray(req.body?.clips) ? req.body.clips : [];
    const parsedClips: any[] = rawClips
      .map((clip: unknown) => {
        if (!clip || typeof clip !== "object") {
          return null;
        }
        const source = clip as Record<string, unknown>;
        const id =
          typeof source.id === "string" ? source.id.trim() : "";
        const pathValue =
          typeof source.path === "string" ? source.path.trim() : "";
        const typeRaw =
          typeof source.type === "string"
            ? source.type.trim().toLowerCase()
            : "";
        if (
          !id ||
          !pathValue ||
          (typeRaw !== "audio" && typeRaw !== "video")
        ) {
          return null;
        }
        return {
          id,
          path: pathValue,
          type: typeRaw as "audio" | "video",
          camera:
            typeof source.camera === "string" ? source.camera : undefined,
          syncGroup:
            typeof source.syncGroup === "string"
              ? source.syncGroup
              : undefined,
          timecode:
            typeof source.timecode === "string"
              ? source.timecode
              : undefined,
        };
      })
      .filter((clip: any): clip is any => clip !== null);

    if (parsedClips.length < 2) {
      return res.status(400).json({
        success: false,
        error: "At least two valid clips are required",
      });
    }

    patchVideoSyncJob(jobId, {
      clips: parsedClips,
      status: "processing",
      progress: 10,
      error: null,
    });

    void runVideoSyncJob(jobId);

    return res.status(202).json({
      success: true,
      jobId,
      status: "processing",
    });
  });

  app.get("/api/video-sync/jobs/:jobId", async (req, res) => {
    const job = await getVideoSyncJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Sync job not found",
      });
    }

    return res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        sync_results: job.sync_results,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      },
    });
  });

  app.post("/api/video-sync/jobs/:jobId/cancel", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const jobId = req.params.jobId;
    const job = await getVideoSyncJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Sync job not found",
      });
    }

    if (
      job.status === "completed" ||
      job.status === "error" ||
      job.status === "cancelled"
    ) {
      return res.json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
        },
      });
    }

    const controller = videoSyncJobControllers.get(jobId);
    if (controller) {
      controller.abort();
    }
    patchVideoSyncJob(jobId, {
      status: "cancelled",
      progress: 100,
      error: "Cancelled by user",
    });

    return res.json({
      success: true,
      job: {
        id: job.id,
        status: "cancelled",
        progress: 100,
      },
    });
  });
}
