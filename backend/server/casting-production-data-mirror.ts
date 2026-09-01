import type { Pool } from "pg";

type JsonRecord = Record<string, unknown>;

export class NormalizedSceneIdentityConflictError extends Error {
  constructor(readonly sceneId: string) {
    super("normalized_scene_identity_conflict");
    this.name = "NormalizedSceneIdentityConflictError";
  }
}

export class NormalizedManuscriptIdentityConflictError extends Error {
  constructor(readonly manuscriptId: string) {
    super("normalized_manuscript_identity_conflict");
    this.name = "NormalizedManuscriptIdentityConflictError";
  }
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function integer(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return fallback;
}

function jsonObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Storyboard Room clients persist screenplay blobs through the compat API,
 * while the production-aware Prompt Engine reads normalized tables. Keep both
 * views in sync so web, iPad and AI orchestration share the same scene truth.
 */
export async function mirrorManuscriptToProductionTables(
  pool: Pool,
  manuscript: JsonRecord,
): Promise<void> {
  const id = text(manuscript.id);
  const projectId = text(manuscript.projectId, manuscript.project_id);
  const title = text(manuscript.title, "Untitled manuscript");
  if (!id || !projectId) throw new Error("normalized_manuscript_identity_required");

  const mirrored = await pool.query<{ id: string }>(
    `INSERT INTO casting_manuscripts
       (id, project_id, title, format, content, version, status, metadata,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       title = EXCLUDED.title,
       format = EXCLUDED.format,
       content = EXCLUDED.content,
       version = EXCLUDED.version,
       status = EXCLUDED.status,
       metadata = COALESCE(casting_manuscripts.metadata, '{}'::jsonb)
         || EXCLUDED.metadata,
       updated_at = NOW()
     WHERE casting_manuscripts.project_id = EXCLUDED.project_id
     RETURNING id`,
    [
      id,
      projectId,
      title,
      text(manuscript.format) || null,
      text(manuscript.content) || null,
      integer(manuscript.version, 1) ?? 1,
      text(manuscript.status) || "draft",
      JSON.stringify({
        subtitle: text(manuscript.subtitle) || null,
        author: text(manuscript.author) || null,
        language: text(manuscript.language) || null,
        source: "casting_compat_api",
      }),
    ],
  );
  if (mirrored.rows.length !== 1) {
    throw new NormalizedManuscriptIdentityConflictError(id);
  }
}

export async function mirrorSceneToProductionTables(
  pool: Pool,
  scene: JsonRecord,
  projectId: string,
): Promise<void> {
  const id = text(scene.id);
  const manuscriptId = text(scene.manuscriptId, scene.manuscript_id);
  if (!id || !manuscriptId || !projectId) {
    throw new Error("normalized_scene_identity_required");
  }

  const location = text(scene.locationName, scene.location, scene.setting);
  const props = jsonArray(scene.propsNeeded).map((value) => ({ name: text(value) }));
  const submittedBreakdown = jsonObject(
    scene.productionBreakdown ?? scene.production_breakdown,
  );
  const productionBreakdown = {
    ...submittedBreakdown,
    ...(location && !Array.isArray(submittedBreakdown.locations)
      ? { locations: [{ name: location }] }
      : {}),
    ...(props.length && !Array.isArray(submittedBreakdown.props) ? { props } : {}),
  };

  const mirrored = await pool.query<{ id: string }>(
    `INSERT INTO casting_scenes
       (id, project_id, manuscript_id, act_id, scene_number, title,
        description, setting, time_of_day, int_ext, characters,
        production_breakdown, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11::jsonb, $12::jsonb, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       manuscript_id = EXCLUDED.manuscript_id,
       act_id = EXCLUDED.act_id,
       scene_number = EXCLUDED.scene_number,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       setting = EXCLUDED.setting,
       time_of_day = EXCLUDED.time_of_day,
       int_ext = EXCLUDED.int_ext,
       characters = EXCLUDED.characters,
       production_breakdown = EXCLUDED.production_breakdown,
       updated_at = NOW()
     WHERE casting_scenes.project_id = EXCLUDED.project_id
       AND casting_scenes.manuscript_id IS NOT DISTINCT FROM EXCLUDED.manuscript_id
     RETURNING id`,
    [
      id,
      projectId,
      manuscriptId,
      text(scene.actId, scene.act_id) || null,
      integer(scene.sceneNumber ?? scene.scene_number),
      text(scene.sceneHeading, scene.heading, scene.title, scene.sceneName) || null,
      text(scene.description, scene.action) || null,
      location || null,
      text(scene.timeOfDay, scene.time_of_day) || null,
      text(scene.intExt, scene.int_ext) || null,
      JSON.stringify(jsonArray(scene.characters).map((value) => text(value)).filter(Boolean)),
      JSON.stringify(productionBreakdown),
    ],
  );
  // A scene id is globally unique in the normalized table. Never let a
  // client-generated compat id move an existing row across a tenant or
  // manuscript boundary; the conditional conflict update is race-safe.
  if (mirrored.rows.length !== 1) {
    throw new NormalizedSceneIdentityConflictError(id);
  }
}
