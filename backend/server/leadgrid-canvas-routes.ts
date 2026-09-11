/**
 * Leadgrid Canvas — Pencil-first notater koblet til leads (fase 1).
 *
 * Notatet er en PKDrawing (base64) + tittel/kategori/lead-kobling,
 * prosjekt+org+bruker-scopet. Lazy tabell (samme mønster som møteloggen).
 * Entitlement: leadgridCanvas (canUse — default PÅ, superadmin kan låse).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomUUID } from "crypto";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import { assertAnyEntitled, LEADGRID_CANVAS_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import {
  getLeadgridObjectStorage,
  leadgridStorageKeys,
} from "./leadgrid-s3-storage-service.js";
import { leadgridStoragePersistenceError } from "./leadgrid-org-storage-service.js";

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
      project_id TEXT,
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
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS project_id TEXT`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leadgrid_canvas_bruker
      ON leadgrid_canvas_notater
        (organization_id, project_id, user_id, updated_at DESC)`);
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
  // Nivå 2 (Daniel 2026-08-05): dokument-bytene flyttes til egen tabell —
  // notat-raden bærer kun metadata, klienten henter bytes on-demand.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_canvas_dokumenter (
      id TEXT PRIMARY KEY,
      notat_id UUID NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      navn TEXT NOT NULL DEFAULT '',
      base64 TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_canvas_dokumenter_notat
      ON leadgrid_canvas_dokumenter (notat_id)`);
  await pool.query(`
    ALTER TABLE leadgrid_canvas_dokumenter
      ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'database',
      ADD COLUMN IF NOT EXISTS storage_object_id UUID,
      ADD COLUMN IF NOT EXISTS storage_key TEXT,
      ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64)`);
  // Org-delt element-bibliotek (Daniel 2026-08-05): gjenbrukbare
  // elementer synkes til backend — «delt» gjør dem synlige for hele
  // org-en (salgssjefen deler standard-elementer med teamet).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_canvas_bibliotek (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      navn TEXT NOT NULL DEFAULT '',
      innhold TEXT NOT NULL DEFAULT '{}',
      delt BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_canvas_bibliotek_org
      ON leadgrid_canvas_bibliotek (organization_id)`);
  // Papirkurv (Daniel 2026-08-05): soft delete — notatet ligger 30 dager
  // i papirkurven før det tømmes for godt (lat opprydding i GET).
  await pool.query(`
    ALTER TABLE leadgrid_canvas_notater
      ADD COLUMN IF NOT EXISTS slettet_at TIMESTAMPTZ`);
  schemaReady = true;
}

type CanvasProjectScope = { organizationId: string; projectId: string };

async function resolveCanvasProjectScope(
  pool: Pool,
  req: Request,
  res: Response,
  userId: string,
): Promise<CanvasProjectScope | null> {
  const query = req.query as Record<string, unknown>;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = query.projectId ?? query.project_id ?? body.projectId ?? body.project_id;
  const projectId = typeof raw === "string" ? raw.trim() : "";
  if (!projectId) {
    res.status(400).json({ error: "project_id_required" });
    return null;
  }
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  return { organizationId: project.organizationId, projectId: project.id };
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
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Alle notatene i aktivt prosjekt, nyeste først.
   *  ?papirkurv=1 → mine slettede notater i stedet (siste 30 dager). */
  app.get("/api/leadgrid/canvas", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
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
              WHERE n.organization_id = $1 AND n.project_id = $2
                AND n.user_id = $3
                AND n.slettet_at IS NOT NULL
              ORDER BY n.slettet_at DESC LIMIT 100`,
            [scope.organizationId, scope.projectId, session.userId])
        : await pool.query(
            `SELECT n.id, n.tittel, n.kategori, n.selskap, n.lead_id,
                    n.drawing_base64, n.updated_at, n.delt, n.user_id,
                    n.lat, n.lon, n.stempler, n.tekstbokser, n.figurer, n.papir,
                    n.noder, n.sider, n.objekter, n.sokbar_tekst, n.dokumenter, n.slettet_at,
                    COALESCE(u.name, u.email, '') AS eier_navn
               FROM leadgrid_canvas_notater n
               LEFT JOIN users u ON u.id::text = n.user_id
              WHERE n.organization_id = $1 AND n.project_id = $2
                AND (n.user_id = $3 OR n.delt)
                AND n.slettet_at IS NULL
              ORDER BY n.updated_at DESC LIMIT 100`,
            [scope.organizationId, scope.projectId, session.userId]);
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
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      const felter = parseFelter((req.body ?? {}) as Record<string, unknown>);
      if (!felter) { res.status(413).json({ error: "tegning_for_stor" }); return; }
      await ensureSchema(pool);
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadgrid_canvas_notater
           (id, organization_id, project_id, user_id, tittel, kategori, selskap, lead_id,
            drawing_base64, delt, lat, lon, stempler, tekstbokser, figurer,
            papir, noder, sider, objekter, sokbar_tekst, dokumenter)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [id, scope.organizationId, scope.projectId, session.userId,
         felter.tittel, felter.kategori,
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
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      // Versjonér forrige tilstand (best effort — velter aldri lagringen).
      try {
        const forrige = await pool.query<{ drawing_base64: string; kategori: string; objekter: string }>(
          `SELECT drawing_base64, kategori, objekter FROM leadgrid_canvas_notater
            WHERE id = $1 AND organization_id = $2 AND project_id = $3
              AND user_id = $4`,
          [req.params.id, scope.organizationId, scope.projectId, session.userId]);
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
          WHERE id = $18 AND organization_id = $19 AND project_id = $20
            AND user_id = $21 AND slettet_at IS NULL`,
        [felter.tittel, felter.kategori, felter.selskap, felter.leadId,
         felter.drawing, felter.delt, felter.lat, felter.lon,
         felter.stempler, felter.tekstbokser, felter.figurer,
         felter.papir, felter.noder, felter.sider, felter.objekter,
         felter.sokbarTekst, felter.dokumenter, req.params.id,
         scope.organizationId, scope.projectId, session.userId]);
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
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      await ensureSchema(pool);
      // Tilgang: eier ELLER delt i org-en.
      const eier = await pool.query(
        `SELECT 1 FROM leadgrid_canvas_notater
          WHERE id = $1 AND organization_id = $2 AND project_id = $3
            AND (user_id = $4 OR delt)`,
        [req.params.id, scope.organizationId, scope.projectId, session.userId]);
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
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      await ensureSchema(pool);
      if (req.query.permanent === "1") {
        const r = await pool.query(
          `DELETE FROM leadgrid_canvas_notater
            WHERE id = $1 AND organization_id = $2 AND project_id = $3
              AND user_id = $4`,
          [req.params.id, scope.organizationId, scope.projectId, session.userId]);
        if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
        await pool.query(
          `DELETE FROM leadgrid_canvas_versjoner WHERE notat_id = $1`,
          [req.params.id]).catch(() => undefined);
        res.json({ ok: true, permanent: true });
        return;
      }
      const r = await pool.query(
        `UPDATE leadgrid_canvas_notater SET slettet_at = now()
          WHERE id = $1 AND organization_id = $2 AND project_id = $3
            AND user_id = $4 AND slettet_at IS NULL`,
        [req.params.id, scope.organizationId, scope.projectId, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] DELETE failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Last opp et dokument (PDF) til notatet — klient-generert id så
   *  side-objektenes referanser står seg. Maks ~20 MB (27M base64-tegn). */
  app.post("/api/leadgrid/canvas/:id/dokumenter", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      await ensureSchema(pool);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const dokId = String(b.id ?? "").slice(0, 64);
      const navn = String(b.navn ?? "").slice(0, 200);
      const base64 = String(b.base64 ?? "");
      if (!dokId || !base64) { res.status(400).json({ error: "bad_request" }); return; }
      if (base64.length > 27_000_000) {
        res.status(413).json({ error: "dokument_for_stort" });
        return;
      }
      // Eier-sjekk på notatet.
      const eier = await pool.query(
        `SELECT 1 FROM leadgrid_canvas_notater
          WHERE id = $1 AND organization_id = $2 AND project_id = $3
            AND user_id = $4`,
        [req.params.id, scope.organizationId, scope.projectId, session.userId]);
      if (eier.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }

      const existing = await pool.query<{
        user_id: string;
        organization_id: string;
        notat_id: string;
        storage_provider: string;
        storage_object_id: string | null;
        storage_key: string | null;
      }>(
        `SELECT user_id, organization_id::text, notat_id::text,
                storage_provider, storage_object_id::text, storage_key
           FROM leadgrid_canvas_dokumenter
          WHERE id = $1`,
        [dokId],
      );
      if (
        existing.rows[0] &&
        (
          existing.rows[0].user_id !== session.userId ||
          existing.rows[0].organization_id !== scope.organizationId ||
          existing.rows[0].notat_id !== req.params.id
        )
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const storage = getLeadgridObjectStorage();
      if (!storage) {
        res.status(503).json({ error: "leadgrid_storage_not_configured" });
        return;
      }
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
        res.status(400).json({ error: "ugyldig_pdf_base64" });
        return;
      }
      const pdf = Buffer.from(base64, "base64");
      if (pdf.length === 0 || pdf.length > 20 * 1024 * 1024) {
        res.status(pdf.length === 0 ? 400 : 413).json({
          error: pdf.length === 0 ? "tomt_dokument" : "dokument_for_stort",
        });
        return;
      }
      if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        res.status(415).json({ error: "kun_pdf_tillatt" });
        return;
      }

      const storageObjectId = randomUUID();
      const objectKey = leadgridStorageKeys.canvasDocument({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        userId: session.userId,
        assetId: storageObjectId,
      });
      let uploaded;
      try {
        uploaded = await storage.putObject({
          key: objectKey,
          body: pdf,
          contentType: "application/pdf",
          purpose: "canvas_document",
        });
      } catch (error) {
        console.error("[canvas] S3 document upload failed", error);
        res.status(502).json({ error: "leadgrid_storage_upload_failed" });
        return;
      }

      try {
        await pool.query(
          `WITH stored AS (
             INSERT INTO leadgrid_storage_objects
               (id, organization_id, uploaded_by, storage_provider,
                bucket_name, object_key, purpose, display_name, size_bytes,
                content_type, checksum_sha256, metadata)
             VALUES
               ($1::uuid, $2::uuid, $3, 'aws_s3', $4, $5,
                'canvas_document', $6, $7, 'application/pdf', $8, $9::jsonb)
             RETURNING id
           )
           INSERT INTO leadgrid_canvas_dokumenter
             (id, notat_id, organization_id, user_id, navn, base64,
              storage_provider, storage_object_id, storage_key, size_bytes,
              mime_type, checksum_sha256)
           SELECT $10, $11::uuid, $2, $3, $6, '', 'aws_s3', id, $5, $7,
                  'application/pdf', $8
             FROM stored
           ON CONFLICT (id) DO UPDATE SET
             navn = EXCLUDED.navn,
             base64 = '',
             storage_provider = EXCLUDED.storage_provider,
             storage_object_id = EXCLUDED.storage_object_id,
             storage_key = EXCLUDED.storage_key,
             size_bytes = EXCLUDED.size_bytes,
             mime_type = EXCLUDED.mime_type,
             checksum_sha256 = EXCLUDED.checksum_sha256
           WHERE leadgrid_canvas_dokumenter.user_id = $3
             AND leadgrid_canvas_dokumenter.organization_id = $2
             AND leadgrid_canvas_dokumenter.notat_id = $11::uuid`,
          [
            storageObjectId,
            scope.organizationId,
            session.userId,
            uploaded.bucket,
            uploaded.key,
            navn,
            uploaded.sizeBytes,
            uploaded.checksumSha256,
            JSON.stringify({
              projectId: scope.projectId,
              noteId: req.params.id,
              documentId: dokId,
            }),
            dokId,
            req.params.id,
          ],
        );
      } catch (error) {
        await storage.deleteObject(uploaded.key).catch(() => undefined);
        const storageError = leadgridStoragePersistenceError(error);
        if (storageError) {
          res.status(storageError.status).json({ error: storageError.code });
          return;
        }
        throw error;
      }

      const previous = existing.rows[0];
      if (
        previous?.storage_provider === "aws_s3" &&
        previous.storage_key &&
        previous.storage_object_id
      ) {
        try {
          await pool.query(
            `UPDATE leadgrid_storage_objects SET deleted_at = NOW()
              WHERE id = $1::uuid AND deleted_at IS NULL`,
            [previous.storage_object_id],
          );
          await storage.deleteObject(previous.storage_key);
        } catch (error) {
          await pool.query(
            `UPDATE leadgrid_storage_objects SET deleted_at = NULL
              WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
            [previous.storage_object_id],
          ).catch(() => undefined);
          console.error("[canvas] previous S3 document cleanup failed", error);
          res.json({ ok: true, id: dokId });
          return;
        }
        await pool.query(
          `DELETE FROM leadgrid_storage_objects WHERE id = $1::uuid`,
          [previous.storage_object_id],
        ).catch((error) => {
          console.error("[canvas] previous storage metadata cleanup failed", error);
        });
      }
      res.json({ ok: true, id: dokId });
    } catch (e) {
      console.error("[canvas] dokument-opplasting failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Hent dokument-bytes on-demand (eier ELLER delt i org-en). */
  app.get("/api/leadgrid/canvas/dokumenter/:dokId", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      await ensureSchema(pool);
      const r = await pool.query<{
        id: string;
        navn: string;
        base64: string;
        storage_provider: string;
        storage_key: string | null;
      }>(
        `SELECT d.id, d.navn, d.base64, d.storage_provider, d.storage_key
           FROM leadgrid_canvas_dokumenter d
           JOIN leadgrid_canvas_notater n ON n.id = d.notat_id
          WHERE d.id = $1 AND n.organization_id = $2 AND n.project_id = $3
            AND (n.user_id = $4 OR n.delt)`,
        [req.params.dokId, scope.organizationId, scope.projectId, session.userId]);
      const rad = r.rows[0];
      if (!rad) { res.status(404).json({ error: "not_found" }); return; }
      if (rad.storage_provider === "aws_s3") {
        const storage = getLeadgridObjectStorage();
        if (!storage || !rad.storage_key) {
          res.status(503).json({ error: "leadgrid_storage_not_configured" });
          return;
        }
        try {
          const bytes = await storage.getObjectBuffer(
            rad.storage_key,
            20 * 1024 * 1024,
          );
          res.json({
            dokument: {
              id: rad.id,
              navn: rad.navn,
              base64: bytes.toString("base64"),
            },
          });
          return;
        } catch (error) {
          console.error("[canvas] S3 document read failed", error);
          res.status(502).json({ error: "leadgrid_storage_download_failed" });
          return;
        }
      }
      res.json({ dokument: { id: rad.id, navn: rad.navn, base64: rad.base64 } });
    } catch (e) {
      console.error("[canvas] dokument-henting failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Slett dokument (eier) — kalles når siste side-objekt fjernes. */
  app.delete("/api/leadgrid/canvas/dokumenter/:dokId", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      await ensureSchema(pool);
      const existing = await pool.query<{
        storage_provider: string;
        storage_key: string | null;
        storage_object_id: string | null;
      }>(
        `SELECT d.storage_provider, d.storage_key, d.storage_object_id::text
           FROM leadgrid_canvas_dokumenter d
           JOIN leadgrid_canvas_notater n ON n.id = d.notat_id
          WHERE d.id = $1 AND d.user_id = $2
            AND d.organization_id = $3 AND n.organization_id = $3
            AND n.project_id = $4`,
        [req.params.dokId, session.userId, scope.organizationId, scope.projectId]);
      const document = existing.rows[0];
      if (!document) { res.status(404).json({ error: "not_found" }); return; }
      if (document.storage_provider === "aws_s3") {
        const storage = getLeadgridObjectStorage();
        if (!storage || !document.storage_key) {
          res.status(503).json({ error: "leadgrid_storage_not_configured" });
          return;
        }
        if (document.storage_object_id) {
          await pool.query(
            `UPDATE leadgrid_storage_objects SET deleted_at = NOW()
              WHERE id = $1::uuid AND deleted_at IS NULL`,
            [document.storage_object_id],
          );
        }
        try {
          await storage.deleteObject(document.storage_key);
        } catch (error) {
          if (document.storage_object_id) {
            await pool.query(
              `UPDATE leadgrid_storage_objects SET deleted_at = NULL
                WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
              [document.storage_object_id],
            ).catch(() => undefined);
          }
          console.error("[canvas] S3 document delete failed", error);
          res.status(502).json({ error: "leadgrid_storage_delete_failed" });
          return;
        }
      }
      await pool.query(
        `DELETE FROM leadgrid_canvas_dokumenter
          WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
        [req.params.dokId, session.userId, scope.organizationId]);
      if (document.storage_object_id) {
        await pool.query(
          `DELETE FROM leadgrid_storage_objects WHERE id = $1::uuid`,
          [document.storage_object_id],
        );
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] dokument-sletting failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Element-biblioteket: mine + org-delte elementer. */
  app.get("/api/leadgrid/canvas/bibliotek", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ elementer: [] }); return; }
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT b.id, b.navn, b.innhold, b.delt, b.user_id,
                COALESCE(u.name, u.email, '') AS eier_navn
           FROM leadgrid_canvas_bibliotek b
           LEFT JOIN users u ON u.id::text = b.user_id
          WHERE b.organization_id = $1 AND (b.user_id = $2 OR b.delt)
          ORDER BY b.created_at DESC LIMIT 100`,
        [orgId, session.userId]);
      res.json({
        elementer: r.rows.map((row) => ({
          id: row.id,
          navn: row.navn,
          innhold: row.innhold,
          delt: row.delt === true,
          er_min: row.user_id === session.userId,
          eier_navn: row.user_id === session.userId ? null : row.eier_navn,
        })),
      });
    } catch (e) {
      console.error("[canvas] bibliotek GET failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Lagre/oppdater element (klient-generert id). Cap 500 kB per element. */
  app.post("/api/leadgrid/canvas/bibliotek", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_CANVAS_FEATURE_KEYS, res))) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(403).json({ error: "ingen_org" }); return; }
      await ensureSchema(pool);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const id = String(b.id ?? "").slice(0, 64);
      const navn = String(b.navn ?? "").slice(0, 120);
      const innhold = String(b.innhold ?? "{}");
      if (!id || !navn) { res.status(400).json({ error: "bad_request" }); return; }
      if (innhold.length > 500_000) {
        res.status(413).json({ error: "element_for_stort" });
        return;
      }
      await pool.query(
        `INSERT INTO leadgrid_canvas_bibliotek
           (id, organization_id, user_id, navn, innhold, delt)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET navn = EXCLUDED.navn,
                                        innhold = EXCLUDED.innhold,
                                        delt = EXCLUDED.delt
         WHERE leadgrid_canvas_bibliotek.user_id = $3`,
        [id, orgId, session.userId, navn, innhold, b.delt === true]);
      res.json({ ok: true, id });
    } catch (e) {
      console.error("[canvas] bibliotek POST failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Slett element (eier). */
  app.delete("/api/leadgrid/canvas/bibliotek/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      await ensureSchema(pool);
      const r = await pool.query(
        `DELETE FROM leadgrid_canvas_bibliotek
          WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] bibliotek DELETE failed:", e);
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
      const scope = await resolveCanvasProjectScope(pool, req, res, session.userId);
      if (!scope) return;
      const r = await pool.query(
        `UPDATE leadgrid_canvas_notater
            SET slettet_at = NULL, updated_at = now()
          WHERE id = $1 AND organization_id = $2 AND project_id = $3
            AND user_id = $4 AND slettet_at IS NOT NULL`,
        [req.params.id, scope.organizationId, scope.projectId, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[canvas] gjenopprett failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
