/**
 * Mockup Studio-prosjekter i skyen.
 *
 * MockupDoc er en egen kontrakt fra DemoProject. Prosjektene lagres derfor i
 * en egen tabell og endepunktfamilie, alltid eieravgrenset med created_by.
 * project_updated_at er klientens endringstid og gir deterministisk
 * konfliktløsing mellom flere maskiner: en eldre kopi får aldri overskrive en
 * nyere kopi.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData> }

const VALID_STATUSES = new Set(["draft", "ready", "exported", "archived"]);
const MAX_PROJECT_BYTES = 6_500_000;
const MAX_PROJECTS_PER_USER = 100;

function getUserId(req: Request, sessions: Map<string, SessionData>): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return sessions.get(auth.slice(7).trim())?.userId ?? null;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

export function registerRoleRoomMockupProjectsRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;
  // Kanonisk skjema ligger i migrasjon 0454. On-demand-oppretting gjør en
  // rullende deploy trygg dersom en web-instans starter før migrasjonsjobben.
  const tableReady = pool
    .query(
      `CREATE TABLE IF NOT EXISTS demo_studio_mockup_projects (
         id                 TEXT NOT NULL,
         created_by         TEXT NOT NULL,
         name               TEXT NOT NULL,
         status             TEXT NOT NULL DEFAULT 'draft',
         template_id        TEXT,
         project_updated_at BIGINT NOT NULL,
         payload            JSONB NOT NULL,
         updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (id, created_by)
       )`,
    )
    .then(async () => {
      await pool.query(
        `CREATE INDEX IF NOT EXISTS demo_studio_mockup_projects_owner_updated_idx
           ON demo_studio_mockup_projects (created_by, project_updated_at DESC)`,
      );
      return true;
    })
    .catch((error: Error) => {
      console.warn("[mockup-projects] tabell-feil:", error.message);
      return false;
    });

  async function requireTable(res: Response): Promise<boolean> {
    if (await tableReady) return true;
    res.status(503).json({ error: "ikke_klar" });
    return false;
  }

  app.get("/api/role-room/mockup-projects", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!(await requireTable(res))) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, status, template_id, project_updated_at, updated_at
           FROM demo_studio_mockup_projects
          WHERE created_by = $1
          ORDER BY project_updated_at DESC
          LIMIT $2`,
        [uid, MAX_PROJECTS_PER_USER],
      );
      res.json({
        projects: rows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          template: row.template_id ?? "",
          projectUpdatedAt: Number(row.project_updated_at),
          syncedAt: row.updated_at,
        })),
      });
    } catch {
      res.status(500).json({ error: "list_feil", detail: "internal_error" });
    }
  });

  app.get("/api/role-room/mockup-projects/:id", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const id = String(req.params.id ?? "");
    if (!validId(id)) { res.status(400).json({ error: "ugyldig_id" }); return; }
    if (!(await requireTable(res))) return;
    try {
      const { rows } = await pool.query(
        `SELECT payload FROM demo_studio_mockup_projects WHERE id = $1 AND created_by = $2`,
        [id, uid],
      );
      if (!rows.length) { res.status(404).json({ error: "finnes_ikke" }); return; }
      res.json({ project: rows[0].payload });
    } catch {
      res.status(500).json({ error: "hent_feil", detail: "internal_error" });
    }
  });

  app.put("/api/role-room/mockup-projects/:id", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!(await requireTable(res))) return;
    const id = String(req.params.id ?? "");
    const project = req.body?.project;
    const projectUpdatedAt = Number(project?.updatedAt);
    if (
      !validId(id)
      || !project
      || typeof project !== "object"
      || project.id !== id
      || project.version !== 1
      || !project.canvas
      || typeof project.canvas !== "object"
      || !Array.isArray(project.devices)
      || !Array.isArray(project.texts)
      || !Number.isSafeInteger(projectUpdatedAt)
      || projectUpdatedAt <= 0
    ) {
      res.status(400).json({ error: "ugyldig_prosjekt" });
      return;
    }
    const status = String(project.status ?? "draft");
    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ error: "ugyldig_status" });
      return;
    }
    const raw = JSON.stringify(project);
    if (Buffer.byteLength(raw, "utf8") > MAX_PROJECT_BYTES) {
      res.status(413).json({ error: "for_stor" });
      return;
    }

    try {
      const existing = await pool.query(
        `SELECT 1 FROM demo_studio_mockup_projects WHERE id = $1 AND created_by = $2`,
        [id, uid],
      );
      if (!existing.rows.length) {
        const count = await pool.query(
          `SELECT COUNT(*)::int AS count FROM demo_studio_mockup_projects WHERE created_by = $1`,
          [uid],
        );
        if (Number(count.rows[0]?.count ?? 0) >= MAX_PROJECTS_PER_USER) {
          res.status(409).json({ error: "prosjektgrense" });
          return;
        }
      }

      const saved = await pool.query(
        `INSERT INTO demo_studio_mockup_projects
           (id, created_by, name, status, template_id, project_updated_at, payload, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (id, created_by)
         DO UPDATE SET name = EXCLUDED.name,
                       status = EXCLUDED.status,
                       template_id = EXCLUDED.template_id,
                       project_updated_at = EXCLUDED.project_updated_at,
                       payload = EXCLUDED.payload,
                       updated_at = now()
         WHERE demo_studio_mockup_projects.project_updated_at < EXCLUDED.project_updated_at
         RETURNING project_updated_at`,
        [
          id,
          uid,
          String(project.name ?? "Uten navn").slice(0, 200),
          status,
          String(project.template ?? "").slice(0, 200) || null,
          projectUpdatedAt,
          raw,
        ],
      );
      res.json({ ok: true, updated: (saved.rowCount ?? 0) > 0 });
    } catch {
      res.status(500).json({ error: "lagre_feil", detail: "internal_error" });
    }
  });

  app.delete("/api/role-room/mockup-projects/:id", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const id = String(req.params.id ?? "");
    if (!validId(id)) { res.status(400).json({ error: "ugyldig_id" }); return; }
    if (!(await requireTable(res))) return;
    try {
      await pool.query(
        `DELETE FROM demo_studio_mockup_projects WHERE id = $1 AND created_by = $2`,
        [id, uid],
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "slett_feil", detail: "internal_error" });
    }
  });
}
