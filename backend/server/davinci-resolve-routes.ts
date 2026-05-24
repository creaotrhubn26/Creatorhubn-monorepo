import express from "express";
import crypto from "crypto";
import { readString } from "./_shared";

export interface DavinciResolveRoutesDeps {
  app: express.Application;
  compatResolveUserId: (req: express.Request) => string;
  getCompatResolveStatus: (userId: string) => any;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  compatResolveProjectsStore: Map<string, any>;
  compatResolveStatusStore: Map<string, any>;
  compatResolveTimelinesStore: Map<string, any>;
  compatResolveExecutionHistoryStore: Map<string, any[]>;
  compatStoreSet: (
    key: string,
    value: Record<string, unknown> | any[],
  ) => Promise<void>;
  dbCompatResolveProjectKey: (projectId: string) => string;
  dbCompatResolveStatusKey: (userId: string) => string;
  dbCompatResolveTimelineKey: (timelineId: string) => string;
  dbCompatResolveHistoryKey: (userId: string) => string;
}

export function setupDavinciResolveRoutes(
  deps: DavinciResolveRoutesDeps,
): void {
  const {
    app,
    compatResolveUserId,
    getCompatResolveStatus,
    isRecord,
    compatResolveProjectsStore,
    compatResolveStatusStore,
    compatResolveTimelinesStore,
    compatResolveExecutionHistoryStore,
    compatStoreSet,
    dbCompatResolveProjectKey,
    dbCompatResolveStatusKey,
    dbCompatResolveTimelineKey,
    dbCompatResolveHistoryKey,
  } = deps;

  app.get("/api/davinci-resolve/status", (req, res) => {
    const userId = compatResolveUserId(req);
    const status = getCompatResolveStatus(userId);
    res.json(status);
  });

  app.post("/api/davinci-resolve/projects", (req, res) => {
    const userId = compatResolveUserId(req);
    const projectId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload = isRecord(req.body) ? req.body : {};

    compatResolveProjectsStore.set(projectId, {
      id: projectId,
      userId,
      config: payload,
      createdAt,
    });
    void compatStoreSet(dbCompatResolveProjectKey(projectId), {
      id: projectId,
      userId,
      config: payload,
      createdAt,
    });

    const status = {
      connected: true,
      projectId,
      isCreating: false,
      updatedAt: createdAt,
    };
    compatResolveStatusStore.set(userId, status);
    void compatStoreSet(dbCompatResolveStatusKey(userId), status);

    res.json({
      success: true,
      projectId,
      message: "DaVinci Resolve project created",
    });
  });

  app.post(
    "/api/davinci-resolve/projects/:projectId/timelines",
    (req, res) => {
      const userId = compatResolveUserId(req);
      const projectId = req.params.projectId;
      const project = compatResolveProjectsStore.get(projectId);

      if (!project) {
        return res
          .status(404)
          .json({ success: false, error: "Project not found" });
      }

      const timelineId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const payload = isRecord(req.body) ? req.body : {};

      compatResolveTimelinesStore.set(timelineId, {
        id: timelineId,
        userId,
        projectId,
        config: payload,
        createdAt,
      });
      void compatStoreSet(dbCompatResolveTimelineKey(timelineId), {
        id: timelineId,
        userId,
        projectId,
        config: payload,
        createdAt,
      });

      const currentStatus = getCompatResolveStatus(userId);
      compatResolveStatusStore.set(userId, {
        ...currentStatus,
        connected: true,
        projectId,
        timelineId,
        updatedAt: createdAt,
      });
      void compatStoreSet(dbCompatResolveStatusKey(userId), {
        ...currentStatus,
        connected: true,
        projectId,
        timelineId,
        updatedAt: createdAt,
      });

      res.json({
        success: true,
        timelineId,
        projectId,
        message: "DaVinci Resolve timeline created",
      });
    },
  );

  app.get("/api/davinci-resolve/system-status", (_req, res) => {
    res.json({
      pythonInstalled: true,
      davinciInstalled: true,
      scriptsInstalled: true,
      apiConnected: true,
    });
  });

  app.get("/api/davinci-resolve/scripts", (_req, res) => {
    res.json([
      {
        id: "color-balance",
        name: "ColorBalance",
        displayName: "Color Balance Pass",
        description: "Applies baseline color balancing to selected clips",
        category: "color",
      },
      {
        id: "audio-normalize",
        name: "AudioNormalize",
        displayName: "Audio Normalize",
        description: "Normalizes dialogue and music loudness",
        category: "audio",
      },
    ]);
  });

  app.get("/api/davinci-resolve/execution-history", (req, res) => {
    const userId = compatResolveUserId(req);
    const history = compatResolveExecutionHistoryStore.get(userId) || [];
    res.json(history);
  });

  app.post("/api/davinci-resolve/execute-script", (req, res) => {
    const userId = compatResolveUserId(req);
    const scriptName = readString(req.body?.scriptName) || "UnknownScript";
    const timestamp = new Date().toISOString();
    const next = {
      scriptName,
      timestamp,
      status: "success" as const,
    };

    const history = compatResolveExecutionHistoryStore.get(userId) || [];
    const nextHistory = [next, ...history].slice(0, 100);
    compatResolveExecutionHistoryStore.set(userId, nextHistory);
    void compatStoreSet(dbCompatResolveHistoryKey(userId), nextHistory);
    res.json({ success: true, scriptName, timestamp });
  });

  app.post("/api/davinci-resolve/install-scripts", (_req, res) => {
    res.json({ success: true, message: "Scripts installed" });
  });
}
