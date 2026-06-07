/**
 * Demo Studio sky-bibliotek — synk av genererte artefakter (infographics,
 * one-pagers, Product Brain, guider) til backend, så de deles på tvers av
 * enheter/team i stedet for kun localStorage.
 *
 * Endepunkter (auth: RR_BEARER_TOKEN):
 *   GET    /api/role-room/demo-assets?host=theroleroom.com
 *   POST   /api/role-room/demo-assets
 *   DELETE /api/role-room/demo-assets/:id
 *
 * Tabell opprettes on-demand (ingen egen migrasjon). Tilgang gates på eier
 * (created_by = innlogget bruker).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import express from "express";
import { randomBytes } from "node:crypto";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData> }

const VALID_KINDS = ["infographic", "onepager", "brain", "variant", "thumbnail", "guide", "other"];
const MAX_PAYLOAD = 2_000_000; // ~2 MB pr. artefakt (SVG/HTML/data-URL)

function getUserId(req: Request, sessions: Map<string, SessionData>): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    return sessions.get(t)?.userId ?? null;
  }
  return null;
}

export function registerRoleRoomDemoAssetsRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;
  let ready = false;
  void pool
    .query(
      `CREATE TABLE IF NOT EXISTS demo_studio_assets (
         id         TEXT PRIMARY KEY,
         created_by TEXT NOT NULL,
         host       TEXT,
         kind       TEXT NOT NULL,
         title      TEXT NOT NULL,
         payload    JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )
    .then(() => { ready = true; })
    .catch((e: Error) => console.warn("[demo-assets] tabell-feil:", e.message));

  app.get("/api/role-room/demo-assets", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!ready) { res.json({ assets: [] }); return; }
    const host = String(req.query.host ?? "").trim();
    try {
      const { rows } = await pool.query(
        `SELECT id, host, kind, title, payload, created_at
           FROM demo_studio_assets
          WHERE created_by = $1 ${host ? "AND host = $2" : ""}
          ORDER BY created_at DESC LIMIT 200`,
        host ? [uid, host] : [uid],
      );
      res.json({ assets: rows.map((r) => ({ ...r.payload, id: r.id, host: r.host, kind: r.kind, title: r.title, createdAt: r.created_at })) });
    } catch (e) {
      res.status(500).json({ error: "list_feil", detail: (e as Error).message });
    }
  });

  app.post("/api/role-room/demo-assets", express.json({ limit: "4mb" }), async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!ready) { res.status(503).json({ error: "ikke_klar" }); return; }
    const { kind, title, host } = req.body ?? {};
    if (!VALID_KINDS.includes(String(kind))) { res.status(400).json({ error: "ugyldig_kind" }); return; }
    if (!title || typeof title !== "string") { res.status(400).json({ error: "mangler_tittel" }); return; }
    const payload = { svg: req.body?.svg, text: req.body?.text, dataUrl: req.body?.dataUrl, note: req.body?.note };
    if (JSON.stringify(payload).length > MAX_PAYLOAD) { res.status(413).json({ error: "for_stor" }); return; }
    const id = `c_${randomBytes(6).toString("hex")}`;
    try {
      await pool.query(
        `INSERT INTO demo_studio_assets (id, created_by, host, kind, title, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, uid, String(host ?? "") || null, String(kind), title, JSON.stringify(payload)],
      );
      res.json({ id, ok: true });
    } catch (e) {
      res.status(500).json({ error: "lagre_feil", detail: (e as Error).message });
    }
  });

  app.delete("/api/role-room/demo-assets/:id", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    try {
      await pool.query(`DELETE FROM demo_studio_assets WHERE id = $1 AND created_by = $2`, [String(req.params.id), uid]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "slett_feil", detail: (e as Error).message });
    }
  });
}
