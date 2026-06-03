/**
 * Academy → Google Vids / NotebookLM workspace-integrations.
 *
 * Ekstrahert fra `index.ts` (#236-sekvens) for å redusere mainfilen.
 * Routene speiler workspace-state for to eksterne læringsverktøy:
 *   - Google Vids (course-snapshots → drevet workspace)
 *   - NotebookLM (lesson-snapshots → drevet notebook)
 *
 * Bridge-modulene `academy-google-vids-workspace` + `academy-notebooklm-workspace`
 * importeres direkte; bare `requireAcademySession` (med Express-koblet
 * session-validering) injecteres som dep fordi den lever inne i index.ts.
 */
import type { Application, Request, Response } from "express";
import type { Pool } from "pg";

import { readString } from "./_shared.js";
import {
  getAcademyGoogleVidsWorkspaceStatus,
  syncAcademyGoogleVidsWorkspace,
} from "./academy-google-vids-workspace.js";
import {
  getAcademyNotebookLmWorkspaceStatus,
  syncAcademyNotebookLmWorkspace,
} from "./academy-notebooklm-workspace.js";

/**
 * Subset av returverdien til `requireAcademySession` som vi faktisk
 * leser — bare `user.id`. Bredere felter eksisterer (session/roleId/
 * isInstructor) men er irrelevante her.
 */
type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

export interface AcademyIntegrationsRoutesDeps {
  app: Application;
  pool: Pool;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
}

export function setupAcademyIntegrationsRoutes(
  deps: AcademyIntegrationsRoutesDeps,
): void {
  const { app, pool, requireAcademySession } = deps;

  // ──────────────────────────────────────────────────────────────
  // Google Vids workspace
  // ──────────────────────────────────────────────────────────────

  app.get("/api/academy/google-vids/status", async (req, res) => {
    try {
      const academySession = await requireAcademySession(
        req,
        res,
        "instructor",
      );
      if (!academySession) {
        return;
      }
      const userId = academySession.user.id;
      const status = await getAcademyGoogleVidsWorkspaceStatus(pool, {
        userId,
        courseId: readString(req.query.courseId),
        courseTitle: readString(req.query.courseTitle),
      });

      return res.json(status);
    } catch (error) {
      console.error("Academy Google Vids workspace status error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch Academy Google Vids workspace status" });
    }
  });

  app.post("/api/academy/google-vids/sync", async (req, res) => {
    try {
      const academySession = await requireAcademySession(
        req,
        res,
        "instructor",
      );
      if (!academySession) {
        return;
      }
      const userId = academySession.user.id;
      const workspace = await syncAcademyGoogleVidsWorkspace(pool, {
        userId,
        courseId: readString(req.body?.courseId),
        courseTitle: readString(req.body?.courseTitle),
        snapshot: req.body?.snapshot,
      });

      const status = await getAcademyGoogleVidsWorkspaceStatus(pool, {
        userId,
        courseId: workspace.courseId,
        courseTitle: workspace.courseTitle,
      });

      return res.json(status);
    } catch (error) {
      console.error("Academy Google Vids workspace sync error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Academy Google Vids workspace",
      });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // NotebookLM workspace
  // ──────────────────────────────────────────────────────────────

  app.get("/api/academy/notebooklm/status", async (req, res) => {
    try {
      const academySession = await requireAcademySession(
        req,
        res,
        "instructor",
      );
      if (!academySession) {
        return;
      }
      const userId = academySession.user.id;
      const status = await getAcademyNotebookLmWorkspaceStatus(pool, {
        userId,
        courseId: readString(req.query.courseId),
        lessonId: readString(req.query.lessonId),
        courseTitle: readString(req.query.courseTitle),
      });

      return res.json(status);
    } catch (error) {
      console.error("Academy NotebookLM workspace status error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch Academy NotebookLM workspace status" });
    }
  });

  app.post("/api/academy/notebooklm/sync", async (req, res) => {
    try {
      const academySession = await requireAcademySession(
        req,
        res,
        "instructor",
      );
      if (!academySession) {
        return;
      }
      const userId = academySession.user.id;
      const workspace = await syncAcademyNotebookLmWorkspace(pool, {
        userId,
        courseId: readString(req.body?.courseId),
        lessonId: readString(req.body?.lessonId),
        courseTitle: readString(req.body?.courseTitle),
        snapshot: req.body?.snapshot,
      });

      const status = await getAcademyNotebookLmWorkspaceStatus(pool, {
        userId,
        courseId: workspace.courseId,
        lessonId: workspace.lessonId,
        courseTitle: workspace.courseTitle,
      });

      return res.json(status);
    } catch (error) {
      console.error("Academy NotebookLM workspace sync error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Academy NotebookLM workspace",
      });
    }
  });
}
