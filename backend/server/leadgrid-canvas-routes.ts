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
  // Time Travel: versjonshistorikk per notat (skrives ved PUT når
  // tegningen faktisk endres, cap 40 per notat).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_canvas_versjoner (
      id UUID PRIMARY KEY,
      notat_id UUID NOT NULL,
      kategori TEXT NOT NULL DEFAULT 'mote',
      drawing_base64 TEXT NOT NULL DEFAULT '',
      objekter TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_canvas_versjoner_notat
      ON leadgrid_canvas_versjoner (notat_id, created_at DESC)`);
  // Ekte PDF-håndtering (Daniel 2026-08-05): originaldokumentene lagres
  // som base64 (vektor-rendering + tapsfri eksport på klienten).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS dokumenter TEXT NOT NULL DEFAULT '[]'`);
  // Papirkurv (Daniel 2026-08-05): soft delete — notatet ligger 30 dager
  // i papirkurven før det tømmes for godt (lat opprydding i GET).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS slettet_at TIMESTAMPTZ`);
  schemaReady = true;
}

/** Tøm notater som har ligget >30 dager i papirkurven (best effort). */
async function tomGamleFraPapirkurv(pool: Pool): Promise<void> {
  try {
    const r = await pool.query<{ id: string }>(
      `DELETE FROM leadgrid_canvas_notater
        WHERE slettet_at IS NOT NULL AND slettet_at < now() - interval '30 days'
        RETURNING id`);
    if (r.rows.length > 0) {
      await pool.query(
        `DELETE FROM leadgrid_canvas_versjoner WHERE notat_id = ANY($1::uuid[])`,
        [r.rows.map((row) => row.id)]);
    }
  } catch (e) {
    console.warn("[canvas] papirkurv-opprydding feilet:", String(e).slice(0, 120));
  }
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
  dokumenter: string;
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
    // Original-PDF-er (base64) — vektor-kvalitet hele veien.
    dokumenter: String(b.dokumenter ?? "[]").slice(0, 16_000_000),
  };
}

export function registerLeadgridCanvasRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Alle notatene mine (org+bruker), nyeste først.
   *  ?papirkurv=1 → mine slettede notater i stedet (siste 30 dager). */
  app.get("/api/leadgrid/canvas", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ notater: [] }); return; }
      await ensureSchema(pool);
      await tomGamleFraPapirkurv(pool);
      const visPapirkurv = req.query.papirkurv === "1";
      const r = visPapirkurv
        ? await pool.query(
            `SELECT n.id, n.tittel, n.kategori, n.selskap, n.lead_id,
                    n.drawing_base64, n.updated_at, n.delt, n.user_id,
                    n.lat, n.lon, n.stempler, n.tekstbokser, n.figurer, n.papir,
                    n.noder, n.sider, n.objekter, n.sokbar_tekst, n.dokumenter, n.slettet_at,
                    '' AS eier_navn
               FROM leadgrid_canvas_notater n
              WHERE n.organization_id = $1 AND n.user_id = $2
                AND n.slettet_at IS NOT NULL
              ORDER BY n.slettet_at DESC LIMIT 100`,
            [orgId, session.userId])
        : await pool.query(
            `SELECT n.id, n.tittel, n.kategori, n.selskap, n.lead_id,
                    n.drawing_base64, n.updated_at, n.delt, n.user_id,
                    n.lat, n.lon, n.stempler, n.tekstbokser, n.figurer, n.papir,
                    n.noder, n.sider, n.objekter, n.sokbar_tekst, n.dokumenter, n.slettet_at,
                    COALESCE(u.name, u.email, '') AS eier_navn
               FROM leadgrid_canvas_notater n
               LEFT JOIN users u ON u.id::text = n.user_id
              WHERE n.organization_id = $1 AND (n.user_id = $2 OR n.delt)
                AND n.slettet_at IS NULL
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
          dokumenter: row.dokumenter ?? "[]",
          slettet_at: row.slettet_at instanceof Date
            ? row.slettet_at.toISOString()
            : (row.slettet_at ? String(row.slettet_at) : null),
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
            papir, noder, sider, objekter, sokbar_tekst, dokumenter)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [id, orgId, session.userId, felter.tittel, felter.kategori,
         felter.selskap, felter.leadId, felter.drawing, felter.delt,
         felter.lat, felter.lon, felter.stempler, felter.tekstbokser,
         felter.figurer, felter.papir, felter.noder, felter.sider,
         felter.objekter, felter.sokbarTekst, felter.dokumenter]);
      res.json({ id });
    } catch (e) {
      console.error("[canvas] POST failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Oppdater notat (bruker-scopet). Time Travel: gammel tegning
   *  versjoneres FØR oppdatering når den faktisk er endret. */
  app.put("/api/leadgrid/canvas/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const felter = parseFelter((req.body ?? {}) as Record<string, unknown>);
      if (!felter) { res.status(413).json({ error: "tegning_for_stor" }); return; }
      await ensureSchema(pool);
      // Versjonér forrige tilstand (best effort — velter aldri lagringen).
      try {
        const forrige = await pool.query<{ drawing_base64: string; kategori: string; objekter: string }>(
          `SELECT drawing_base64, kategori, objekter FROM leadgrid_canvas_notater
            WHERE id = $1 AND user_id = $2`,
          [req.params.id, session.userId]);
        const rad = forrige.rows[0];
        if (rad && rad.drawing_base64 !== felter.drawing && rad.drawing_base64.length > 0) {
          await pool.query(
            `INSERT INTO leadgrid_canvas_versjoner
               (id, notat_id, kategori, drawing_base64, objekter)
             VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), req.params.id, rad.kategori, rad.drawing_base64,
             rad.objekter ?? "[]"]);
          await pool.query(
            `DELETE FROM leadgrid_canvas_versjoner
              WHERE notat_id = $1 AND id NOT IN (
                SELECT id FROM leadgrid_canvas_versjoner
                 WHERE notat_id = $1 ORDER BY created_at DESC LIMIT 40)`,
            [req.params.id]);
        }
      } catch (e) {
        console.warn("[canvas] versjonering feilet:", String(e).slice(0, 120));
      }
      const r = await pool.query(
        `UPDATE leadgrid_canvas_notater
            SET tittel = $1, kategori = $2, selskap = $3, lead_id = $4,
                drawing_base64 = $5, delt = $6, lat = $7, lon = $8,
                stempler = $9, tekstbokser = $10, figurer = $11,
                papir = $12, noder = $13, sider = $14, objekter = $15,
                sokbar_tekst = $16, dokumenter = $17, updated_at = now()
          WHERE id = $18 AND user_id = $19 AND slettet_at IS NULL`,
        [felter.tittel, felter.kategori, felter.selskap, felter.leadId,
         felter.drawing, felter.delt, felter.lat, felter.lon,
         felter.stempler, felter.tekstbokser, felter.figurer,
         felter.papir, felter.noder, felter.sider, felter.objekter,
         felter.sokbarTekst, felter.dokumenter, req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] PUT failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Time Travel: versjonene til et notat (eldst → nyest, maks 30). */
  app.get("/api/leadgrid/canvas/:id/versjoner", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ versjoner: [] }); return; }
      await ensureSchema(pool);
      // Tilgang: eier ELLER delt i org-en.
      const eier = await pool.query(
        `SELECT 1 FROM leadgrid_canvas_notater
          WHERE id = $1 AND organization_id = $2 AND (user_id = $3 OR delt)`,
        [req.params.id, orgId, session.userId]);
      if (eier.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT id, kategori, drawing_base64, created_at
           FROM leadgrid_canvas_versjoner
          WHERE notat_id = $1 ORDER BY created_at ASC LIMIT 30`,
        [req.params.id]);
      res.json({
        versjoner: r.rows.map((row) => ({
          id: row.id,
          kategori: row.kategori,
          drawing_base64: row.drawing_base64,
          opprettet: row.created_at instanceof Date
            ? row.created_at.toISOString() : String(row.created_at),
        })),
      });
    } catch (e) {
      console.error("[canvas] versjoner failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Slett notat (bruker-scopet) → papirkurven i 30 dager.
   *  ?permanent=1 fra papirkurven → borte for godt (inkl. versjoner). */
  app.delete("/api/leadgrid/canvas/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      await ensureSchema(pool);
      if (req.query.permanent === "1") {
        const r = await pool.query(
          `DELETE FROM leadgrid_canvas_notater WHERE id = $1 AND user_id = $2`,
          [req.params.id, session.userId]);
        if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
        await pool.query(
          `DELETE FROM leadgrid_canvas_versjoner WHERE notat_id = $1`,
          [req.params.id]).catch(() => undefined);
        res.json({ ok: true, permanent: true });
        return;
      }
      const r = await pool.query(
        `UPDATE leadgrid_canvas_notater SET slettet_at = now()
          WHERE id = $1 AND user_id = $2 AND slettet_at IS NULL`,
        [req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] DELETE failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Gjenopprett notat fra papirkurven. */
  app.post("/api/leadgrid/canvas/:id/gjenopprett", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE leadgrid_canvas_notater
            SET slettet_at = NULL, updated_at = now()
          WHERE id = $1 AND user_id = $2 AND slettet_at IS NOT NULL`,
        [req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] gjenopprett failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
