/**
 * role-room-education-license-routes.ts — mountes under /api/role-room.
 *
 * Per-institusjon TRR-lisens. «TRR-seter» = navngitte, aktive Role Room-brukere
 * (faglærere + studenter). GET rapporterer grense/ubegrenset + brukte + ledige;
 * PUT setter lisensvilkårene (grense eller «ubegrenset»). Owner-scopet som resten
 * av education_*. Ikke self-serve billing — dette registrerer avtalte vilkår.
 *
 * Endepunkter:
 *   GET /api/role-room/education/license
 *   PUT /api/role-room/education/license   { seatLimit?: number|null, unlimited?: boolean, model?: string }
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export interface LicenseView {
  seatLimit: number | null;
  unlimited: boolean;
  model: string;
  used: number;
  available: number | null; // null = ubegrenset eller ingen grense satt
}

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

/** Antall brukte TRR-seter = faglærere + aktive studenter eid av brukeren. */
async function countUsedSeats(pool: Pool, userId: string): Promise<number> {
  let faculty = 0;
  let students = 0;
  try {
    const f = await pool.query(`SELECT COUNT(*)::int AS n FROM role_room_education_faculty WHERE owner_user_id = $1`, [userId]);
    faculty = Number(f.rows[0]?.n ?? 0);
  } catch { /* tabell mangler → 0 */ }
  try {
    const s = await pool.query(`SELECT COUNT(*)::int AS n FROM role_room_education_students WHERE owner_user_id = $1 AND status = 'active'`, [userId]);
    students = Number(s.rows[0]?.n ?? 0);
  } catch { /* tabell mangler → 0 */ }
  return faculty + students;
}

function buildView(row: Record<string, unknown> | undefined, used: number): LicenseView {
  const seatLimit = row && row.seat_limit != null ? Number(row.seat_limit) : null;
  const unlimited = Boolean(row?.unlimited);
  const model = (row?.model as string) ?? "named";
  const available = unlimited || seatLimit == null ? null : Math.max(0, seatLimit - used);
  return { seatLimit, unlimited, model, used, available };
}

export interface CreateEducationLicenseRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationLicenseRouter(
  pool: Pool,
  deps: CreateEducationLicenseRouterDeps = {},
): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };
  const uid = (req: Request) => (req as Request & { userId: string }).userId;

  router.get("/education/license", requireAuth, async (req, res) => {
    try {
      const used = await countUsedSeats(pool, uid(req));
      let row: Record<string, unknown> | undefined;
      try {
        const r = await pool.query(`SELECT * FROM role_room_education_license WHERE owner_user_id = $1`, [uid(req)]);
        row = r.rows[0];
      } catch { /* lisens-tabell mangler → defaults */ }
      res.json({ license: buildView(row, used) });
    } catch (err) {
      console.warn("[education-license] get failed:", (err as Error).message);
      res.json({ license: { seatLimit: null, unlimited: false, model: "named", used: 0, available: null } });
    }
  });

  router.put("/education/license", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { seatLimit?: number | null; unlimited?: boolean; model?: string };
    const unlimited = typeof body.unlimited === "boolean" ? body.unlimited : false;
    let seatLimit: number | null = null;
    if (body.seatLimit != null) {
      const n = Number(body.seatLimit);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) { res.status(400).json({ error: "invalid_seat_limit" }); return; }
      seatLimit = n;
    }
    const model = typeof body.model === "string" && ["named", "site", "fte"].includes(body.model)
      ? body.model
      : (unlimited ? "site" : "named");
    try {
      await pool.query(
        `INSERT INTO role_room_education_license (owner_user_id, seat_limit, unlimited, model, updated_at)
         VALUES ($1,$2,$3,$4, now())
         ON CONFLICT (owner_user_id) DO UPDATE
           SET seat_limit = EXCLUDED.seat_limit,
               unlimited = EXCLUDED.unlimited,
               model = EXCLUDED.model,
               updated_at = now()`,
        [uid(req), unlimited ? null : seatLimit, unlimited, model],
      );
      const used = await countUsedSeats(pool, uid(req));
      const r = await pool.query(`SELECT * FROM role_room_education_license WHERE owner_user_id = $1`, [uid(req)]);
      res.json({ license: buildView(r.rows[0], used) });
    } catch (err) {
      console.error("[education-license] put failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  return router;
}
