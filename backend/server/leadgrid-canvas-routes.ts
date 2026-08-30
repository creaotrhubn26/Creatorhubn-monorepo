/**
 * Leadgrid Canvas — Pencil-first notater koblet til leads (fase 1).
 *
 * Notatet er en PKDrawing (base64) + tittel/kategori/lead-kobling,
 * org+bruker-scopet. Lazy tabell (samme mønster som møteloggen).
 * Entitlement: leadgridCanvas (canUse — default PÅ, superadmin kan låse).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { LEADGRID_CANVAS_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { etagFor, parseIfMatchVersion } from "./_shared-concurrency.js";
import { getCanvasAuthorization } from "./leadgrid-canvas-authorization.js";
import { resolveCanonicalOrgAccess } from "./org-status-enforcement.js";
import {
  CanvasRateLimitUnavailableError,
  consumeLocalCanvasReadRateLimit,
  consumeSharedCanvasRateLimit,
  type CanvasRateLimitDecision,
  type CanvasRateLimitMode,
} from "./leadgrid-canvas-rate-limit.js";
import {
  canvasCursorScope,
  encodeCanvasCursor,
  parseCanvasPageRequest,
  selectCanvasPagePrefix,
  type CanvasPageRequest,
} from "./leadgrid-canvas-pagination.js";
import {
  CanvasServiceError,
  MAX_CANVAS_HISTORY_BYTES,
  MAX_CANVAS_LIBRARY_BYTES,
  MAX_CANVAS_LIST_BYTES,
  MAX_CANVAS_PDF_RESPONSE_BYTES,
  createCanvasNote,
  parseCanvasNoteFields,
  parseCanvasPdf,
  permanentlyDeleteCanvasNote,
  purgeExpiredCanvasTrash,
  requireCanvasUuid,
  restoreCanvasHistoryVersion,
  restoreCanvasTrashNote,
  revisionNumber,
  softDeleteCanvasNote,
  storeCanvasPdf,
  upsertCanvasLibraryElement,
  updateCanvasNote,
  type CanvasNoteRow,
} from "./leadgrid-canvas-service.js";

let schemaReady = false;

let activeCanvasLargeResponses = 0;
const MAX_CONCURRENT_CANVAS_LARGE_RESPONSES = 4;
const MAX_CANVAS_PAGINATED_LIST_PREFLIGHT_BYTES =
  MAX_CANVAS_LIST_BYTES - 4 * 1024 * 1024;

function acquireCanvasResponseSlot(res: Response): (() => void) | null {
  if (activeCanvasLargeResponses >= MAX_CONCURRENT_CANVAS_LARGE_RESPONSES) {
    res
      .status(503)
      .setHeader("Retry-After", "1")
      .json({ error: "canvas_response_capacity_reached" });
    return null;
  }
  activeCanvasLargeResponses += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    res.off("finish", release);
    res.off("close", release);
    activeCanvasLargeResponses = Math.max(0, activeCanvasLargeResponses - 1);
  };
  res.once("finish", release);
  res.once("close", release);
  return release;
}

export function serializeCanvasResponse(
  payload: unknown,
  maxBytes: number,
  code: string,
  itemCount: number,
): string {
  const serialized = JSON.stringify(payload);
  assertCanvasResponseBudget(
    Buffer.byteLength(serialized, "utf8"),
    maxBytes,
    code,
    itemCount,
  );
  return serialized;
}

function sendBoundedCanvasJson(
  res: Response,
  payload: unknown,
  maxBytes: number,
  code: string,
  itemCount: number,
): void {
  res.type("application/json").send(
    serializeCanvasResponse(payload, maxBytes, code, itemCount),
  );
}

export function consumeCanvasRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  return consumeLocalCanvasReadRateLimit(key, limit, windowMs, now);
}

async function requireCanvasRate(
  pool: Pool,
  res: Response,
  userId: string,
  operation: string,
  limit: number,
  windowMs: number,
  mode: CanvasRateLimitMode,
): Promise<boolean> {
  let decision;
  try {
    decision = await consumeSharedCanvasRateLimit(pool, {
      operation,
      identity: userId,
      limit,
      windowMs,
      mode,
    });
  } catch (error) {
    if (error instanceof CanvasRateLimitUnavailableError) {
      res
        .status(503)
        .setHeader("Retry-After", "1")
        .json({ error: "canvas_rate_limit_unavailable" });
      return false;
    }
    throw error;
  }
  return applyCanvasRateDecision(res, decision);
}

export function applyCanvasRateDecision(
  res: Pick<Response, "setHeader" | "status" | "json">,
  decision: CanvasRateLimitDecision,
): boolean {
  res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
  res.setHeader("X-RateLimit-Source", decision.source);
  if (decision.allowed) return true;
  res.setHeader("Retry-After", String(decision.retryAfterSeconds));
  res.status(429).json({ error: "canvas_rate_limited" });
  return false;
}

export async function resolveCanvasRouteOrganization(
  pool: Pool,
  userId: string,
  requestedOrganizationId: unknown,
  write: boolean,
): Promise<string> {
  try {
    const rawOrganizationId = Array.isArray(requestedOrganizationId)
      ? requestedOrganizationId[0]
      : requestedOrganizationId;
    const organizationId = typeof rawOrganizationId === "string"
      ? rawOrganizationId.trim()
      : "";
    if (!organizationId || organizationId.length > 200) {
      throw new CanvasServiceError(400, "organization_context_required");
    }
    // Validate the exact tenant selected by the client. Never substitute a
    // resolver fallback: a multi-org user's UI and persistence scope must be
    // the same even when membership ordering/cache changes.
    const tenantAccess = await resolveCanonicalOrgAccess(
      pool,
      userId,
      organizationId,
    );
    if (!tenantAccess?.canRead) {
      throw new CanvasServiceError(403, "org_access_denied");
    }
    if (write && !tenantAccess.canWrite) {
      throw new CanvasServiceError(423, "org_read_only");
    }

    // Canvas is stricter than the legacy global entitlement helper: an absent
    // override row remains compatible, but an indeterminate DB lookup fails
    // closed instead of silently unlocking the feature.
    const entitlement = await pool.query<{ state: string }>(
      `SELECT state
         FROM leadgrid_org_entitlements
        WHERE organization_id = $1
          AND feature_key = ANY($2::text[])`,
      [organizationId, LEADGRID_CANVAS_FEATURE_KEYS],
    );
    if (
      entitlement.rows.length > 0 &&
      entitlement.rows.every((row) => row.state === "locked")
    ) {
      throw new CanvasServiceError(403, "entitlement_locked", {
        features: LEADGRID_CANVAS_FEATURE_KEYS,
      });
    }
    return organizationId;
  } catch (error) {
    if (error instanceof CanvasServiceError) throw error;
    throw new CanvasServiceError(503, "canvas_authorization_unavailable");
  }
}

const NOTE_BYTES_SQL = `
  octet_length(COALESCE(n.tittel, '')) +
  octet_length(COALESCE(n.kategori, '')) +
  octet_length(COALESCE(n.selskap, '')) +
  octet_length(COALESCE(n.lead_id, '')) +
  octet_length(COALESCE(n.drawing_base64, '')) +
  octet_length(COALESCE(n.stempler, '')) +
  octet_length(COALESCE(n.tekstbokser, '')) +
  octet_length(COALESCE(n.figurer, '')) +
  octet_length(COALESCE(n.papir, '')) +
  octet_length(COALESCE(n.noder, '')) +
  octet_length(COALESCE(n.objekter, '')) +
  octet_length(COALESCE(n.sokbar_tekst, '')) +
  octet_length(COALESCE(n.dokumenter, '')) + 1024`;

// Upper bound for JSON string escaping. The drawing is base64 and therefore
// does not need expansion; canonical JSON strings can at most double when they
// are embedded as strings in the response object.
const NOTE_RESPONSE_UPPER_BYTES_SQL = `
  octet_length(COALESCE(n.drawing_base64, '')) +
  2 * (
    octet_length(COALESCE(n.tittel, '')) +
    octet_length(COALESCE(n.kategori, '')) +
    octet_length(COALESCE(n.selskap, '')) +
    octet_length(COALESCE(n.lead_id, '')) +
    octet_length(COALESCE(n.stempler, '')) +
    octet_length(COALESCE(n.tekstbokser, '')) +
    octet_length(COALESCE(n.figurer, '')) +
    octet_length(COALESCE(n.papir, '')) +
    octet_length(COALESCE(n.noder, '')) +
    octet_length(COALESCE(n.objekter, '')) +
    octet_length(COALESCE(n.sokbar_tekst, '')) +
    octet_length(COALESCE(n.dokumenter, ''))
  ) + 4096`;

type CanvasNotePageCandidate = {
  id: string;
  sort_at: Date | string;
  response_bytes: string | number;
};

async function loadCanvasNotePage(
  pool: Pool,
  input: {
    organizationId: string;
    userId: string;
    trash: boolean;
    page: CanvasPageRequest;
  },
): Promise<{
  rows: Array<CanvasNoteRow & { eier_navn: string }>;
  hasMore: boolean;
  cursorRow: CanvasNotePageCandidate | null;
}> {
  const sortColumn = input.trash ? "slettet_at" : "updated_at";
  const visibility = input.trash
    ? "n.user_id = $2 AND n.slettet_at IS NOT NULL"
    : "(n.user_id = $2 OR n.delt) AND n.slettet_at IS NULL";
  const values: unknown[] = [input.organizationId, input.userId];
  let cursorClause = "";
  if (input.page.cursor) {
    values.push(input.page.cursor.timestamp, input.page.cursor.id);
    cursorClause =
      `AND (n.${sortColumn}, n.id) < ($3::timestamptz, $4::uuid)`;
  }
  values.push(input.page.limit + 1);
  const limitParameter = `$${values.length}`;
  const candidates = await pool.query<CanvasNotePageCandidate>(
    `SELECT n.id, n.${sortColumn} AS sort_at,
            ${NOTE_RESPONSE_UPPER_BYTES_SQL} AS response_bytes
       FROM leadgrid_canvas_notater n
      WHERE n.organization_id = $1
        AND ${visibility}
        ${cursorClause}
      ORDER BY n.${sortColumn} DESC, n.id DESC
      LIMIT ${limitParameter}`,
    values,
  );
  const selected = selectCanvasPagePrefix(
    candidates.rows,
    input.page.limit,
    MAX_CANVAS_PAGINATED_LIST_PREFLIGHT_BYTES,
  );
  const ids = selected.rows.map((row) => row.id);
  if (ids.length === 0) {
    return { rows: [], hasMore: false, cursorRow: null };
  }
  const rows = await pool.query<CanvasNoteRow & { eier_navn: string }>(
    `SELECT n.id, n.tittel, n.kategori, n.selskap, n.lead_id,
            n.drawing_base64, n.updated_at, n.delt, n.user_id,
            n.lat, n.lon, n.stempler, n.tekstbokser, n.figurer, n.papir,
            n.noder, n.sider, n.objekter, n.sokbar_tekst, n.dokumenter,
            n.revision, n.slettet_at,
            ${input.trash
              ? "''"
              : "COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, '')"} AS eier_navn
       FROM leadgrid_canvas_notater n
       ${input.trash ? "" : "LEFT JOIN users u ON u.id::text = n.user_id"}
      WHERE n.organization_id = $1
        AND ${visibility}
        AND n.id = ANY($3::uuid[])
      ORDER BY n.${sortColumn} DESC, n.id DESC`,
    [input.organizationId, input.userId, ids],
  );
  return {
    rows: rows.rows,
    hasMore: selected.hasMore,
    cursorRow: selected.rows.at(-1) ?? null,
  };
}

function aggregateBytes(value: unknown): number {
  const bytes = Number(value ?? 0);
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new CanvasServiceError(500, "invalid_stored_canvas_size");
  }
  return bytes;
}

export function assertCanvasResponseBudget(
  value: unknown,
  maxBytes: number,
  code: string,
  itemCount: number,
): void {
  const bytes = aggregateBytes(value);
  if (bytes > maxBytes) {
    throw new CanvasServiceError(413, code, { maxBytes, itemCount });
  }
}

async function assertCanvasListBudget(
  pool: Pool,
  organizationId: string,
  userId: string,
  trash: boolean,
): Promise<void> {
  const result = await pool.query<{ response_bytes: string | number; item_count: number }>(
    `SELECT COALESCE(SUM(payload_bytes), 0) AS response_bytes,
            COUNT(*)::int AS item_count
       FROM (
         SELECT ${NOTE_BYTES_SQL} AS payload_bytes
           FROM leadgrid_canvas_notater n
          WHERE n.organization_id = $1
            AND ${trash
              ? "n.user_id = $2 AND n.slettet_at IS NOT NULL"
              : "(n.user_id = $2 OR n.delt) AND n.slettet_at IS NULL"}
          ORDER BY ${trash ? "n.slettet_at" : "n.updated_at"} DESC
          LIMIT 100
       ) bounded`,
    [organizationId, userId],
  );
  assertCanvasResponseBudget(
    result.rows[0]?.response_bytes,
    MAX_CANVAS_LIST_BYTES,
    "canvas_list_too_large",
    Number(result.rows[0]?.item_count ?? 0),
  );
}

async function assertCanvasHistoryBudget(pool: Pool, noteId: string): Promise<void> {
  const result = await pool.query<{ response_bytes: string | number; item_count: number }>(
    `SELECT COALESCE(SUM(octet_length(COALESCE(drawing_base64, '')) + 512), 0)
              AS response_bytes,
            COUNT(*)::int AS item_count
       FROM (
         SELECT drawing_base64
           FROM leadgrid_canvas_versjoner
          WHERE notat_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT 40
       ) bounded`,
    [noteId],
  );
  assertCanvasResponseBudget(
    result.rows[0]?.response_bytes,
    MAX_CANVAS_HISTORY_BYTES,
    "canvas_history_too_large",
    Number(result.rows[0]?.item_count ?? 0),
  );
}

async function assertCanvasLibraryBudget(
  pool: Pool,
  organizationId: string,
  userId: string,
): Promise<void> {
  const result = await pool.query<{ response_bytes: string | number; item_count: number }>(
    `SELECT COALESCE(SUM(octet_length(COALESCE(navn, '')) +
                        octet_length(COALESCE(innhold, '')) + 512), 0)
              AS response_bytes,
            COUNT(*)::int AS item_count
       FROM (
         SELECT navn, innhold
           FROM leadgrid_canvas_bibliotek
          WHERE organization_id = $1 AND (user_id = $2 OR delt)
          ORDER BY created_at DESC
          LIMIT 100
       ) bounded`,
    [organizationId, userId],
  );
  assertCanvasResponseBudget(
    result.rows[0]?.response_bytes,
    MAX_CANVAS_LIBRARY_BYTES,
    "canvas_library_too_large",
    Number(result.rows[0]?.item_count ?? 0),
  );
}

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
      revision BIGINT NOT NULL DEFAULT 0,
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
      ADD COLUMN IF NOT EXISTS slettet_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0`);
  // Legacy/pre-0465 installations may not have `slettet_at` yet. Create the
  // dependent index only after the self-healing ALTER above has committed the
  // column in this statement sequence.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_canvas_trash_expiry
      ON leadgrid_canvas_notater (slettet_at, id)
      WHERE slettet_at IS NOT NULL`);
  await pool.query(`
    ALTER TABLE leadgrid_canvas_versjoner
      ADD COLUMN IF NOT EXISTS revision BIGINT,
      ADD COLUMN IF NOT EXISTS schema_version SMALLINT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS snapshot JSONB,
      ADD COLUMN IF NOT EXISTS storage_bytes BIGINT`);
  await pool.query(`
    ALTER TABLE leadgrid_canvas_dokumenter
      ADD COLUMN IF NOT EXISTS content_sha256 TEXT,
      ADD COLUMN IF NOT EXISTS byte_size BIGINT,
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_canvas_policy (
      organization_id TEXT NOT NULL,
      malgruppe TEXT NOT NULL,
      skjulte_funksjoner JSONB NOT NULL DEFAULT '[]',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, malgruppe)
    )`);
  schemaReady = true;
}

/** Tøm notater som har ligget >30 dager i papirkurven (best effort). */
async function tomGamleFraPapirkurv(pool: Pool): Promise<void> {
  try {
    await purgeExpiredCanvasTrash(pool);
  } catch (e) {
    console.warn("[canvas] papirkurv-opprydding feilet:", String(e).slice(0, 120));
  }
}

function sendCanvasError(res: Response, error: unknown, operation: string): void {
  if (error instanceof CanvasServiceError) {
    if (typeof error.details?.currentRevision === "number") {
      res.setHeader("ETag", etagFor(error.details.currentRevision));
    }
    res.status(error.status).json({ error: error.code, ...error.details });
    return;
  }
  console.error(`[canvas] ${operation} failed:`, error);
  res.status(500).json({ error: "internal_error" });
}

export function requestCanvasRevision(req: Pick<Request, "headers">): number | null {
  const raw = req.headers["if-match"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.trim()) {
    // OCC is fail-closed. A time-bounded legacy rollout can be opted into
    // explicitly, but absence/misspelling of configuration remains safe.
    if (/^(1|true)$/i.test(process.env.CANVAS_ALLOW_MISSING_IF_MATCH ?? "")) {
      return null;
    }
    throw new CanvasServiceError(428, "revision_required");
  }
  const revision = parseIfMatchVersion(value);
  if (revision === null) throw new CanvasServiceError(400, "invalid_if_match");
  return revision;
}

function setWriteRevision(res: Response, revision: number, legacy: boolean): void {
  res.setHeader("ETag", etagFor(revision));
  if (legacy) {
    res.setHeader(
      "Warning",
      '299 CreatorHub "If-Match is required by the current Canvas client"',
    );
  }
}

function noteDto(row: CanvasNoteRow, userId: string): Record<string, unknown> {
  return {
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
    revision: revisionNumber(row.revision),
    slettet_at: row.slettet_at instanceof Date
      ? row.slettet_at.toISOString()
      : row.slettet_at ? String(row.slettet_at) : null,
    er_min: row.user_id === userId,
    oppdatert: row.updated_at instanceof Date
      ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function storedHistoryRevision(value: unknown): number {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision)) {
    throw new CanvasServiceError(500, "invalid_stored_revision");
  }
  return revision;
}

export function registerLeadgridCanvasRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Alle notatene mine (org+bruker), nyeste først.
   *  ?papirkurv=1 → mine slettede notater i stedet (siste 30 dager). */
  app.get("/api/leadgrid/canvas", async (req, res) => {
    let releaseResponse: (() => void) | null = null;
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-list", 30, 60_000, "read",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], false,
      );
      releaseResponse = acquireCanvasResponseSlot(res);
      if (!releaseResponse) return;
      await ensureSchema(pool);
      await tomGamleFraPapirkurv(pool);
      const visPapirkurv = req.query.papirkurv === "1";
      const cursorScope = canvasCursorScope(orgId, session.userId);
      const page = parseCanvasPageRequest({
        limitValue: req.query.limit,
        cursorValue: req.query.cursor,
        kind: visPapirkurv ? "trash" : "notes",
        scope: cursorScope,
        defaultLimit: 50,
        maxLimit: 50,
      });
      let r: { rows: Array<CanvasNoteRow & { eier_navn: string }> };
      let nextCursor: string | null = null;
      if (page.enabled) {
        const paged = await loadCanvasNotePage(pool, {
          organizationId: orgId,
          userId: session.userId,
          trash: visPapirkurv,
          page,
        });
        r = { rows: paged.rows };
        if (paged.hasMore && paged.cursorRow) {
          nextCursor = encodeCanvasCursor({
            kind: visPapirkurv ? "trash" : "notes",
            scope: cursorScope,
            timestamp: paged.cursorRow.sort_at,
            id: paged.cursorRow.id,
          });
        }
      } else {
        await assertCanvasListBudget(pool, orgId, session.userId, visPapirkurv);
        r = visPapirkurv
          ? await pool.query(
            `SELECT n.id, n.tittel, n.kategori, n.selskap, n.lead_id,
                    n.drawing_base64, n.updated_at, n.delt, n.user_id,
                    n.lat, n.lon, n.stempler, n.tekstbokser, n.figurer, n.papir,
                    n.noder, n.sider, n.objekter, n.sokbar_tekst, n.dokumenter,
                    n.revision, n.slettet_at,
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
                    n.noder, n.sider, n.objekter, n.sokbar_tekst, n.dokumenter,
                    n.revision, n.slettet_at,
                    COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, '') AS eier_navn
               FROM leadgrid_canvas_notater n
               LEFT JOIN users u ON u.id::text = n.user_id
              WHERE n.organization_id = $1 AND (n.user_id = $2 OR n.delt)
                AND n.slettet_at IS NULL
              ORDER BY n.updated_at DESC LIMIT 100`,
            [orgId, session.userId]);
      }
      res.setHeader("Cache-Control", "private, no-store");
      const payload = {
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
          revision: revisionNumber(row.revision),
          slettet_at: row.slettet_at instanceof Date
            ? row.slettet_at.toISOString()
            : (row.slettet_at ? String(row.slettet_at) : null),
          er_min: row.user_id === session.userId,
          eier_navn: row.user_id === session.userId ? null : row.eier_navn,
          oppdatert: row.updated_at instanceof Date
            ? row.updated_at.toISOString() : String(row.updated_at),
        })),
        ...(page.enabled ? { next_cursor: nextCursor } : {}),
      };
      sendBoundedCanvasJson(
        res,
        payload,
        MAX_CANVAS_LIST_BYTES,
        "canvas_list_too_large",
        r.rows.length,
      );
    } catch (e) {
      sendCanvasError(res, e, "GET");
    }
  });

  /** Nytt notat. Klient-ID gjør retry idempotent. */
  app.post("/api/leadgrid/canvas", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-create", 30, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const felter = parseCanvasNoteFields(body);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canWrite || (felter.delt && !auth.canShare)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const result = await createCanvasNote(
        pool,
        { organizationId: orgId, userId: session.userId },
        felter,
        body.id,
      );
      res.setHeader("ETag", etagFor(result.revision));
      res.status(result.created ? 201 : 200).json({
        id: result.id,
        revision: result.revision,
        created: result.created,
      });
    } catch (e) {
      sendCanvasError(res, e, "POST");
    }
  });

  /** Oppdater notat (bruker-scopet). Time Travel: gammel tegning
   *  versjoneres FØR oppdatering når den faktisk er endret. */
  app.put("/api/leadgrid/canvas/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-write", 180, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const felter = parseCanvasNoteFields((req.body ?? {}) as Record<string, unknown>);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canWrite || (felter.delt && !auth.canShare)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const expectedRevision = requestCanvasRevision(req);
      const result = await updateCanvasNote(
        pool,
        {
          organizationId: orgId,
          userId: session.userId,
          noteId: requireCanvasUuid(req.params.id),
        },
        felter,
        expectedRevision,
      );
      setWriteRevision(res, result.revision, expectedRevision === null);
      res.json({ ok: true, revision: result.revision });
    } catch (e) {
      sendCanvasError(res, e, "PUT");
    }
  });

  /** Time Travel: de 40 nyeste versjonene presentert eldst → nyest. */
  app.get("/api/leadgrid/canvas/:id/versjoner", async (req, res) => {
    let releaseResponse: (() => void) | null = null;
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-history", 15, 60_000, "read",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], false,
      );
      releaseResponse = acquireCanvasResponseSlot(res);
      if (!releaseResponse) return;
      await ensureSchema(pool);
      const noteId = requireCanvasUuid(req.params.id);
      // Tilgang: eier ELLER delt i org-en.
      const eier = await pool.query(
        `SELECT 1 FROM leadgrid_canvas_notater
          WHERE id = $1 AND organization_id = $2 AND (user_id = $3 OR delt)
            AND slettet_at IS NULL`,
        [noteId, orgId, session.userId]);
      if (eier.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      const cursorScope = `${canvasCursorScope(orgId, session.userId)}:${noteId}`;
      const page = parseCanvasPageRequest({
        limitValue: req.query.limit,
        cursorValue: req.query.cursor,
        kind: "history",
        scope: cursorScope,
        defaultLimit: 5,
        maxLimit: 5,
      });
      let rows: Array<Record<string, unknown>>;
      let nextCursor: string | null = null;
      if (page.enabled) {
        const values: unknown[] = [noteId];
        let cursorClause = "";
        if (page.cursor) {
          values.push(page.cursor.timestamp, page.cursor.id);
          cursorClause =
            "AND (created_at, id) < ($2::timestamptz, $3::uuid)";
        }
        values.push(page.limit + 1);
        const limitParameter = `$${values.length}`;
        const result = await pool.query(
          `SELECT id, revision, schema_version, kategori, drawing_base64, created_at
             FROM leadgrid_canvas_versjoner
            WHERE notat_id = $1
              ${cursorClause}
            ORDER BY created_at DESC, id DESC
            LIMIT ${limitParameter}`,
          values,
        );
        const descending = result.rows.slice(0, page.limit);
        const cursorRow = descending.at(-1);
        if (result.rows.length > page.limit && cursorRow) {
          nextCursor = encodeCanvasCursor({
            kind: "history",
            scope: cursorScope,
            timestamp: cursorRow.created_at,
            id: String(cursorRow.id),
          });
        }
        // Preserve the endpoint's established oldest-to-newest ordering inside
        // every page. The current iPad client prepends subsequent older pages.
        rows = descending.reverse();
      } else {
        await assertCanvasHistoryBudget(pool, noteId);
        const result = await pool.query(
          `SELECT id, revision, schema_version, kategori, drawing_base64, created_at
             FROM (
               SELECT id, revision, schema_version, kategori, drawing_base64, created_at
                 FROM leadgrid_canvas_versjoner
                WHERE notat_id = $1
                ORDER BY created_at DESC, id DESC LIMIT 40
             ) latest
            ORDER BY created_at ASC, id ASC`,
          [noteId]);
        rows = result.rows;
      }
      res.setHeader("Cache-Control", "private, no-store");
      const payload = {
        versjoner: rows.map((row) => ({
          id: row.id,
          revision: storedHistoryRevision(row.revision),
          schema_version: Number(row.schema_version),
          kategori: row.kategori,
          drawing_base64: row.drawing_base64,
          opprettet: row.created_at instanceof Date
            ? row.created_at.toISOString() : String(row.created_at),
        })),
        ...(page.enabled ? { next_cursor: nextCursor } : {}),
      };
      sendBoundedCanvasJson(
        res,
        payload,
        MAX_CANVAS_HISTORY_BYTES,
        "canvas_history_too_large",
        rows.length,
      );
    } catch (e) {
      sendCanvasError(res, e, "versjoner");
    }
  });

  /** Gjenopprett en komplett historikk-snapshot som en ny revisjon. */
  app.post("/api/leadgrid/canvas/:id/versjoner/:versionId/gjenopprett", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-write", 180, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canWrite || !auth.canRestoreHistory) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const expectedRevision = requestCanvasRevision(req);
      const row = await restoreCanvasHistoryVersion(
        pool,
        {
          organizationId: orgId,
          userId: session.userId,
          noteId: requireCanvasUuid(req.params.id),
          versionId: requireCanvasUuid(req.params.versionId, "versionId"),
        },
        expectedRevision,
        auth.canShare,
      );
      const revision = revisionNumber(row.revision);
      setWriteRevision(res, revision, expectedRevision === null);
      res.json({ notat: noteDto(row, session.userId) });
    } catch (e) {
      sendCanvasError(res, e, "historikk-gjenopprett");
    }
  });

  /** Slett notat (bruker-scopet) → papirkurven i 30 dager.
   *  ?permanent=1 fra papirkurven → borte for godt (inkl. versjoner). */
  app.delete("/api/leadgrid/canvas/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-write", 180, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canWrite) { res.status(403).json({ error: "forbidden" }); return; }
      const scope = {
        organizationId: orgId,
        userId: session.userId,
        noteId: requireCanvasUuid(req.params.id),
      };
      const expectedRevision = requestCanvasRevision(req);
      if (req.query.permanent === "1") {
        const result = await permanentlyDeleteCanvasNote(pool, scope, expectedRevision);
        setWriteRevision(res, result.revision, expectedRevision === null);
        res.json({ ok: true, permanent: true });
        return;
      }
      const result = await softDeleteCanvasNote(pool, scope, expectedRevision);
      setWriteRevision(res, result.revision, expectedRevision === null);
      res.json({ ok: true, permanent: false, revision: result.revision });
    } catch (e) {
      sendCanvasError(res, e, "DELETE");
    }
  });

  /** Last opp et dokument (PDF) til notatet — klient-generert id så
   *  side-objektenes referanser står seg. Maks ~20 MB (27M base64-tegn). */
  app.post("/api/leadgrid/canvas/:id/dokumenter", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-pdf-upload", 12, 600_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canUploadPdf) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const pdf = parseCanvasPdf((req.body ?? {}) as Record<string, unknown>);
      const result = await storeCanvasPdf(
        pool,
        {
          organizationId: orgId,
          userId: session.userId,
          noteId: requireCanvasUuid(req.params.id),
        },
        pdf,
      );
      res.status(result.created ? 201 : 200).json({ ok: true, id: pdf.id });
    } catch (e) {
      sendCanvasError(res, e, "dokument-opplasting");
    }
  });

  /** Hent dokument-bytes on-demand (eier ELLER delt i org-en). */
  app.get("/api/leadgrid/canvas/dokumenter/:dokId", async (req, res) => {
    let releaseResponse: (() => void) | null = null;
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-pdf-read", 30, 60_000, "read",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], false,
      );
      releaseResponse = acquireCanvasResponseSlot(res);
      if (!releaseResponse) return;
      await ensureSchema(pool);
      const dokId = String(req.params.dokId ?? "");
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(dokId)) {
        res.status(400).json({ error: "invalid_document_id" });
        return;
      }
      const r = await pool.query(
        `SELECT d.id, d.navn, d.base64
           FROM leadgrid_canvas_dokumenter d
           JOIN leadgrid_canvas_notater n
             ON n.id = d.notat_id
            AND n.organization_id = d.organization_id
            AND n.user_id = d.user_id
          WHERE d.id = $1 AND d.organization_id = $2
            AND n.organization_id = $2 AND n.slettet_at IS NULL
            AND ((n.user_id = $3 AND d.user_id = $3) OR (n.delt AND d.active))`,
        [dokId, orgId, session.userId]);
      const rad = r.rows[0];
      if (!rad) { res.status(404).json({ error: "not_found" }); return; }
      res.setHeader("Cache-Control", "private, no-store");
      sendBoundedCanvasJson(
        res,
        { dokument: { id: rad.id, navn: rad.navn, base64: rad.base64 } },
        MAX_CANVAS_PDF_RESPONSE_BYTES,
        "canvas_document_response_too_large",
        1,
      );
    } catch (e) {
      sendCanvasError(res, e, "dokument-henting");
    }
  });

  /** Slett dokument (eier) — kalles når siste side-objekt fjernes. */
  app.delete("/api/leadgrid/canvas/dokumenter/:dokId", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-write", 180, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canWrite) { res.status(403).json({ error: "forbidden" }); return; }
      const r = await pool.query(
        `SELECT 1
           FROM leadgrid_canvas_dokumenter d
           JOIN leadgrid_canvas_notater n
             ON n.id = d.notat_id
            AND n.organization_id = d.organization_id
            AND n.user_id = d.user_id
          WHERE d.id = $1 AND d.organization_id = $2 AND d.user_id = $3
            AND n.slettet_at IS NULL`,
        [req.params.dokId, orgId, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      // Bytes are immutable and retained for history. A successful note PUT
      // reconciles `active`; parent-note permanent delete removes via FK.
      res.json({ ok: true, retained: true });
    } catch (e) {
      sendCanvasError(res, e, "dokument-sletting");
    }
  });

  /** Element-biblioteket: mine + org-delte elementer. */
  app.get("/api/leadgrid/canvas/bibliotek", async (req, res) => {
    let releaseResponse: (() => void) | null = null;
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-library-read", 60, 60_000, "read",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], false,
      );
      releaseResponse = acquireCanvasResponseSlot(res);
      if (!releaseResponse) return;
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canUseLibrary) { res.status(403).json({ error: "forbidden" }); return; }
      const cursorScope = `${canvasCursorScope(orgId, session.userId)}:library`;
      const page = parseCanvasPageRequest({
        limitValue: req.query.limit,
        cursorValue: req.query.cursor,
        kind: "library",
        scope: cursorScope,
        defaultLimit: 10,
        maxLimit: 10,
      });
      let rows: Array<Record<string, unknown>>;
      let nextCursor: string | null = null;
      if (page.enabled) {
        const values: unknown[] = [orgId, session.userId];
        let cursorClause = "";
        if (page.cursor) {
          values.push(page.cursor.timestamp, page.cursor.id);
          cursorClause =
            "AND (b.created_at, b.id) < ($3::timestamptz, $4::text)";
        }
        values.push(page.limit + 1);
        const limitParameter = `$${values.length}`;
        const candidateResult = await pool.query<CanvasNotePageCandidate>(
          `SELECT b.id, b.created_at AS sort_at,
                  2 * (octet_length(COALESCE(b.navn, ''))
                       + octet_length(COALESCE(b.innhold, ''))) + 2048
                    AS response_bytes
             FROM leadgrid_canvas_bibliotek b
            WHERE b.organization_id = $1 AND (b.user_id = $2 OR b.delt)
              ${cursorClause}
            ORDER BY b.created_at DESC, b.id DESC
            LIMIT ${limitParameter}`,
          values,
        );
        const selected = selectCanvasPagePrefix(
          candidateResult.rows,
          page.limit,
          MAX_CANVAS_LIBRARY_BYTES - 2 * 1024 * 1024,
        );
        const ids = selected.rows.map((row) => row.id);
        const result = ids.length === 0
          ? { rows: [] }
          : await pool.query(
              `SELECT b.id, b.navn, b.innhold, b.delt, b.user_id,
                      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, '') AS eier_navn
                 FROM leadgrid_canvas_bibliotek b
                 LEFT JOIN users u ON u.id::text = b.user_id
                WHERE b.organization_id = $1 AND (b.user_id = $2 OR b.delt)
                  AND b.id = ANY($3::text[])
                ORDER BY b.created_at DESC, b.id DESC`,
              [orgId, session.userId, ids],
            );
        rows = result.rows;
        const cursorRow = selected.rows.at(-1);
        if (selected.hasMore && cursorRow) {
          nextCursor = encodeCanvasCursor({
            kind: "library",
            scope: cursorScope,
            timestamp: cursorRow.sort_at,
            id: cursorRow.id,
          });
        }
      } else {
        await assertCanvasLibraryBudget(pool, orgId, session.userId);
        const result = await pool.query(
          `SELECT b.id, b.navn, b.innhold, b.delt, b.user_id,
                  COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, '') AS eier_navn
             FROM leadgrid_canvas_bibliotek b
             LEFT JOIN users u ON u.id::text = b.user_id
            WHERE b.organization_id = $1 AND (b.user_id = $2 OR b.delt)
            ORDER BY b.created_at DESC LIMIT 100`,
          [orgId, session.userId]);
        rows = result.rows;
      }
      res.setHeader("Cache-Control", "private, no-store");
      const payload = {
        elementer: rows.map((row) => ({
          id: row.id,
          navn: row.navn,
          innhold: row.innhold,
          delt: row.delt === true,
          er_min: row.user_id === session.userId,
          eier_navn: row.user_id === session.userId ? null : row.eier_navn,
        })),
        ...(page.enabled ? { next_cursor: nextCursor } : {}),
      };
      sendBoundedCanvasJson(
        res,
        payload,
        MAX_CANVAS_LIBRARY_BYTES,
        "canvas_library_too_large",
        rows.length,
      );
    } catch (e) {
      sendCanvasError(res, e, "bibliotek GET");
    }
  });

  /** Lagre/oppdater element (klient-generert id). Cap 500 kB per element. */
  app.post("/api/leadgrid/canvas/bibliotek", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-library-write", 60, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const id = String(b.id ?? "");
      const navn = String(b.navn ?? "");
      const innhold = String(b.innhold ?? "{}");
      if (!auth.canUseLibrary || (b.delt === true && !auth.canShare)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !navn || Buffer.byteLength(navn) > 120) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      try { JSON.parse(innhold); } catch {
        res.status(400).json({ error: "invalid_canvas_json", field: "innhold" });
        return;
      }
      if (Buffer.byteLength(innhold) > 500_000) {
        res.status(413).json({ error: "element_for_stort" });
        return;
      }
      await upsertCanvasLibraryElement(
        pool,
        { organizationId: orgId, userId: session.userId },
        { id, name: navn, content: innhold, shared: b.delt === true },
      );
      res.json({ ok: true, id });
    } catch (e) {
      sendCanvasError(res, e, "bibliotek POST");
    }
  });

  /** Slett element (eier). */
  app.delete("/api/leadgrid/canvas/bibliotek/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-library-write", 60, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canUseLibrary) { res.status(403).json({ error: "forbidden" }); return; }
      const r = await pool.query(
        `DELETE FROM leadgrid_canvas_bibliotek
          WHERE id = $1 AND organization_id = $2 AND user_id = $3`,
        [req.params.id, orgId, session.userId]);
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
      if (!(await requireCanvasRate(
        pool, res, session.userId, "canvas-write", 180, 60_000, "write",
      ))) return;
      const orgId = await resolveCanvasRouteOrganization(
        pool, session.userId, req.headers["x-organization-id"], true,
      );
      await ensureSchema(pool);
      const auth = await getCanvasAuthorization(pool, session.userId, orgId);
      if (!auth.canWrite) { res.status(403).json({ error: "forbidden" }); return; }
      const expectedRevision = requestCanvasRevision(req);
      const result = await restoreCanvasTrashNote(
        pool,
        {
          organizationId: orgId,
          userId: session.userId,
          noteId: requireCanvasUuid(req.params.id),
        },
        expectedRevision,
        auth.canShare,
      );
      setWriteRevision(res, result.revision, expectedRevision === null);
      res.json({ ok: true, revision: result.revision });
    } catch (e) {
      sendCanvasError(res, e, "gjenopprett");
    }
  });
}
