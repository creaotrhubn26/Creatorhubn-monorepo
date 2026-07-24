// leadgrid-pondus-quiz-routes.ts
//
// Pondus-quiz (mig 0410): Akademiets kapittel 12 blir ekte. Selgeren tar en
// 12-spørsmåls selvtest → score per Pondus-dimensjon (0-100) → profil.
// Klienten regner ut dimensjons-scorene (spørsmålsbanken bor i appen);
// backend validerer området, persisterer og serverer profiler.
//
// Endepunkter:
//   POST /api/leadgrid/pondus/quiz        (selger: lagre gjennomføring)
//   GET  /api/leadgrid/pondus/quiz/mine   (selger: siste profil + historikk)
//   GET  /api/leadgrid/pondus/quiz/org    (leder: siste profil per selger —
//                                          brukes av coaching/anbefaling)
//
// camelCase DTO-er. ensureTable() self-healer (samme mønster som 0405-0407).

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

type SessionUser = { userId: string; email: string; name: string; role: string };

export interface LeadgridPondusQuizRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

function isManagerRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "admin" || r === "super_admin" || r === "owner" || r === "sales_manager";
}

const DIMENSIONS = ["autoritet", "klarhet", "troverdighet", "trygghet", "fremdrift"] as const;

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function resultDTO(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    userId: String(row.user_id ?? ""),
    userName: (row.user_name as string | null) ?? null,
    autoritet: Number(row.autoritet ?? 0),
    klarhet: Number(row.klarhet ?? 0),
    troverdighet: Number(row.troverdighet ?? 0),
    trygghet: Number(row.trygghet ?? 0),
    fremdrift: Number(row.fremdrift ?? 0),
    total: Number(row.total ?? 0),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

export function registerLeadgridPondusQuizRoutes(deps: LeadgridPondusQuizRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  let ensured = false;
  async function ensureTable(): Promise<void> {
    if (ensured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leadgrid_pondus_quiz_results (
        id SERIAL PRIMARY KEY, organization_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL, user_name VARCHAR(255),
        autoritet INT NOT NULL DEFAULT 0, klarhet INT NOT NULL DEFAULT 0,
        troverdighet INT NOT NULL DEFAULT 0, trygghet INT NOT NULL DEFAULT 0,
        fremdrift INT NOT NULL DEFAULT 0, total INT NOT NULL DEFAULT 0,
        answers JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_pondus_quiz_user_idx ON leadgrid_pondus_quiz_results (user_id, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_pondus_quiz_org_idx ON leadgrid_pondus_quiz_results (organization_id, created_at DESC)`);
    ensured = true;
  }

  // ── Selger: lagre gjennomføring ─────────────────────────────────────
  app.post("/api/leadgrid/pondus/quiz", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const scores: Record<string, number> = {};
      for (const d of DIMENSIONS) scores[d] = clampScore(b[d]);
      const total = clampScore(
        b.total ?? DIMENSIONS.reduce((s, d) => s + scores[d], 0) / DIMENSIONS.length,
      );
      const answers =
        b.answers && typeof b.answers === "object" ? JSON.stringify(b.answers) : null;
      const { rows } = await pool.query(
        `INSERT INTO leadgrid_pondus_quiz_results
           (organization_id, user_id, user_name, autoritet, klarhet, troverdighet,
            trygghet, fremdrift, total, answers)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
        [orgId, session.userId, session.name || null,
         scores.autoritet, scores.klarhet, scores.troverdighet,
         scores.trygghet, scores.fremdrift, total, answers],
      );
      return res.json({ result: resultDTO(rows[0]) });
    } catch (err) {
      console.error("[pondus-quiz] submit failed:", err);
      return res.status(500).json({ error: "quiz_submit_failed" });
    }
  });

  // ── Selger: egen profil (siste) + historikk ─────────────────────────
  app.get("/api/leadgrid/pondus/quiz/mine", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable();
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_pondus_quiz_results
          WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [session.userId],
      );
      return res.json({
        latest: rows.length > 0 ? resultDTO(rows[0]) : null,
        history: rows.map(resultDTO),
        attempts: rows.length,
      });
    } catch (err) {
      console.error("[pondus-quiz] mine failed:", err);
      return res.status(500).json({ error: "quiz_mine_failed" });
    }
  });

  // ── Leder: siste profil per selger i org-en ──────────────────────────
  app.get("/api/leadgrid/pondus/quiz/org", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      // DISTINCT ON: nyeste rad per bruker.
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (user_id) *
           FROM leadgrid_pondus_quiz_results
          WHERE organization_id = $1
          ORDER BY user_id, created_at DESC`,
        [orgId],
      );
      return res.json({ profiles: rows.map(resultDTO) });
    } catch (err) {
      console.error("[pondus-quiz] org failed:", err);
      return res.status(500).json({ error: "quiz_org_failed" });
    }
  });
}
