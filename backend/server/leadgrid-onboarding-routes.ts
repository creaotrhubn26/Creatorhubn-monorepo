/**
 * leadgrid-onboarding-routes.ts
 *
 * State for in-app onboarding-tour for nye Leadgrid-brukere.
 *
 * Steps:
 *   1. welcome — vis splash + 'Start tour'
 *   2. add_first_customer — hint på + knapp i Prosjekter
 *   3. see_portal — etter første onboarding: vis kunde-portal-lenke
 *   4. try_playbook — hint på første focus-request → playbook
 *   5. view_apis — vis Developer-docs hvis 'uses_api' i partnerskaps-flow
 *   6. completed — done badge
 *
 *   GET  /api/leadgrid/onboarding/state (innlogget bruker)
 *   POST /api/leadgrid/onboarding/advance (step → next)
 *   POST /api/leadgrid/onboarding/skip
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

const STEPS = [
  "welcome", "add_first_customer", "see_portal",
  "try_playbook", "view_apis", "completed",
];

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

export function registerLeadgridOnboardingRoutes({ app, pool, activeSessions }: Deps): void {

  app.get("/api/leadgrid/onboarding/state", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const r = await pool.query(
      `SELECT current_step, steps_completed, started_at::text,
              completed_at::text, skipped_at::text
         FROM leadgrid_onboarding_tour_state
        WHERE user_id = $1`,
      [s.userId],
    );

    if (r.rows.length === 0) {
      // Sjekk om brukeren har en Leadgrid-org — hvis ja, init tour
      const orgR = await pool.query<{ organization_id: string }>(
        `SELECT om.organization_id
           FROM organization_members om
           JOIN organizations o ON o.id = om.organization_id
          WHERE om.user_id = $1 AND o.plan IN ('solo_free', 'solo_pro', 'agency')
          LIMIT 1`,
        [s.userId],
      );
      if (orgR.rows.length === 0) {
        return res.json({ state: null, eligible: false });
      }
      await pool.query(
        `INSERT INTO leadgrid_onboarding_tour_state (user_id, organization_id)
         VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [s.userId, orgR.rows[0].organization_id],
      );
      return res.json({
        state: { current_step: "welcome", steps_completed: [] },
        eligible: true,
        is_new: true,
      });
    }

    res.json({ state: r.rows[0], eligible: true });
  });

  app.post("/api/leadgrid/onboarding/advance", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { fromStep } = req.body ?? {};
    if (!fromStep) return res.status(400).json({ error: "fromStep påkrevd" });

    const curIdx = STEPS.indexOf(fromStep);
    if (curIdx === -1) return res.status(400).json({ error: "Ugyldig step" });
    const nextStep = curIdx + 1 < STEPS.length ? STEPS[curIdx + 1] : "completed";

    await pool.query(
      `UPDATE leadgrid_onboarding_tour_state
          SET current_step = $1,
              steps_completed = (
                SELECT array_agg(DISTINCT s) FROM unnest(steps_completed || ARRAY[$2]::text[]) AS s
              ),
              last_activity_at = now(),
              completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END
        WHERE user_id = $3`,
      [nextStep, fromStep, s.userId],
    );

    res.json({ ok: true, next_step: nextStep });
  });

  app.post("/api/leadgrid/onboarding/skip", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    await pool.query(
      `UPDATE leadgrid_onboarding_tour_state
          SET current_step = 'skipped', skipped_at = now(),
              last_activity_at = now()
        WHERE user_id = $1`,
      [s.userId],
    );
    res.json({ ok: true });
  });

  // Statistikk for super-admin
  app.get("/api/superadmin/onboarding-funnel", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const userR = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [session.userId]);
    if (userR.rows[0]?.role !== "super_admin") return res.status(403).json({ error: "Krever super-admin" });

    const r = await pool.query<{ step: string; count: string }>(
      `SELECT current_step AS step, COUNT(*)::text AS count
         FROM leadgrid_onboarding_tour_state
        GROUP BY current_step`,
    );
    res.json({ funnel: r.rows });
  });
}
