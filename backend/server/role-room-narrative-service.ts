/**
 * Story Graph — narrativ graf for spillstudio-vertikalen (game_studio).
 *
 * Ren SQL-service over tabellene i 0618_role_room_narrative_graph.sql.
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
export type NarrativeAssetKind = 'image' | 'audio' | 'video' | 'file';

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
  /** Aktiverte locale-koder; første er kildespråket (nb). */
  locales: string[];
  i18n: Record<string, { title?: string }>;
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
  /** Per-locale overrides (kun prose; skript flettes fra kilden ved oppslag). */
  i18n: Record<string, { titleHtml?: string; contentHtml?: string }>;
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
  i18n: Record<string, { labelHtml?: string }>;
}

export type NarrativeComponentKind = 'character' | 'location' | 'item' | 'faction' | 'other';
export const NARRATIVE_COMPONENT_KINDS: readonly NarrativeComponentKind[] = ['character', 'location', 'item', 'faction', 'other'];

export interface NarrativeComponent {
  id: string;
  projectId: string;
  name: string;
  folderPath: string;
  coverAssetId: string | null;
  customId: string | null;
  sortOrder: number;
  /** Fase 7: karakter / lokasjon / gjenstand / fraksjon / annet. */
  kind: NarrativeComponentKind;
  /** Fase 7: typet profil per kind (drivkraft, forfatterfasit, minnespor, epoker …). */
  profile: Record<string, unknown>;
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

export type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
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
    return { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null, locales: ['nb'], i18n: {} };
  }
  const locales = jsonValue(row.locales);
  return {
    projectId,
    title: strOrNull(row.title),
    startingElementId: strOrNull(row.starting_element_id),
    coverAssetId: strOrNull(row.cover_asset_id),
    schemaVersion: num(row.schema_version, 1),
    updatedAt: isoTsOrNull(row.updated_at),
    locales: Array.isArray(locales) && locales.length ? locales.filter((l): l is string => typeof l === 'string') : ['nb'],
    i18n: jsonObject(row.i18n) as NarrativeSettings['i18n'],
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
    i18n: jsonObject(row.i18n) as NarrativeElement['i18n'],
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
    i18n: jsonObject(row.i18n) as NarrativeConnection['i18n'],
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
    kind: (NARRATIVE_COMPONENT_KINDS as readonly string[]).includes(String(row.kind)) ? String(row.kind) as NarrativeComponentKind : 'other',
    profile: jsonObject(row.profile),
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
  /** Aktiverte locale-koder (første = kilde). */
  locales?: string[];
}

export async function upsertSettings(
  db: Queryable, projectId: string, userId: string, patch: SettingsPatch,
): Promise<NarrativeSettings> {
  const { rows } = await db.query(
    `INSERT INTO narrative_settings (project_id, title, starting_element_id, cover_asset_id, updated_by, locales)
       VALUES ($1, $2, $3, $4, $5, COALESCE($8::jsonb, '["nb"]'::jsonb))
     ON CONFLICT (project_id) DO UPDATE SET
       title = COALESCE($2, narrative_settings.title),
       starting_element_id = CASE WHEN $6::boolean THEN $3 ELSE narrative_settings.starting_element_id END,
       cover_asset_id = CASE WHEN $7::boolean THEN $4 ELSE narrative_settings.cover_asset_id END,
       locales = COALESCE($8::jsonb, narrative_settings.locales),
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
      patch.locales ? JSON.stringify(normalizeLocales(patch.locales)) : null,
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
  await db.query(`DELETE FROM narrative_scene_links WHERE project_id = $1 AND owner_kind = 'board' AND owner_id = $2`, [projectId, id]);
  await db.query(
    `DELETE FROM narrative_scene_links WHERE project_id = $1 AND owner_kind = 'element'
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
  i18n?: NarrativeElement['i18n'];
}
export type ElementPatch = Partial<Omit<ElementInput, 'boardId'>> & { boardId?: string };

export async function createElement(db: Queryable, projectId: string, userId: string, input: ElementInput): Promise<NarrativeElement> {
  const { rows } = await db.query(
    `INSERT INTO narrative_elements
       (id, project_id, board_id, kind, title_html, content_html, x, y, width, height, theme,
        cover_asset_id, custom_id, jumper_target_id, branch_conditions, sort_order, created_by, i18n)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18::jsonb)
     RETURNING *`,
    [
      generateId('nel'), projectId, input.boardId, input.kind ?? 'element',
      input.titleHtml ?? '', input.contentHtml ?? '',
      input.x ?? 0, input.y ?? 0, input.width ?? 260, input.height ?? 120, input.theme ?? 'default',
      input.coverAssetId ?? null, input.customId ?? null, input.jumperTargetId ?? null,
      JSON.stringify(normalizeBranchConditions(input.branchConditions ?? [])), input.sortOrder ?? 0, userId,
      JSON.stringify(input.i18n ?? {}),
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
       i18n = COALESCE($21::jsonb, i18n),
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
      patch.i18n ? JSON.stringify(patch.i18n) : null,
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
  await db.query(`DELETE FROM narrative_scene_links WHERE project_id = $1 AND owner_kind = 'element' AND owner_id = $2`, [projectId, id]);
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
  kind?: NarrativeComponentKind;
  profile?: Record<string, unknown>;
}
export type ComponentPatch = Partial<ComponentInput>;

export async function createComponent(db: Queryable, projectId: string, userId: string, input: ComponentInput): Promise<NarrativeComponent> {
  const { rows } = await db.query(
    `INSERT INTO narrative_components (id, project_id, name, folder_path, cover_asset_id, custom_id, sort_order, created_by, kind, profile)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) RETURNING *`,
    [generateId('ncp'), projectId, input.name, input.folderPath ?? '', input.coverAssetId ?? null, input.customId ?? null, input.sortOrder ?? 0, userId, input.kind ?? 'other', JSON.stringify(input.profile ?? {})],
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
       kind = COALESCE($10, kind),
       profile = CASE WHEN $11::boolean THEN $12::jsonb ELSE profile END,
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [
      id, projectId, patch.name ?? null, patch.folderPath ?? null,
      patch.coverAssetId !== undefined, patch.coverAssetId ?? null,
      patch.customId !== undefined, patch.customId ?? null, patch.sortOrder ?? null,
      patch.kind ?? null, patch.profile !== undefined, JSON.stringify(patch.profile ?? {}),
    ],
  );
  return rows[0] ? mapComponentRow(rows[0] as Row) : null;
}

export async function deleteComponent(db: Queryable, projectId: string, id: string): Promise<boolean> {
  await db.query(`DELETE FROM narrative_attributes WHERE project_id = $1 AND owner_kind = 'component' AND owner_id = $2`, [projectId, id]);
  await db.query(`DELETE FROM narrative_scene_links WHERE project_id = $1 AND owner_kind = 'component' AND owner_id = $2`, [projectId, id]);
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
  // Fase 6: myke referanser fra scener/rammer nulles; rammer uten kilde slettes (XOR-CHECK).
  await db.query(`UPDATE narrative_scenes SET hero_asset_id = NULL WHERE project_id = $1 AND hero_asset_id = $2`, [projectId, id]);
  await db.query(`DELETE FROM narrative_scene_frames WHERE project_id = $1 AND asset_id = $2`, [projectId, id]);
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
  await pruneRevisions(db, projectId).catch((err) => console.warn('[narrative] pruneRevisions', err));
  return revisionMetaFromRow(rows[0] as Row);
}

/**
 * Fase 8g: revisjons-retensjon — behold de 50 nyeste, og deretter én per dag (den nyeste den dagen)
 * i 90 dager. Eldre enn 90 dager slettes uansett (utover de 50 nyeste). Kjøres etter hver ny revisjon.
 */
export async function pruneRevisions(db: Queryable, projectId: string, opts: { keepLatest?: number; keepDays?: number } = {}): Promise<number> {
  const keepLatest = opts.keepLatest ?? 50;
  const keepDays = opts.keepDays ?? 90;
  const { rowCount } = await db.query(
    `DELETE FROM narrative_revisions r
      WHERE r.project_id = $1
        AND r.id NOT IN (SELECT id FROM narrative_revisions WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2)
        AND r.id NOT IN (
          SELECT DISTINCT ON (date_trunc('day', created_at)) id FROM narrative_revisions
           WHERE project_id = $1 AND created_at > now() - ($3::int * interval '1 day')
           ORDER BY date_trunc('day', created_at), created_at DESC
        )`,
    [projectId, keepLatest, keepDays],
  );
  return rowCount ?? 0;
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
        `INSERT INTO narrative_components (id, project_id, name, folder_path, cover_asset_id, custom_id, sort_order, created_by, kind, profile)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [c.id, projectId, c.name, c.folderPath ?? '', c.coverAssetId, c.customId, c.sortOrder ?? 0, userId, c.kind ?? 'other', JSON.stringify(c.profile ?? {})],
      );
    }
    for (const e of graph.elements ?? []) {
      await client.query(
        `INSERT INTO narrative_elements
           (id, project_id, board_id, kind, title_html, content_html, x, y, width, height, theme,
            cover_asset_id, custom_id, jumper_target_id, branch_conditions, version, sort_order, created_by, i18n)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19::jsonb)`,
        [
          e.id, projectId, e.boardId, e.kind, e.titleHtml ?? '', e.contentHtml ?? '', e.x ?? 0, e.y ?? 0,
          e.width ?? 260, e.height ?? 120, e.theme ?? 'default', e.coverAssetId, e.customId, e.jumperTargetId,
          JSON.stringify(normalizeBranchConditions(e.branchConditions ?? [])), (e.version ?? 0) + 1, e.sortOrder ?? 0, userId,
          JSON.stringify(e.i18n ?? {}),
        ],
      );
    }
    for (const c of graph.connections ?? []) {
      await client.query(
        `INSERT INTO narrative_connections
           (id, project_id, board_id, source_id, target_id, source_output_key, label_html, sort_order, created_by, i18n)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [c.id, projectId, c.boardId, c.sourceId, c.targetId, c.sourceOutputKey ?? 'default', c.labelHtml ?? '', c.sortOrder ?? 0, userId, JSON.stringify(c.i18n ?? {})],
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
      `INSERT INTO narrative_settings (project_id, title, starting_element_id, cover_asset_id, updated_by, locales, i18n)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       ON CONFLICT (project_id) DO UPDATE SET
         title = EXCLUDED.title, starting_element_id = EXCLUDED.starting_element_id,
         cover_asset_id = EXCLUDED.cover_asset_id, updated_by = EXCLUDED.updated_by,
         locales = EXCLUDED.locales, i18n = EXCLUDED.i18n, updated_at = now()`,
      [projectId, s?.title ?? null, s?.startingElementId ?? null, s?.coverAssetId ?? null, userId,
        JSON.stringify(normalizeLocales(s?.locales ?? ['nb'])), JSON.stringify(s?.i18n ?? {})],
    );
    // Fase 7: scene-lenker som peker på elementer/brett/komponenter som ikke
    // lenger finnes (import genererer nye ider) ryddes så kortene ikke viser «(slettet)».
    await client.query(
      `DELETE FROM narrative_scene_links l WHERE l.project_id = $1 AND (
         (l.owner_kind = 'element' AND NOT EXISTS (SELECT 1 FROM narrative_elements e WHERE e.id = l.owner_id AND e.project_id = $1))
         OR (l.owner_kind = 'board' AND NOT EXISTS (SELECT 1 FROM narrative_boards b WHERE b.id = l.owner_id AND b.project_id = $1))
         OR (l.owner_kind = 'component' AND NOT EXISTS (SELECT 1 FROM narrative_components c WHERE c.id = l.owner_id AND c.project_id = $1)))`,
      [projectId],
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
  // Eksplisitt innsnevring: prosjektets tsconfig snevrer ikke inn den
  // diskriminerte unionen i et betinget uttrykk her.
  let parsed: ReturnType<typeof fromTwee> | ReturnType<typeof fromInk> | ReturnType<typeof fromArcweaveProject>;
  if (input.format === 'twee' || input.format === 'ink') {
    const text = input as Extract<ImportInput, { source: string }>;
    parsed = input.format === 'twee'
      ? fromTwee(text.source, { projectId, title: text.title ?? undefined })
      : fromInk(text.source, { projectId, title: text.title ?? undefined });
  } else {
    parsed = fromArcweaveProject((input as Extract<ImportInput, { format: 'arcweave' }>).project, { projectId });
  }
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

/** Kildespråket først, unike, gyldige koder. */
export function normalizeLocales(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.filter((l): l is string => typeof l === 'string') : [];
  const out: string[] = ['nb'];
  for (const l of raw) {
    const code = l.trim();
    if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code) || out.includes(code)) continue;
    out.push(code);
  }
  return out.slice(0, 20);
}

export interface TranslationEntry {
  ownerKind: 'element' | 'connection' | 'settings';
  id: string;
  field: 'titleHtml' | 'contentHtml' | 'labelHtml' | 'title';
  /** Full HTML (med kildens kodeblokk-struktur) eller ren tittel-tekst. */
  html: string;
}

/**
 * Lagre oversettelser for ett språk: merger felt inn i `i18n[locale]` på hver
 * rad (jsonb-merge, aldri overskriv andre felt/språk). Bumper ikke `version`
 * — oversettelser konkurrerer ikke med redigering av kilden.
 */
export async function saveTranslations(db: Queryable, projectId: string, locale: string, entries: TranslationEntry[]): Promise<{ saved: number }> {
  let saved = 0;
  for (const entry of entries) {
    if (entry.ownerKind === 'element' && (entry.field === 'titleHtml' || entry.field === 'contentHtml')) {
      const r = await db.query(
        `UPDATE narrative_elements
           SET i18n = jsonb_set(COALESCE(i18n, '{}'::jsonb), ARRAY[$3::text], COALESCE(i18n -> $3, '{}'::jsonb) || $4::jsonb, true),
               updated_at = now()
         WHERE id = $1 AND project_id = $2`,
        [entry.id, projectId, locale, JSON.stringify({ [entry.field]: entry.html })],
      );
      saved += r.rowCount ?? 0;
    } else if (entry.ownerKind === 'connection' && entry.field === 'labelHtml') {
      const r = await db.query(
        `UPDATE narrative_connections
           SET i18n = jsonb_set(COALESCE(i18n, '{}'::jsonb), ARRAY[$3::text], COALESCE(i18n -> $3, '{}'::jsonb) || $4::jsonb, true),
               updated_at = now()
         WHERE id = $1 AND project_id = $2`,
        [entry.id, projectId, locale, JSON.stringify({ labelHtml: entry.html })],
      );
      saved += r.rowCount ?? 0;
    } else if (entry.ownerKind === 'settings' && entry.field === 'title') {
      const r = await db.query(
        `UPDATE narrative_settings
           SET i18n = jsonb_set(COALESCE(i18n, '{}'::jsonb), ARRAY[$2::text], COALESCE(i18n -> $2, '{}'::jsonb) || $3::jsonb, true),
               updated_at = now()
         WHERE project_id = $1`,
        [projectId, locale, JSON.stringify({ title: entry.html })],
      );
      saved += r.rowCount ?? 0;
    }
  }
  return { saved };
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

// ═══════════════════════════════════════════════════════════════════════
//  Fase 6: Scener & gameplay + Review & Godkjenning
//  (tabeller i 0623_narrative_scenes_and_reviews.sql)
// ═══════════════════════════════════════════════════════════════════════

export type NarrativeSceneStatus = 'idea' | 'in_progress' | 'in_review' | 'changes_requested' | 'approved' | 'implemented';
export type NarrativeSceneTaskStatus = 'todo' | 'doing' | 'done';
export type NarrativeSceneReviewStatus = 'in_review' | 'changes_requested' | 'approved' | 'superseded';
export type NarrativeSceneLinkKind = 'element' | 'board' | 'component';

export const NARRATIVE_SCENE_STATUSES: readonly NarrativeSceneStatus[] =
  ['idea', 'in_progress', 'in_review', 'changes_requested', 'approved', 'implemented'];
export const NARRATIVE_SCENE_TASK_STATUSES: readonly NarrativeSceneTaskStatus[] = ['todo', 'doing', 'done'];
/** Scenekode: 1–3 bokstaver + 1–4 sifre (speiler CHECK-en i 0623). */
export const NARRATIVE_SCENE_CODE_RE = /^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?$/;
export type NarrativeSceneEra = 'pre' | '1797' | '1802' | '1817' | 'other';
export const NARRATIVE_SCENE_ERAS: readonly NarrativeSceneEra[] = ['pre', '1797', '1802', '1817', 'other'];
export type NarrativeSourceTag = 'W' | 'K' | 'U' | 'A' | 'E' | 'T';
export const NARRATIVE_SOURCE_TAGS: readonly NarrativeSourceTag[] = ['W', 'K', 'U', 'A', 'E', 'T'];
export interface NarrativeSourceRef { tag: NarrativeSourceTag; ref: string; field?: string; note?: string }
/** Seks kunnskapsfelt per scene (SCENE-PLAN §E). */
export interface NarrativeSceneKnowledge { actualPast?: string; recollection?: string; ownerPerspective?: string; othersObserve?: string; audienceKnows?: string; saidAloud?: string }

export interface NarrativeScene {
  id: string;
  projectId: string;
  code: string;
  title: string;
  subtitle: string;
  location: string;
  challenge: string;
  gameplayMechanic: string;
  environment: string;
  status: NarrativeSceneStatus;
  assigneeUserId: string | null;
  dueAt: string | null;
  heroAssetId: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Fase 7: scenekort v2
  beforeState: string;
  action: string;
  control: string;
  afterState: string;
  audio: string;
  changeNote: string;
  bridge: string;
  timeNote: string;
  knowledge: NarrativeSceneKnowledge;
  era: NarrativeSceneEra;
  episodeId: string | null;
  startAt: string | null;
  sourceRefs: NarrativeSourceRef[];
  workingId: string | null;
}

export interface NarrativeSceneLink {
  sceneId: string;
  ownerKind: NarrativeSceneLinkKind;
  ownerId: string;
  sortOrder: number;
}

export interface NarrativeSceneFrame {
  id: string;
  sceneId: string;
  projectId: string;
  assetId: string | null;
  externalUrl: string | null;
  caption: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSceneTask {
  id: string;
  sceneId: string;
  projectId: string;
  title: string;
  status: NarrativeSceneTaskStatus;
  assigneeUserId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSceneReview {
  id: string;
  sceneId: string;
  projectId: string;
  round: number;
  status: NarrativeSceneReviewStatus;
  requestedBy: string | null;
  requestedAt: string;
  requestNote: string | null;
  decidedByUserId: string | null;
  decidedByLabel: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  snapshotHash: string;
}

/** Scene i lista: + siste runde og oppgavetelling (én spørring per liste, ikke per scene). */
export interface NarrativeSceneSummary extends NarrativeScene {
  latestReview: Pick<NarrativeSceneReview, 'id' | 'round' | 'status' | 'requestedAt' | 'decidedAt'> | null;
  taskCounts: { total: number; done: number };
}

export interface NarrativeSceneDetail {
  scene: NarrativeScene;
  links: NarrativeSceneLink[];
  frames: NarrativeSceneFrame[];
  tasks: NarrativeSceneTask[];
  reviews: NarrativeSceneReview[];
  /** Fase 7 */
  gates: NarrativeSceneGate[];
  lines: NarrativeSceneLine[];
  /** Hash av scenen slik den er nå — klienten sammenligner med åpen rundes hash. */
  currentSnapshotHash: string;
}

export interface NarrativeMemberLite {
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  isOwner: boolean;
}

export class SceneDuplicateCodeError extends Error {
  readonly code = 'duplicate_code';
  constructor(readonly sceneCode: string) { super(`Scenekoden «${sceneCode}» er allerede i bruk.`); }
}
export class SceneReviewStaleError extends Error {
  readonly code = 'snapshot_stale';
  constructor(readonly currentHash: string, readonly reviewHash: string) {
    super('Scenen er endret siden runden ble sendt — send ny runde.');
  }
}
export class SceneReviewClosedError extends Error {
  readonly code = 'review_closed';
  constructor(readonly status: NarrativeSceneReviewStatus) { super('Runden er allerede avgjort.'); }
}

export function mapSceneRow(row: Row): NarrativeScene {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    code: String(row.code),
    title: String(row.title ?? ''),
    subtitle: String(row.subtitle ?? ''),
    location: String(row.location ?? ''),
    challenge: String(row.challenge ?? ''),
    gameplayMechanic: String(row.gameplay_mechanic ?? ''),
    environment: String(row.environment ?? ''),
    status: String(row.status ?? 'idea') as NarrativeSceneStatus,
    assigneeUserId: strOrNull(row.assignee_user_id),
    dueAt: isoTsOrNull(row.due_at),
    heroAssetId: strOrNull(row.hero_asset_id),
    sortOrder: num(row.sort_order),
    createdBy: strOrNull(row.created_by),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
    beforeState: String(row.before_state ?? ''),
    action: String(row.action ?? ''),
    control: String(row.control ?? ''),
    afterState: String(row.after_state ?? ''),
    audio: String(row.audio ?? ''),
    changeNote: String(row.change_note ?? ''),
    bridge: String(row.bridge ?? ''),
    timeNote: String(row.time_note ?? ''),
    knowledge: jsonObject(row.knowledge) as NarrativeSceneKnowledge,
    era: (NARRATIVE_SCENE_ERAS as readonly string[]).includes(String(row.era)) ? String(row.era) as NarrativeSceneEra : 'other',
    episodeId: strOrNull(row.episode_id),
    startAt: isoTsOrNull(row.start_at),
    sourceRefs: normalizeSourceRefs(row.source_refs),
    workingId: strOrNull(row.working_id),
  };
}

export function normalizeSourceRefs(value: unknown): NarrativeSourceRef[] {
  const raw = typeof value === 'string' ? jsonValue(value) : value;
  if (!Array.isArray(raw)) return [];
  const out: NarrativeSourceRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const tag = String(rec.tag ?? '').toUpperCase();
    const ref = typeof rec.ref === 'string' ? rec.ref.trim() : '';
    if (!(NARRATIVE_SOURCE_TAGS as readonly string[]).includes(tag) || !ref) continue;
    const entry: NarrativeSourceRef = { tag: tag as NarrativeSourceTag, ref };
    if (typeof rec.field === 'string' && rec.field) entry.field = rec.field;
    if (typeof rec.note === 'string' && rec.note) entry.note = rec.note;
    out.push(entry);
  }
  return out;
}

function mapSceneLinkRow(row: Row): NarrativeSceneLink {
  return {
    sceneId: String(row.scene_id),
    ownerKind: String(row.owner_kind) as NarrativeSceneLinkKind,
    ownerId: String(row.owner_id),
    sortOrder: num(row.sort_order),
  };
}

function mapSceneFrameRow(row: Row): NarrativeSceneFrame {
  return {
    id: String(row.id),
    sceneId: String(row.scene_id),
    projectId: String(row.project_id),
    assetId: strOrNull(row.asset_id),
    externalUrl: strOrNull(row.external_url),
    caption: String(row.caption ?? ''),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapSceneTaskRow(row: Row): NarrativeSceneTask {
  return {
    id: String(row.id),
    sceneId: String(row.scene_id),
    projectId: String(row.project_id),
    title: String(row.title ?? ''),
    status: String(row.status ?? 'todo') as NarrativeSceneTaskStatus,
    assigneeUserId: strOrNull(row.assignee_user_id),
    dueAt: isoTsOrNull(row.due_at),
    completedAt: isoTsOrNull(row.completed_at),
    sortOrder: num(row.sort_order),
    createdBy: strOrNull(row.created_by),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapSceneReviewRow(row: Row): NarrativeSceneReview {
  return {
    id: String(row.id),
    sceneId: String(row.scene_id),
    projectId: String(row.project_id),
    round: num(row.round, 1),
    status: String(row.status ?? 'in_review') as NarrativeSceneReviewStatus,
    requestedBy: strOrNull(row.requested_by),
    requestedAt: isoTs(row.requested_at),
    requestNote: strOrNull(row.request_note),
    decidedByUserId: strOrNull(row.decided_by_user_id),
    decidedByLabel: strOrNull(row.decided_by_label),
    decidedAt: isoTsOrNull(row.decided_at),
    decisionNote: strOrNull(row.decision_note),
    snapshotHash: String(row.snapshot_hash ?? ''),
  };
}

/**
 * Neste ledige S-kode gitt eksisterende koder («S1», «S2», «B7» → «S3»).
 * Ren funksjon — speiles i frontendens sceneOps for forhåndsutfylling.
 */
export function nextSceneCode(existingCodes: readonly string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const m = /^S(\d{1,4})$/i.exec(code.trim());
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return `S${Math.min(max + 1, 9999)}`;
}

// ─── Scener ──────────────────────────────────────────────────────────

export async function listScenes(db: Queryable, projectId: string): Promise<NarrativeSceneSummary[]> {
  const [scenes, reviews, tasks] = await Promise.all([
    db.query(`SELECT * FROM narrative_scenes WHERE project_id = $1 ORDER BY sort_order, code, created_at`, [projectId]),
    db.query(
      `SELECT DISTINCT ON (scene_id) id, scene_id, round, status, requested_at, decided_at
         FROM narrative_scene_reviews WHERE project_id = $1
        ORDER BY scene_id, round DESC`,
      [projectId],
    ),
    db.query(
      `SELECT scene_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'done')::int AS done
         FROM narrative_scene_tasks WHERE project_id = $1 GROUP BY scene_id`,
      [projectId],
    ),
  ]);
  const latestBy = new Map<string, NarrativeSceneSummary['latestReview']>();
  for (const r of reviews.rows as Row[]) {
    latestBy.set(String(r.scene_id), {
      id: String(r.id), round: num(r.round, 1), status: String(r.status) as NarrativeSceneReviewStatus,
      requestedAt: isoTs(r.requested_at), decidedAt: isoTsOrNull(r.decided_at),
    });
  }
  const countsBy = new Map<string, { total: number; done: number }>();
  for (const t of tasks.rows as Row[]) countsBy.set(String(t.scene_id), { total: num(t.total), done: num(t.done) });
  return (scenes.rows as Row[]).map((row) => {
    const scene = mapSceneRow(row);
    return { ...scene, latestReview: latestBy.get(scene.id) ?? null, taskCounts: countsBy.get(scene.id) ?? { total: 0, done: 0 } };
  });
}

export async function listSceneCodes(db: Queryable, projectId: string): Promise<string[]> {
  const { rows } = await db.query(`SELECT code FROM narrative_scenes WHERE project_id = $1`, [projectId]);
  return (rows as Row[]).map((r) => String(r.code));
}

export async function getScene(db: Queryable, projectId: string, id: string): Promise<NarrativeScene | null> {
  const { rows } = await db.query(`SELECT * FROM narrative_scenes WHERE id = $1 AND project_id = $2 LIMIT 1`, [id, projectId]);
  return rows[0] ? mapSceneRow(rows[0] as Row) : null;
}

export async function getSceneDetail(db: Queryable, projectId: string, id: string): Promise<NarrativeSceneDetail | null> {
  const scene = await getScene(db, projectId, id);
  if (!scene) return null;
  const [links, frames, tasks, reviews, gates] = await Promise.all([
    db.query(`SELECT * FROM narrative_scene_links WHERE scene_id = $1 AND project_id = $2 ORDER BY sort_order, owner_kind, owner_id`, [id, projectId]),
    db.query(`SELECT * FROM narrative_scene_frames WHERE scene_id = $1 AND project_id = $2 ORDER BY sort_order, created_at`, [id, projectId]),
    db.query(`SELECT * FROM narrative_scene_tasks WHERE scene_id = $1 AND project_id = $2 ORDER BY sort_order, created_at`, [id, projectId]),
    db.query(`SELECT * FROM narrative_scene_reviews WHERE scene_id = $1 AND project_id = $2 ORDER BY round DESC`, [id, projectId]),
    db.query(`SELECT * FROM narrative_scene_gates WHERE scene_id = $1 AND project_id = $2`, [id, projectId]),
  ]);
  const mappedLinks = (links.rows as Row[]).map(mapSceneLinkRow);
  const mappedFrames = (frames.rows as Row[]).map(mapSceneFrameRow);
  const mappedReviews = (reviews.rows as Row[]).map(mapSceneReviewRow);
  // Gjeldende hash bygges med samme versjon som den åpne runden (ellers v2).
  const openRaw = (reviews.rows as Row[]).find((r) => r.status === 'in_review');
  const snapshot = await buildSceneSnapshot(db, projectId, scene, mappedFrames, mappedLinks, { version: openRaw ? snapshotVersionOf(openRaw.snapshot) : 2 });
  return {
    scene,
    links: mappedLinks,
    frames: mappedFrames,
    tasks: (tasks.rows as Row[]).map(mapSceneTaskRow),
    reviews: mappedReviews,
    gates: fillGates(id, projectId, (gates.rows as Row[]).map(mapSceneGateRow)),
    lines: await listSceneLines(db, projectId, id),
    currentSnapshotHash: hashSceneSnapshot(snapshot),
  };
}

export interface SceneInput {
  code?: string | null;
  title?: string;
  subtitle?: string;
  location?: string;
  challenge?: string;
  gameplayMechanic?: string;
  environment?: string;
  status?: NarrativeSceneStatus;
  assigneeUserId?: string | null;
  dueAt?: string | null;
  heroAssetId?: string | null;
  sortOrder?: number;
  // Fase 7
  beforeState?: string;
  action?: string;
  control?: string;
  afterState?: string;
  audio?: string;
  changeNote?: string;
  bridge?: string;
  timeNote?: string;
  knowledge?: NarrativeSceneKnowledge;
  era?: NarrativeSceneEra;
  episodeId?: string | null;
  startAt?: string | null;
  sourceRefs?: NarrativeSourceRef[];
  workingId?: string | null;
}
export type ScenePatch = SceneInput;

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: unknown }).code === '23505';
}

/** Oppretter scene; tom kode → neste ledige «S{n}». Duplikat → SceneDuplicateCodeError. */
export async function createScene(db: Queryable, projectId: string, userId: string, input: SceneInput): Promise<NarrativeScene> {
  const requested = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
  const code = requested || nextSceneCode(await listSceneCodes(db, projectId));
  const sortOrder = input.sortOrder ?? (await listSceneCodes(db, projectId)).length;
  try {
    const { rows } = await db.query(
      `INSERT INTO narrative_scenes
         (id, project_id, code, title, subtitle, location, challenge, gameplay_mechanic, environment,
          status, assignee_user_id, due_at, hero_asset_id, sort_order, created_by,
          before_state, action, control, after_state, audio, change_note, bridge, time_note, knowledge,
          era, episode_id, start_at, source_refs, working_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20, $21, $22, $23, $24::jsonb, $25, $26, $27, $28::jsonb, $29) RETURNING *`,
      [
        generateId('nsc'), projectId, code, input.title ?? '', input.subtitle ?? '', input.location ?? '',
        input.challenge ?? '', input.gameplayMechanic ?? '', input.environment ?? '',
        input.status ?? 'idea', input.assigneeUserId ?? null, input.dueAt ?? null, input.heroAssetId ?? null,
        sortOrder, userId,
        input.beforeState ?? '', input.action ?? '', input.control ?? '', input.afterState ?? '', input.audio ?? '',
        input.changeNote ?? '', input.bridge ?? '', input.timeNote ?? '', JSON.stringify(input.knowledge ?? {}),
        input.era ?? 'other', input.episodeId ?? null, input.startAt ?? null, JSON.stringify(normalizeSourceRefs(input.sourceRefs ?? [])),
        input.workingId ?? null,
      ],
    );
    return mapSceneRow(rows[0] as Row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new SceneDuplicateCodeError(code);
    throw err;
  }
}

export async function patchScene(db: Queryable, projectId: string, id: string, patch: ScenePatch): Promise<NarrativeScene | null> {
  const code = typeof patch.code === 'string' && patch.code.trim() ? patch.code.trim().toUpperCase() : null;
  try {
    const { rows } = await db.query(
      `UPDATE narrative_scenes SET
         code = COALESCE($3, code),
         title = COALESCE($4, title),
         subtitle = COALESCE($5, subtitle),
         location = COALESCE($6, location),
         challenge = COALESCE($7, challenge),
         gameplay_mechanic = COALESCE($8, gameplay_mechanic),
         environment = COALESCE($9, environment),
         status = COALESCE($10, status),
         assignee_user_id = CASE WHEN $11::boolean THEN $12 ELSE assignee_user_id END,
         due_at = CASE WHEN $13::boolean THEN $14::timestamptz ELSE due_at END,
         hero_asset_id = CASE WHEN $15::boolean THEN $16 ELSE hero_asset_id END,
         sort_order = COALESCE($17, sort_order),
         before_state = COALESCE($18, before_state),
         action = COALESCE($19, action),
         control = COALESCE($20, control),
         after_state = COALESCE($21, after_state),
         audio = COALESCE($22, audio),
         change_note = COALESCE($23, change_note),
         bridge = COALESCE($24, bridge),
         time_note = COALESCE($25, time_note),
         knowledge = CASE WHEN $26::boolean THEN $27::jsonb ELSE knowledge END,
         era = COALESCE($28, era),
         episode_id = CASE WHEN $29::boolean THEN $30 ELSE episode_id END,
         start_at = CASE WHEN $31::boolean THEN $32::timestamptz ELSE start_at END,
         source_refs = CASE WHEN $33::boolean THEN $34::jsonb ELSE source_refs END,
         working_id = CASE WHEN $35::boolean THEN $36 ELSE working_id END,
         updated_at = now()
       WHERE id = $1 AND project_id = $2 RETURNING *`,
      [
        id, projectId, code, patch.title ?? null, patch.subtitle ?? null, patch.location ?? null,
        patch.challenge ?? null, patch.gameplayMechanic ?? null, patch.environment ?? null, patch.status ?? null,
        patch.assigneeUserId !== undefined, patch.assigneeUserId ?? null,
        patch.dueAt !== undefined, patch.dueAt ?? null,
        patch.heroAssetId !== undefined, patch.heroAssetId ?? null,
        patch.sortOrder ?? null,
        patch.beforeState ?? null, patch.action ?? null, patch.control ?? null, patch.afterState ?? null, patch.audio ?? null,
        patch.changeNote ?? null, patch.bridge ?? null, patch.timeNote ?? null,
        patch.knowledge !== undefined, JSON.stringify(patch.knowledge ?? {}),
        patch.era ?? null,
        patch.episodeId !== undefined, patch.episodeId ?? null,
        patch.startAt !== undefined, patch.startAt ?? null,
        patch.sourceRefs !== undefined, JSON.stringify(normalizeSourceRefs(patch.sourceRefs ?? [])),
        patch.workingId !== undefined, patch.workingId ?? null,
      ],
    );
    return rows[0] ? mapSceneRow(rows[0] as Row) : null;
  } catch (err) {
    if (isUniqueViolation(err)) throw new SceneDuplicateCodeError(code ?? '');
    throw err;
  }
}

export async function deleteScene(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_scenes WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

export async function reorderScenes(db: Queryable, projectId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db.query(`UPDATE narrative_scenes SET sort_order = $3, updated_at = now() WHERE id = $1 AND project_id = $2`, [orderedIds[i], projectId, i]);
  }
}

// ─── Lenker til Story Graph ──────────────────────────────────────────

export interface SceneLinkInput { ownerKind: NarrativeSceneLinkKind; ownerId: string }

/**
 * Erstatter scenens lenker. Eiere som ikke finnes i prosjektet forkastes
 * stille (forebygger lenker på tvers av prosjekter); returnerer det som ble lagret.
 */
export async function setSceneLinks(db: Queryable, projectId: string, sceneId: string, links: SceneLinkInput[]): Promise<NarrativeSceneLink[] | null> {
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  const elementIds = links.filter((l) => l.ownerKind === 'element').map((l) => l.ownerId);
  const boardIds = links.filter((l) => l.ownerKind === 'board').map((l) => l.ownerId);
  const valid = new Set<string>();
  if (elementIds.length) {
    const { rows } = await db.query(`SELECT id FROM narrative_elements WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, elementIds]);
    for (const r of rows as Row[]) valid.add(`element:${String(r.id)}`);
  }
  if (boardIds.length) {
    const { rows } = await db.query(`SELECT id FROM narrative_boards WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, boardIds]);
    for (const r of rows as Row[]) valid.add(`board:${String(r.id)}`);
  }
  const componentIds = links.filter((l) => l.ownerKind === 'component').map((l) => l.ownerId);
  if (componentIds.length) {
    const { rows } = await db.query(`SELECT id FROM narrative_components WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, componentIds]);
    for (const r of rows as Row[]) valid.add(`component:${String(r.id)}`);
  }
  await db.query(`DELETE FROM narrative_scene_links WHERE scene_id = $1 AND project_id = $2`, [sceneId, projectId]);
  const out: NarrativeSceneLink[] = [];
  const seen = new Set<string>();
  let i = 0;
  for (const l of links) {
    const key = `${l.ownerKind}:${l.ownerId}`;
    if (!valid.has(key) || seen.has(key)) continue;
    seen.add(key);
    await db.query(
      `INSERT INTO narrative_scene_links (scene_id, project_id, owner_kind, owner_id, sort_order) VALUES ($1, $2, $3, $4, $5)`,
      [sceneId, projectId, l.ownerKind, l.ownerId, i],
    );
    out.push({ sceneId, ownerKind: l.ownerKind, ownerId: l.ownerId, sortOrder: i });
    i += 1;
  }
  await db.query(`UPDATE narrative_scenes SET updated_at = now() WHERE id = $1 AND project_id = $2`, [sceneId, projectId]);
  return out;
}

/** Reverse-oppslag for Story Graph-UI: scener som peker på et element. */
export async function listScenesForOwner(db: Queryable, projectId: string, ownerKind: NarrativeSceneLinkKind, ownerId: string): Promise<Array<Pick<NarrativeScene, 'id' | 'code' | 'title' | 'status'>>> {
  const { rows } = await db.query(
    `SELECT s.id, s.code, s.title, s.status FROM narrative_scene_links l
       JOIN narrative_scenes s ON s.id = l.scene_id
      WHERE l.project_id = $1 AND l.owner_kind = $2 AND l.owner_id = $3
      ORDER BY s.sort_order, s.code`,
    [projectId, ownerKind, ownerId],
  );
  return (rows as Row[]).map((r) => ({ id: String(r.id), code: String(r.code), title: String(r.title ?? ''), status: String(r.status) as NarrativeSceneStatus }));
}

// ─── Storyboard-rammer ───────────────────────────────────────────────

export interface SceneFrameInput {
  assetId?: string | null;
  externalUrl?: string | null;
  caption?: string;
  sortOrder?: number;
}

export async function createSceneFrame(db: Queryable, projectId: string, sceneId: string, userId: string, input: SceneFrameInput): Promise<NarrativeSceneFrame | null> {
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  let assetId = input.assetId ?? null;
  const externalUrl = input.externalUrl ?? null;
  if (assetId) {
    // Asset må tilhøre prosjektet — ellers behandles det som «ikke funnet».
    const { rows } = await db.query(`SELECT id FROM narrative_assets WHERE id = $1 AND project_id = $2 LIMIT 1`, [assetId, projectId]);
    if (!rows[0]) assetId = null;
  }
  if (!assetId && !externalUrl) return null;
  const sortOrder = input.sortOrder ?? num((await db.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM narrative_scene_frames WHERE scene_id = $1`, [sceneId],
  )).rows[0]?.next);
  const { rows } = await db.query(
    `INSERT INTO narrative_scene_frames (id, scene_id, project_id, asset_id, external_url, caption, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [generateId('nsf'), sceneId, projectId, assetId, assetId ? null : externalUrl, input.caption ?? '', sortOrder, userId],
  );
  await db.query(`UPDATE narrative_scenes SET updated_at = now() WHERE id = $1 AND project_id = $2`, [sceneId, projectId]);
  return mapSceneFrameRow(rows[0] as Row);
}

export async function patchSceneFrame(db: Queryable, projectId: string, sceneId: string, frameId: string, patch: Pick<SceneFrameInput, 'caption' | 'sortOrder'>): Promise<NarrativeSceneFrame | null> {
  const { rows } = await db.query(
    `UPDATE narrative_scene_frames SET caption = COALESCE($4, caption), sort_order = COALESCE($5, sort_order), updated_at = now()
      WHERE id = $1 AND scene_id = $2 AND project_id = $3 RETURNING *`,
    [frameId, sceneId, projectId, patch.caption ?? null, patch.sortOrder ?? null],
  );
  return rows[0] ? mapSceneFrameRow(rows[0] as Row) : null;
}

export async function deleteSceneFrame(db: Queryable, projectId: string, sceneId: string, frameId: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_scene_frames WHERE id = $1 AND scene_id = $2 AND project_id = $3`, [frameId, sceneId, projectId]);
  return (r.rowCount ?? 0) > 0;
}

export async function reorderSceneFrames(db: Queryable, projectId: string, sceneId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db.query(
      `UPDATE narrative_scene_frames SET sort_order = $4, updated_at = now() WHERE id = $1 AND scene_id = $2 AND project_id = $3`,
      [orderedIds[i], sceneId, projectId, i],
    );
  }
}

// ─── Oppgaver ────────────────────────────────────────────────────────

export interface SceneTaskInput {
  title: string;
  status?: NarrativeSceneTaskStatus;
  assigneeUserId?: string | null;
  dueAt?: string | null;
  sortOrder?: number;
}
export type SceneTaskPatch = Partial<SceneTaskInput>;

export async function createSceneTask(db: Queryable, projectId: string, sceneId: string, userId: string, input: SceneTaskInput): Promise<NarrativeSceneTask | null> {
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  const status = input.status ?? 'todo';
  const { rows } = await db.query(
    `INSERT INTO narrative_scene_tasks (id, scene_id, project_id, title, status, assignee_user_id, due_at, completed_at, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $5 = 'done' THEN now() ELSE NULL END, $8, $9) RETURNING *`,
    [generateId('nst'), sceneId, projectId, input.title, status, input.assigneeUserId ?? null, input.dueAt ?? null, input.sortOrder ?? 0, userId],
  );
  return mapSceneTaskRow(rows[0] as Row);
}

export async function patchSceneTask(db: Queryable, projectId: string, sceneId: string, taskId: string, patch: SceneTaskPatch): Promise<NarrativeSceneTask | null> {
  const { rows } = await db.query(
    `UPDATE narrative_scene_tasks SET
       title = COALESCE($4, title),
       status = COALESCE($5, status),
       completed_at = CASE
         WHEN $5 = 'done' THEN COALESCE(completed_at, now())
         WHEN $5 IS NOT NULL THEN NULL
         ELSE completed_at END,
       assignee_user_id = CASE WHEN $6::boolean THEN $7 ELSE assignee_user_id END,
       due_at = CASE WHEN $8::boolean THEN $9::timestamptz ELSE due_at END,
       sort_order = COALESCE($10, sort_order),
       updated_at = now()
     WHERE id = $1 AND scene_id = $2 AND project_id = $3 RETURNING *`,
    [
      taskId, sceneId, projectId, patch.title ?? null, patch.status ?? null,
      patch.assigneeUserId !== undefined, patch.assigneeUserId ?? null,
      patch.dueAt !== undefined, patch.dueAt ?? null,
      patch.sortOrder ?? null,
    ],
  );
  return rows[0] ? mapSceneTaskRow(rows[0] as Row) : null;
}

export async function deleteSceneTask(db: Queryable, projectId: string, sceneId: string, taskId: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_scene_tasks WHERE id = $1 AND scene_id = $2 AND project_id = $3`, [taskId, sceneId, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ─── Review-runder ───────────────────────────────────────────────────

export type SceneSnapshotVersion = 1 | 2;

export interface SceneSnapshot {
  /** v1 = Fase 6-form; v2 (Fase 7) = + manusfelt, kildemerker, epoke og replikker. Mangler = 1. */
  v?: SceneSnapshotVersion;
  code: string;
  title: string;
  subtitle: string;
  location: string;
  challenge: string;
  gameplayMechanic: string;
  environment: string;
  heroAssetId: string | null;
  frames: Array<{ assetId: string | null; externalUrl: string | null; caption: string }>;
  links: Array<{ ownerKind: NarrativeSceneLinkKind; ownerId: string; title: string }>;
  // v2
  script?: { beforeState: string; action: string; control: string; afterState: string; audio: string; changeNote: string; bridge: string; timeNote: string; knowledge: NarrativeSceneKnowledge };
  era?: NarrativeSceneEra;
  sourceRefs?: NarrativeSourceRef[];
  lines?: Array<{ cueId: string; speakerLabel: string; textEn: string; textNb: string; sourceType: string; perspective: string }>;
}

/** Stabil JSON (sorterte nøkler) → sha256. Samme input gir alltid samme hash. */
export function hashSceneSnapshot(snapshot: SceneSnapshot): string {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return createHash('sha256').update(JSON.stringify(stable(snapshot))).digest('hex');
}

/**
 * Snapshot = felter + rammer + lenkede elementers/bretts/komponenters titler
 * (slettet mål → «(slettet)»). v2 tar med manusfelt, kildemerker, epoke og
 * replikker; gater og oppgaver inngår ikke (QA-bevis endres etter godkjenning).
 * Versjonen følger runden som ble sendt, så åpne v1-runder avgjøres riktig.
 */
export async function buildSceneSnapshot(
  db: Queryable, projectId: string, scene: NarrativeScene, frames: NarrativeSceneFrame[], links: NarrativeSceneLink[],
  options: { version?: SceneSnapshotVersion } = {},
): Promise<SceneSnapshot> {
  const version = options.version ?? 2;
  const elementIds = links.filter((l) => l.ownerKind === 'element').map((l) => l.ownerId);
  const boardIds = links.filter((l) => l.ownerKind === 'board').map((l) => l.ownerId);
  const componentIds = links.filter((l) => l.ownerKind === 'component').map((l) => l.ownerId);
  const titles = new Map<string, string>();
  if (componentIds.length) {
    const { rows } = await db.query(`SELECT id, name FROM narrative_components WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, componentIds]);
    for (const r of rows as Row[]) titles.set(`component:${String(r.id)}`, String(r.name ?? ''));
  }
  if (elementIds.length) {
    const { rows } = await db.query(`SELECT id, title_html FROM narrative_elements WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, elementIds]);
    for (const r of rows as Row[]) titles.set(`element:${String(r.id)}`, String(r.title_html ?? ''));
  }
  if (boardIds.length) {
    const { rows } = await db.query(`SELECT id, name FROM narrative_boards WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, boardIds]);
    for (const r of rows as Row[]) titles.set(`board:${String(r.id)}`, String(r.name ?? ''));
  }
  const base: SceneSnapshot = {
    code: scene.code,
    title: scene.title,
    subtitle: scene.subtitle,
    location: scene.location,
    challenge: scene.challenge,
    gameplayMechanic: scene.gameplayMechanic,
    environment: scene.environment,
    heroAssetId: scene.heroAssetId,
    frames: frames.map((f) => ({ assetId: f.assetId, externalUrl: f.externalUrl, caption: f.caption })),
    links: links.map((l) => ({ ownerKind: l.ownerKind, ownerId: l.ownerId, title: titles.get(`${l.ownerKind}:${l.ownerId}`) ?? '(slettet)' })),
  };
  if (version === 1) return base;
  const lines = await listSceneLines(db, projectId, scene.id);
  return {
    ...base,
    v: 2,
    script: {
      beforeState: scene.beforeState, action: scene.action, control: scene.control, afterState: scene.afterState, audio: scene.audio,
      changeNote: scene.changeNote, bridge: scene.bridge, timeNote: scene.timeNote, knowledge: scene.knowledge,
    },
    era: scene.era,
    sourceRefs: scene.sourceRefs,
    lines: lines.map((l) => ({ cueId: l.cueId, speakerLabel: l.speakerLabel, textEn: l.textEn, textNb: l.textNb, sourceType: l.sourceType, perspective: l.perspective })),
  };
}

async function currentSceneSnapshot(db: Queryable, projectId: string, scene: NarrativeScene, version: SceneSnapshotVersion = 2): Promise<SceneSnapshot> {
  const [links, frames] = await Promise.all([
    db.query(`SELECT * FROM narrative_scene_links WHERE scene_id = $1 AND project_id = $2 ORDER BY sort_order, owner_kind, owner_id`, [scene.id, projectId]),
    db.query(`SELECT * FROM narrative_scene_frames WHERE scene_id = $1 AND project_id = $2 ORDER BY sort_order, created_at`, [scene.id, projectId]),
  ]);
  return buildSceneSnapshot(db, projectId, scene, (frames.rows as Row[]).map(mapSceneFrameRow), (links.rows as Row[]).map(mapSceneLinkRow), { version });
}

/** Versjonen en lagret runde ble bygget med (rader fra før Fase 7 mangler `v`). */
function snapshotVersionOf(raw: unknown): SceneSnapshotVersion {
  const v = jsonObject(raw).v;
  return v === 2 ? 2 : 1;
}

export async function listSceneReviews(db: Queryable, projectId: string, sceneId: string): Promise<NarrativeSceneReview[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_scene_reviews WHERE scene_id = $1 AND project_id = $2 ORDER BY round DESC`, [sceneId, projectId]);
  return (rows as Row[]).map(mapSceneReviewRow);
}

/**
 * Ny review-runde: åpen runde superseders (så «send ny runde» etter 409
 * alltid virker), runde = maks+1, snapshot fryses, scene.status → in_review.
 */
export async function requestSceneReview(
  db: Queryable, projectId: string, sceneId: string, userId: string, note: string | null,
): Promise<NarrativeSceneReview | null> {
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  const snapshot = await currentSceneSnapshot(db, projectId, scene);
  const hash = hashSceneSnapshot(snapshot);
  await db.query(
    `UPDATE narrative_scene_reviews SET status = 'superseded', updated_at = now() WHERE scene_id = $1 AND project_id = $2 AND status = 'in_review'`,
    [sceneId, projectId],
  );
  const { rows: maxRows } = await db.query(`SELECT COALESCE(MAX(round), 0)::int AS max_round FROM narrative_scene_reviews WHERE scene_id = $1`, [sceneId]);
  const round = num(maxRows[0]?.max_round) + 1;
  const { rows } = await db.query(
    `INSERT INTO narrative_scene_reviews (id, scene_id, project_id, round, status, requested_by, request_note, snapshot, snapshot_hash)
       VALUES ($1, $2, $3, $4, 'in_review', $5, $6, $7::jsonb, $8) RETURNING *`,
    [generateId('nsr'), sceneId, projectId, round, userId, note, JSON.stringify(snapshot), hash],
  );
  await db.query(`UPDATE narrative_scenes SET status = 'in_review', updated_at = now() WHERE id = $1 AND project_id = $2`, [sceneId, projectId]);
  return mapSceneReviewRow(rows[0] as Row);
}

export interface SceneReviewDecisionInput {
  decision: 'approved' | 'changes_requested';
  note?: string | null;
  /** Hash klienten så da den viste runden; avvik → SceneReviewStaleError. */
  expectedSnapshotHash?: string | null;
  userId: string;
  userLabel: string | null;
}

/**
 * Beslutning på en åpen runde. 409-tilfeller: runden er lukket
 * (SceneReviewClosedError) eller scenen er endret siden runden ble sendt
 * (SceneReviewStaleError med gjeldende hash). Scene.status følger beslutningen.
 */
export async function decideSceneReview(
  db: Queryable, projectId: string, sceneId: string, reviewId: string, input: SceneReviewDecisionInput,
): Promise<NarrativeSceneReview | null> {
  const { rows } = await db.query(
    `SELECT * FROM narrative_scene_reviews WHERE id = $1 AND scene_id = $2 AND project_id = $3 LIMIT 1`,
    [reviewId, sceneId, projectId],
  );
  if (!rows[0]) return null;
  const review = mapSceneReviewRow(rows[0] as Row);
  if (review.status !== 'in_review') throw new SceneReviewClosedError(review.status);
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  const currentHash = hashSceneSnapshot(await currentSceneSnapshot(db, projectId, scene, snapshotVersionOf((rows[0] as Row).snapshot)));
  if (currentHash !== review.snapshotHash) throw new SceneReviewStaleError(currentHash, review.snapshotHash);
  if (input.expectedSnapshotHash && input.expectedSnapshotHash !== review.snapshotHash) {
    throw new SceneReviewStaleError(currentHash, review.snapshotHash);
  }
  const { rows: updated } = await db.query(
    `UPDATE narrative_scene_reviews SET
       status = $4, decided_by_user_id = $5, decided_by_label = $6, decided_at = now(), decision_note = $7, updated_at = now()
     WHERE id = $1 AND scene_id = $2 AND project_id = $3 AND status = 'in_review' RETURNING *`,
    [reviewId, sceneId, projectId, input.decision, input.userId, input.userLabel, input.note ?? null],
  );
  if (!updated[0]) throw new SceneReviewClosedError('superseded');
  await db.query(
    `UPDATE narrative_scenes SET status = $3, updated_at = now() WHERE id = $1 AND project_id = $2`,
    [sceneId, projectId, input.decision === 'approved' ? 'approved' : 'changes_requested'],
  );
  return mapSceneReviewRow(updated[0] as Row);
}

// ─── Medlemmer (lettvekt, for «Ansvarlig»-velgeren) ──────────────────

/**
 * Eier + aktive casting_user_roles-medlemmer med visningsnavn/avatar.
 * Tilgjengelig for alle med prosjekt-tilgang (members-ruten i Role Room er
 * eier-only) — leads må kunne sette ansvarlig uten å være eier.
 */
export async function listMembersLite(db: Queryable, projectId: string): Promise<NarrativeMemberLite[]> {
  const { rows } = await db.query(
    `WITH ids AS (
       SELECT created_by AS user_id, TRUE AS is_owner FROM casting_projects WHERE id = $1
       UNION
       SELECT user_id, FALSE FROM casting_user_roles WHERE project_id = $1 AND deactivated_at IS NULL
       UNION
       SELECT m.user_id, FALSE
         FROM casting_projects p
         JOIN enterprise_team_members m ON m.organization_id = p.created_by AND m.org_kind = 'game_studio' AND m.status = 'active'
        WHERE p.id = $1
     )
     SELECT ids.user_id, BOOL_OR(ids.is_owner) AS is_owner,
            MAX(p.display_name) AS display_name, MAX(p.profile_image_url) AS profile_image_url,
            MAX(NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.first_name, ''), NULLIF(u.last_name, ''))), '')) AS full_name,
            MAX(u.email) AS email
       FROM ids
       LEFT JOIN role_room_member_profiles p ON p.user_id = ids.user_id
       LEFT JOIN users u ON u.id = ids.user_id
      WHERE ids.user_id IS NOT NULL
      GROUP BY ids.user_id
      ORDER BY is_owner DESC, display_name NULLS LAST`,
    [projectId],
  );
  return (rows as Row[]).map((r) => ({
    userId: String(r.user_id),
    displayName: String(r.display_name || r.full_name || r.email || r.user_id),
    profileImageUrl: strOrNull(r.profile_image_url),
    isOwner: r.is_owner === true,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
//  Fase 7: Produksjons-OS — gater, replikker, episoder, åpne spørsmål,
//  kilder, milepæler, plattformmål, oversikt og innboks
//  (tabeller i 0624_narrative_production_os.sql)
// ═══════════════════════════════════════════════════════════════════════

export type NarrativeGateKey = 'script_coverage' | 'greybox' | 'characters_animation' | 'playthrough' | 'picture' | 'audio';
export const NARRATIVE_GATE_KEYS: readonly NarrativeGateKey[] = ['script_coverage', 'greybox', 'characters_animation', 'playthrough', 'picture', 'audio'];
export type NarrativeGateStatus = 'not_started' | 'in_progress' | 'passed' | 'failed';
export const NARRATIVE_GATE_STATUSES: readonly NarrativeGateStatus[] = ['not_started', 'in_progress', 'passed', 'failed'];
export type NarrativeLineSourceType = 'E' | 'T' | 'E+T' | 'U' | 'A';
export type NarrativeLineRecordingStatus = 'none' | 'needs_take' | 'recorded' | 'approved';
export type NarrativeEpisodeStatus = 'draft' | 'locked';
export type NarrativeQuestionKind = 'question' | 'check';
export type NarrativeQuestionStatus = 'open' | 'done' | 'dropped';
export type NarrativeSourceKind = 'docx' | 'pdf' | 'md' | 'txt' | 'other';
export type NarrativeMilestoneLane = 'story' | 'greybox' | 'characters' | 'playtest' | 'picture_audio' | 'engineering' | 'other';
export const NARRATIVE_MILESTONE_LANES: readonly NarrativeMilestoneLane[] = ['story', 'greybox', 'characters', 'playtest', 'picture_audio', 'engineering', 'other'];
export type NarrativeMilestoneStatus = 'planned' | 'in_progress' | 'done' | 'blocked';
export type NarrativePlatform = 'ipad' | 'iphone' | 'mac' | 'pc' | 'console' | 'web' | 'other';
export const NARRATIVE_PLATFORMS: readonly NarrativePlatform[] = ['ipad', 'iphone', 'mac', 'pc', 'console', 'web', 'other'];
/** Replikk-ID: W01.01, U04.02, K03.01, G03A.04 — kilde-/scenekode + løpenummer. */
export const NARRATIVE_CUE_ID_RE = /^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?(\.[0-9]{1,3})?$/;

export interface NarrativeSceneGate {
  sceneId: string;
  projectId: string;
  gateKey: NarrativeGateKey;
  status: NarrativeGateStatus;
  evidence: string;
  evidenceRefs: string[];
  checkedBy: string | null;
  checkedAt: string | null;
  updatedAt: string | null;
}

export interface NarrativeSceneLine {
  id: string;
  sceneId: string;
  projectId: string;
  cueId: string;
  speakerComponentId: string | null;
  speakerLabel: string;
  perspective: string;
  textEn: string;
  textNb: string;
  sourceType: NarrativeLineSourceType;
  recordingStatus: NarrativeLineRecordingStatus;
  note: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeEpisode {
  id: string;
  projectId: string;
  code: string;
  title: string;
  summary: string;
  playersLearn: string;
  sourceNote: string;
  status: NarrativeEpisodeStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeOpenQuestion {
  id: string;
  projectId: string;
  code: string;
  kind: NarrativeQuestionKind;
  question: string;
  context: string;
  status: NarrativeQuestionStatus;
  decision: string;
  decidedBy: string | null;
  decidedAt: string | null;
  sourceRefs: NarrativeSourceRef[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSource {
  id: string;
  projectId: string;
  code: string;
  label: string;
  kind: NarrativeSourceKind;
  sha256: string | null;
  pathHint: string;
  notes: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeMilestone {
  id: string;
  projectId: string;
  title: string;
  lane: NarrativeMilestoneLane;
  startAt: string | null;
  dueAt: string | null;
  status: NarrativeMilestoneStatus;
  ownerUserId: string | null;
  description: string;
  acceptance: string;
  evidence: string;
  sortOrder: number;
  sceneIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NarrativePlatformRequirement {
  code: string;
  text: string;
  status: 'unverified' | 'verified' | 'failed';
  evidence?: string;
  source?: string;
}

export interface NarrativePlatformTarget {
  id: string;
  projectId: string;
  name: string;
  platform: NarrativePlatform;
  isPrimary: boolean;
  engine: string;
  osMin: string;
  deviceMin: string;
  inputModel: string;
  budgets: Record<string, unknown>;
  requirements: NarrativePlatformRequirement[];
  visualDirection: Record<string, unknown>;
  notes: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function mapSceneGateRow(row: Row): NarrativeSceneGate {
  const refs = jsonValue(row.evidence_refs);
  return {
    sceneId: String(row.scene_id),
    projectId: String(row.project_id),
    gateKey: String(row.gate_key) as NarrativeGateKey,
    status: String(row.status ?? 'not_started') as NarrativeGateStatus,
    evidence: String(row.evidence ?? ''),
    evidenceRefs: Array.isArray(refs) ? refs.map(String) : [],
    checkedBy: strOrNull(row.checked_by),
    checkedAt: isoTsOrNull(row.checked_at),
    updatedAt: isoTsOrNull(row.updated_at),
  };
}

/** Alle seks gater finnes alltid i svaret (manglende rad = not_started). */
function fillGates(sceneId: string, projectId: string, stored: NarrativeSceneGate[]): NarrativeSceneGate[] {
  const byKey = new Map(stored.map((g) => [g.gateKey, g]));
  return NARRATIVE_GATE_KEYS.map((gateKey) => byKey.get(gateKey) ?? ({
    sceneId, projectId, gateKey, status: 'not_started', evidence: '', evidenceRefs: [], checkedBy: null, checkedAt: null, updatedAt: null,
  }));
}

function mapSceneLineRow(row: Row): NarrativeSceneLine {
  return {
    id: String(row.id),
    sceneId: String(row.scene_id),
    projectId: String(row.project_id),
    cueId: String(row.cue_id),
    speakerComponentId: strOrNull(row.speaker_component_id),
    speakerLabel: String(row.speaker_label ?? ''),
    perspective: String(row.perspective ?? ''),
    textEn: String(row.text_en ?? ''),
    textNb: String(row.text_nb ?? ''),
    sourceType: String(row.source_type ?? 'T') as NarrativeLineSourceType,
    recordingStatus: String(row.recording_status ?? 'none') as NarrativeLineRecordingStatus,
    note: String(row.note ?? ''),
    sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapEpisodeRow(row: Row): NarrativeEpisode {
  return {
    id: String(row.id), projectId: String(row.project_id), code: String(row.code), title: String(row.title ?? ''),
    summary: String(row.summary ?? ''), playersLearn: String(row.players_learn ?? ''), sourceNote: String(row.source_note ?? ''),
    status: String(row.status ?? 'draft') as NarrativeEpisodeStatus, sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at), updatedAt: isoTs(row.updated_at),
  };
}

function mapOpenQuestionRow(row: Row): NarrativeOpenQuestion {
  return {
    id: String(row.id), projectId: String(row.project_id), code: String(row.code),
    kind: String(row.kind ?? 'question') as NarrativeQuestionKind, question: String(row.question ?? ''), context: String(row.context ?? ''),
    status: String(row.status ?? 'open') as NarrativeQuestionStatus, decision: String(row.decision ?? ''),
    decidedBy: strOrNull(row.decided_by), decidedAt: isoTsOrNull(row.decided_at), sourceRefs: normalizeSourceRefs(row.source_refs),
    sortOrder: num(row.sort_order), createdAt: isoTs(row.created_at), updatedAt: isoTs(row.updated_at),
  };
}

function mapSourceRow(row: Row): NarrativeSource {
  return {
    id: String(row.id), projectId: String(row.project_id), code: String(row.code), label: String(row.label ?? ''),
    kind: String(row.kind ?? 'other') as NarrativeSourceKind, sha256: strOrNull(row.sha256), pathHint: String(row.path_hint ?? ''),
    notes: String(row.notes ?? ''), verifiedAt: isoTsOrNull(row.verified_at), verifiedBy: strOrNull(row.verified_by),
    sortOrder: num(row.sort_order), createdAt: isoTs(row.created_at), updatedAt: isoTs(row.updated_at),
  };
}

function mapMilestoneRow(row: Row, sceneIds: string[] = []): NarrativeMilestone {
  return {
    id: String(row.id), projectId: String(row.project_id), title: String(row.title ?? ''),
    lane: String(row.lane ?? 'other') as NarrativeMilestoneLane, startAt: isoTsOrNull(row.start_at), dueAt: isoTsOrNull(row.due_at),
    status: String(row.status ?? 'planned') as NarrativeMilestoneStatus, ownerUserId: strOrNull(row.owner_user_id),
    description: String(row.description ?? ''), acceptance: String(row.acceptance ?? ''), evidence: String(row.evidence ?? ''),
    sortOrder: num(row.sort_order), sceneIds, createdAt: isoTs(row.created_at), updatedAt: isoTs(row.updated_at),
  };
}

function normalizeRequirements(value: unknown): NarrativePlatformRequirement[] {
  const raw = typeof value === 'string' ? jsonValue(value) : value;
  if (!Array.isArray(raw)) return [];
  const out: NarrativePlatformRequirement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const code = typeof rec.code === 'string' ? rec.code.trim() : '';
    const text = typeof rec.text === 'string' ? rec.text : '';
    if (!code || !text) continue;
    const status = rec.status === 'verified' || rec.status === 'failed' ? rec.status : 'unverified';
    const entry: NarrativePlatformRequirement = { code, text, status };
    if (typeof rec.evidence === 'string' && rec.evidence) entry.evidence = rec.evidence;
    if (typeof rec.source === 'string' && rec.source) entry.source = rec.source;
    out.push(entry);
  }
  return out;
}

function mapPlatformTargetRow(row: Row): NarrativePlatformTarget {
  return {
    id: String(row.id), projectId: String(row.project_id), name: String(row.name ?? ''),
    platform: (NARRATIVE_PLATFORMS as readonly string[]).includes(String(row.platform)) ? String(row.platform) as NarrativePlatform : 'other',
    isPrimary: row.is_primary === true, engine: String(row.engine ?? ''), osMin: String(row.os_min ?? ''), deviceMin: String(row.device_min ?? ''),
    inputModel: String(row.input_model ?? ''), budgets: jsonObject(row.budgets), requirements: normalizeRequirements(row.requirements),
    visualDirection: jsonObject(row.visual_direction), notes: String(row.notes ?? ''), sortOrder: num(row.sort_order),
    createdAt: isoTs(row.created_at), updatedAt: isoTs(row.updated_at),
  };
}

// ─── Gater ───────────────────────────────────────────────────────────

export class GateEvidenceRequiredError extends Error {
  readonly code = 'gate_evidence_required';
  constructor() { super('En gate kan ikke settes «bestått» uten bevis.'); }
}

export async function listSceneGates(db: Queryable, projectId: string, sceneId: string): Promise<NarrativeSceneGate[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_scene_gates WHERE scene_id = $1 AND project_id = $2`, [sceneId, projectId]);
  return fillGates(sceneId, projectId, (rows as Row[]).map(mapSceneGateRow));
}

export interface SceneGateInput { status: NarrativeGateStatus; evidence?: string; evidenceRefs?: string[] }

/** Upsert av én gate. «passed» uten bevis avvises FØR databasen (samme regel som CHECK-en). */
export async function setSceneGate(
  db: Queryable, projectId: string, sceneId: string, gateKey: NarrativeGateKey, userId: string, input: SceneGateInput,
): Promise<NarrativeSceneGate | null> {
  const evidence = (input.evidence ?? '').trim();
  if (input.status === 'passed' && !evidence) throw new GateEvidenceRequiredError();
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  const { rows } = await db.query(
    `INSERT INTO narrative_scene_gates (scene_id, project_id, gate_key, status, evidence, evidence_refs, checked_by, checked_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), now())
     ON CONFLICT (scene_id, gate_key) DO UPDATE SET
       status = EXCLUDED.status, evidence = EXCLUDED.evidence, evidence_refs = EXCLUDED.evidence_refs,
       checked_by = EXCLUDED.checked_by, checked_at = now(), updated_at = now()
     RETURNING *`,
    [sceneId, projectId, gateKey, input.status, evidence, JSON.stringify(input.evidenceRefs ?? []), userId],
  );
  return mapSceneGateRow(rows[0] as Row);
}

// ─── Replikker ───────────────────────────────────────────────────────

export class DuplicateCueError extends Error {
  readonly code = 'duplicate_cue';
  constructor(readonly cueId: string) { super(`Replikk-ID «${cueId}» finnes allerede i scenen.`); }
}

export async function listSceneLines(db: Queryable, projectId: string, sceneId: string): Promise<NarrativeSceneLine[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_scene_lines WHERE scene_id = $1 AND project_id = $2 ORDER BY sort_order, cue_id`, [sceneId, projectId]);
  return (rows as Row[]).map(mapSceneLineRow);
}

/** Replikker der en karakter er taler (Karakterer-siden). */
export async function listLinesBySpeaker(db: Queryable, projectId: string, componentId: string): Promise<Array<NarrativeSceneLine & { sceneCode: string; sceneTitle: string }>> {
  const { rows } = await db.query(
    `SELECT l.*, s.code AS scene_code, s.title AS scene_title FROM narrative_scene_lines l
       JOIN narrative_scenes s ON s.id = l.scene_id
      WHERE l.project_id = $1 AND l.speaker_component_id = $2
      ORDER BY s.sort_order, s.code, l.sort_order`,
    [projectId, componentId],
  );
  return (rows as Row[]).map((r) => ({ ...mapSceneLineRow(r), sceneCode: String(r.scene_code), sceneTitle: String(r.scene_title ?? '') }));
}

export interface SceneLineInput {
  cueId: string;
  speakerComponentId?: string | null;
  speakerLabel?: string;
  perspective?: string;
  textEn?: string;
  textNb?: string;
  sourceType?: NarrativeLineSourceType;
  recordingStatus?: NarrativeLineRecordingStatus;
  note?: string;
  sortOrder?: number;
}
export type SceneLinePatch = Partial<SceneLineInput>;

export async function createSceneLine(db: Queryable, projectId: string, sceneId: string, userId: string, input: SceneLineInput): Promise<NarrativeSceneLine | null> {
  const scene = await getScene(db, projectId, sceneId);
  if (!scene) return null;
  const cueId = input.cueId.trim().toUpperCase();
  const sortOrder = input.sortOrder ?? num((await db.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM narrative_scene_lines WHERE scene_id = $1`, [sceneId],
  )).rows[0]?.next);
  try {
    const { rows } = await db.query(
      `INSERT INTO narrative_scene_lines
         (id, scene_id, project_id, cue_id, speaker_component_id, speaker_label, perspective, text_en, text_nb, source_type, recording_status, note, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        generateId('nsl'), sceneId, projectId, cueId, input.speakerComponentId ?? null, input.speakerLabel ?? '', input.perspective ?? '',
        input.textEn ?? '', input.textNb ?? '', input.sourceType ?? 'T', input.recordingStatus ?? 'none', input.note ?? '', sortOrder, userId,
      ],
    );
    return mapSceneLineRow(rows[0] as Row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCueError(cueId);
    throw err;
  }
}

export async function patchSceneLine(db: Queryable, projectId: string, sceneId: string, lineId: string, patch: SceneLinePatch): Promise<NarrativeSceneLine | null> {
  const cueId = typeof patch.cueId === 'string' && patch.cueId.trim() ? patch.cueId.trim().toUpperCase() : null;
  try {
    const { rows } = await db.query(
      `UPDATE narrative_scene_lines SET
         cue_id = COALESCE($4, cue_id),
         speaker_component_id = CASE WHEN $5::boolean THEN $6 ELSE speaker_component_id END,
         speaker_label = COALESCE($7, speaker_label),
         perspective = COALESCE($8, perspective),
         text_en = COALESCE($9, text_en),
         text_nb = COALESCE($10, text_nb),
         source_type = COALESCE($11, source_type),
         recording_status = COALESCE($12, recording_status),
         note = COALESCE($13, note),
         sort_order = COALESCE($14, sort_order),
         updated_at = now()
       WHERE id = $1 AND scene_id = $2 AND project_id = $3 RETURNING *`,
      [
        lineId, sceneId, projectId, cueId, patch.speakerComponentId !== undefined, patch.speakerComponentId ?? null,
        patch.speakerLabel ?? null, patch.perspective ?? null, patch.textEn ?? null, patch.textNb ?? null,
        patch.sourceType ?? null, patch.recordingStatus ?? null, patch.note ?? null, patch.sortOrder ?? null,
      ],
    );
    return rows[0] ? mapSceneLineRow(rows[0] as Row) : null;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCueError(cueId ?? '');
    throw err;
  }
}

export async function deleteSceneLine(db: Queryable, projectId: string, sceneId: string, lineId: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_scene_lines WHERE id = $1 AND scene_id = $2 AND project_id = $3`, [lineId, sceneId, projectId]);
  return (r.rowCount ?? 0) > 0;
}

export async function reorderSceneLines(db: Queryable, projectId: string, sceneId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db.query(`UPDATE narrative_scene_lines SET sort_order = $4, updated_at = now() WHERE id = $1 AND scene_id = $2 AND project_id = $3`, [orderedIds[i], sceneId, projectId, i]);
  }
}

// ─── Episoder ────────────────────────────────────────────────────────

export class DuplicateCodeError extends Error {
  readonly code = 'duplicate_code';
  constructor(readonly entity: string, readonly value: string) { super(`Koden «${value}» er allerede i bruk (${entity}).`); }
}

export interface EpisodeInput { code: string; title?: string; summary?: string; playersLearn?: string; sourceNote?: string; status?: NarrativeEpisodeStatus; sortOrder?: number }
export type EpisodePatch = Partial<EpisodeInput>;

export async function listEpisodes(db: Queryable, projectId: string): Promise<NarrativeEpisode[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_episodes WHERE project_id = $1 ORDER BY sort_order, code`, [projectId]);
  return (rows as Row[]).map(mapEpisodeRow);
}

export async function createEpisode(db: Queryable, projectId: string, userId: string, input: EpisodeInput): Promise<NarrativeEpisode> {
  const code = input.code.trim().toUpperCase();
  try {
    const { rows } = await db.query(
      `INSERT INTO narrative_episodes (id, project_id, code, title, summary, players_learn, source_note, status, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [generateId('nep'), projectId, code, input.title ?? '', input.summary ?? '', input.playersLearn ?? '', input.sourceNote ?? '', input.status ?? 'draft', input.sortOrder ?? 0, userId],
    );
    return mapEpisodeRow(rows[0] as Row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCodeError('episode', code);
    throw err;
  }
}

export async function patchEpisode(db: Queryable, projectId: string, id: string, patch: EpisodePatch): Promise<NarrativeEpisode | null> {
  const code = typeof patch.code === 'string' && patch.code.trim() ? patch.code.trim().toUpperCase() : null;
  try {
    const { rows } = await db.query(
      `UPDATE narrative_episodes SET code = COALESCE($3, code), title = COALESCE($4, title), summary = COALESCE($5, summary),
         players_learn = COALESCE($6, players_learn), source_note = COALESCE($7, source_note), status = COALESCE($8, status),
         sort_order = COALESCE($9, sort_order), updated_at = now()
       WHERE id = $1 AND project_id = $2 RETURNING *`,
      [id, projectId, code, patch.title ?? null, patch.summary ?? null, patch.playersLearn ?? null, patch.sourceNote ?? null, patch.status ?? null, patch.sortOrder ?? null],
    );
    return rows[0] ? mapEpisodeRow(rows[0] as Row) : null;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCodeError('episode', code ?? '');
    throw err;
  }
}

export async function deleteEpisode(db: Queryable, projectId: string, id: string): Promise<boolean> {
  await db.query(`UPDATE narrative_scenes SET episode_id = NULL WHERE project_id = $1 AND episode_id = $2`, [projectId, id]);
  const r = await db.query(`DELETE FROM narrative_episodes WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ─── Åpne spørsmål / sjekklister ─────────────────────────────────────

export interface OpenQuestionInput {
  code: string; kind?: NarrativeQuestionKind; question: string; context?: string; status?: NarrativeQuestionStatus;
  decision?: string; sourceRefs?: NarrativeSourceRef[]; sortOrder?: number;
}
export type OpenQuestionPatch = Partial<OpenQuestionInput>;

export async function listOpenQuestions(db: Queryable, projectId: string): Promise<NarrativeOpenQuestion[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_open_questions WHERE project_id = $1 ORDER BY sort_order, code`, [projectId]);
  return (rows as Row[]).map(mapOpenQuestionRow);
}

export async function createOpenQuestion(db: Queryable, projectId: string, userId: string, input: OpenQuestionInput): Promise<NarrativeOpenQuestion> {
  const code = input.code.trim().toUpperCase();
  try {
    const { rows } = await db.query(
      `INSERT INTO narrative_open_questions (id, project_id, code, kind, question, context, status, decision, source_refs, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) RETURNING *`,
      [generateId('noq'), projectId, code, input.kind ?? 'question', input.question, input.context ?? '', input.status ?? 'open', input.decision ?? '',
        JSON.stringify(normalizeSourceRefs(input.sourceRefs ?? [])), input.sortOrder ?? 0, userId],
    );
    return mapOpenQuestionRow(rows[0] as Row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCodeError('open_question', code);
    throw err;
  }
}

export async function patchOpenQuestion(db: Queryable, projectId: string, id: string, userId: string, patch: OpenQuestionPatch): Promise<NarrativeOpenQuestion | null> {
  const { rows } = await db.query(
    `UPDATE narrative_open_questions SET
       kind = COALESCE($3, kind), question = COALESCE($4, question), context = COALESCE($5, context),
       status = COALESCE($6, status), decision = COALESCE($7, decision),
       decided_by = CASE WHEN $6 IS NOT NULL AND $6 <> 'open' THEN $8 ELSE decided_by END,
       decided_at = CASE WHEN $6 IS NOT NULL AND $6 <> 'open' THEN now() WHEN $6 = 'open' THEN NULL ELSE decided_at END,
       source_refs = CASE WHEN $9::boolean THEN $10::jsonb ELSE source_refs END,
       sort_order = COALESCE($11, sort_order), updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [id, projectId, patch.kind ?? null, patch.question ?? null, patch.context ?? null, patch.status ?? null, patch.decision ?? null, userId,
      patch.sourceRefs !== undefined, JSON.stringify(normalizeSourceRefs(patch.sourceRefs ?? [])), patch.sortOrder ?? null],
  );
  return rows[0] ? mapOpenQuestionRow(rows[0] as Row) : null;
}

export async function deleteOpenQuestion(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_open_questions WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ─── Kilderegister ───────────────────────────────────────────────────

export interface SourceInput { code: string; label: string; kind?: NarrativeSourceKind; sha256?: string | null; pathHint?: string; notes?: string; sortOrder?: number }
export type SourcePatch = Partial<SourceInput> & { verified?: boolean };

export async function listSources(db: Queryable, projectId: string): Promise<NarrativeSource[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_sources WHERE project_id = $1 ORDER BY sort_order, code`, [projectId]);
  return (rows as Row[]).map(mapSourceRow);
}

export async function createSource(db: Queryable, projectId: string, userId: string, input: SourceInput): Promise<NarrativeSource> {
  const code = input.code.trim().toUpperCase();
  try {
    const { rows } = await db.query(
      `INSERT INTO narrative_sources (id, project_id, code, label, kind, sha256, path_hint, notes, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [generateId('nso'), projectId, code, input.label, input.kind ?? 'other', input.sha256 ? input.sha256.toLowerCase() : null, input.pathHint ?? '', input.notes ?? '', input.sortOrder ?? 0, userId],
    );
    return mapSourceRow(rows[0] as Row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCodeError('source', code);
    throw err;
  }
}

export async function patchSource(db: Queryable, projectId: string, id: string, userId: string, patch: SourcePatch): Promise<NarrativeSource | null> {
  const { rows } = await db.query(
    `UPDATE narrative_sources SET
       label = COALESCE($3, label), kind = COALESCE($4, kind),
       sha256 = CASE WHEN $5::boolean THEN $6 ELSE sha256 END,
       path_hint = COALESCE($7, path_hint), notes = COALESCE($8, notes), sort_order = COALESCE($9, sort_order),
       verified_at = CASE WHEN $10::boolean THEN now() ELSE verified_at END,
       verified_by = CASE WHEN $10::boolean THEN $11 ELSE verified_by END,
       updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [id, projectId, patch.label ?? null, patch.kind ?? null, patch.sha256 !== undefined, patch.sha256 ? patch.sha256.toLowerCase() : null,
      patch.pathHint ?? null, patch.notes ?? null, patch.sortOrder ?? null, patch.verified === true, userId],
  );
  return rows[0] ? mapSourceRow(rows[0] as Row) : null;
}

export async function deleteSource(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_sources WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ─── Milepæler ───────────────────────────────────────────────────────

export interface MilestoneInput {
  title: string; lane?: NarrativeMilestoneLane; startAt?: string | null; dueAt?: string | null; status?: NarrativeMilestoneStatus;
  ownerUserId?: string | null; description?: string; acceptance?: string; evidence?: string; sortOrder?: number;
}
export type MilestonePatch = Partial<MilestoneInput>;

export async function listMilestones(db: Queryable, projectId: string): Promise<NarrativeMilestone[]> {
  const [{ rows }, links] = await Promise.all([
    db.query(`SELECT * FROM narrative_milestones WHERE project_id = $1 ORDER BY lane, start_at NULLS LAST, due_at NULLS LAST, sort_order`, [projectId]),
    db.query(`SELECT ms.milestone_id, ms.scene_id FROM narrative_milestone_scenes ms JOIN narrative_milestones m ON m.id = ms.milestone_id WHERE m.project_id = $1`, [projectId]),
  ]);
  const scenesBy = new Map<string, string[]>();
  for (const l of links.rows as Row[]) {
    const list = scenesBy.get(String(l.milestone_id)) ?? [];
    list.push(String(l.scene_id));
    scenesBy.set(String(l.milestone_id), list);
  }
  return (rows as Row[]).map((r) => mapMilestoneRow(r, scenesBy.get(String(r.id)) ?? []));
}

export async function createMilestone(db: Queryable, projectId: string, userId: string, input: MilestoneInput): Promise<NarrativeMilestone> {
  const { rows } = await db.query(
    `INSERT INTO narrative_milestones (id, project_id, title, lane, start_at, due_at, status, owner_user_id, description, acceptance, evidence, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [generateId('nms'), projectId, input.title, input.lane ?? 'other', input.startAt ?? null, input.dueAt ?? null, input.status ?? 'planned',
      input.ownerUserId ?? null, input.description ?? '', input.acceptance ?? '', input.evidence ?? '', input.sortOrder ?? 0, userId],
  );
  return mapMilestoneRow(rows[0] as Row);
}

export async function patchMilestone(db: Queryable, projectId: string, id: string, patch: MilestonePatch): Promise<NarrativeMilestone | null> {
  const { rows } = await db.query(
    `UPDATE narrative_milestones SET
       title = COALESCE($3, title), lane = COALESCE($4, lane),
       start_at = CASE WHEN $5::boolean THEN $6::timestamptz ELSE start_at END,
       due_at = CASE WHEN $7::boolean THEN $8::timestamptz ELSE due_at END,
       status = COALESCE($9, status),
       owner_user_id = CASE WHEN $10::boolean THEN $11 ELSE owner_user_id END,
       description = COALESCE($12, description), acceptance = COALESCE($13, acceptance), evidence = COALESCE($14, evidence),
       sort_order = COALESCE($15, sort_order), updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [id, projectId, patch.title ?? null, patch.lane ?? null, patch.startAt !== undefined, patch.startAt ?? null, patch.dueAt !== undefined, patch.dueAt ?? null,
      patch.status ?? null, patch.ownerUserId !== undefined, patch.ownerUserId ?? null, patch.description ?? null, patch.acceptance ?? null, patch.evidence ?? null, patch.sortOrder ?? null],
  );
  if (!rows[0]) return null;
  const links = await db.query(`SELECT scene_id FROM narrative_milestone_scenes WHERE milestone_id = $1`, [id]);
  return mapMilestoneRow(rows[0] as Row, (links.rows as Row[]).map((l) => String(l.scene_id)));
}

export async function deleteMilestone(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_milestones WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

/** Erstatter scenene en milepæl dekker; scener utenfor prosjektet forkastes stille. */
export async function setMilestoneScenes(db: Queryable, projectId: string, milestoneId: string, sceneIds: string[]): Promise<string[] | null> {
  const ms = await db.query(`SELECT id FROM narrative_milestones WHERE id = $1 AND project_id = $2 LIMIT 1`, [milestoneId, projectId]);
  if (!ms.rows[0]) return null;
  const valid = sceneIds.length
    ? (await db.query(`SELECT id FROM narrative_scenes WHERE project_id = $1 AND id = ANY($2::text[])`, [projectId, sceneIds])).rows as Row[]
    : [];
  const keep = new Set(valid.map((r) => String(r.id)));
  await db.query(`DELETE FROM narrative_milestone_scenes WHERE milestone_id = $1`, [milestoneId]);
  const out: string[] = [];
  for (const id of sceneIds) {
    if (!keep.has(id) || out.includes(id)) continue;
    await db.query(`INSERT INTO narrative_milestone_scenes (milestone_id, scene_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [milestoneId, id]);
    out.push(id);
  }
  return out;
}

// ─── Plattformmål ────────────────────────────────────────────────────

export interface PlatformTargetInput {
  name: string; platform?: NarrativePlatform; isPrimary?: boolean; engine?: string; osMin?: string; deviceMin?: string; inputModel?: string;
  budgets?: Record<string, unknown>; requirements?: NarrativePlatformRequirement[]; visualDirection?: Record<string, unknown>; notes?: string; sortOrder?: number;
}
export type PlatformTargetPatch = Partial<PlatformTargetInput>;

export async function listPlatformTargets(db: Queryable, projectId: string): Promise<NarrativePlatformTarget[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_platform_targets WHERE project_id = $1 ORDER BY is_primary DESC, sort_order, name`, [projectId]);
  return (rows as Row[]).map(mapPlatformTargetRow);
}

async function clearPrimaryPlatform(db: Queryable, projectId: string, exceptId: string | null): Promise<void> {
  await db.query(`UPDATE narrative_platform_targets SET is_primary = FALSE, updated_at = now() WHERE project_id = $1 AND is_primary AND ($2::text IS NULL OR id <> $2)`, [projectId, exceptId]);
}

export async function createPlatformTarget(db: Queryable, projectId: string, userId: string, input: PlatformTargetInput): Promise<NarrativePlatformTarget> {
  if (input.isPrimary) await clearPrimaryPlatform(db, projectId, null);
  const { rows } = await db.query(
    `INSERT INTO narrative_platform_targets
       (id, project_id, name, platform, is_primary, engine, os_min, device_min, input_model, budgets, requirements, visual_direction, notes, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15) RETURNING *`,
    [generateId('npt'), projectId, input.name, input.platform ?? 'other', input.isPrimary === true, input.engine ?? '', input.osMin ?? '', input.deviceMin ?? '',
      input.inputModel ?? '', JSON.stringify(input.budgets ?? {}), JSON.stringify(normalizeRequirements(input.requirements ?? [])),
      JSON.stringify(input.visualDirection ?? {}), input.notes ?? '', input.sortOrder ?? 0, userId],
  );
  return mapPlatformTargetRow(rows[0] as Row);
}

export async function patchPlatformTarget(db: Queryable, projectId: string, id: string, patch: PlatformTargetPatch): Promise<NarrativePlatformTarget | null> {
  if (patch.isPrimary === true) await clearPrimaryPlatform(db, projectId, id);
  const { rows } = await db.query(
    `UPDATE narrative_platform_targets SET
       name = COALESCE($3, name), platform = COALESCE($4, platform),
       is_primary = COALESCE($5, is_primary),
       engine = COALESCE($6, engine), os_min = COALESCE($7, os_min), device_min = COALESCE($8, device_min), input_model = COALESCE($9, input_model),
       budgets = CASE WHEN $10::boolean THEN $11::jsonb ELSE budgets END,
       requirements = CASE WHEN $12::boolean THEN $13::jsonb ELSE requirements END,
       visual_direction = CASE WHEN $14::boolean THEN $15::jsonb ELSE visual_direction END,
       notes = COALESCE($16, notes), sort_order = COALESCE($17, sort_order), updated_at = now()
     WHERE id = $1 AND project_id = $2 RETURNING *`,
    [id, projectId, patch.name ?? null, patch.platform ?? null, patch.isPrimary ?? null, patch.engine ?? null, patch.osMin ?? null, patch.deviceMin ?? null, patch.inputModel ?? null,
      patch.budgets !== undefined, JSON.stringify(patch.budgets ?? {}), patch.requirements !== undefined, JSON.stringify(normalizeRequirements(patch.requirements ?? [])),
      patch.visualDirection !== undefined, JSON.stringify(patch.visualDirection ?? {}), patch.notes ?? null, patch.sortOrder ?? null],
  );
  return rows[0] ? mapPlatformTargetRow(rows[0] as Row) : null;
}

export async function deletePlatformTarget(db: Queryable, projectId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM narrative_platform_targets WHERE id = $1 AND project_id = $2`, [id, projectId]);
  return (r.rowCount ?? 0) > 0;
}

// ─── Komponenter per kind (Karakterer / Lokasjoner) ──────────────────

export async function listComponentsByKind(db: Queryable, projectId: string, kind: NarrativeComponentKind): Promise<NarrativeComponent[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_components WHERE project_id = $1 AND kind = $2 ORDER BY sort_order, name`, [projectId, kind]);
  return (rows as Row[]).map(mapComponentRow);
}

// ─── Prosjektoversikt (hjem) ─────────────────────────────────────────

export interface NarrativeActivityItem {
  kind: 'scene' | 'review' | 'task' | 'gate' | 'milestone' | 'revision';
  id: string;
  title: string;
  detail: string;
  at: string;
  sceneId: string | null;
}

export interface NarrativeProjectOverview {
  scenes: { total: number; byStatus: Record<NarrativeSceneStatus, number>; byEra: Record<string, number>; withoutDates: number };
  gates: { total: number; passed: number; failed: number; byKey: Record<NarrativeGateKey, { passed: number; total: number }> };
  tasks: { open: number; overdue: number; done: number };
  reviews: { open: number };
  lines: { total: number; approved: number };
  questions: { open: number; checksOpen: number };
  guardian: { pending: number; high: number };
  /** Fase 8e: spilltest siste 7 dager (null uten data). */
  playtest: { sessions7d: number; worstDropOff: { sceneCode: string; sessions: number } | null };
  platform: { requirements: number; verified: number; primaryName: string | null };
  milestones: NarrativeMilestone[];
  episodes: Array<{ id: string; code: string; title: string; sceneCount: number; approvedCount: number }>;
  activity: NarrativeActivityItem[];
  unreadInbox: number;
}

export async function getProjectOverview(db: Queryable, projectId: string, userId: string): Promise<NarrativeProjectOverview> {
  const [scenes, gates, tasks, reviews, lines, questions, platform, milestones, episodes, activity, unread, guardian, playtest] = await Promise.all([
    db.query(`SELECT status, era, start_at, due_at FROM narrative_scenes WHERE project_id = $1`, [projectId]),
    db.query(`SELECT gate_key, status, COUNT(*)::int AS n FROM narrative_scene_gates WHERE project_id = $1 GROUP BY gate_key, status`, [projectId]),
    db.query(`SELECT status, due_at FROM narrative_scene_tasks WHERE project_id = $1`, [projectId]),
    db.query(`SELECT COUNT(*)::int AS n FROM narrative_scene_reviews WHERE project_id = $1 AND status = 'in_review'`, [projectId]),
    db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE recording_status = 'approved')::int AS approved FROM narrative_scene_lines WHERE project_id = $1`, [projectId]),
    db.query(`SELECT kind, COUNT(*)::int AS n FROM narrative_open_questions WHERE project_id = $1 AND status = 'open' GROUP BY kind`, [projectId]),
    db.query(`SELECT name, requirements FROM narrative_platform_targets WHERE project_id = $1 ORDER BY is_primary DESC, sort_order LIMIT 1`, [projectId]),
    listMilestones(db, projectId),
    db.query(
      `SELECT e.id, e.code, e.title, COUNT(s.id)::int AS scene_count, COUNT(s.id) FILTER (WHERE s.status IN ('approved','implemented'))::int AS approved_count
         FROM narrative_episodes e LEFT JOIN narrative_scenes s ON s.episode_id = e.id AND s.project_id = e.project_id
        WHERE e.project_id = $1 GROUP BY e.id ORDER BY e.sort_order, e.code`,
      [projectId],
    ),
    db.query(
      `SELECT * FROM (
         SELECT 'scene' AS kind, id, code || ' – ' || title AS title, 'Scene oppdatert' AS detail, updated_at AS at, id AS scene_id FROM narrative_scenes WHERE project_id = $1
         UNION ALL
         SELECT 'review', r.id, s.code || ' – ' || s.title, 'Runde ' || r.round || ': ' || r.status, COALESCE(r.decided_at, r.requested_at), r.scene_id
           FROM narrative_scene_reviews r JOIN narrative_scenes s ON s.id = r.scene_id WHERE r.project_id = $1
         UNION ALL
         SELECT 'task', t.id, t.title, 'Oppgave ferdig (' || s.code || ')', t.completed_at, t.scene_id
           FROM narrative_scene_tasks t JOIN narrative_scenes s ON s.id = t.scene_id WHERE t.project_id = $1 AND t.completed_at IS NOT NULL
         UNION ALL
         SELECT 'gate', g.scene_id || ':' || g.gate_key, s.code || ' – ' || s.title, 'Gate ' || g.gate_key || ': ' || g.status, g.checked_at, g.scene_id
           FROM narrative_scene_gates g JOIN narrative_scenes s ON s.id = g.scene_id WHERE g.project_id = $1 AND g.checked_at IS NOT NULL
         UNION ALL
         SELECT 'milestone', id, title, 'Milepæl: ' || status, updated_at, NULL FROM narrative_milestones WHERE project_id = $1
         UNION ALL
         SELECT 'revision', id, COALESCE(label, 'Revisjon'), 'Ny revisjon av grafen', created_at, NULL FROM narrative_revisions WHERE project_id = $1
       ) a WHERE at IS NOT NULL ORDER BY at DESC LIMIT 20`,
      [projectId],
    ),
    db.query(
      `SELECT COUNT(*)::int AS n FROM role_room_project_notifications n
         LEFT JOIN role_room_project_notification_reads rd ON rd.notification_id = n.id AND rd.user_id = $2
        WHERE n.project_id = $1 AND n.archived_at IS NULL AND rd.notification_id IS NULL
          AND n.audience IN ('producer_team', 'all') AND (n.event_type LIKE 'narrative_%' OR n.linked_entity_type LIKE 'narrative_%')`,
      [projectId, userId],
    ),
    // Manusvakt (Fase 8d): ventende funn fra script-guardian-agent; tabellen kan mangle i eldre miljø → 0.
    db.query(
      `SELECT COUNT(*)::int AS pending, COUNT(*) FILTER (WHERE payload->>'severity' = 'high')::int AS high
         FROM casting_ai_suggestions WHERE project_id = $1 AND agent_name = 'script-guardian-agent' AND status = 'pending'`,
      [projectId],
    ).catch(() => ({ rows: [] as Row[] })),
    // Fase 8e: spilltest siste 7 dager — økter + scenen flest økter slutter i uten `complete`.
    db.query(
      `WITH recent AS (SELECT * FROM narrative_playtest_events WHERE project_id = $1 AND received_at > now() - interval '7 days'),
            last AS (SELECT DISTINCT ON (session_id) session_id, scene_code, event FROM recent ORDER BY session_id, received_at DESC, id DESC)
       SELECT (SELECT COUNT(DISTINCT session_id)::int FROM recent) AS sessions,
              (SELECT scene_code FROM last WHERE event <> 'complete' GROUP BY scene_code ORDER BY COUNT(*) DESC, scene_code LIMIT 1) AS worst_scene,
              (SELECT COUNT(*)::int FROM last WHERE event <> 'complete' AND scene_code = (SELECT scene_code FROM last WHERE event <> 'complete' GROUP BY scene_code ORDER BY COUNT(*) DESC, scene_code LIMIT 1)) AS worst_n`,
      [projectId],
    ).catch(() => ({ rows: [] as Row[] })),
  ]);
  const byStatus: Record<NarrativeSceneStatus, number> = { idea: 0, in_progress: 0, in_review: 0, changes_requested: 0, approved: 0, implemented: 0 };
  const byEra: Record<string, number> = {};
  let withoutDates = 0;
  for (const r of scenes.rows as Row[]) {
    const st = String(r.status) as NarrativeSceneStatus;
    if (st in byStatus) byStatus[st] += 1;
    const era = String(r.era ?? 'other');
    byEra[era] = (byEra[era] ?? 0) + 1;
    if (!r.start_at && !r.due_at) withoutDates += 1;
  }
  // Gate-totalen teller bare scener som er startet (status ≠ idea): en scene på
  // idéstadiet har ingen leveranse å gate ennå, og «6 av 204» skjuler reell fremdrift.
  const startedScenes = scenes.rows.length - byStatus.idea;
  const byKey = Object.fromEntries(NARRATIVE_GATE_KEYS.map((k) => [k, { passed: 0, total: startedScenes }])) as Record<NarrativeGateKey, { passed: number; total: number }>;
  let passed = 0; let failed = 0;
  for (const g of gates.rows as Row[]) {
    const key = String(g.gate_key) as NarrativeGateKey;
    if (g.status === 'passed') { passed += num(g.n); if (byKey[key]) byKey[key].passed += num(g.n); }
    if (g.status === 'failed') failed += num(g.n);
  }
  const now = Date.now();
  let open = 0; let overdue = 0; let done = 0;
  for (const t of tasks.rows as Row[]) {
    if (t.status === 'done') { done += 1; continue; }
    open += 1;
    const due = t.due_at ? new Date(t.due_at as string).getTime() : NaN;
    if (Number.isFinite(due) && due < now) overdue += 1;
  }
  const qOpen = (questions.rows as Row[]).find((q) => q.kind === 'question');
  const cOpen = (questions.rows as Row[]).find((q) => q.kind === 'check');
  const primary = (platform.rows as Row[])[0];
  const reqs = primary ? normalizeRequirements(primary.requirements) : [];
  return {
    scenes: { total: scenes.rows.length, byStatus, byEra, withoutDates },
    gates: { total: startedScenes * NARRATIVE_GATE_KEYS.length, passed, failed, byKey },
    tasks: { open, overdue, done },
    reviews: { open: num(reviews.rows[0]?.n) },
    lines: { total: num(lines.rows[0]?.total), approved: num(lines.rows[0]?.approved) },
    questions: { open: num(qOpen?.n), checksOpen: num(cOpen?.n) },
    guardian: { pending: num((guardian.rows as Row[])[0]?.pending), high: num((guardian.rows as Row[])[0]?.high) },
    playtest: {
      sessions7d: num((playtest.rows as Row[])[0]?.sessions),
      worstDropOff: (playtest.rows as Row[])[0]?.worst_scene ? { sceneCode: String((playtest.rows as Row[])[0].worst_scene), sessions: num((playtest.rows as Row[])[0].worst_n) } : null,
    },
    platform: { requirements: reqs.length, verified: reqs.filter((r) => r.status === 'verified').length, primaryName: primary ? String(primary.name) : null },
    milestones,
    episodes: (episodes.rows as Row[]).map((e) => ({ id: String(e.id), code: String(e.code), title: String(e.title ?? ''), sceneCount: num(e.scene_count), approvedCount: num(e.approved_count) })),
    activity: (activity.rows as Row[]).map((a) => ({
      kind: String(a.kind) as NarrativeActivityItem['kind'], id: String(a.id), title: String(a.title ?? ''), detail: String(a.detail ?? ''),
      at: isoTs(a.at), sceneId: strOrNull(a.scene_id),
    })),
    unreadInbox: num(unread.rows[0]?.n),
  };
}

// ─── Innboks (narrative-varsler over role_room_project_notifications) ──

export interface NarrativeInboxItem {
  id: string;
  eventType: string;
  title: string;
  message: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
}

function mapInboxRow(row: Row): NarrativeInboxItem {
  return {
    id: String(row.id), eventType: String(row.event_type ?? ''), title: String(row.title ?? ''), message: strOrNull(row.message),
    linkedEntityType: strOrNull(row.linked_entity_type), linkedEntityId: strOrNull(row.linked_entity_id), createdByUserId: strOrNull(row.created_by_user_id),
    createdAt: isoTs(row.created_at), updatedAt: isoTs(row.updated_at), readAt: isoTsOrNull(row.read_at),
  };
}

/**
 * Producer-varsel-ACL-en (`canReadProducerNotifications`) avviser spillstudio-
 * eiere uten film-rolle; derfor egen lesesti for narrative-hendelser,
 * gated av prosjekt-tilgangen som resten av Story Graph.
 */
export async function listInbox(db: Queryable, projectId: string, userId: string, limit = 50): Promise<NarrativeInboxItem[]> {
  const { rows } = await db.query(
    `SELECT n.*, rd.read_at FROM role_room_project_notifications n
       LEFT JOIN role_room_project_notification_reads rd ON rd.notification_id = n.id AND rd.user_id = $2
      WHERE n.project_id = $1 AND n.archived_at IS NULL
        AND n.audience IN ('producer_team', 'all') AND (n.event_type LIKE 'narrative_%' OR n.linked_entity_type LIKE 'narrative_%')
      ORDER BY n.updated_at DESC, n.created_at DESC LIMIT $3`,
    [projectId, userId, limit],
  );
  return (rows as Row[]).map(mapInboxRow);
}

export async function markInboxRead(db: Queryable, projectId: string, userId: string, notificationId: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT id FROM role_room_project_notifications WHERE id = $1 AND project_id = $2 LIMIT 1`, [notificationId, projectId]);
  if (!rows[0]) return false;
  await db.query(
    `INSERT INTO role_room_project_notification_reads (notification_id, user_id, read_at) VALUES ($1, $2, now()) ON CONFLICT (notification_id, user_id) DO NOTHING`,
    [notificationId, userId],
  );
  return true;
}

export async function markAllInboxRead(db: Queryable, projectId: string, userId: string): Promise<number> {
  const r = await db.query(
    `INSERT INTO role_room_project_notification_reads (notification_id, user_id, read_at)
       SELECT n.id, $2, now() FROM role_room_project_notifications n
        WHERE n.project_id = $1 AND n.archived_at IS NULL
          AND n.audience IN ('producer_team', 'all') AND (n.event_type LIKE 'narrative_%' OR n.linked_entity_type LIKE 'narrative_%')
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
    [projectId, userId],
  );
  return r.rowCount ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  Fase 7e-2: Gjeste-reviewere (delingslenker per runde + reviewer-sesjoner)
//  (tabeller i 0626_narrative_review_share_links.sql)
// ═══════════════════════════════════════════════════════════════════════

export type NarrativeReviewAccessMode = 'view' | 'comment' | 'approve';

export interface NarrativeReviewShareLink {
  id: string;
  projectId: string;
  sceneId: string;
  reviewId: string;
  accessMode: NarrativeReviewAccessMode;
  requireIdentity: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdBy: string;
  createdAt: string;
}

export interface NarrativeReviewerSession { id: string; shareLinkId: string; displayName: string; email: string | null }

function mapReviewShareLinkRow(row: Row): NarrativeReviewShareLink {
  return {
    id: String(row.id), projectId: String(row.project_id), sceneId: String(row.scene_id), reviewId: String(row.review_id),
    accessMode: String(row.access_mode ?? 'comment') as NarrativeReviewAccessMode, requireIdentity: row.require_identity !== false,
    expiresAt: isoTsOrNull(row.expires_at), revokedAt: isoTsOrNull(row.revoked_at), viewCount: num(row.view_count),
    createdBy: String(row.created_by ?? ''), createdAt: isoTs(row.created_at),
  };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface ReviewShareLinkInput { accessMode?: NarrativeReviewAccessMode; requireIdentity?: boolean; expiresAt?: string | null }

/** Oppretter delingslenke for en åpen runde; råtoken returneres én gang. */
export async function createReviewShareLink(
  db: Queryable, projectId: string, sceneId: string, reviewId: string, userId: string, input: ReviewShareLinkInput = {},
): Promise<{ link: NarrativeReviewShareLink; token: string } | null> {
  const { rows } = await db.query(`SELECT id, status FROM narrative_scene_reviews WHERE id = $1 AND scene_id = $2 AND project_id = $3 LIMIT 1`, [reviewId, sceneId, projectId]);
  if (!rows[0]) return null;
  if (rows[0].status === 'superseded') throw new SceneReviewClosedError('superseded');
  const token = randomBytes(32).toString('base64url');
  const inserted = await db.query(
    `INSERT INTO narrative_review_share_links (id, project_id, scene_id, review_id, token_hash, access_mode, require_identity, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [generateId('nrl'), projectId, sceneId, reviewId, sha256Hex(token), input.accessMode ?? 'comment', input.requireIdentity ?? true, input.expiresAt ?? null, userId],
  );
  return { link: mapReviewShareLinkRow(inserted.rows[0] as Row), token };
}

export async function listReviewShareLinks(db: Queryable, projectId: string, sceneId: string, reviewId: string): Promise<NarrativeReviewShareLink[]> {
  const { rows } = await db.query(
    `SELECT * FROM narrative_review_share_links WHERE project_id = $1 AND scene_id = $2 AND review_id = $3 ORDER BY created_at DESC`,
    [projectId, sceneId, reviewId],
  );
  return (rows as Row[]).map(mapReviewShareLinkRow);
}

export async function revokeReviewShareLink(db: Queryable, projectId: string, sceneId: string, reviewId: string, linkId: string): Promise<boolean> {
  const r = await db.query(
    `UPDATE narrative_review_share_links SET revoked_at = now() WHERE id = $1 AND project_id = $2 AND scene_id = $3 AND review_id = $4 AND revoked_at IS NULL RETURNING id`,
    [linkId, projectId, sceneId, reviewId],
  );
  return (r.rowCount ?? 0) > 0;
}

export interface ResolvedReviewShare {
  link: NarrativeReviewShareLink;
  review: NarrativeSceneReview;
  /** Runde-snapshotet slik det ble frosset (v1/v2). */
  snapshot: SceneSnapshot;
  sceneStatus: NarrativeSceneStatus;
  sceneTitle: string;
  sceneCode: string;
}

/** Ugyldig, utløpt og tilbakekalt gir null (ingen lekkasje av hvilken). */
export async function resolveReviewShare(db: Queryable, token: string): Promise<ResolvedReviewShare | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db.query(
    `SELECT l.*, r.snapshot AS review_snapshot, r.round, r.status AS review_status, r.requested_by, r.requested_at, r.request_note,
            r.decided_by_user_id, r.decided_by_label, r.decided_at, r.decision_note, r.snapshot_hash, r.created_at AS review_created_at, r.updated_at AS review_updated_at,
            s.status AS scene_status, s.title AS scene_title, s.code AS scene_code
       FROM narrative_review_share_links l
       JOIN narrative_scene_reviews r ON r.id = l.review_id
       JOIN narrative_scenes s ON s.id = l.scene_id
      WHERE l.token_hash = $1 AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > now())
      LIMIT 1`,
    [sha256Hex(token)],
  );
  const row = rows[0] as Row | undefined;
  if (!row) return null;
  const link = mapReviewShareLinkRow(row);
  const review = mapSceneReviewRow({
    id: row.review_id, scene_id: row.scene_id, project_id: row.project_id, round: row.round, status: row.review_status, requested_by: row.requested_by,
    requested_at: row.requested_at, request_note: row.request_note, decided_by_user_id: row.decided_by_user_id, decided_by_label: row.decided_by_label,
    decided_at: row.decided_at, decision_note: row.decision_note, snapshot_hash: row.snapshot_hash,
  });
  return {
    link, review, snapshot: jsonObject(row.review_snapshot) as unknown as SceneSnapshot,
    sceneStatus: String(row.scene_status ?? 'idea') as NarrativeSceneStatus, sceneTitle: String(row.scene_title ?? ''), sceneCode: String(row.scene_code ?? ''),
  };
}

export async function bumpReviewShareViews(db: Queryable, linkId: string): Promise<void> {
  await db.query(`UPDATE narrative_review_share_links SET view_count = view_count + 1 WHERE id = $1`, [linkId]).catch(() => undefined);
}

export async function createReviewerSession(db: Queryable, shareLinkId: string, displayName: string, email: string | null): Promise<{ session: NarrativeReviewerSession; reviewerToken: string }> {
  const reviewerToken = randomBytes(32).toString('base64url');
  const { rows } = await db.query(
    `INSERT INTO narrative_review_sessions (id, share_link_id, reviewer_token_hash, display_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING id, share_link_id, display_name, email`,
    [generateId('nrs'), shareLinkId, sha256Hex(reviewerToken), displayName, email],
  );
  const r = rows[0] as Row;
  return { session: { id: String(r.id), shareLinkId: String(r.share_link_id), displayName: String(r.display_name), email: strOrNull(r.email) }, reviewerToken };
}

export async function resolveReviewer(db: Queryable, shareLinkId: string, reviewerToken: string | undefined): Promise<NarrativeReviewerSession | null> {
  if (!reviewerToken || reviewerToken.length > 200) return null;
  const { rows } = await db.query(
    `UPDATE narrative_review_sessions SET last_seen_at = now() WHERE share_link_id = $1 AND reviewer_token_hash = $2 RETURNING id, share_link_id, display_name, email`,
    [shareLinkId, sha256Hex(reviewerToken)],
  );
  const r = rows[0] as Row | undefined;
  return r ? { id: String(r.id), shareLinkId: String(r.share_link_id), displayName: String(r.display_name), email: strOrNull(r.email) } : null;
}
