/**
 * Team-delt Infographic-bibliotek — når en bruker deler en ferdig infographic
 * blir den synlig for HELE teamet (alle innloggede). Bygger på samme mønster som
 * infographic-signals: on-demand tabell, Bearer-auth, egne rader kan slettes.
 *
 * Endepunkter (auth: RR_BEARER_TOKEN):
 *   POST   /api/role-room/infographic-library         (del/oppdater — egen rad)
 *   GET    /api/role-room/infographic-library          (hele team-biblioteket)
 *   DELETE /api/role-room/infographic-library/:id      (avdel — kun egen rad)
 *
 * Snapshotet lagres som JSONB (scener + brand + logo + data + palett). Deling er
 * eksplisitt: en rad her = brukeren har valgt «Del med team».
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import express from "express";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData> }

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.slice(7).trim()) ?? null;
  return null;
}

export function registerRoleRoomInfographicLibraryRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;
  let ready = false;
  void pool
    .query(
      `CREATE TABLE IF NOT EXISTS infographic_library (
         id             TEXT PRIMARY KEY,
         created_by     TEXT NOT NULL,
         author_name    TEXT,
         name           TEXT NOT NULL,
         snapshot       JSONB NOT NULL,
         preview_tpl_id TEXT,
         updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )
    .then(() => pool.query(`CREATE INDEX IF NOT EXISTS idx_ig_library_updated ON infographic_library (updated_at DESC)`))
    .then(() => { ready = true; })
    .catch((e: Error) => console.warn("[ig-library] tabell-feil:", e.message));

  // Del (eller oppdater egen delt) infographic med teamet.
  app.post("/api/role-room/infographic-library", express.json({ limit: "3mb" }), async (req: Request, res: Response) => {
    const s = getSession(req, activeSessions);
    if (!s) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!ready) { res.status(503).json({ error: "ikke_klar" }); return; }
    const b = req.body ?? {};
    const id = String(b.id ?? "").slice(0, 80);
    const name = String(b.name ?? "").slice(0, 200).trim();
    const snapshot = b.snapshot;
    if (!id || !name || !snapshot || typeof snapshot !== "object") { res.status(400).json({ error: "ugyldig_input" }); return; }
    const authorName = b.authorName ? String(b.authorName).slice(0, 120) : (s.email ? s.email.split("@")[0] : null);
    const previewTplId = b.previewTplId ? String(b.previewTplId).slice(0, 120) : null;
    try {
      // Upsert — men kun eier kan overskrive sin egen rad (created_by-vakt).
      await pool.query(
        `INSERT INTO infographic_library (id, created_by, author_name, name, snapshot, preview_tpl_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, snapshot = EXCLUDED.snapshot,
           preview_tpl_id = EXCLUDED.preview_tpl_id, author_name = EXCLUDED.author_name, updated_at = now()
         WHERE infographic_library.created_by = $2`,
        [id, s.userId, authorName, name, JSON.stringify(snapshot), previewTplId],
      );
      res.json({ ok: true, id });
    } catch (e) {
      res.status(500).json({ error: "lagre_feil", detail: (e as Error).message });
    }
  });

  // Hele team-biblioteket (nyeste først). Markerer hvilke som er mine.
  app.get("/api/role-room/infographic-library", async (req: Request, res: Response) => {
    const s = getSession(req, activeSessions);
    if (!s) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!ready) { res.json({ items: [] }); return; }
    try {
      const { rows } = await pool.query(
        `SELECT id, author_name, name, snapshot, preview_tpl_id, created_by,
                EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
           FROM infographic_library
          ORDER BY updated_at DESC LIMIT 200`,
      );
      res.json({
        items: rows.map((r) => ({
          id: r.id, name: r.name, authorName: r.author_name, snapshot: r.snapshot,
          previewTplId: r.preview_tpl_id, mine: r.created_by === s.userId, updatedAt: Number(r.updated_ms) || 0,
        })),
      });
    } catch (e) {
      res.status(500).json({ error: "hent_feil", detail: (e as Error).message });
    }
  });

  // Avdel — fjerner kun egen rad.
  app.delete("/api/role-room/infographic-library/:id", async (req: Request, res: Response) => {
    const s = getSession(req, activeSessions);
    if (!s) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!ready) { res.status(503).json({ error: "ikke_klar" }); return; }
    try {
      const r = await pool.query(`DELETE FROM infographic_library WHERE id = $1 AND created_by = $2`, [String(req.params.id).slice(0, 80), s.userId]);
      res.json({ ok: true, deleted: r.rowCount ?? 0 });
    } catch (e) {
      res.status(500).json({ error: "slett_feil", detail: (e as Error).message });
    }
  });
}
