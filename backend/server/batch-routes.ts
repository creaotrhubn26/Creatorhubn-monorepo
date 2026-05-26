import express from "express";
import crypto from "crypto";

interface BatchJob {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  results: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
}

export interface BatchRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
}

export function setupBatchRoutes(deps: BatchRoutesDeps): void {
  const { app, requireUserSession } = deps;

  const batchJobs = new Map<string, BatchJob>();

  app.post("/api/batch/create", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { name, files, operation, settings } = req.body || {};
      if (!Array.isArray(files) || files.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "No files provided" });
      }
      const id = crypto.randomUUID();
      const job: BatchJob = {
        id,
        name: name || "Batch job",
        status: "processing",
        progress: 0,
        totalFiles: files.length,
        processedFiles: 0,
        failedFiles: 0,
        results: [],
        errors: [],
      };
      batchJobs.set(id, job);

      files.forEach((file: string, index: number) => {
        setTimeout(
          () => {
            const current = batchJobs.get(id);
            if (!current || current.status === "cancelled") return;
            current.processedFiles += 1;
            current.results.push({
              file,
              operation,
              settings,
              status: "completed",
            });
            current.progress = Math.round(
              (current.processedFiles / current.totalFiles) * 100,
            );
            if (current.processedFiles === current.totalFiles) {
              current.status = "completed";
            }
            batchJobs.set(id, current);
          },
          300 + index * 200,
        );
      });

      res.json({ success: true, job });
    } catch (error) {
      console.error("Batch create error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create batch job" });
    }
  });

  app.get("/api/batch/job/:id", (req, res) => {
    const job = batchJobs.get(req.params.id);
    if (!job)
      return res
        .status(404)
        .json({ success: false, error: "Job not found" });
    res.json({ success: true, job });
  });

  app.post("/api/batch/cancel/:id", (req, res) => {
    if (!requireUserSession(req, res)) return;
    const job = batchJobs.get(req.params.id);
    if (!job)
      return res
        .status(404)
        .json({ success: false, error: "Job not found" });
    job.status = "cancelled";
    batchJobs.set(req.params.id, job);
    res.json({ success: true });
  });
}
