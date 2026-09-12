/**
 * Product onboarding for the authenticated Leadgrid workspace.
 *
 * This is deliberately separate from notification-channel onboarding. The
 * product guide is scoped by user + authoritative organization + customer
 * project + effective project role + version, so changing from Dentum to a
 * different customer can never reuse progress from the previous workspace.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  getLeadgridSession,
  LeadgridProjectAccessError,
  requireLeadgridProjectAccess,
} from "./leadgrid-project-access.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

export const LEADGRID_PRODUCT_ONBOARDING_VERSION = 2;
export const LEADGRID_PRODUCT_ONBOARDING_STEPS = [
  "welcome",
  "choose_project",
  "find_candidates",
  "approve_candidates",
  "work_leads",
  "follow_up",
  "completed",
] as const;

type OnboardingStep = (typeof LEADGRID_PRODUCT_ONBOARDING_STEPS)[number];

interface OnboardingScope {
  userId: string;
  organizationId: string;
  projectId: string;
  roleTrack: string;
}

interface OnboardingRow {
  current_step: string;
  steps_completed: string[];
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  skipped_at: string | null;
  organization_id: string;
  project_id: string;
  role_track: string;
  onboarding_version: number;
}

function requestedProjectId(req: Request): string | null {
  const raw = req.method === "GET"
    ? req.query.projectId ?? req.query.project_id
    : req.body?.projectId ?? req.body?.project_id;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

async function resolveScope(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<OnboardingScope | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session) {
    res.status(401).json({ error: "Ikke innlogget" });
    return null;
  }
  const projectId = requestedProjectId(req);
  if (!projectId) {
    res.status(400).json({ error: "projectId påkrevd" });
    return null;
  }
  try {
    const project = await requireLeadgridProjectAccess(pool, {
      projectId,
      userId: session.userId,
    });
    return {
      userId: session.userId,
      organizationId: project.organizationId,
      projectId: project.id,
      roleTrack: project.memberRole,
    };
  } catch (error) {
    if (error instanceof LeadgridProjectAccessError) {
      res.status(error.status).json({ error: error.code });
      return null;
    }
    throw error;
  }
}

function selectState(pool: Pool, scope: OnboardingScope) {
  return pool.query<OnboardingRow>(
    `SELECT current_step, steps_completed, started_at::text,
            last_activity_at::text, completed_at::text, skipped_at::text,
            organization_id::text, project_id, role_track,
            onboarding_version
       FROM leadgrid_product_onboarding_state
      WHERE user_id = $1
        AND organization_id = $2::uuid
        AND project_id = $3
        AND role_track = $4
        AND onboarding_version = $5`,
    [
      scope.userId,
      scope.organizationId,
      scope.projectId,
      scope.roleTrack,
      LEADGRID_PRODUCT_ONBOARDING_VERSION,
    ],
  );
}

async function ensureState(pool: Pool, scope: OnboardingScope): Promise<{
  row: OnboardingRow;
  isNew: boolean;
}> {
  const existing = await selectState(pool, scope);
  if (existing.rows[0]) return { row: existing.rows[0], isNew: false };

  const inserted = await pool.query<OnboardingRow>(
    `INSERT INTO leadgrid_product_onboarding_state (
       user_id, organization_id, project_id, role_track, onboarding_version
     ) VALUES ($1, $2::uuid, $3, $4, $5)
     ON CONFLICT (user_id, organization_id, project_id, role_track, onboarding_version)
     DO NOTHING
     RETURNING current_step, steps_completed, started_at::text,
               last_activity_at::text, completed_at::text, skipped_at::text,
               organization_id::text, project_id, role_track,
               onboarding_version`,
    [
      scope.userId,
      scope.organizationId,
      scope.projectId,
      scope.roleTrack,
      LEADGRID_PRODUCT_ONBOARDING_VERSION,
    ],
  );
  if (inserted.rows[0]) return { row: inserted.rows[0], isNew: true };

  // A concurrent request won the insert. Read the one canonical row.
  const raced = await selectState(pool, scope);
  if (!raced.rows[0]) throw new Error("Onboarding state could not be initialized");
  return { row: raced.rows[0], isNew: false };
}

function statePayload(row: OnboardingRow) {
  return {
    ...row,
    completed: row.current_step === "completed",
  };
}

export function registerLeadgridOnboardingRoutes({ app, pool, activeSessions }: Deps): void {
  app.get("/api/leadgrid/onboarding/state", async (req, res) => {
    const scope = await resolveScope(req, res, pool, activeSessions);
    if (!scope) return;
    const state = await ensureState(pool, scope);
    res.json({ state: statePayload(state.row), eligible: true, is_new: state.isNew });
  });

  app.post("/api/leadgrid/onboarding/advance", async (req, res) => {
    const scope = await resolveScope(req, res, pool, activeSessions);
    if (!scope) return;
    const fromStep = req.body?.fromStep;
    if (typeof fromStep !== "string" || !fromStep) {
      return res.status(400).json({ error: "fromStep påkrevd" });
    }

    const currentIndex = LEADGRID_PRODUCT_ONBOARDING_STEPS.indexOf(
      fromStep as OnboardingStep,
    );
    if (currentIndex < 0 || fromStep === "completed") {
      return res.status(400).json({ error: "Ugyldig step" });
    }
    const nextStep = LEADGRID_PRODUCT_ONBOARDING_STEPS[currentIndex + 1] ?? "completed";
    await ensureState(pool, scope);

    const updated = await pool.query<OnboardingRow>(
      `UPDATE leadgrid_product_onboarding_state
          SET current_step = $1,
              steps_completed = CASE
                WHEN $2 = ANY(steps_completed) THEN steps_completed
                ELSE array_append(steps_completed, $2)
              END,
              last_activity_at = NOW(),
              completed_at = CASE
                WHEN $1 = 'completed' THEN COALESCE(completed_at, NOW())
                ELSE completed_at
              END
        WHERE user_id = $3
          AND organization_id = $4::uuid
          AND project_id = $5
          AND role_track = $6
          AND onboarding_version = $7
          AND current_step = $2
      RETURNING current_step, steps_completed, started_at::text,
                last_activity_at::text, completed_at::text, skipped_at::text,
                organization_id::text, project_id, role_track,
                onboarding_version`,
      [
        nextStep,
        fromStep,
        scope.userId,
        scope.organizationId,
        scope.projectId,
        scope.roleTrack,
        LEADGRID_PRODUCT_ONBOARDING_VERSION,
      ],
    );
    if (updated.rows[0]) {
      return res.json({ ok: true, next_step: nextStep, state: statePayload(updated.rows[0]) });
    }

    const existing = await selectState(pool, scope);
    const row = existing.rows[0];
    if (row?.steps_completed.includes(fromStep)) {
      // Safe retry after a lost response: advancing the same completed step is
      // idempotent and returns the state already committed by the first call.
      return res.json({ ok: true, next_step: row.current_step, state: statePayload(row) });
    }
    return res.status(409).json({
      error: "onboarding_step_conflict",
      current_step: row?.current_step ?? null,
    });
  });

  app.post("/api/leadgrid/onboarding/skip", async (req, res) => {
    const scope = await resolveScope(req, res, pool, activeSessions);
    if (!scope) return;
    await ensureState(pool, scope);
    await pool.query(
      `UPDATE leadgrid_product_onboarding_state
          SET current_step = 'skipped',
              skipped_at = COALESCE(skipped_at, NOW()),
              last_activity_at = NOW()
        WHERE user_id = $1
          AND organization_id = $2::uuid
          AND project_id = $3
          AND role_track = $4
          AND onboarding_version = $5
          AND current_step NOT IN ('completed', 'skipped')`,
      [
        scope.userId,
        scope.organizationId,
        scope.projectId,
        scope.roleTrack,
        LEADGRID_PRODUCT_ONBOARDING_VERSION,
      ],
    );
    res.json({ ok: true });
  });

  app.get("/api/superadmin/onboarding-funnel", async (req, res) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const user = await pool.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [session.userId],
    );
    if (user.rows[0]?.role !== "super_admin") {
      return res.status(403).json({ error: "Krever super-admin" });
    }
    const result = await pool.query<{ step: string; role_track: string; count: string }>(
      `SELECT current_step AS step, role_track, COUNT(*)::text AS count
         FROM leadgrid_product_onboarding_state
        WHERE onboarding_version = $1
        GROUP BY current_step, role_track
        ORDER BY role_track, current_step`,
      [LEADGRID_PRODUCT_ONBOARDING_VERSION],
    );
    res.json({ funnel: result.rows, onboarding_version: LEADGRID_PRODUCT_ONBOARDING_VERSION });
  });
}
