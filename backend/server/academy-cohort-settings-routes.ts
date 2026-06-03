/**
 * Academy → cohort-settings (GET + POST).
 *
 * Persisterer cohort-konfigurasjon (cohorts, feature-flags, discussions,
 * selectedCohortId) per (user, course)-par i `academy_cohort_settings`-
 * tabellen. Tabellen er ensured idempotent ved hver POST.
 *
 * Ekstrahert fra `index.ts`. Helpers (normalize/ensureTable) deles fra
 * index.ts som dep-injected callbacks.
 */
import type { Application, Request, Response } from "express";
import type { Pool } from "pg";

import { readString } from "./_shared.js";
import type {
  AcademyCohortFeatureFlags,
  AcademyPersistedCohortItem,
  AcademyPersistedDiscussionItem,
} from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

export interface AcademyCohortSettingsRoutesDeps {
  app: Application;
  pool: Pool;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  ensureAcademyCohortSettingsTable: () => Promise<void>;
  normalizeCohortItems: (value: unknown) => AcademyPersistedCohortItem[];
  normalizeCohortFeatureFlags: (value: unknown) => AcademyCohortFeatureFlags;
  normalizeCohortDiscussions: (
    value: unknown,
  ) => AcademyPersistedDiscussionItem[];
}

export function setupAcademyCohortSettingsRoutes(
  deps: AcademyCohortSettingsRoutesDeps,
): void {
  const {
    app,
    pool,
    requireAcademySession,
    ensureAcademyCohortSettingsTable,
    normalizeCohortItems,
    normalizeCohortFeatureFlags,
    normalizeCohortDiscussions,
  } = deps;

  app.get("/api/academy/cohort-settings", async (req, res) => {
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
      const courseId = readString(req.query?.courseId);
      if (!courseId) {
        return res
          .status(400)
          .json({ success: false, error: "courseId is required" });
      }

      await ensureAcademyCohortSettingsTable();
      const result = await pool.query(
        `SELECT course_id, cohorts, feature_flags, discussions, selected_cohort_id, updated_at
         FROM academy_cohort_settings
         WHERE user_id = $1 AND course_id = $2
         LIMIT 1`,
        [userId, courseId],
      );

      const row = result.rows?.[0];
      if (!row) {
        return res.status(200).json({ success: true, data: null });
      }

      return res.status(200).json({
        success: true,
        data: {
          courseId: row.course_id,
          cohorts: normalizeCohortItems(row.cohorts),
          featureFlags: normalizeCohortFeatureFlags(row.feature_flags),
          discussions: normalizeCohortDiscussions(row.discussions),
          selectedCohortId: readString(row.selected_cohort_id) || null,
          updatedAt: row.updated_at,
        },
      });
    } catch (error) {
      console.error("Error reading academy cohort settings:", error);
      return res
        .status(500)
        .json({ success: false, error: "Could not read cohort settings" });
    }
  });

  app.post("/api/academy/cohort-settings", async (req, res) => {
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
      const courseId = readString(req.body?.courseId);
      if (!courseId) {
        return res
          .status(400)
          .json({ success: false, error: "courseId is required" });
      }

      const cohorts = normalizeCohortItems(req.body?.cohorts);
      const featureFlags = normalizeCohortFeatureFlags(req.body?.featureFlags);
      const discussions = normalizeCohortDiscussions(req.body?.discussions);
      const selectedCohortId = readString(req.body?.selectedCohortId) || null;

      await ensureAcademyCohortSettingsTable();
      const result = await pool.query(
        `INSERT INTO academy_cohort_settings
          (user_id, course_id, cohorts, feature_flags, discussions, selected_cohort_id, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, NOW(), NOW())
         ON CONFLICT (user_id, course_id) DO UPDATE SET
           cohorts = EXCLUDED.cohorts,
           feature_flags = EXCLUDED.feature_flags,
           discussions = EXCLUDED.discussions,
           selected_cohort_id = EXCLUDED.selected_cohort_id,
           updated_at = NOW()
         RETURNING course_id, cohorts, feature_flags, discussions, selected_cohort_id, updated_at`,
        [
          userId,
          courseId,
          JSON.stringify(cohorts),
          JSON.stringify(featureFlags),
          JSON.stringify(discussions),
          selectedCohortId,
        ],
      );

      const row = result.rows?.[0];
      return res.status(200).json({
        success: true,
        data: {
          courseId: row?.course_id || courseId,
          cohorts: normalizeCohortItems(row?.cohorts || cohorts),
          featureFlags: normalizeCohortFeatureFlags(
            row?.feature_flags || featureFlags,
          ),
          discussions: normalizeCohortDiscussions(
            row?.discussions || discussions,
          ),
          selectedCohortId: readString(row?.selected_cohort_id) || null,
          updatedAt: row?.updated_at || new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error saving academy cohort settings:", error);
      return res
        .status(500)
        .json({ success: false, error: "Could not save cohort settings" });
    }
  });
}
