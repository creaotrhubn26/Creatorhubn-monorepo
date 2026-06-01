/**
 * dance_annotation_catalog — categories + labels for DanceAnnotate.
 *
 * Schema: migrasjon 217. Speilet etter dance-formation-service.ts-pattern.
 *
 * Auto-seed: når listCategories(owner, project=NULL) returnerer tom liste,
 * seedes 5 defaults (steps/arms/body/jumps/turns) med farger + keybinds
 * 1-5. Labels seedes IKKE — brukeren legger til ved behov.
 */
import type { Pool } from 'pg';

export interface AnnotationCategoryRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  name: string;
  color: string;
  shortcut: string | null;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationCategoryInput {
  name: string;
  color: string;
  shortcut?: string | null;
  sortOrder?: number;
  projectId?: string | null;
  isDefault?: boolean;
}

export type AnnotationCategoryPatch = Partial<AnnotationCategoryInput>;

export interface AnnotationLabelRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  categoryId: string | null;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationLabelInput {
  name: string;
  categoryId?: string | null;
  sortOrder?: number;
  projectId?: string | null;
  isDefault?: boolean;
}

export type AnnotationLabelPatch = Partial<AnnotationLabelInput>;

// ─── Helpers ────────────────────────────────────────────────────────────

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function asNumberOr(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function generateId(prefix: string): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapCategory(row: Record<string, unknown>): AnnotationCategoryRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    name: String(row.name),
    color: String(row.color),
    shortcut: row.shortcut == null ? null : String(row.shortcut),
    sortOrder: asNumberOr(row.sort_order, 0),
    isDefault: row.is_default === true,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapLabel(row: Record<string, unknown>): AnnotationLabelRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    categoryId: row.category_id == null ? null : String(row.category_id),
    name: String(row.name),
    sortOrder: asNumberOr(row.sort_order, 0),
    isDefault: row.is_default === true,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

// ─── Defaults (auto-seed) ──────────────────────────────────────────────

interface DefaultCategorySeed {
  id: string;
  name: string;
  color: string;
  shortcut: string;
  sortOrder: number;
}

const DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
  { id: 'steps', name: 'Steps', color: '#a78bfa', shortcut: '1', sortOrder: 1 },
  { id: 'arms',  name: 'Arms',  color: '#34d399', shortcut: '2', sortOrder: 2 },
  { id: 'body',  name: 'Body',  color: '#fbbf24', shortcut: '3', sortOrder: 3 },
  { id: 'jumps', name: 'Jumps', color: '#60a5fa', shortcut: '4', sortOrder: 4 },
  { id: 'turns', name: 'Turns', color: '#f472b6', shortcut: '5', sortOrder: 5 },
];

async function seedDefaultCategoriesIfMissing(
  pool: Pool,
  ownerUserId: string,
): Promise<void> {
  // Sjekk om defaults allerede er seedet for denne owner.
  const { rows } = await pool.query(
    `SELECT id FROM dance_annotation_category
     WHERE owner_user_id = $1 AND project_id IS NULL AND is_default = true
     LIMIT 1`,
    [ownerUserId],
  );
  if (rows.length > 0) return;

  // ON CONFLICT DO NOTHING så concurrent seeding ikke krasjer.
  for (const d of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO dance_annotation_category
        (id, owner_user_id, project_id, name, color, shortcut, sort_order, is_default)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO NOTHING`,
      [`${d.id}_${ownerUserId}`, ownerUserId, d.name, d.color, d.shortcut, d.sortOrder],
    );
  }
}

// ─── Categories CRUD ────────────────────────────────────────────────────

export interface ListCategoriesOptions {
  projectId?: string | null;
  /** Inkluder defaults selv om de er global (project_id IS NULL). Default true. */
  includeDefaults?: boolean;
}

export async function listAnnotationCategories(
  pool: Pool,
  ownerUserId: string,
  options: ListCategoriesOptions = {},
): Promise<AnnotationCategoryRecord[]> {
  // Auto-seed defaults ved første access (idempotent — kun første call inserter).
  await seedDefaultCategoriesIfMissing(pool, ownerUserId);

  const includeDefaults = options.includeDefaults !== false;
  const projectFilter = typeof options.projectId === 'string' && options.projectId.length > 0
    ? options.projectId
    : null;

  let sql: string;
  let params: unknown[];

  if (projectFilter) {
    // Prosjekt-spesifikke + (valgfritt) globale defaults.
    if (includeDefaults) {
      sql = `SELECT * FROM dance_annotation_category
             WHERE owner_user_id = $1
               AND (project_id = $2 OR project_id IS NULL)
             ORDER BY is_default DESC, sort_order ASC, name ASC`;
      params = [ownerUserId, projectFilter];
    } else {
      sql = `SELECT * FROM dance_annotation_category
             WHERE owner_user_id = $1 AND project_id = $2
             ORDER BY sort_order ASC, name ASC`;
      params = [ownerUserId, projectFilter];
    }
  } else {
    sql = `SELECT * FROM dance_annotation_category
           WHERE owner_user_id = $1 AND project_id IS NULL
           ORDER BY is_default DESC, sort_order ASC, name ASC`;
    params = [ownerUserId];
  }

  const { rows } = await pool.query(sql, params);
  return rows.map(mapCategory);
}

export async function createAnnotationCategory(
  pool: Pool,
  ownerUserId: string,
  input: AnnotationCategoryInput,
): Promise<AnnotationCategoryRecord> {
  const id = generateId('annc');
  const { rows } = await pool.query(
    `INSERT INTO dance_annotation_category
      (id, owner_user_id, project_id, name, color, shortcut, sort_order, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      ownerUserId,
      input.projectId ?? null,
      input.name,
      input.color,
      input.shortcut ?? null,
      input.sortOrder ?? 0,
      input.isDefault === true,
    ],
  );
  return mapCategory(rows[0]);
}

export async function patchAnnotationCategory(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: AnnotationCategoryPatch,
): Promise<AnnotationCategoryRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) push('name', patch.name);
  if (patch.color !== undefined) push('color', patch.color);
  if (patch.shortcut !== undefined) push('shortcut', patch.shortcut);
  if (patch.sortOrder !== undefined) push('sort_order', patch.sortOrder);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_annotation_category WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length === 0 ? null : mapCategory(rows[0]);
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_annotation_category
     SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapCategory(rows[0]);
}

export type DeleteCategoryResult = 'deleted' | 'not_found' | 'default_protected';

export async function deleteAnnotationCategory(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<DeleteCategoryResult> {
  // Sjekk is_default — defaults kan ikke slettes (kun navn/farge endres)
  const { rows: existing } = await pool.query(
    `SELECT is_default FROM dance_annotation_category
     WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  if (existing.length === 0) return 'not_found';
  if (existing[0].is_default === true) return 'default_protected';

  // Slett tilhørende labels også (orphan-cleanup).
  await pool.query(
    `DELETE FROM dance_annotation_label
     WHERE owner_user_id = $1 AND category_id = $2`,
    [ownerUserId, id],
  );
  const { rowCount } = await pool.query(
    `DELETE FROM dance_annotation_category
     WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0 ? 'deleted' : 'not_found';
}

// ─── Labels CRUD ────────────────────────────────────────────────────────

export interface ListLabelsOptions {
  projectId?: string | null;
  categoryId?: string | null;
  /** Inkluder globale labels (project_id IS NULL). Default true. */
  includeGlobals?: boolean;
}

export async function listAnnotationLabels(
  pool: Pool,
  ownerUserId: string,
  options: ListLabelsOptions = {},
): Promise<AnnotationLabelRecord[]> {
  const includeGlobals = options.includeGlobals !== false;
  const projectFilter = typeof options.projectId === 'string' && options.projectId.length > 0
    ? options.projectId
    : null;
  const categoryFilter = typeof options.categoryId === 'string' && options.categoryId.length > 0
    ? options.categoryId
    : null;

  const where: string[] = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];

  if (projectFilter) {
    if (includeGlobals) {
      params.push(projectFilter);
      where.push(`(project_id = $${params.length} OR project_id IS NULL)`);
    } else {
      params.push(projectFilter);
      where.push(`project_id = $${params.length}`);
    }
  } else {
    where.push(`project_id IS NULL`);
  }

  if (categoryFilter) {
    params.push(categoryFilter);
    where.push(`(category_id = $${params.length} OR category_id IS NULL)`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM dance_annotation_label
     WHERE ${where.join(' AND ')}
     ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return rows.map(mapLabel);
}

export async function createAnnotationLabel(
  pool: Pool,
  ownerUserId: string,
  input: AnnotationLabelInput,
): Promise<AnnotationLabelRecord> {
  const id = generateId('annl');
  const { rows } = await pool.query(
    `INSERT INTO dance_annotation_label
      (id, owner_user_id, project_id, category_id, name, sort_order, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      ownerUserId,
      input.projectId ?? null,
      input.categoryId ?? null,
      input.name,
      input.sortOrder ?? 0,
      input.isDefault === true,
    ],
  );
  return mapLabel(rows[0]);
}

export async function patchAnnotationLabel(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: AnnotationLabelPatch,
): Promise<AnnotationLabelRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) push('name', patch.name);
  if (patch.categoryId !== undefined) push('category_id', patch.categoryId);
  if (patch.sortOrder !== undefined) push('sort_order', patch.sortOrder);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_annotation_label WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length === 0 ? null : mapLabel(rows[0]);
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_annotation_label
     SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapLabel(rows[0]);
}

export async function deleteAnnotationLabel(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_annotation_label WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}
