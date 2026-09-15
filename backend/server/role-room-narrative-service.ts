/**
 * Story Graph — narrativ graf for spillstudio-vertikalen (game_studio).
 *
 * Ren SQL-service over tabellene i 0605_role_room_narrative_graph.sql.
 * Alt er prosjekt-skopet: hver funksjon tar (pool, projectId, …) og hver
 * spørring har `project_id = $n` slik at en id fra et annet prosjekt aldri
 * kan leses/endres (IDOR-vern uavhengig av rute-laget).
 *
 * Datamodellen speiler Arcweaves JSON-eksport 1:1 (se migrasjonen) —
 * `getGraph` er samme form som eksporten og som revisjons-snapshots.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
// Delt format-lag (Fase 3): Arcweave-import + runtime-delsett til offentlige spill-lenker.
import {
  fromArcweaveProject, fromInk, fromTwee, toRuntimeSubset, type FormatWarning, type ImportFormat,
} from '../../frontend/shared/narrative-format/index.ts';

// ═══════════════════════════════════════════════════════════════════════
//  Typer (speiles i frontend/client/src/components/role-room/narrative/narrativeTypes.ts)
// ═══════════════════════════════════════════════════════════════════════

export type NarrativeElementKind = 'element' | 'branch' | 'jumper' | 'note';
export type NarrativeAttributeOwnerKind = 'element' | 'component' | 'board';
export type NarrativeAttributeType =
  | 'rich_text' | 'string' | 'bool' | 'int' | 'float' | 'component_list' | 'asset_list';
export type NarrativeVariableType = 'bool' | 'int' | 'float' | 'string';
export type NarrativeAssetKind = 'image' | 'audio' | 'video';

export const NARRATIVE_ELEMENT_KINDS: readonly NarrativeElementKind[] = ['element', 'branch', 'jumper', 'note'];
export const NARRATIVE_ATTRIBUTE_OWNER_KINDS: readonly NarrativeAttributeOwnerKind[] = ['element', 'component', 'board'];
export const NARRATIVE_ATTRIBUTE_TYPES: readonly NarrativeAttributeType[] =
  ['rich_text', 'string', 'bool', 'int', 'float', 'component_list', 'asset_list'];
export const NARRATIVE_VARIABLE_TYPES: readonly NarrativeVariableType[] = ['bool', 'int', 'float', 'string'];
export const NARRATIVE_ASSET_KINDS: readonly NarrativeAssetKind[] = ['image', 'audio', 'video'];

export interface NarrativeSettings {
  projectId: string;
  title: string | null;
  startingElementId: string | null;
  coverAssetId: string | null;
  schemaVersion: number;
  updatedAt: string | null;
}

export interface NarrativeBoard {
  id: string;
  projectId: string;
  name: string;
  customId: string | null;
  folderPath: string;
  sortOrder: number;
  viewport: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeBranchCondition {
  id: string;
  /** arcscript-kompatibelt uttrykk. Tom streng/null = else-gren. */
  script: string | null;
  label: string | null;
}

export interface NarrativeElement {
  id: string;
  projectId: string;
  boardId: string;
  kind: NarrativeElementKind;
  titleHtml: string;
  contentHtml: string;
  x: number;
  y: number;
  width: number;
  height: number;
  theme: string;
  coverAssetId: string | null;
  customId: string | null;
  jumperTargetId: string | null;
  branchConditions: NarrativeBranchCondition[];
  version: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeConnection {
  id: string;
  projectId: string;
  boardId: string;
  sourceId: string;
  targetId: string;
  sourceOutputKey: string;
  labelHtml: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeComponent {
  id: string;
  projectId: string;
  name: string;
  folderPath: string;
  coverAssetId: string | null;
  customId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeElementComponent {
  elementId: string;
  componentId: string;
  sortOrder: number;
}

export interface NarrativeAttribute {
  id: string;
  projectId: string;
  ownerKind: NarrativeAttributeOwnerKind;
  ownerId: string;
  name: string;
  type: NarrativeAttributeType;
  value: unknown;
  customId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeVariable {
  id: string;
  projectId: string;
  name: string;
  type: NarrativeVariableType;
  defaultValue: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeAsset {
  id: string;
  projectId: string;
  kind: NarrativeAssetKind;
  name: string;
  storageKey: string | null;
  externalUrl: string | null;
  mime: string | null;
  sizeBytes: number | null;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeRevisionMeta {
  id: string;
  projectId: string;
  label: string | null;
  createdBy: string | null;
  createdAt: string;
  counts: { boards: number; elements: number; connections: number; components: number };
}

export interface NarrativeGraph {
  settings: NarrativeSettings;
  boards: NarrativeBoard[];
  elements: NarrativeElement[];
  connections: NarrativeConnection[];
  components: NarrativeComponent[];
  elementComponents: NarrativeElementComponent[];
  attributes: NarrativeAttribute[];
  variables: NarrativeVariable[];
  assets: NarrativeAsset[];
}

// ═══════════════════════════════════════════════════════════════════════
//  Hjelpere
// ═══════════════════════════════════════════════════════════════════════

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
type Row = Record<string, unknown>;

function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function isoTsOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoTs(value);
}

function strOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* ignore */ }
  }
  return {};
}

function jsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try { return JSON.parse(value) as unknown; } catch { return value; }
  }
  return value ?? null;
}

export function normalizeBranchConditions(value: unknown): NarrativeBranchCondition[] {
  const raw = typeof value === 'string' ? jsonValue(value) : value;
  if (!Array.isArray(raw)) return [];
  const out: NarrativeBranchCondition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : generateId('cond');
    const script = typeof rec.script === 'string' && rec.script.trim() ? rec.script : null;
    const label = typeof rec.label === 'string' && rec.label.trim() ? rec.label : null;
    out.push({ id, script, label });
  }
  return out;
}

// ─── Row-mappere ──────────────────────────────────────────────────────

function mapSettingsRow(projectId: string, row: Row | undefined): NarrativeSettings {
  if (!row) {
    return { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null };
  }
  return {
    projectId,
    title: strOrNull(row.title),
    startingElementId: strOrNull(row.starting_element_id),
    coverAssetId: strOrNull(row.cover_asset_id),
    schemaVersion: num(row.schema_version, 1),
    updatedAt: isoTsOrNull(row.updated_at),
  };
}

export function mapBoardRow(row: Row): NarrativeBoard {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name ?? ''),
    customId: strOrNull(row.custom_id),
    folderPath: String(row.folder_path ?? ''),
    sortOrder: num(row.sort_order),
    viewport: jsonObject(row.viewport),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export function mapElementRow(row: Row): NarrativeElement {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    boardId: String(row.board_id),
    kind: String(row.kind ?? 'element') as NarrativeElementKind,
    titleHtml: String(row.title_html ?? ''),
    contentHtml: String(row.content_html ?? ''),
    x: num(row.x),
    y: num(row.y),
    width: num(row.width, 260),
    height: num(row.height, 120),
    theme: String(row.theme ?? 'default'),
    coverAssetId: strOrNull(row.cover_asset_id),
    customId: strOrNull(row.custom_id),
    jumperTargetId: strOrNull(row.jumper_target_id),
    branchConditions: normalizeBranchConditions(row.branch_conditions),
    version: num(row.version, 1),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export function mapConnectionRow(row: Row): NarrativeConnection {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    boardId: String(row.board_id),
    sourceId: String(row.source_id),
    targetId: String(row.target_id),
    sourceOutputKey: String(row.source_output_key ?? 'default'),
    labelHtml: String(row.label_html ?? ''),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export function mapComponentRow(row: Row): NarrativeComponent {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name ?? ''),
    folderPath: String(row.folder_path ?? ''),
    coverAssetId: strOrNull(row.cover_asset_id),
    customId: strOrNull(row.custom_id),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapElementComponentRow(row: Row): NarrativeElementComponent {
  return {
    elementId: String(row.element_id),
    componentId: String(row.component_id),
    sortOrder: num(row.sort_order),
  };
}

export function mapAttributeRow(row: Row): NarrativeAttribute {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ownerKind: String(row.owner_kind) as NarrativeAttributeOwnerKind,
    ownerId: String(row.owner_id),
    name: String(row.name ?? ''),
    type: String(row.type ?? 'string') as NarrativeAttributeType,
    value: jsonValue(row.value),
    customId: strOrNull(row.custom_id),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export function mapVariableRow(row: Row): NarrativeVariable {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name ?? ''),
    type: String(row.type ?? 'bool') as NarrativeVariableType,
    defaultValue: jsonValue(row.default_value),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export function mapAssetRow(row: Row): NarrativeAsset {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    kind: String(row.kind ?? 'image') as NarrativeAssetKind,
    name: String(row.name ?? ''),
    storageKey: strOrNull(row.storage_key),
    externalUrl: strOrNull(row.external_url),
    mime: strOrNull(row.mime),
    sizeBytes: numOrNull(row.size_bytes),
    folderPath: String(row.folder_path ?? ''),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Hele grafen
// ═══════════════════════════════════════════════════════════════════════

export async function getGraph(db: Queryable, projectId: string): Promise<NarrativeGraph> {
  const [settings, boards, elements, connections, components, elementComponents, attributes, variables, assets] =
    await Promise.all([
      db.query(`SELECT * FROM narrative_settings WHERE project_id = $1 LIMIT 1`, [projectId]),
      db.query(`SELECT * FROM narrative_boards WHERE project_id = $1 ORDER BY folder_path, sort_order, created_at`, [projectId]),
      db.query(`SELECT * FROM narrative_elements WHERE project_id = $1 ORDER BY board_id, sort_order, created_at`, [projectId]),
      db.query(`SELECT * FROM narrative_connections WHERE project_id = $1 ORDER BY board_id, sort_order, created_at`, [projectId]),
      db.query(`SELECT * FROM narrative_components WHERE project_id = $1 ORDER BY folder_path, sort_order, created_at`, [projectId]),
      db.query(
        `SELECT ec.* FROM narrative_element_components ec
           JOIN narrative_elements e ON e.id = ec.element_id
          WHERE e.project_id = $1 ORDER BY ec.element_id, ec.sort_order`,
        [projectId],
      ),
      db.query(`SELECT * FROM narrative_attributes WHERE project_id = $1 ORDER BY owner_kind, owner_id, sort_order`, [projectId]),
      db.query(`SELECT * FROM narrative_variables WHERE project_id = $1 ORDER BY sort_order, name`, [projectId]),
      db.query(`SELECT * FROM narrative_assets WHERE project_id = $1 ORDER BY folder_path, name`, [projectId]),
    ]);
  return {
    settings: mapSettingsRow(projectId, settings.rows[0] as Row | undefined),
    boards: (boards.rows as Row[]).map(mapBoardRow),
    elements: (elements.rows as Row[]).map(mapElementRow),
    connections: (connections.rows as Row[]).map(mapConnectionRow),
    components: (components.rows as Row[]).map(mapComponentRow),
    elementComponents: (elementComponents.rows as Row[]).map(mapElementComponentRow),
    attributes: (attributes.rows as Row[]).map(mapAttributeRow),
    variables: (variables.rows as Row[]).map(mapVariableRow),
    assets: (assets.rows as Row[]).map(mapAssetRow),
  };
}

export interface SettingsPatch {
  title?: string | null;
  startingElementId?: string | null;
  coverAssetId?: string | null;
}

export async function upsertSettings(
  db: Queryable, projectId: string, userId: string, patch: SettingsPatch,
): Promise<NarrativeSettings> {
  const { rows } = await db.query(
    `INSERT INTO narrative_settings (project_id, title, starting_element_id, cover_asset_id, updated_by)
       VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (project_id) DO UPDATE SET
       title = COALESCE($2, narrative_settings.title),
       starting_element_id = CASE WHEN $6::boolean THEN $3 ELSE narrative_settings.starting_element_id END,
       cover_asset_id = CASE WHEN $7::boolean THEN $4 ELSE narrative_settings.cover_asset_id END,
       updated_by = $5,
       updated_at = now()
     RETURNING *`,
    [
      projectId,
      patch.title ?? null,
      patch.startingElementId ?? null,
      patch.coverAssetId ?? null,
      userId,
      patch.startingElementId !== undefined,
      patch.coverAssetId !== undefined,
    ],
  );
  return mapSettingsRow(projectId, rows[0] as Row | undefined);
}

// ═══════════════════════════════════════════════════════════════════════
//  Brett
// ═══════════════════════════════════════════════════════════════════════

export interface BoardInput {
  name: string;
  customId?: string | null;
  folderPath?: string;
  sortOrder?: number;
  viewport?: Record<string, unknown>;
}
export type BoardPatch = Partial<BoardInput>;

export async function createBoard(db: Queryable, projectId: string, userId: string, input: BoardInput): Promise<NarrativeBoard> {
  const { rows } = await db.query(
    `INSERT INTO narrative_boards (id, project_id, name, custom_id, folder_path, sort_order, viewport, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING *`,
    [
      generateId('nbd'), projectId, input.name, input.customId ?? null, input.folderPath ?? '',
      input.sortOrder ?? 0, JSON.stringify(input.viewport ?? {}), userId,
    ],
  );
  return mapBoardRow(rows[0] as Row);
}

export async function patchBoard(db: Queryable, projectId: string, id: string, patch: BoardPatch): Promise<NarrativeBoard | null> {
  const { rows } = await db.query(
    `UPDATE narrative_boards SET
       name = COALESCE($3, name),
       custom_id = CASE WHEN $4::boolean THEN $5 ELSE custom_id END,
       folder_path = COALESCE($6, folder_path),
       sort_order = COALESCE($7, sort_order),
       viewport = COALESCE($8::jsonb, viewport),
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [
      id, projectId, patch.name ?? null, patch.customId !== undefined, patch.customId ?? null,
      patch.folderPath ?? null, patch.sortOrder ?? null, patch.viewport ? JSON.stringify(patch.viewport) : null,
    ],
  );
  return rows[0] ? mapBoardRow(rows[0] as Row) : null;
}

export async function deleteBoard(db: Queryable, projectId: string, id: string): Promise<boolean> {
  await db.query(`DELETE FROM narrative_attributes WHERE project_id = $1 AND owner_kind = 'board' AND owner_id = $2`, [projectId, id]);
  await db.query(
    `DELETE FROM narrative_attributes WHERE project_id = $1 AND owner_kind = 'element'
        AND owner_id IN (SELECT id FROM narrative_elements WHERE project_id = $1 AND board_id = $2)`,
    [projectId, id],
  );
  const r = await db.query(`DELETE FROM narrative_boards WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Elementer
// ═══════════════════════════════════════════════════════════════════════

export interface ElementInput {
  boardId: string;
  kind?: NarrativeElementKind;
  titleHtml?: string;
  contentHtml?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  theme?: string;
  coverAssetId?: string | null;
  customId?: string | null;
  jumperTargetId?: string | null;
  branchConditions?: NarrativeBranchCondition[];
  sortOrder?: number;
}
export type ElementPatch = Partial<Omit<ElementInput, 'boardId'>> & { boardId?: string };

export async function createElement(db: Queryable, projectId: string, userId: string, input: ElementInput): Promise<NarrativeElement> {
  const { rows } = await db.query(
    `INSERT INTO narrative_elements
       (id, project_id, board_id, kind, title_html, content_html, x, y, width, height, theme,
        cover_asset_id, custom_id, jumper_target_id, branch_conditions, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
     RETURNING *`,
    [
      generateId('nel'), projectId, input.boardId, input.kind ?? 'element',
      input.titleHtml ?? '', input.contentHtml ?? '',
      input.x ?? 0, input.y ?? 0, input.width ?? 260, input.height ?? 120, input.theme ?? 'default',
      input.coverAssetId ?? null, input.customId ?? null, input.jumperTargetId ?? null,
      JSON.stringify(normalizeBranchConditions(input.branchConditions ?? [])), input.sortOrder ?? 0, userId,
    ],
  );
  return mapElementRow(rows[0] as Row);
}

export type ElementPatchResult =
  | { ok: true; element: NarrativeElement }
  | { ok: false; conflict: NarrativeElement }
  | null;

/**
 * Oppdater et element. `expectedVersion` (fra If-Match) gir optimistisk
 * låsing: avvik → { ok:false, conflict } med gjeldende rad så klienten kan
 * vise «noen andre endret dette» i stedet for å overskrive stille.
 */
export async function patchElement(
  db: Queryable, projectId: string, id: string, patch: ElementPatch, expectedVersion: number | null = null,
): Promise<ElementPatchResult> {
  const { rows } = await db.query(
    `UPDATE narrative_elements SET
       board_id = COALESCE($4, board_id),
       kind = COALESCE($5, kind),
       title_html = COALESCE($6, title_html),
       content_html = COALESCE($7, content_html),
       x = COALESCE($8, x), y = COALESCE($9, y),
       width = COALESCE($10, width), height = COALESCE($11, height),
       theme = COALESCE($12, theme),
       cover_asset_id = CASE WHEN $13::boolean THEN $14 ELSE cover_asset_id END,
       custom_id = CASE WHEN $15::boolean THEN $16 ELSE custom_id END,
       jumper_target_id = CASE WHEN $17::boolean THEN $18 ELSE jumper_target_id END,
       branch_conditions = COALESCE($19::jsonb, branch_conditions),
       sort_order = COALESCE($20, sort_order),
       version = version + 1,
       updated_at = now()
     WHERE id = $1 AND project_id = $2 AND ($3::int IS NULL OR version = $3::int)
     RETURNING *`,
    [
      id, projectId, expectedVersion,
      patch.boardId ?? null, patch.kind ?? null, patch.titleHtml ?? null, patch.contentHtml ?? null,
      patch.x ?? null, patch.y ?? null, patch.width ?? null, patch.height ?? null, patch.theme ?? null,
      patch.coverAssetId !== undefined, patch.coverAssetId ?? null,
      patch.customId !== undefined, patch.customId ?? null,
      patch.jumperTargetId !== undefined, patch.jumperTargetId ?? null,
      patch.branchConditions ? JSON.stringify(normalizeBranchConditions(patch.branchConditions)) : null,
      patch.sortOrder ?? null,
    ],
  );
  if (rows[0]) return { ok: true, element: mapElementRow(rows[0] as Row) };
  const current = await db.query(`SELECT * FROM narrative_elements WHERE id = $1 AND project_id = $2 LIMIT 1`, [id, projectId]);
  if (!current.rows[0]) return null;
  return { ok: false, conflict: mapElementRow(current.rows[0] as Row) };
}

export interface ElementMove {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** Batch-flytting fra canvas-drag. Ingen If-Match: posisjon er «siste vinner». */
export async function moveElements(db: Queryable, projectId: string, moves: ElementMove[]): Promise<NarrativeElement[]> {
  const out: NarrativeElement[] = [];
  for (const m of moves) {
    const { rows } = await db.query(
      `UPDATE narrative_elements SET x = $3, y = $4,
         width = COALESCE($5, width), height = COALESCE($6, height),
         version = version + 1, updated_at = now()
       WHERE id = $1 AND project_id = $2 RETURNING *`,
      [m.id, projectId, m.x, m.y, m.width ?? null, m.height ?? null],
    );
    if (rows[0]) out.push(mapElementRow(rows[0] as Row));
  }
  return out;
}

export async function deleteElement(db: Queryable, projectId: string, id: string): Promise<boolean> {
  await db.query(`DELETE FROM narrative_attributes WHERE project_id = $1 AND owner_kind = 'element' AND owner_id = $2`, [projectId, id]);
  await db.query(`UPDATE narrative_elements SET jumper_target_id = NULL WHERE project_id = $1 AND jumper_target_id = $2`, [projectId, id]);
  await db.query(`UPDATE narrative_settings SET starting_element_id = NULL WHERE project_id = $1 AND starting_element_id = $2`, [projectId, id]);
  const r = await db.query(`DELETE FROM narrative_elements WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Koblinger
// ═══════════════════════════════════════════════════════════════════════

export interface ConnectionInput {
  boardId: string;
  sourceId: string;
  targetId: string;
  sourceOutputKey?: string;
  labelHtml?: string;
  sortOrder?: number;
}
export type ConnectionPatch = Partial<Pick<ConnectionInput, 'labelHtml' | 'sortOrder' | 'sourceOutputKey' | 'targetId'>>;

export async function createConnection(db: Queryable, projectId: string, userId: string, input: ConnectionInput): Promise<NarrativeConnection | null> {
  // Kilde og mål må finnes i samme prosjekt (FK sikrer eksistens, ikke prosjekt).
  const check = await db.query(
    `SELECT id FROM narrative_elements WHERE project_id = $1 AND id = ANY($2::text[])`,
    [projectId, [input.sourceId, input.targetId]],
  );
  const found = new Set((check.rows as Row[]).map((r) => String(r.id)));
  if (!found.has(input.sourceId) || !found.has(input.targetId)) return null;
  const { rows } = await db.query(
    `INSERT INTO narrative_connections
       (id, project_id, board_id, source_id, target_id, source_output_key, label_html, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      generateId('ncn'), projectId, input.boardId, input.sourceId, input.targetId,
      input.sourceOutputKey ?? 'default', input.labelHtml ?? '', input.sortOrder ?? 0, userId,
    ],
  );
  return mapConnectionRow(rows[0] as Row);
}

export async function patchConnection(db: Queryable, projectId: string, id: string, patch: ConnectionPatch): Promise<NarrativeConnection | null> {
  const { rows } = await db.query(
    `UPDATE narrative_connections SET
       target_id = COALESCE($3, target_id),
       source_output_key = COALESCE($4, source_output_key),
       label_html = COALESCE($5, label_html),
       sort_order = COALESCE($6, sort_order),
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [id, projectId, patch.targetId ?? null, patch.sourceOutputKey ?? null, patch.labelHtml ?? null, patch.sortOrder ?? null],
  );
  return rows[0] ? mapConnectionRow(rows[0] as Row) : null;
}

export async function deleteConnection(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_connections WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Komponenter
// ═══════════════════════════════════════════════════════════════════════

export interface ComponentInput {
  name: string;
  folderPath?: string;
  coverAssetId?: string | null;
  customId?: string | null;
  sortOrder?: number;
}
export type ComponentPatch = Partial<ComponentInput>;

export async function createComponent(db: Queryable, projectId: string, userId: string, input: ComponentInput): Promise<NarrativeComponent> {
  const { rows } = await db.query(
    `INSERT INTO narrative_components (id, project_id, name, folder_path, cover_asset_id, custom_id, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [generateId('ncp'), projectId, input.name, input.folderPath ?? '', input.coverAssetId ?? null, input.customId ?? null, input.sortOrder ?? 0, userId],
  );
  return mapComponentRow(rows[0] as Row);
}

export async function patchComponent(db: Queryable, projectId: string, id: string, patch: ComponentPatch): Promise<NarrativeComponent | null> {
  const { rows } = await db.query(
    `UPDATE narrative_components SET
       name = COALESCE($3, name),
       folder_path = COALESCE($4, folder_path),
       cover_asset_id = CASE WHEN $5::boolean THEN $6 ELSE cover_asset_id END,
       custom_id = CASE WHEN $7::boolean THEN $8 ELSE custom_id END,
       sort_order = COALESCE($9, sort_order),
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [
      id, projectId, patch.name ?? null, patch.folderPath ?? null,
      patch.coverAssetId !== undefined, patch.coverAssetId ?? null,
      patch.customId !== undefined, patch.customId ?? null, patch.sortOrder ?? null,
    ],
  );
  return rows[0] ? mapComponentRow(rows[0] as Row) : null;
}

export async function deleteComponent(db: Queryable, projectId: string, id: string): Promise<boolean> {
  await db.query(`DELETE FROM narrative_attributes WHERE project_id = $1 AND owner_kind = 'component' AND owner_id = $2`, [projectId, id]);
  const r = await db.query(`DELETE FROM narrative_components WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

/** Erstatt listen av komponenter festet på et element (rekkefølge = arrayrekkefølge). */
export async function setElementComponents(
  db: Queryable, projectId: string, elementId: string, componentIds: string[],
): Promise<NarrativeElementComponent[] | null> {
  const el = await db.query(`SELECT id FROM narrative_elements WHERE id = $1 AND project_id = $2 LIMIT 1`, [elementId, projectId]);
  if (!el.rows[0]) return null;
  const valid = await db.query(
    `SELECT id FROM narrative_components WHERE project_id = $1 AND id = ANY($2::text[])`,
    [projectId, componentIds],
  );
  const allowed = new Set((valid.rows as Row[]).map((r) => String(r.id)));
  await db.query(`DELETE FROM narrative_element_components WHERE element_id = $1`, [elementId]);
  const out: NarrativeElementComponent[] = [];
  let order = 0;
  for (const componentId of componentIds) {
    if (!allowed.has(componentId)) continue;
    await db.query(
      `INSERT INTO narrative_element_components (element_id, component_id, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (element_id, component_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [elementId, componentId, order],
    );
    out.push({ elementId, componentId, sortOrder: order });
    order += 1;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
//  Attributter
// ═══════════════════════════════════════════════════════════════════════

export interface AttributeInput {
  ownerKind: NarrativeAttributeOwnerKind;
  ownerId: string;
  name: string;
  type?: NarrativeAttributeType;
  value?: unknown;
  customId?: string | null;
  sortOrder?: number;
}
export type AttributePatch = Partial<Omit<AttributeInput, 'ownerKind' | 'ownerId'>>;

export async function createAttribute(db: Queryable, projectId: string, input: AttributeInput): Promise<NarrativeAttribute> {
  const { rows } = await db.query(
    `INSERT INTO narrative_attributes (id, project_id, owner_kind, owner_id, name, type, value, custom_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) RETURNING *`,
    [
      generateId('nat'), projectId, input.ownerKind, input.ownerId, input.name, input.type ?? 'string',
      JSON.stringify(input.value ?? null), input.customId ?? null, input.sortOrder ?? 0,
    ],
  );
  return mapAttributeRow(rows[0] as Row);
}

export async function patchAttribute(db: Queryable, projectId: string, id: string, patch: AttributePatch): Promise<NarrativeAttribute | null> {
  const { rows } = await db.query(
    `UPDATE narrative_attributes SET
       name = COALESCE($3, name),
       type = COALESCE($4, type),
       value = CASE WHEN $5::boolean THEN $6::jsonb ELSE value END,
       custom_id = CASE WHEN $7::boolean THEN $8 ELSE custom_id END,
       sort_order = COALESCE($9, sort_order),
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [
      id, projectId, patch.name ?? null, patch.type ?? null,
      patch.value !== undefined, JSON.stringify(patch.value ?? null),
      patch.customId !== undefined, patch.customId ?? null, patch.sortOrder ?? null,
    ],
  );
  return rows[0] ? mapAttributeRow(rows[0] as Row) : null;
}

export async function deleteAttribute(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_attributes WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Variabler
// ═══════════════════════════════════════════════════════════════════════

export interface VariableInput {
  name: string;
  type?: NarrativeVariableType;
  defaultValue?: unknown;
  sortOrder?: number;
}
export type VariablePatch = Partial<VariableInput>;

export function defaultValueForVariableType(type: NarrativeVariableType): unknown {
  switch (type) {
    case 'int':
    case 'float':
      return 0;
    case 'string':
      return '';
    case 'bool':
    default:
      return false;
  }
}

export async function createVariable(db: Queryable, projectId: string, input: VariableInput): Promise<NarrativeVariable | null> {
  const type = input.type ?? 'bool';
  const { rows } = await db.query(
    `INSERT INTO narrative_variables (id, project_id, name, type, default_value, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     ON CONFLICT (project_id, name) DO NOTHING
     RETURNING *`,
    [
      generateId('nvr'), projectId, input.name, type,
      JSON.stringify(input.defaultValue ?? defaultValueForVariableType(type)), input.sortOrder ?? 0,
    ],
  );
  return rows[0] ? mapVariableRow(rows[0] as Row) : null;
}

export async function patchVariable(db: Queryable, projectId: string, id: string, patch: VariablePatch): Promise<NarrativeVariable | null> {
  const { rows } = await db.query(
    `UPDATE narrative_variables SET
       name = COALESCE($3, name),
       type = COALESCE($4, type),
       default_value = CASE WHEN $5::boolean THEN $6::jsonb ELSE default_value END,
       sort_order = COALESCE($7, sort_order),
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [
      id, projectId, patch.name ?? null, patch.type ?? null,
      patch.defaultValue !== undefined, JSON.stringify(patch.defaultValue ?? null), patch.sortOrder ?? null,
    ],
  );
  return rows[0] ? mapVariableRow(rows[0] as Row) : null;
}

export async function deleteVariable(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_variables WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Ressurser (Fase 1: ekstern URL / metadata)
// ═══════════════════════════════════════════════════════════════════════

export interface AssetInput {
  kind?: NarrativeAssetKind;
  name: string;
  externalUrl?: string | null;
  mime?: string | null;
  sizeBytes?: number | null;
  folderPath?: string;
}
export type AssetPatch = Partial<AssetInput>;

export async function createAsset(db: Queryable, projectId: string, userId: string, input: AssetInput): Promise<NarrativeAsset> {
  const { rows } = await db.query(
    `INSERT INTO narrative_assets (id, project_id, kind, name, external_url, mime, size_bytes, folder_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      generateId('nas'), projectId, input.kind ?? 'image', input.name, input.externalUrl ?? null,
      input.mime ?? null, input.sizeBytes ?? null, input.folderPath ?? '', userId,
    ],
  );
  return mapAssetRow(rows[0] as Row);
}

export async function patchAsset(db: Queryable, projectId: string, id: string, patch: AssetPatch): Promise<NarrativeAsset | null> {
  const { rows } = await db.query(
    `UPDATE narrative_assets SET
       kind = COALESCE($3, kind),
       name = COALESCE($4, name),
       external_url = CASE WHEN $5::boolean THEN $6 ELSE external_url END,
       mime = COALESCE($7, mime),
       size_bytes = COALESCE($8, size_bytes),
       folder_path = COALESCE($9, folder_path),
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [
      id, projectId, patch.kind ?? null, patch.name ?? null,
      patch.externalUrl !== undefined, patch.externalUrl ?? null,
      patch.mime ?? null, patch.sizeBytes ?? null, patch.folderPath ?? null,
    ],
  );
  return rows[0] ? mapAssetRow(rows[0] as Row) : null;
}

export async function deleteAsset(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_assets WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Revisjoner (prosjekthistorikk)
// ═══════════════════════════════════════════════════════════════════════

function revisionMetaFromRow(row: Row): NarrativeRevisionMeta {
  const snap = jsonObject(row.snapshot);
  const count = (key: string): number => (Array.isArray(snap[key]) ? (snap[key] as unknown[]).length : 0);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    label: strOrNull(row.label),
    createdBy: strOrNull(row.created_by),
    createdAt: isoTs(row.created_at),
    counts: {
      boards: count('boards'),
      elements: count('elements'),
      connections: count('connections'),
      components: count('components'),
    },
  };
}

export async function listRevisions(db: Queryable, projectId: string, limit = 100): Promise<NarrativeRevisionMeta[]> {
  const { rows } = await db.query(
    `SELECT id, project_id, label, created_by, created_at,
            jsonb_build_object(
              'boards', COALESCE(snapshot->'boards', '[]'::jsonb),
              'elements', COALESCE(snapshot->'elements', '[]'::jsonb),
              'connections', COALESCE(snapshot->'connections', '[]'::jsonb),
              'components', COALESCE(snapshot->'components', '[]'::jsonb)
            ) AS snapshot
       FROM narrative_revisions WHERE project_id = $1
      ORDER BY created_at DESC LIMIT $2`,
    [projectId, limit],
  );
  return (rows as Row[]).map(revisionMetaFromRow);
}

export async function createRevision(db: Queryable, projectId: string, userId: string, label: string | null): Promise<NarrativeRevisionMeta> {
  const graph = await getGraph(db, projectId);
  const { rows } = await db.query(
    `INSERT INTO narrative_revisions (id, project_id, label, snapshot, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
    [generateId('nrv'), projectId, label, JSON.stringify(graph), userId],
  );
  return revisionMetaFromRow(rows[0] as Row);
}

export async function getRevision(db: Queryable, projectId: string, id: string): Promise<{ meta: NarrativeRevisionMeta; snapshot: NarrativeGraph } | null> {
  const { rows } = await db.query(`SELECT * FROM narrative_revisions WHERE id = $1 AND project_id = $2 LIMIT 1`, [id, projectId]);
  if (!rows[0]) return null;
  const row = rows[0] as Row;
  return { meta: revisionMetaFromRow(row), snapshot: jsonObject(row.snapshot) as unknown as NarrativeGraph };
}

/**
 * Erstatt hele grafen for et prosjekt med et snapshot (brukes av
 * gjenoppretting og — i Fase 3 — Arcweave-import). Kjøres i én transaksjon
 * når `pool.connect` finnes; ellers sekvensielt (test-fake-pool).
 */
export async function replaceGraph(pool: Pool, projectId: string, userId: string, graph: NarrativeGraph): Promise<void> {
  const connect = (pool as Partial<Pool>).connect;
  const client: Queryable & { release?: () => void } = typeof connect === 'function' ? await pool.connect() : pool;
  const tx = typeof connect === 'function';
  try {
    if (tx) await client.query('BEGIN');
    await client.query(`DELETE FROM narrative_connections WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM narrative_attributes WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM narrative_elements WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM narrative_boards WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM narrative_components WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM narrative_variables WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM narrative_assets WHERE project_id = $1`, [projectId]);

    for (const a of graph.assets ?? []) {
      await client.query(
        `INSERT INTO narrative_assets (id, project_id, kind, name, storage_key, external_url, mime, size_bytes, folder_path, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [a.id, projectId, a.kind, a.name, a.storageKey, a.externalUrl, a.mime, a.sizeBytes, a.folderPath ?? '', userId],
      );
    }
    for (const b of graph.boards ?? []) {
      await client.query(
        `INSERT INTO narrative_boards (id, project_id, name, custom_id, folder_path, sort_order, viewport, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [b.id, projectId, b.name, b.customId, b.folderPath ?? '', b.sortOrder ?? 0, JSON.stringify(b.viewport ?? {}), userId],
      );
    }
    for (const c of graph.components ?? []) {
      await client.query(
        `INSERT INTO narrative_components (id, project_id, name, folder_path, cover_asset_id, custom_id, sort_order, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.id, projectId, c.name, c.folderPath ?? '', c.coverAssetId, c.customId, c.sortOrder ?? 0, userId],
      );
    }
    for (const e of graph.elements ?? []) {
      await client.query(
        `INSERT INTO narrative_elements
           (id, project_id, board_id, kind, title_html, content_html, x, y, width, height, theme,
            cover_asset_id, custom_id, jumper_target_id, branch_conditions, version, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18)`,
        [
          e.id, projectId, e.boardId, e.kind, e.titleHtml ?? '', e.contentHtml ?? '', e.x ?? 0, e.y ?? 0,
          e.width ?? 260, e.height ?? 120, e.theme ?? 'default', e.coverAssetId, e.customId, e.jumperTargetId,
          JSON.stringify(normalizeBranchConditions(e.branchConditions ?? [])), (e.version ?? 0) + 1, e.sortOrder ?? 0, userId,
        ],
      );
    }
    for (const c of graph.connections ?? []) {
      await client.query(
        `INSERT INTO narrative_connections
           (id, project_id, board_id, source_id, target_id, source_output_key, label_html, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [c.id, projectId, c.boardId, c.sourceId, c.targetId, c.sourceOutputKey ?? 'default', c.labelHtml ?? '', c.sortOrder ?? 0, userId],
      );
    }
    for (const ec of graph.elementComponents ?? []) {
      await client.query(
        `INSERT INTO narrative_element_components (element_id, component_id, sort_order) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
        [ec.elementId, ec.componentId, ec.sortOrder ?? 0],
      );
    }
    for (const a of graph.attributes ?? []) {
      await client.query(
        `INSERT INTO narrative_attributes (id, project_id, owner_kind, owner_id, name, type, value, custom_id, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
        [a.id, projectId, a.ownerKind, a.ownerId, a.name, a.type, JSON.stringify(a.value ?? null), a.customId, a.sortOrder ?? 0],
      );
    }
    for (const v of graph.variables ?? []) {
      await client.query(
        `INSERT INTO narrative_variables (id, project_id, name, type, default_value, sort_order)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6) ON CONFLICT (project_id, name) DO NOTHING`,
        [v.id, projectId, v.name, v.type, JSON.stringify(v.defaultValue ?? null), v.sortOrder ?? 0],
      );
    }
    const s = graph.settings;
    await client.query(
      `INSERT INTO narrative_settings (project_id, title, starting_element_id, cover_asset_id, updated_by)
         VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id) DO UPDATE SET
         title = EXCLUDED.title, starting_element_id = EXCLUDED.starting_element_id,
         cover_asset_id = EXCLUDED.cover_asset_id, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [projectId, s?.title ?? null, s?.startingElementId ?? null, s?.coverAssetId ?? null, userId],
    );
    if (tx) await client.query('COMMIT');
  } catch (err) {
    if (tx) await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release?.();
  }
}

/** Gjenopprett en revisjon — ikke-destruktivt: nåværende graf lagres først som ny revisjon. */
export async function restoreRevision(pool: Pool, projectId: string, userId: string, revisionId: string): Promise<NarrativeRevisionMeta | null> {
  const rev = await getRevision(pool, projectId, revisionId);
  if (!rev) return null;
  const backup = await createRevision(pool, projectId, userId, `Før gjenoppretting av ${rev.meta.createdAt.slice(0, 16).replace('T', ' ')}`);
  await replaceGraph(pool, projectId, userId, rev.snapshot);
  return backup;
}

// ═══════════════════════════════════════════════════════════════════════
//  Fase 3 — Arcweave-import, delingslenker, offentlig spill-graf
// ═══════════════════════════════════════════════════════════════════════

/**
 * Importer et Arcweave `project.json`: nåværende graf lagres først som
 * revisjon («Før import»), deretter erstattes hele grafen. Kaster
 * `ArcweaveImportError` (fra format-laget) ved ugyldig dokument.
 */
export type ImportInput =
  | { format: 'arcweave'; project: unknown }
  | { format: 'twee' | 'ink'; source: string; title?: string | null };

export interface ImportOutcome {
  graph: NarrativeGraph;
  warnings: FormatWarning[];
  backup: NarrativeRevisionMeta;
  format: ImportFormat;
  stats?: { elements: number; connections: number; variables: number; unsupported: number };
}

/**
 * Importer fra Arcweave-JSON, Twine (Twee 3) eller Ink. Alle formatene går
 * gjennom det delte format-laget; ugyldige dokumenter kaster format-lagets
 * egne feilklasser (Arcweave/Twee/InkImportError) som ruten svarer 400 på.
 */
export async function importProject(pool: Pool, projectId: string, userId: string, input: ImportInput): Promise<ImportOutcome> {
  const parsed = input.format === 'twee'
    ? fromTwee(input.source, { projectId, title: input.title ?? undefined })
    : input.format === 'ink'
      ? fromInk(input.source, { projectId, title: input.title ?? undefined })
      : fromArcweaveProject(input.project, { projectId });
  const backup = await createRevision(pool, projectId, userId, `Før import ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  await replaceGraph(pool, projectId, userId, parsed.graph as NarrativeGraph);
  return {
    graph: await getGraph(pool, projectId), warnings: parsed.warnings, backup, format: input.format,
    stats: 'stats' in parsed ? parsed.stats : undefined,
  };
}

export async function importArcweaveProject(
  pool: Pool, projectId: string, userId: string, project: unknown,
): Promise<{ graph: NarrativeGraph; warnings: FormatWarning[]; backup: NarrativeRevisionMeta }> {
  return importProject(pool, projectId, userId, { format: 'arcweave', project });
}

export type NarrativeShareMode = 'view_play' | 'play_only';
export const NARRATIVE_SHARE_MODES: readonly NarrativeShareMode[] = ['view_play', 'play_only'];

export interface NarrativeShareLink {
  id: string;
  projectId: string;
  mode: NarrativeShareMode;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdBy: string | null;
  createdAt: string;
}

/** Tokenet lagres kun som sha256-hash (mønster: desktop-auth-routes). */
export function hashShareToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex');
}

function mapShareLinkRow(row: Row): NarrativeShareLink {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    mode: (row.mode === 'view_play' ? 'view_play' : 'play_only'),
    expiresAt: isoTsOrNull(row.expires_at),
    revokedAt: isoTsOrNull(row.revoked_at),
    viewCount: num(row.view_count, 0),
    createdBy: strOrNull(row.created_by),
    createdAt: isoTs(row.created_at),
  };
}

export interface ShareLinkInput {
  mode?: NarrativeShareMode;
  /** null/undefined = utløper aldri. */
  expiresInDays?: number | null;
}

/** Oppretter lenke; råtokenet returneres ÉN gang og lagres aldri. */
export async function createShareLink(
  db: Queryable, projectId: string, userId: string, input: ShareLinkInput = {},
): Promise<{ link: NarrativeShareLink; token: string }> {
  const token = `sgs_${randomBytes(24).toString('hex')}`;
  const days = typeof input.expiresInDays === 'number' && input.expiresInDays > 0 ? Math.min(input.expiresInDays, 3650) : null;
  const expiresAt = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const { rows } = await db.query(
    `INSERT INTO narrative_share_links (id, project_id, token_hash, mode, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [generateId('nsl'), projectId, hashShareToken(token), input.mode ?? 'play_only', expiresAt, userId],
  );
  return { link: mapShareLinkRow(rows[0] as Row), token };
}

export async function listShareLinks(db: Queryable, projectId: string): Promise<NarrativeShareLink[]> {
  const { rows } = await db.query(
    `SELECT * FROM narrative_share_links WHERE project_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [projectId],
  );
  return (rows as Row[]).map(mapShareLinkRow);
}

export async function revokeShareLink(db: Queryable, projectId: string, id: string): Promise<NarrativeShareLink | null> {
  const { rows } = await db.query(
    `UPDATE narrative_share_links SET revoked_at = COALESCE(revoked_at, now())
       WHERE id = $1 AND project_id = $2 RETURNING *`,
    [id, projectId],
  );
  return rows[0] ? mapShareLinkRow(rows[0] as Row) : null;
}

/** Ett-spørrings-verifisering: ikke tilbakekalt og ikke utløpt. */
export async function resolveShareToken(db: Queryable, rawToken: string): Promise<NarrativeShareLink | null> {
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token || token.length > 200) return null;
  const { rows } = await db.query(
    `SELECT * FROM narrative_share_links
       WHERE token_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
       LIMIT 1`,
    [hashShareToken(token)],
  );
  return rows[0] ? mapShareLinkRow(rows[0] as Row) : null;
}

/** Fire-and-forget visningsteller. */
export function bumpShareViewCount(db: Queryable, linkId: string): void {
  Promise.resolve(db.query(`UPDATE narrative_share_links SET view_count = view_count + 1 WHERE id = $1`, [linkId]))
    .catch(() => undefined);
}

const PUBLIC_ATTRIBUTE_TYPES: ReadonlySet<string> = new Set(['bool', 'int', 'float', 'string']);

/**
 * Grafen slik en offentlig spill-lenke ser den: uten notater, uten
 * element-attributter/riktekst-attributter (designer-notater), uten
 * lagringsnøkler og uten prosjekt-id. Delsettet er det samme som
 * standalone-eksporten bruker (`toRuntimeSubset`), her i full NarrativeGraph-form
 * så frontendens spiller kan gjenbrukes uendret.
 */
export function toPublicGraph(graph: NarrativeGraph): NarrativeGraph {
  const runtime = toRuntimeSubset(graph);
  const keepElement = new Set(runtime.elements.map((e) => e.id));
  return {
    settings: { ...graph.settings, projectId: '' },
    boards: graph.boards.map((b) => ({ ...b, projectId: '', viewport: {} })),
    elements: graph.elements.filter((e) => keepElement.has(e.id)).map((e) => ({ ...e, projectId: '' })),
    connections: graph.connections.map((c) => ({ ...c, projectId: '' })),
    components: graph.components.map((c) => ({ ...c, projectId: '' })),
    elementComponents: graph.elementComponents,
    attributes: graph.attributes
      .filter((a) => a.ownerKind !== 'element' && PUBLIC_ATTRIBUTE_TYPES.has(a.type))
      .map((a) => ({ ...a, projectId: '' })),
    variables: graph.variables.map((v) => ({ ...v, projectId: '' })),
    assets: graph.assets.map((a) => ({ ...a, projectId: '', storageKey: null })),
  };
}

export interface PublicStory {
  title: string;
  mode: NarrativeShareMode;
  graph: NarrativeGraph;
}

export async function getPublicStory(db: Queryable, rawToken: string): Promise<PublicStory | null> {
  const link = await resolveShareToken(db, rawToken);
  if (!link) return null;
  const graph = await getGraph(db, link.projectId);
  bumpShareViewCount(db, link.id);
  return { title: graph.settings.title?.trim() || 'Story Graph', mode: link.mode, graph: toPublicGraph(graph) };
}
