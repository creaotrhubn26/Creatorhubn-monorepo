import { createHash, randomUUID } from "crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export const CANVAS_CATEGORIES = new Set([
  "mote",
  "lead",
  "befaring",
  "salgsplan",
  "prosjekt",
  "rute",
  "oppfolging",
  "ide",
  "kunde",
  "internt",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DRAWING_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDFS_PER_NOTE = 50;
const MAX_PDF_BYTES_PER_NOTE = 100 * 1024 * 1024;
const MAX_PDFS_PER_USER = 500;
const MAX_PDF_BYTES_PER_USER = 500 * 1024 * 1024;
const MAX_PDFS_PER_ORGANIZATION = 5_000;
const MAX_PDF_BYTES_PER_ORGANIZATION = 5 * 1024 * 1024 * 1024;
const MAX_CANVAS_NOTES_PER_USER = 500;
const MAX_CANVAS_NOTE_BYTES_PER_USER = 512 * 1024 * 1024;
const MAX_CANVAS_NOTES_PER_ORGANIZATION = 5_000;
const MAX_CANVAS_NOTE_BYTES_PER_ORGANIZATION = 5 * 1024 * 1024 * 1024;
const MAX_CANVAS_HISTORY_BYTES_PER_NOTE = 96 * 1024 * 1024;
const MAX_CANVAS_HISTORY_BYTES_PER_USER = 512 * 1024 * 1024;
const MAX_CANVAS_HISTORY_BYTES_PER_ORGANIZATION = 5 * 1024 * 1024 * 1024;
const MAX_CANVAS_LIBRARY_ITEMS_PER_USER = 500;
const MAX_CANVAS_LIBRARY_BYTES_PER_USER = 100 * 1024 * 1024;
const MAX_CANVAS_LIBRARY_ITEMS_PER_ORGANIZATION = 5_000;
const MAX_CANVAS_LIBRARY_BYTES_PER_ORGANIZATION = 1024 * 1024 * 1024;
export const MAX_CANVAS_NOTE_BYTES = 24 * 1024 * 1024;
export const MAX_CANVAS_LIST_BYTES = 64 * 1024 * 1024;
export const MAX_CANVAS_HISTORY_BYTES = 32 * 1024 * 1024;
export const MAX_CANVAS_LIBRARY_BYTES = 16 * 1024 * 1024;
export const MAX_CANVAS_PDF_RESPONSE_BYTES = 30 * 1024 * 1024;

const JSON_LIMITS = {
  stempler: 20_000,
  tekstbokser: 40_000,
  figurer: 40_000,
  noder: 60_000,
  objekter: 12_000_000,
  dokumenter: 16_000_000,
} as const;

export class CanvasServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "CanvasServiceError";
  }
}
export type CanvasNoteFields = {
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

export interface CanvasNoteRow extends QueryResultRow {
  id: string;
  organization_id: string;
  user_id: string;
  tittel: string;
  kategori: string;
  selskap: string | null;
  lead_id: string | null;
  drawing_base64: string;
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
  sokbar_tekst: string;
  dokumenter: string;
  revision: number | string;
  slettet_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type CanvasSnapshot = {
  tittel: string;
  kategori: string;
  selskap: string | null;
  lead_id: string | null;
  drawing_base64: string;
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
  sokbar_tekst: string;
  dokumenter: string;
  slettet_at: string | null;
};

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function canvasNoteFieldsByteSize(fields: CanvasNoteFields): number {
  return [
    fields.tittel,
    fields.kategori,
    fields.selskap ?? "",
    fields.leadId ?? "",
    fields.drawing,
    fields.stempler,
    fields.tekstbokser,
    fields.figurer,
    fields.papir,
    fields.noder,
    fields.objekter,
    fields.sokbarTekst,
    fields.dokumenter,
  ].reduce((total, value) => total + byteLength(value), 0);
}

function boundedString(
  body: Record<string, unknown>,
  keys: string[],
  defaultValue: string,
  maxBytes: number,
  field: string,
): string {
  const raw = keys.map((key) => body[key]).find((value) => value !== undefined);
  const value = raw === undefined || raw === null ? defaultValue : String(raw);
  if (byteLength(value) > maxBytes) {
    throw new CanvasServiceError(413, "canvas_field_too_large", { field });
  }
  return value;
}

function optionalBoundedString(
  body: Record<string, unknown>,
  keys: string[],
  maxBytes: number,
  field: string,
): string | null {
  const raw = keys.map((key) => body[key]).find((value) => value !== undefined);
  if (raw === undefined || raw === null || raw === "") return null;
  const value = String(raw);
  if (byteLength(value) > maxBytes) {
    throw new CanvasServiceError(413, "canvas_field_too_large", { field });
  }
  return value;
}

function canonicalJsonArray(
  body: Record<string, unknown>,
  field: keyof typeof JSON_LIMITS,
): string {
  const raw = body[field] ?? "[]";
  if (typeof raw === "string" && byteLength(raw) > JSON_LIMITS[field]) {
    throw new CanvasServiceError(413, "canvas_field_too_large", { field });
  }
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new CanvasServiceError(400, "invalid_canvas_json", { field });
  }
  if (!Array.isArray(parsed)) {
    throw new CanvasServiceError(400, "invalid_canvas_json", { field });
  }
  const canonical = JSON.stringify(parsed);
  if (byteLength(canonical) > JSON_LIMITS[field]) {
    throw new CanvasServiceError(413, "canvas_field_too_large", { field });
  }
  return canonical;
}

export function parseCanvasNoteFields(
  body: Record<string, unknown>,
): CanvasNoteFields {
  const drawing = boundedString(
    body,
    ["drawing_base64", "drawingBase64"],
    "",
    MAX_DRAWING_BYTES,
    "drawing_base64",
  );
  const kategori = boundedString(body, ["kategori"], "mote", 40, "kategori");
  if (!CANVAS_CATEGORIES.has(kategori)) {
    throw new CanvasServiceError(400, "invalid_canvas_category", {
      field: "kategori",
    });
  }

  const lat =
    body.lat === undefined || body.lat === null ? null : Number(body.lat);
  const lon =
    body.lon === undefined || body.lon === null ? null : Number(body.lon);
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    throw new CanvasServiceError(400, "invalid_canvas_coordinate", {
      field: "lat",
    });
  }
  if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) {
    throw new CanvasServiceError(400, "invalid_canvas_coordinate", {
      field: "lon",
    });
  }
  const sider = body.sider === undefined ? 1 : Number(body.sider);
  if (!Number.isInteger(sider) || sider < 1 || sider > 20) {
    throw new CanvasServiceError(400, "invalid_canvas_pages", {
      field: "sider",
    });
  }

  const fields: CanvasNoteFields = {
    tittel: boundedString(body, ["tittel"], "", 300, "tittel"),
    kategori,
    selskap: optionalBoundedString(body, ["selskap"], 200, "selskap"),
    leadId: optionalBoundedString(body, ["lead_id", "leadId"], 64, "lead_id"),
    drawing,
    delt: body.delt === true,
    lat,
    lon,
    stempler: canonicalJsonArray(body, "stempler"),
    tekstbokser: canonicalJsonArray(body, "tekstbokser"),
    figurer: canonicalJsonArray(body, "figurer"),
    papir: boundedString(body, ["papir"], "blank", 40, "papir"),
    noder: canonicalJsonArray(body, "noder"),
    sider,
    objekter: canonicalJsonArray(body, "objekter"),
    sokbarTekst: boundedString(
      body,
      ["sokbar_tekst", "sokbarTekst"],
      "",
      20_000,
      "sokbar_tekst",
    ),
    dokumenter: canonicalJsonArray(body, "dokumenter"),
  };
  const aggregateBytes = canvasNoteFieldsByteSize(fields);
  if (aggregateBytes > MAX_CANVAS_NOTE_BYTES) {
    throw new CanvasServiceError(413, "canvas_note_too_large", {
      maxBytes: MAX_CANVAS_NOTE_BYTES,
    });
  }
  return fields;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireCanvasUuid(value: unknown, field = "id"): string {
  const id = String(value ?? "").toLowerCase();
  if (!isUuid(id)) {
    throw new CanvasServiceError(400, "invalid_canvas_id", { field });
  }
  return id;
}

export function revisionNumber(value: number | string): number {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new CanvasServiceError(500, "invalid_stored_revision");
  }
  return revision;
}

export function snapshotFromRow(row: CanvasNoteRow): CanvasSnapshot {
  const deletedAt = row.slettet_at;
  return {
    tittel: row.tittel ?? "",
    kategori: row.kategori ?? "mote",
    selskap: row.selskap ?? null,
    lead_id: row.lead_id ?? null,
    drawing_base64: row.drawing_base64 ?? "",
    delt: row.delt === true,
    lat: row.lat === null ? null : Number(row.lat),
    lon: row.lon === null ? null : Number(row.lon),
    stempler: row.stempler ?? "[]",
    tekstbokser: row.tekstbokser ?? "[]",
    figurer: row.figurer ?? "[]",
    papir: row.papir ?? "blank",
    noder: row.noder ?? "[]",
    sider: Number(row.sider ?? 1),
    objekter: row.objekter ?? "[]",
    sokbar_tekst: row.sokbar_tekst ?? "",
    dokumenter: row.dokumenter ?? "[]",
    slettet_at:
      deletedAt instanceof Date
        ? deletedAt.toISOString()
        : deletedAt === null
          ? null
          : String(deletedAt),
  };
}

function fieldsFromSnapshot(snapshot: CanvasSnapshot): CanvasNoteFields {
  return parseCanvasNoteFields({
    tittel: snapshot.tittel,
    kategori: snapshot.kategori,
    selskap: snapshot.selskap,
    lead_id: snapshot.lead_id,
    drawing_base64: snapshot.drawing_base64,
    delt: snapshot.delt,
    lat: snapshot.lat,
    lon: snapshot.lon,
    stempler: snapshot.stempler,
    tekstbokser: snapshot.tekstbokser,
    figurer: snapshot.figurer,
    papir: snapshot.papir,
    noder: snapshot.noder,
    sider: snapshot.sider,
    objekter: snapshot.objekter,
    sokbar_tekst: snapshot.sokbar_tekst,
    dokumenter: snapshot.dokumenter,
  });
}

function isFullSnapshot(value: unknown): value is CanvasSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return [
    "tittel",
    "kategori",
    "drawing_base64",
    "delt",
    "stempler",
    "tekstbokser",
    "figurer",
    "papir",
    "noder",
    "sider",
    "objekter",
    "sokbar_tekst",
    "dokumenter",
  ].every((key) => Object.prototype.hasOwnProperty.call(snapshot, key));
}

function fieldsEqual(row: CanvasNoteRow, fields: CanvasNoteFields): boolean {
  const current = snapshotFromRow(row);
  return (
    current.tittel === fields.tittel &&
    current.kategori === fields.kategori &&
    current.selskap === fields.selskap &&
    current.lead_id === fields.leadId &&
    current.drawing_base64 === fields.drawing &&
    current.delt === fields.delt &&
    current.lat === fields.lat &&
    current.lon === fields.lon &&
    current.stempler === fields.stempler &&
    current.tekstbokser === fields.tekstbokser &&
    current.figurer === fields.figurer &&
    current.papir === fields.papir &&
    current.noder === fields.noder &&
    current.sider === fields.sider &&
    current.objekter === fields.objekter &&
    current.sokbar_tekst === fields.sokbarTekst &&
    current.dokumenter === fields.dokumenter
  );
}

function documentIds(documentJson: string): string[] {
  try {
    const parsed = JSON.parse(documentJson) as unknown[];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const object = item as Record<string, unknown>;
      const id = String(
        object.id ?? object.documentId ?? object.dokumentId ?? "",
      );
      return DOCUMENT_ID_PATTERN.test(id) ? [id] : [];
    });
  } catch {
    return [];
  }
}

async function reconcileDocuments(
  client: PoolClient,
  row: Pick<CanvasNoteRow, "id" | "organization_id" | "user_id">,
  documentJson: string,
): Promise<void> {
  await client.query(
    `UPDATE leadgrid_canvas_dokumenter
        SET active = (id = ANY($1::text[]))
      WHERE notat_id = $2 AND organization_id = $3 AND user_id = $4`,
    [documentIds(documentJson), row.id, row.organization_id, row.user_id],
  );
}

async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function assertRevision(
  row: CanvasNoteRow,
  expectedRevision: number | null,
): number {
  const currentRevision = revisionNumber(row.revision);
  if (expectedRevision !== null && currentRevision !== expectedRevision) {
    throw new CanvasServiceError(412, "revision_conflict", { currentRevision });
  }
  return currentRevision;
}

async function insertSnapshot(
  client: PoolClient,
  row: CanvasNoteRow,
  revision: number,
): Promise<void> {
  const snapshot = snapshotFromRow(row);
  const snapshotJson = JSON.stringify(snapshot);
  const storageBytes =
    byteLength(snapshotJson) +
    byteLength(snapshot.drawing_base64) +
    byteLength(snapshot.objekter) +
    512;
  await lockCanvasOrganization(client, row.organization_id);
  await client.query(
    `INSERT INTO leadgrid_canvas_versjoner
       (id, notat_id, revision, schema_version, snapshot,
        kategori, drawing_base64, objekter, storage_bytes)
     VALUES ($1, $2, $3, 1, $4::jsonb, $5, $6, $7, $8)`,
    [
      randomUUID(),
      row.id,
      revision,
      snapshotJson,
      snapshot.kategori,
      snapshot.drawing_base64,
      snapshot.objekter,
      storageBytes,
    ],
  );
  await client.query(
    `DELETE FROM leadgrid_canvas_versjoner
      WHERE id IN (
        SELECT id
          FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     ORDER BY created_at DESC, id DESC
                   ) AS version_rank,
                   SUM(COALESCE(
                     storage_bytes,
                     COALESCE(pg_column_size(snapshot), 0) +
                     octet_length(COALESCE(drawing_base64, '')) +
                     octet_length(COALESCE(objekter, '')) + 512
                   )) OVER (
                     ORDER BY created_at DESC, id DESC
                   ) AS cumulative_bytes
              FROM leadgrid_canvas_versjoner
             WHERE notat_id = $1
          ) ranked
         WHERE version_rank > 40 OR cumulative_bytes > $2
      )`,
    [row.id, MAX_CANVAS_HISTORY_BYTES_PER_NOTE],
  );

  const pruneAggregate = async (
    userScoped: boolean,
    maxBytes: number,
  ) => {
    const maxParameter = userScoped ? "$3" : "$2";
    await client.query(
      `DELETE FROM leadgrid_canvas_versjoner
        WHERE id IN (
          SELECT id
            FROM (
              SELECT v.id,
                     SUM(COALESCE(
                       v.storage_bytes,
                       COALESCE(pg_column_size(v.snapshot), 0) +
                       octet_length(COALESCE(v.drawing_base64, '')) +
                       octet_length(COALESCE(v.objekter, '')) + 512
                     )) OVER (
                       ORDER BY v.created_at DESC, v.id DESC
                     ) AS cumulative_bytes
                FROM leadgrid_canvas_versjoner v
                JOIN leadgrid_canvas_notater n ON n.id = v.notat_id
               WHERE n.organization_id = $1
                 ${userScoped ? "AND n.user_id = $2" : ""}
            ) ranked
           WHERE cumulative_bytes > ${maxParameter}
        )`,
      userScoped
        ? [row.organization_id, row.user_id, maxBytes]
        : [row.organization_id, maxBytes],
    );
  };
  await pruneAggregate(true, MAX_CANVAS_HISTORY_BYTES_PER_USER);
  await pruneAggregate(false, MAX_CANVAS_HISTORY_BYTES_PER_ORGANIZATION);
}

const FIELD_VALUES = (fields: CanvasNoteFields): unknown[] => [
  fields.tittel,
  fields.kategori,
  fields.selskap,
  fields.leadId,
  fields.drawing,
  fields.delt,
  fields.lat,
  fields.lon,
  fields.stempler,
  fields.tekstbokser,
  fields.figurer,
  fields.papir,
  fields.noder,
  fields.sider,
  fields.objekter,
  fields.sokbarTekst,
  fields.dokumenter,
];

const NOTE_STORAGE_BYTES_SQL = `
  octet_length(COALESCE(tittel, '')) +
  octet_length(COALESCE(kategori, '')) +
  octet_length(COALESCE(selskap, '')) +
  octet_length(COALESCE(lead_id, '')) +
  octet_length(COALESCE(drawing_base64, '')) +
  octet_length(COALESCE(stempler, '')) +
  octet_length(COALESCE(tekstbokser, '')) +
  octet_length(COALESCE(figurer, '')) +
  octet_length(COALESCE(papir, '')) +
  octet_length(COALESCE(noder, '')) +
  octet_length(COALESCE(objekter, '')) +
  octet_length(COALESCE(sokbar_tekst, '')) +
  octet_length(COALESCE(dokumenter, '')) + 1024`;

async function lockCanvasOrganization(
  client: PoolClient,
  organizationId: string,
): Promise<void> {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`leadgrid-canvas-storage:${organizationId}`],
  );
}

async function assertCanvasNoteStorageBudget(
  client: PoolClient,
  scope: { organizationId: string; userId: string },
  fields: CanvasNoteFields,
  excludeNoteId: string | null,
): Promise<void> {
  const aggregate = async (userScoped: boolean) => {
    const excludeParameter = userScoped ? "$3" : "$2";
    const result = await client.query<
      { note_count: number; total_bytes: number | string } & QueryResultRow
    >(
      `SELECT COUNT(*)::int AS note_count,
              COALESCE(SUM(${NOTE_STORAGE_BYTES_SQL}), 0) AS total_bytes
        FROM leadgrid_canvas_notater
        WHERE organization_id = $1
          ${userScoped ? "AND user_id = $2" : ""}
          AND (${excludeParameter}::uuid IS NULL OR id <> ${excludeParameter}::uuid)`,
      userScoped
        ? [scope.organizationId, scope.userId, excludeNoteId]
        : [scope.organizationId, excludeNoteId],
    );
    const count = Number(result.rows[0]?.note_count ?? 0);
    const bytes = Number(result.rows[0]?.total_bytes ?? 0);
    if (
      !Number.isSafeInteger(count) || count < 0 ||
      !Number.isSafeInteger(bytes) || bytes < 0
    ) {
      throw new CanvasServiceError(500, "invalid_stored_canvas_size");
    }
    return { count, bytes };
  };
  const incomingBytes = canvasNoteFieldsByteSize(fields) + 1024;
  const userUsage = await aggregate(true);
  const organizationUsage = await aggregate(false);
  if (
    userUsage.count + 1 > MAX_CANVAS_NOTES_PER_USER ||
    userUsage.bytes + incomingBytes > MAX_CANVAS_NOTE_BYTES_PER_USER
  ) {
    throw new CanvasServiceError(413, "canvas_user_storage_quota_exceeded", {
      maxNotes: MAX_CANVAS_NOTES_PER_USER,
      maxBytes: MAX_CANVAS_NOTE_BYTES_PER_USER,
    });
  }
  if (
    organizationUsage.count + 1 > MAX_CANVAS_NOTES_PER_ORGANIZATION ||
    organizationUsage.bytes + incomingBytes >
      MAX_CANVAS_NOTE_BYTES_PER_ORGANIZATION
  ) {
    throw new CanvasServiceError(
      413,
      "canvas_organization_storage_quota_exceeded",
      {
        maxNotes: MAX_CANVAS_NOTES_PER_ORGANIZATION,
        maxBytes: MAX_CANVAS_NOTE_BYTES_PER_ORGANIZATION,
      },
    );
  }
}

export async function createCanvasNote(
  pool: Pool,
  scope: { organizationId: string; userId: string },
  fields: CanvasNoteFields,
  requestedId?: unknown,
): Promise<{ id: string; revision: number; created: boolean }> {
  const id =
    requestedId === undefined || requestedId === null || requestedId === ""
      ? randomUUID()
      : requireCanvasUuid(requestedId);
  const retryResult = (row: CanvasNoteRow | undefined) => {
    if (
      row &&
      row.organization_id === scope.organizationId &&
      row.user_id === scope.userId &&
      row.slettet_at === null
    ) {
      // A stable client UUID can be retried after a lost response. Even if the
      // local draft has advanced since the first POST, return the persisted
      // revision; the client then follows with an OCC-protected PUT.
      return { id, revision: revisionNumber(row.revision), created: false };
    }
    throw new CanvasServiceError(409, "canvas_id_conflict");
  };

  const existing = await pool.query<CanvasNoteRow>(
    `SELECT * FROM leadgrid_canvas_notater WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (existing.rows[0]) return retryResult(existing.rows[0]);

  return withTransaction(pool, async (client) => {
    await lockCanvasOrganization(client, scope.organizationId);
    await assertCanvasNoteStorageBudget(client, scope, fields, null);
    const inserted = await client.query<CanvasNoteRow>(
      `INSERT INTO leadgrid_canvas_notater
         (id, organization_id, user_id, tittel, kategori, selskap, lead_id,
          drawing_base64, delt, lat, lon, stempler, tekstbokser, figurer,
          papir, noder, sider, objekter, sokbar_tekst, dokumenter, revision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,0)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [id, scope.organizationId, scope.userId, ...FIELD_VALUES(fields)],
    );
    if (inserted.rows[0]) return { id, revision: 0, created: true };
    const raced = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater WHERE id = $1 LIMIT 1`,
      [id],
    );
    return retryResult(raced.rows[0]);
  });
}

export async function updateCanvasNote(
  pool: Pool,
  scope: { organizationId: string; userId: string; noteId: string },
  fields: CanvasNoteFields,
  expectedRevision: number | null,
): Promise<{ revision: number; changed: boolean }> {
  return withTransaction(pool, async (client) => {
    const selected = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NULL
        FOR UPDATE`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const row = selected.rows[0];
    if (!row) throw new CanvasServiceError(404, "not_found");
    const currentRevision = assertRevision(row, expectedRevision);
    if (fieldsEqual(row, fields)) {
      await reconcileDocuments(client, row, fields.dokumenter);
      return { revision: currentRevision, changed: false };
    }

    await lockCanvasOrganization(client, scope.organizationId);
    await assertCanvasNoteStorageBudget(client, scope, fields, scope.noteId);
    await insertSnapshot(client, row, currentRevision);
    const nextRevision = currentRevision + 1;
    await client.query(
      `UPDATE leadgrid_canvas_notater
          SET tittel = $1, kategori = $2, selskap = $3, lead_id = $4,
              drawing_base64 = $5, delt = $6, lat = $7, lon = $8,
              stempler = $9, tekstbokser = $10, figurer = $11,
              papir = $12, noder = $13, sider = $14, objekter = $15,
              sokbar_tekst = $16, dokumenter = $17,
              revision = $18, updated_at = now()
        WHERE id = $19 AND organization_id = $20 AND user_id = $21`,
      [
        ...FIELD_VALUES(fields),
        nextRevision,
        scope.noteId,
        scope.organizationId,
        scope.userId,
      ],
    );
    await reconcileDocuments(client, row, fields.dokumenter);
    return { revision: nextRevision, changed: true };
  });
}

export async function softDeleteCanvasNote(
  pool: Pool,
  scope: { organizationId: string; userId: string; noteId: string },
  expectedRevision: number | null,
): Promise<{ revision: number }> {
  return withTransaction(pool, async (client) => {
    const selected = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NULL
        FOR UPDATE`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const row = selected.rows[0];
    if (!row) throw new CanvasServiceError(404, "not_found");
    const currentRevision = assertRevision(row, expectedRevision);
    await insertSnapshot(client, row, currentRevision);
    const revision = currentRevision + 1;
    await client.query(
      `UPDATE leadgrid_canvas_notater
          SET slettet_at = now(), revision = $1, updated_at = now()
        WHERE id = $2 AND organization_id = $3 AND user_id = $4`,
      [revision, scope.noteId, scope.organizationId, scope.userId],
    );
    return { revision };
  });
}

export async function permanentlyDeleteCanvasNote(
  pool: Pool,
  scope: { organizationId: string; userId: string; noteId: string },
  expectedRevision: number | null,
): Promise<{ revision: number }> {
  return withTransaction(pool, async (client) => {
    const selected = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NOT NULL
        FOR UPDATE`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const row = selected.rows[0];
    if (!row) throw new CanvasServiceError(404, "not_found");
    const revision = assertRevision(row, expectedRevision);
    // Do not rely solely on migration 0465's cascades. Rolling instances and
    // legacy lazy-created schemas must still provide real hard deletion.
    await client.query(
      `DELETE FROM leadgrid_canvas_versjoner WHERE notat_id = $1`,
      [scope.noteId],
    );
    await client.query(
      `DELETE FROM leadgrid_canvas_dokumenter
        WHERE notat_id = $1`,
      [scope.noteId],
    );
    await client.query(
      `DELETE FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NOT NULL`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    return { revision };
  });
}

/** Bounded lazy trash cleanup with explicit child removal for pre-FK schemas. */
export async function purgeExpiredCanvasTrash(
  pool: Pool,
  limit = 100,
): Promise<number> {
  const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit) || 100));
  return withTransaction(pool, async (client) => {
    const expired = await client.query<{ id: string } & QueryResultRow>(
      `SELECT id
         FROM leadgrid_canvas_notater
        WHERE slettet_at IS NOT NULL
          AND slettet_at < now() - interval '30 days'
        ORDER BY slettet_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1`,
      [boundedLimit],
    );
    const ids = expired.rows.map((row) => row.id);
    if (ids.length === 0) return 0;
    await client.query(
      `DELETE FROM leadgrid_canvas_versjoner WHERE notat_id = ANY($1::uuid[])`,
      [ids],
    );
    await client.query(
      `DELETE FROM leadgrid_canvas_dokumenter WHERE notat_id = ANY($1::uuid[])`,
      [ids],
    );
    const deleted = await client.query(
      `DELETE FROM leadgrid_canvas_notater
        WHERE id = ANY($1::uuid[])
          AND slettet_at IS NOT NULL
          AND slettet_at < now() - interval '30 days'`,
      [ids],
    );
    return deleted.rowCount ?? 0;
  });
}

export async function restoreCanvasTrashNote(
  pool: Pool,
  scope: { organizationId: string; userId: string; noteId: string },
  expectedRevision: number | null,
  allowShared: boolean,
): Promise<{ revision: number }> {
  return withTransaction(pool, async (client) => {
    const selected = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NOT NULL
        FOR UPDATE`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const row = selected.rows[0];
    if (!row) throw new CanvasServiceError(404, "not_found");
    if (row.delt && !allowShared)
      throw new CanvasServiceError(403, "sharing_forbidden");
    const currentRevision = assertRevision(row, expectedRevision);
    await insertSnapshot(client, row, currentRevision);
    const revision = currentRevision + 1;
    await client.query(
      `UPDATE leadgrid_canvas_notater
          SET slettet_at = NULL, revision = $1, updated_at = now()
        WHERE id = $2 AND organization_id = $3 AND user_id = $4`,
      [revision, scope.noteId, scope.organizationId, scope.userId],
    );
    return { revision };
  });
}

export async function restoreCanvasHistoryVersion(
  pool: Pool,
  scope: {
    organizationId: string;
    userId: string;
    noteId: string;
    versionId: string;
  },
  expectedRevision: number | null,
  allowShared: boolean,
): Promise<CanvasNoteRow> {
  return withTransaction(pool, async (client) => {
    const selected = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NULL
        FOR UPDATE`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const row = selected.rows[0];
    if (!row) throw new CanvasServiceError(404, "not_found");
    const currentRevision = assertRevision(row, expectedRevision);
    const version = await client.query<
      {
        schema_version: number;
        snapshot: unknown;
      } & QueryResultRow
    >(
      `SELECT schema_version, snapshot FROM leadgrid_canvas_versjoner
        WHERE id = $1 AND notat_id = $2
        LIMIT 1`,
      [scope.versionId, scope.noteId],
    );
    const stored = version.rows[0];
    if (!stored) throw new CanvasServiceError(404, "version_not_found");
    const rawSnapshot =
      typeof stored.snapshot === "string"
        ? (JSON.parse(stored.snapshot) as unknown)
        : stored.snapshot;
    if (Number(stored.schema_version) !== 1 || !isFullSnapshot(rawSnapshot)) {
      throw new CanvasServiceError(422, "partial_version_not_restorable");
    }
    const fields = fieldsFromSnapshot(rawSnapshot);
    if (fields.delt && !allowShared) {
      throw new CanvasServiceError(403, "sharing_forbidden");
    }
    if (fieldsEqual(row, fields)) return row;

    await insertSnapshot(client, row, currentRevision);
    const revision = currentRevision + 1;
    const updated = await client.query<CanvasNoteRow>(
      `UPDATE leadgrid_canvas_notater
          SET tittel = $1, kategori = $2, selskap = $3, lead_id = $4,
              drawing_base64 = $5, delt = $6, lat = $7, lon = $8,
              stempler = $9, tekstbokser = $10, figurer = $11,
              papir = $12, noder = $13, sider = $14, objekter = $15,
              sokbar_tekst = $16, dokumenter = $17,
              revision = $18, updated_at = now()
        WHERE id = $19 AND organization_id = $20 AND user_id = $21
        RETURNING *`,
      [
        ...FIELD_VALUES(fields),
        revision,
        scope.noteId,
        scope.organizationId,
        scope.userId,
      ],
    );
    await reconcileDocuments(client, row, fields.dokumenter);
    const result = updated.rows[0];
    if (!result) throw new CanvasServiceError(404, "not_found");
    return result;
  });
}

export type ParsedPdf = {
  id: string;
  navn: string;
  base64: string;
  sha256: string;
  byteSize: number;
};

export function parseCanvasPdf(body: Record<string, unknown>): ParsedPdf {
  const id = String(body.id ?? "");
  if (!DOCUMENT_ID_PATTERN.test(id)) {
    throw new CanvasServiceError(400, "invalid_document_id", { field: "id" });
  }
  const navn = String(body.navn ?? "");
  if (!navn || byteLength(navn) > 200) {
    throw new CanvasServiceError(400, "invalid_document_name", {
      field: "navn",
    });
  }
  const base64 = String(body.base64 ?? "").replace(/\s/g, "");
  if (
    !base64 ||
    base64.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new CanvasServiceError(400, "invalid_pdf");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_PDF_BYTES) {
    throw new CanvasServiceError(413, "document_too_large");
  }
  const canonical = bytes.toString("base64").replace(/=+$/u, "");
  if (canonical !== base64.replace(/=+$/u, "")) {
    throw new CanvasServiceError(400, "invalid_pdf");
  }
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new CanvasServiceError(415, "document_must_be_pdf");
  }
  return {
    id,
    navn,
    base64,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.length,
  };
}

export async function storeCanvasPdf(
  pool: Pool,
  scope: { organizationId: string; userId: string; noteId: string },
  pdf: ParsedPdf,
): Promise<{ created: boolean; active: boolean }> {
  type ExistingDocument = {
    notat_id: string;
    organization_id: string;
    user_id: string;
    navn: string;
    base64: string;
    content_sha256: string | null;
    active: boolean;
  } & QueryResultRow;
  const idempotentResult = (current: ExistingDocument | undefined) => {
    const sameBytes = current?.content_sha256
      ? current.content_sha256 === pdf.sha256
      : current?.base64 === pdf.base64;
    if (
      current &&
      current.notat_id === scope.noteId &&
      current.organization_id === scope.organizationId &&
      current.user_id === scope.userId &&
      current.navn === pdf.navn &&
      sameBytes
    ) {
      return { created: false, active: current.active === true };
    }
    throw new CanvasServiceError(409, "document_id_conflict");
  };

  return withTransaction(pool, async (client) => {
    const note = await client.query<CanvasNoteRow>(
      `SELECT * FROM leadgrid_canvas_notater
        WHERE id = $1 AND organization_id = $2 AND user_id = $3
          AND slettet_at IS NULL
        FOR UPDATE`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const row = note.rows[0];
    if (!row) throw new CanvasServiceError(404, "not_found");

    const existing = await client.query<ExistingDocument>(
      `SELECT notat_id, organization_id, user_id, navn, base64,
              content_sha256, active
         FROM leadgrid_canvas_dokumenter WHERE id = $1 LIMIT 1`,
      [pdf.id],
    );
    if (existing.rows[0]) return idempotentResult(existing.rows[0]);

    // Serialize aggregate quota decisions across every note in this tenant.
    // The note row lock alone only protects uploads to the same note.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`leadgrid-canvas-pdf:${scope.organizationId}`],
    );

    const usage = await client.query<
      {
        document_count: number;
        total_bytes: number | string;
      } & QueryResultRow
    >(
      `SELECT COUNT(*)::int AS document_count,
              COALESCE(SUM(COALESCE(byte_size, length(base64)::bigint * 3 / 4)), 0)
                AS total_bytes
         FROM leadgrid_canvas_dokumenter
        WHERE notat_id = $1 AND organization_id = $2 AND user_id = $3`,
      [scope.noteId, scope.organizationId, scope.userId],
    );
    const documentCount = Number(usage.rows[0]?.document_count ?? 0);
    const totalBytes = Number(usage.rows[0]?.total_bytes ?? 0);
    if (
      !Number.isSafeInteger(documentCount) ||
      documentCount < 0 ||
      documentCount >= MAX_PDFS_PER_NOTE ||
      !Number.isSafeInteger(totalBytes) ||
      totalBytes < 0 ||
      totalBytes + pdf.byteSize > MAX_PDF_BYTES_PER_NOTE
    ) {
      throw new CanvasServiceError(413, "document_quota_exceeded", {
        maxDocuments: MAX_PDFS_PER_NOTE,
        maxBytes: MAX_PDF_BYTES_PER_NOTE,
      });
    }

    const aggregateUsage = async (where: string, values: unknown[]) => {
      const result = await client.query<
        { document_count: number; total_bytes: number | string } & QueryResultRow
      >(
        `SELECT COUNT(*)::int AS document_count,
                COALESCE(SUM(COALESCE(byte_size, length(base64)::bigint * 3 / 4)), 0)
                  AS total_bytes
           FROM leadgrid_canvas_dokumenter
          WHERE ${where}`,
        values,
      );
      return {
        count: Number(result.rows[0]?.document_count ?? 0),
        bytes: Number(result.rows[0]?.total_bytes ?? 0),
      };
    };
    const userUsage = await aggregateUsage(
      "organization_id = $1 AND user_id = $2",
      [scope.organizationId, scope.userId],
    );
    const organizationUsage = await aggregateUsage(
      "organization_id = $1",
      [scope.organizationId],
    );
    const exceeds = (
      usageValue: { count: number; bytes: number },
      maxCount: number,
      maxBytes: number,
    ) =>
      !Number.isSafeInteger(usageValue.count) ||
      usageValue.count < 0 ||
      !Number.isSafeInteger(usageValue.bytes) ||
      usageValue.bytes < 0 ||
      usageValue.count >= maxCount ||
      usageValue.bytes + pdf.byteSize > maxBytes;
    if (exceeds(userUsage, MAX_PDFS_PER_USER, MAX_PDF_BYTES_PER_USER)) {
      throw new CanvasServiceError(413, "document_user_quota_exceeded", {
        maxDocuments: MAX_PDFS_PER_USER,
        maxBytes: MAX_PDF_BYTES_PER_USER,
      });
    }
    if (
      exceeds(
        organizationUsage,
        MAX_PDFS_PER_ORGANIZATION,
        MAX_PDF_BYTES_PER_ORGANIZATION,
      )
    ) {
      throw new CanvasServiceError(413, "document_organization_quota_exceeded", {
        maxDocuments: MAX_PDFS_PER_ORGANIZATION,
        maxBytes: MAX_PDF_BYTES_PER_ORGANIZATION,
      });
    }

    const active = documentIds(row.dokumenter).includes(pdf.id);
    const inserted = await client.query(
      `INSERT INTO leadgrid_canvas_dokumenter
         (id, notat_id, organization_id, user_id, navn, base64,
          content_sha256, byte_size, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        pdf.id,
        scope.noteId,
        scope.organizationId,
        scope.userId,
        pdf.navn,
        pdf.base64,
        pdf.sha256,
        pdf.byteSize,
        active,
      ],
    );
    if ((inserted.rowCount ?? 0) > 0) return { created: true, active };

    const raced = await client.query<ExistingDocument>(
      `SELECT notat_id, organization_id, user_id, navn, base64,
              content_sha256, active
         FROM leadgrid_canvas_dokumenter WHERE id = $1 LIMIT 1`,
      [pdf.id],
    );
    return idempotentResult(raced.rows[0]);
  });
}

export async function upsertCanvasLibraryElement(
  pool: Pool,
  scope: { organizationId: string; userId: string },
  element: { id: string; name: string; content: string; shared: boolean },
): Promise<void> {
  return withTransaction(pool, async (client) => {
    await lockCanvasOrganization(client, scope.organizationId);
    const existing = await client.query<{ organization_id: string; user_id: string } & QueryResultRow>(
      `SELECT organization_id, user_id
         FROM leadgrid_canvas_bibliotek
        WHERE id = $1
        LIMIT 1`,
      [element.id],
    );
    const current = existing.rows[0];
    if (
      current &&
      (
        current.organization_id !== scope.organizationId ||
        current.user_id !== scope.userId
      )
    ) {
      throw new CanvasServiceError(409, "canvas_id_conflict");
    }

    const aggregate = async (userScoped: boolean) => {
      const excludeParameter = userScoped ? "$3" : "$2";
      const result = await client.query<
        { item_count: number; total_bytes: number | string } & QueryResultRow
      >(
        `SELECT COUNT(*)::int AS item_count,
                COALESCE(SUM(
                  octet_length(COALESCE(navn, '')) +
                  octet_length(COALESCE(innhold, '')) + 512
                ), 0) AS total_bytes
           FROM leadgrid_canvas_bibliotek
          WHERE organization_id = $1
            ${userScoped ? "AND user_id = $2" : ""}
            AND id <> ${excludeParameter}`,
        userScoped
          ? [scope.organizationId, scope.userId, element.id]
          : [scope.organizationId, element.id],
      );
      const count = Number(result.rows[0]?.item_count ?? 0);
      const bytes = Number(result.rows[0]?.total_bytes ?? 0);
      if (
        !Number.isSafeInteger(count) || count < 0 ||
        !Number.isSafeInteger(bytes) || bytes < 0
      ) {
        throw new CanvasServiceError(500, "invalid_stored_canvas_size");
      }
      return { count, bytes };
    };
    const incomingBytes =
      byteLength(element.name) + byteLength(element.content) + 512;
    const userUsage = await aggregate(true);
    const organizationUsage = await aggregate(false);
    if (
      userUsage.count + 1 > MAX_CANVAS_LIBRARY_ITEMS_PER_USER ||
      userUsage.bytes + incomingBytes > MAX_CANVAS_LIBRARY_BYTES_PER_USER
    ) {
      throw new CanvasServiceError(413, "canvas_library_user_quota_exceeded");
    }
    if (
      organizationUsage.count + 1 > MAX_CANVAS_LIBRARY_ITEMS_PER_ORGANIZATION ||
      organizationUsage.bytes + incomingBytes >
        MAX_CANVAS_LIBRARY_BYTES_PER_ORGANIZATION
    ) {
      throw new CanvasServiceError(
        413,
        "canvas_library_organization_quota_exceeded",
      );
    }

    const saved = await client.query(
      `INSERT INTO leadgrid_canvas_bibliotek
         (id, organization_id, user_id, navn, innhold, delt)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET navn = EXCLUDED.navn,
                                      innhold = EXCLUDED.innhold,
                                      delt = EXCLUDED.delt
       WHERE leadgrid_canvas_bibliotek.organization_id = $2
         AND leadgrid_canvas_bibliotek.user_id = $3
       RETURNING id`,
      [
        element.id,
        scope.organizationId,
        scope.userId,
        element.name,
        element.content,
        element.shared,
      ],
    );
    if ((saved.rowCount ?? saved.rows.length) === 0) {
      throw new CanvasServiceError(409, "canvas_id_conflict");
    }
  });
}
