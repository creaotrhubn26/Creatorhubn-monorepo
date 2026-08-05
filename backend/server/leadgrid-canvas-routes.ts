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

// Strukturen (Daniel 2026-08-05): Møte/Lead/Befaring/Salgsplan/Prosjekt/
// Rute — gamle verdier beholdes så eksisterende notater dekoder.
const GYLDIGE_KATEGORIER = new Set([
  "mote", "lead", "befaring", "salgsplan", "prosjekt", "rute",
  "oppfolging", "ide", "kunde", "internt",
]);
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
  // Fase 4: stedfesting + stempel-overlay (JSON).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS stempler TEXT NOT NULL DEFAULT '[]'`);
  // Fase 5: flyttbare tekstbokser (JSON).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS tekstbokser TEXT NOT NULL DEFAULT '[]'`);
  // Fase 6: flyttbare/skalerbare figurer (JSON).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS figurer TEXT NOT NULL DEFAULT '[]'`);
  // Papir-maler (Daniel 2026-08-05): SWOT/Kanban/Pipeline/… under flata.
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS papir TEXT NOT NULL DEFAULT 'blank'`);
  // Levende maler: tankekart-/brainstorm-noder + antall sider.
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS noder TEXT NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS sider INT NOT NULL DEFAULT 1`);
  // Objekt-laget: bilder + lead-/KPI-/kart-/oppgave-widgets (JSON m/
  // base64-bilder — cap håndheves i parseFelter).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS objekter TEXT NOT NULL DEFAULT '[]'`);
  // Universalsøk: samlet søkbar tekst (OCR av blekk + PDF + bilder +
  // tekstbokser/noder) — bygges på klienten ved lagring.
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS sokbar_tekst TEXT NOT NULL DEFAULT ''`);
  schemaReady = true;
}

type NotatFelter = {
  tittel: string;
  kategori: string;
  selskap: string | null;
  leadId: string | null;
  drawing: string;
  delt: boolean;
  lat: number | null;
  lon: number | null;
  stempler: string;
  tekstbokser: string;
  figurer: string;
  papir: string;
  noder: string;
  sider: number;
  objekter: string;
  sokbarTekst: string;
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
    lat: typeof b.lat === "number" && isFinite(b.lat) ? b.lat : null,
    lon: typeof b.lon === "number" && isFinite(b.lon) ? b.lon : null,
    stempler: String(b.stempler ?? "[]").slice(0, 20_000),
    tekstbokser: String(b.tekstbokser ?? "[]").slice(0, 40_000),
    figurer: String(b.figurer ?? "[]").slice(0, 40_000),
    papir: String(b.papir ?? "blank").slice(0, 40),
    noder: String(b.noder ?? "[]").slice(0, 60_000),
    sider: Math.min(20, Math.max(1, Number(b.sider ?? 1) || 1)),
    objekter: String(b.objekter ?? "[]").slice(0, 12_000_000),
    sokbarTekst: String(b.sokbar_tekst ?? b.sokbarTekst ?? "").slice(0, 20_000),
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
                n.lat, n.lon, n.stempler, n.tekstbokser, n.figurer, n.papir,
                n.noder, n.sider, n.objekter, n.sokbar_tekst,
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
          lat: row.lat,
          lon: row.lon,
          stempler: row.stempler ?? "[]",
          tekstbokser: row.tekstbokser ?? "[]",
          figurer: row.figurer ?? "[]",
          papir: row.papir ?? "blank",
          noder: row.noder ?? "[]",
          sider: row.sider ?? 1,
          objekter: row.objekter ?? "[]",
          sokbar_tekst: row.sokbar_tekst ?? "",
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
           (id, organization_id, user_id, tittel, kategori, selskap, lead_id,
            drawing_base64, delt, lat, lon, stempler, tekstbokser, figurer,
            papir, noder, sider, objekter, sokbar_tekst)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [id, orgId, session.userId, felter.tittel, felter.kategori,
         felter.selskap, felter.leadId, felter.drawing, felter.delt,
         felter.lat, felter.lon, felter.stempler, felter.tekstbokser,
         felter.figurer, felter.papir, felter.noder, felter.sider,
         felter.objekter, felter.sokbarTekst]);
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
                drawing_base64 = $5, delt = $6, lat = $7, lon = $8,
                stempler = $9, tekstbokser = $10, figurer = $11,
                papir = $12, noder = $13, sider = $14, objekter = $15,
                sokbar_tekst = $16, updated_at = now()
          WHERE id = $17 AND user_id = $18`,
        [felter.tittel, felter.kategori, felter.selskap, felter.leadId,
         felter.drawing, felter.delt, felter.lat, felter.lon,
         felter.stempler, felter.tekstbokser, felter.figurer,
         felter.papir, felter.noder, felter.sider, felter.objekter,
         felter.sokbarTekst, req.params.id, session.userId]);
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
