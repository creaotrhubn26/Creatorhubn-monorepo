/**
 * Project-scoped tab-konfig: produksjonsteam-lederen kan styre hvilke faner
 * hver rolle og hver enkelt bruker ser på sitt prosjekt.
 *
 * Modell:
 *   - Tabell `role_room_project_tab_overrides` med (project_id, target_type, target_value)
 *     som PK. target_type er 'role' eller 'user'.
 *   - Bruker-overrides vinner over rolle-overrides, som vinner over plattform-defaults.
 *
 * Autorisering:
 *   - Lederen = created_by på casting_projects. Kun lederen kan lese/skrive konfig
 *     for sitt prosjekt.
 *   - Vanlige medlemmer henter sin egen "effective tabs" via /my-tabs.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const VALID_TAB_VALUES = new Set([
  "roles", "candidates", "crew", "schedule", "publishing", "carousel",
  "approval", "brief", "planner", "shooting", "shotlist", "mannskap",
  "agent", "economy", "admin-room",
]);

const VALID_TARGET_TYPES = new Set(["role", "user"]);

let tableEnsured = false;

async function ensureTable(pool: Pool): Promise<boolean> {
  if (tableEnsured) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_room_project_tab_overrides (
        project_id VARCHAR(255) NOT NULL,
        target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('role','user')),
        target_value VARCHAR(255) NOT NULL,
        tab_values TEXT[] NOT NULL DEFAULT '{}'::text[],
        updated_by_user_id VARCHAR(255),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, target_type, target_value)
      );
      CREATE INDEX IF NOT EXISTS idx_rrptc_project_id
        ON role_room_project_tab_overrides(project_id);
    `);
    tableEnsured = true;
    return true;
  } catch (err) {
    console.error("[rr-project-tab-config] ensure table failed:", err);
    return false;
  }
}

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function isProjectLeader(
  pool: Pool, viewerId: string, projectId: string,
): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2 LIMIT 1`,
      [projectId, viewerId],
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[rr-project-tab-config] isProjectLeader failed:", err);
    return false;
  }
}

function sanitizeTabValues(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (!VALID_TAB_VALUES.has(trimmed)) return null;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }
  return cleaned;
}

export function registerRoleRoomProjectTabConfigRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;
  void ensureTable(pool);

  // ── GET: leder ser alle overrides + team-medlemmer ──────────────
  app.get(
    "/api/role-room/projects/:projectId/tab-config",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId_mangler" }); return;
      }
      if (!(await isProjectLeader(pool, viewerId, projectId))) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }
      if (!(await ensureTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" }); return;
      }

      try {
        const [overridesRes, membersRes] = await Promise.all([
          pool.query(
            `SELECT target_type, target_value, tab_values, updated_at
               FROM role_room_project_tab_overrides
              WHERE project_id = $1`,
            [projectId],
          ),
          pool.query(
            `SELECT cur.user_id, cur.role, cur.email,
                    p.display_name, p.profile_image_url
               FROM casting_user_roles cur
               LEFT JOIN role_room_member_profiles p ON p.user_id = cur.user_id
              WHERE cur.project_id = $1
              UNION
             SELECT cp.created_by AS user_id, 'leder' AS role,
                    u.email, p.display_name, p.profile_image_url
               FROM casting_projects cp
               LEFT JOIN users u ON u.id = cp.created_by
               LEFT JOIN role_room_member_profiles p ON p.user_id = cp.created_by
              WHERE cp.id = $1 AND cp.created_by IS NOT NULL`,
            [projectId],
          ),
        ]);

        res.json({
          projectId,
          overrides: overridesRes.rows.map((row: { target_type: string; target_value: string; tab_values: string[]; updated_at: Date }) => ({
            targetType: row.target_type,
            targetValue: row.target_value,
            tabValues: row.tab_values,
            updatedAt: row.updated_at,
          })),
          members: membersRes.rows.map((row: { user_id: string; role: string | null; email: string | null; display_name: string | null; profile_image_url: string | null }) => ({
            userId: row.user_id,
            role: row.role,
            email: row.email,
            displayName: row.display_name,
            profileImageUrl: row.profile_image_url,
          })),
          validTabValues: Array.from(VALID_TAB_VALUES),
        });
      } catch (err) {
        console.error("[rr-project-tab-config] GET failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  // ── PUT: sett eller oppdater en override ──────────────────────
  app.put(
    "/api/role-room/projects/:projectId/tab-config",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId_mangler" }); return;
      }
      if (!(await isProjectLeader(pool, viewerId, projectId))) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }
      if (!(await ensureTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" }); return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const targetType = String(body.targetType ?? "").trim();
      const targetValue = String(body.targetValue ?? "").trim();
      if (!VALID_TARGET_TYPES.has(targetType) || !targetValue) {
        res.status(400).json({ error: "ugyldig_target" }); return;
      }
      const tabValues = sanitizeTabValues(body.tabValues);
      if (!tabValues) {
        res.status(400).json({ error: "ugyldig_tabValues" }); return;
      }

      try {
        await pool.query(
          `INSERT INTO role_room_project_tab_overrides
                (project_id, target_type, target_value, tab_values, updated_by_user_id, updated_at)
              VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (project_id, target_type, target_value) DO UPDATE
              SET tab_values = EXCLUDED.tab_values,
                  updated_by_user_id = EXCLUDED.updated_by_user_id,
                  updated_at = NOW()`,
          [projectId, targetType, targetValue, tabValues, viewerId],
        );
        res.json({ ok: true, targetType, targetValue, tabValues });
      } catch (err) {
        console.error("[rr-project-tab-config] PUT failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  // ── DELETE: fjern override (tilbake til default) ───────────────
  app.delete(
    "/api/role-room/projects/:projectId/tab-config/:targetType/:targetValue",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      const targetType = String(req.params.targetType ?? "").trim();
      const targetValue = String(req.params.targetValue ?? "").trim();
      if (!projectId || !VALID_TARGET_TYPES.has(targetType) || !targetValue) {
        res.status(400).json({ error: "ugyldig_input" }); return;
      }
      if (!(await isProjectLeader(pool, viewerId, projectId))) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }
      if (!(await ensureTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" }); return;
      }

      try {
        await pool.query(
          `DELETE FROM role_room_project_tab_overrides
            WHERE project_id = $1 AND target_type = $2 AND target_value = $3`,
          [projectId, targetType, targetValue],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[rr-project-tab-config] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  // ── GET my-tabs: hva ser jeg på dette prosjektet? ──────────────
  // Returnerer { tabValues: string[] | null, source: 'user'|'role'|'default' }
  // Frontend bruker tabValues=null som "bruk plattform-defaults for min rolle".
  app.get(
    "/api/role-room/projects/:projectId/my-tabs",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId_mangler" }); return;
      }
      if (!(await ensureTable(pool))) {
        res.json({ tabValues: null, source: "default", role: null });
        return;
      }

      try {
        // Finn brukerens rolle på prosjektet
        const roleRes = await pool.query(
          `SELECT role FROM casting_user_roles
            WHERE project_id = $1 AND user_id = $2
            LIMIT 1`,
          [projectId, viewerId],
        );
        let role: string | null = roleRes.rows[0]?.role ?? null;
        if (!role) {
          // Sjekk om viewer er lederen
          const leaderRes = await pool.query(
            `SELECT 1 FROM casting_projects
              WHERE id = $1 AND created_by = $2 LIMIT 1`,
            [projectId, viewerId],
          );
          if (leaderRes.rows.length > 0) role = "leder";
        }

        // 1. Sjekk bruker-spesifikk override
        const userOverride = await pool.query(
          `SELECT tab_values FROM role_room_project_tab_overrides
            WHERE project_id = $1 AND target_type = 'user' AND target_value = $2
            LIMIT 1`,
          [projectId, viewerId],
        );
        if (userOverride.rows[0]) {
          res.json({ tabValues: userOverride.rows[0].tab_values, source: "user", role });
          return;
        }

        // 2. Sjekk rolle-override
        if (role) {
          const roleOverride = await pool.query(
            `SELECT tab_values FROM role_room_project_tab_overrides
              WHERE project_id = $1 AND target_type = 'role' AND target_value = $2
              LIMIT 1`,
            [projectId, role],
          );
          if (roleOverride.rows[0]) {
            res.json({ tabValues: roleOverride.rows[0].tab_values, source: "role", role });
            return;
          }
        }

        // 3. Ingen override — frontend faller til plattform-default
        res.json({ tabValues: null, source: "default", role });
      } catch (err) {
        console.error("[rr-project-tab-config] my-tabs failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );
}
