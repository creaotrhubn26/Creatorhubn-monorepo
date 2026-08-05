/**
 * Leadgrid Canvas — Pencil-first notater koblet til leads (fase 1).
 *
 * Notatet er en PKDrawing (base64) + tittel/kategori/lead-kobling,
 * org+bruker-scopet. Lazy tabell (samme mønster som møteloggen).
 * Entitlement: leadgridCanvas (canUse — default PÅ, superadmin kan låse).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomUUID } from "crypto";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled, LEADGRID_CANVAS_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";

const GYLDIGE_KATEGORIER = new Set(["mote", "oppfolging", "rute", "ide", "kunde", "internt"]);
/** PKDrawing-base64 cap — 5 MB holder til svært detaljerte tegninger. */
const MAKS_DRAWING_TEGN = 5 * 1024 * 1024;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_canvas_notater (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tittel TEXT NOT NULL DEFAULT '',
      kategori TEXT NOT NULL DEFAULT 'mote',
      selskap TEXT,
      lead_id TEXT,
      drawing_base64 TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leadgrid_canvas_bruker
      ON leadgrid_canvas_notater (organization_id, user_id, updated_at DESC)`);
  // Fase 2 (deling i org): lat selvheler — ingen manuell migrasjon.
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS delt BOOLEAN NOT NULL DEFAULT false`);
  schemaReady = true;
}

type NotatFelter = {
  tittel: string;
  kategori: string;
  selskap: string | null;
  leadId: string | null;
  drawing: string;
  delt: boolean;
};

function parseFelter(b: Record<string, unknown>): NotatFelter | null {
  const drawing = String(b.drawing_base64 ?? b.drawingBase64 ?? "");
  if (drawing.length > MAKS_DRAWING_TEGN) return null;
  const kategori = String(b.kategori ?? "mote");
  return {
    tittel: String(b.tittel ?? "").slice(0, 300),
    kategori: GYLDIGE_KATEGORIER.has(kategori) ? kategori : "mote",
    selskap: b.selskap ? String(b.selskap).slice(0, 200) : null,
    leadId: (b.lead_id ?? b.leadId) ? String(b.lead_id ?? b.leadId).slice(0, 64) : null,
    drawing,
    delt: b.delt === true,
  };
}

export function registerLeadgridCanvasRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Alle notatene mine (org+bruker), nyeste først. */
  app.get("/api/leadgrid/canvas", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ notater: [] }); return; }
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT n.id, n.tittel, n.kategori, n.selskap, n.lead_id,
                n.drawing_base64, n.updated_at, n.delt, n.user_id,
                COALESCE(u.name, u.email, '') AS eier_navn
           FROM leadgrid_canvas_notater n
           LEFT JOIN users u ON u.id::text = n.user_id
          WHERE n.organization_id = $1 AND (n.user_id = $2 OR n.delt)
          ORDER BY n.updated_at DESC LIMIT 100`,
        [orgId, session.userId]);
      res.json({
        notater: r.rows.map((row) => ({
          id: row.id,
          tittel: row.tittel,
          kategori: row.kategori,
          selskap: row.selskap,
          lead_id: row.lead_id,
          drawing_base64: row.drawing_base64,
          delt: row.delt === true,
          er_min: row.user_id === session.userId,
          eier_navn: row.user_id === session.userId ? null : row.eier_navn,
          oppdatert: row.updated_at instanceof Date
            ? row.updated_at.toISOString() : String(row.updated_at),
        })),
      });
    } catch (e) {
      console.error("[canvas] GET failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Nytt notat → { id }. */
  app.post("/api/leadgrid/canvas", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(403).json({ error: "ingen_org" }); return; }
      const felter = parseFelter((req.body ?? {}) as Record<string, unknown>);
      if (!felter) { res.status(413).json({ error: "tegning_for_stor" }); return; }
      await ensureSchema(pool);
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadgrid_canvas_notater
           (id, organization_id, user_id, tittel, kategori, selskap, lead_id, drawing_base64, delt)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, orgId, session.userId, felter.tittel, felter.kategori,
         felter.selskap, felter.leadId, felter.drawing, felter.delt]);
      res.json({ id });
    } catch (e) {
      console.error("[canvas] POST failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Oppdater notat (bruker-scopet). */
  app.put("/api/leadgrid/canvas/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const felter = parseFelter((req.body ?? {}) as Record<string, unknown>);
      if (!felter) { res.status(413).json({ error: "tegning_for_stor" }); return; }
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE leadgrid_canvas_notater
            SET tittel = $1, kategori = $2, selskap = $3, lead_id = $4,
                drawing_base64 = $5, delt = $6, updated_at = now()
          WHERE id = $7 AND user_id = $8`,
        [felter.tittel, felter.kategori, felter.selskap, felter.leadId,
         felter.drawing, felter.delt, req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] PUT failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Slett notat (bruker-scopet). */
  app.delete("/api/leadgrid/canvas/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      await ensureSchema(pool);
      const r = await pool.query(
        `DELETE FROM leadgrid_canvas_notater WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] DELETE failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
