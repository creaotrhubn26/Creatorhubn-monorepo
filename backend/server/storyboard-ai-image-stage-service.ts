import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  normalizeShotFramingState,
  shotFramingFingerprint,
  type ShotFramingState,
} from "../../frontend/shared/storyboard-shot-framing.js";
import {
  decodeStoryboardImageData,
  generateStoryboardImage,
  prepareStoryboardImageGeneration,
  StoryboardImageGenerationError,
  StoryboardImageProviderOutcomeUnknownError,
  type GeneratedStoryboardImage,
  type StoryboardImageGenerationBody,
} from "./storyboard-ai-image-service.js";
import {
  StoryboardPaintoverCompositeError,
  storyboardPaintoverBindingState,
  validateStoryboardPaintoverCompositeBinding,
  validateStoryboardPaintoverCompositeImage,
  type ValidatedStoryboardPaintoverComposite,
} from "./storyboard-paintover-composite.js";
import {
  storyboardPaintoverStateForFrame,
} from "./storyboard-paintover-contract.js";
import {
  getStoryboard,
  type Storyboard,
} from "./storyboard-service.js";

export type StoryboardAIImageStage = "pencil" | "color" | "atmosphere";
export type StoryboardAIImageVersionStatus =
  | "source"
  | "generated"
  | "approved"
  | "stale";

export interface StoryboardAIImageVersion {
  id: string;
  projectId: string;
  storyboardId: string;
  stage: StoryboardAIImageStage;
  parentVersionId: string | null;
  status: StoryboardAIImageVersionStatus;
  sourceFingerprint: string;
  compilationFingerprint: string | null;
  imageData: string;
  width: number | null;
  height: number | null;
  model: string | null;
  quality: string | null;
  metadata: Record<string, unknown>;
  /** Source revision this candidate was rendered from. */
  sourceRevision: number | null;
  /** Present on approval responses after authoritative adoption. */
  currentSourceRevision?: number;
  /** New compat-frame OCC token written by the approval transaction. */
  adoptedFrameUpdatedAt?: string;
  /** Stable Pencil/camera source token; approval/comments do not advance it. */
  sourceUpdatedAt?: string;
  createdBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface StoryboardAIImageVersionList {
  versions: StoryboardAIImageVersion[];
  currentSourceRevision: number;
  compatFrameUpdatedAt: string | null;
  sourceUpdatedAt: string | null;
}

export class StoryboardAIImageStageError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly safeDetail: string,
  ) {
    super(code);
  }
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function metadataText(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataSourceCompatToken(
  metadata: Record<string, unknown>,
): string | null {
  return metadataText(metadata, "compatSourceUpdatedAt")
    ?? metadataText(metadata, "sourceCompatFrameUpdatedAt")
    ?? metadataText(metadata, "adoptedFrameUpdatedAt")
    ?? metadataText(metadata, "compatFrameUpdatedAt");
}

function metadataRevision(metadata: Record<string, unknown>): number {
  const value = metadata.sourceRevision;
  const number = typeof value === "number" ? value
    : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

/** Authoritative drawing/camera revision exposed to native candidate review. */
export function storyboardSourceRevision(metadata: unknown): number {
  return metadataRevision(jsonObject(metadata));
}

function optionalMetadataRevision(
  metadata: Record<string, unknown>,
  key = "sourceRevision",
): number | null {
  const value = metadata[key];
  const number = typeof value === "number" ? value
    : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function requiredContextRasterPlacementFraming(
  body: StoryboardImageGenerationBody,
): ShotFramingState {
  const framing = normalizeShotFramingState(body.context?.shot.shotFraming);
  if (!framing) {
    throw new StoryboardAIImageStageError(
      409,
      "framing_context_required",
      "Det anvendte utsnittet mangler. Synk shotet og prøv igjen før AI-generering.",
    );
  }
  return framing;
}

function requiredContextFramingFingerprint(
  body: StoryboardImageGenerationBody,
): string {
  return shotFramingFingerprint(
    requiredContextRasterPlacementFraming(body),
  )!;
}

function mapVersion(row: Record<string, unknown>): StoryboardAIImageVersion {
  const metadata = jsonObject(row.metadata);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    storyboardId: String(row.storyboard_id),
    stage: String(row.stage) as StoryboardAIImageStage,
    parentVersionId: row.parent_version_id ? String(row.parent_version_id) : null,
    status: String(row.status) as StoryboardAIImageVersionStatus,
    sourceFingerprint: String(row.source_fingerprint),
    compilationFingerprint: row.compilation_fingerprint
      ? String(row.compilation_fingerprint) : null,
    imageData: String(row.image_data),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    model: row.model ? String(row.model) : null,
    quality: row.quality ? String(row.quality) : null,
    metadata,
    sourceRevision: optionalMetadataRevision(metadata),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: iso(row.approved_at),
  };
}

export interface CompatFrameSource {
  manuscriptId: string;
  sceneId: string;
  frameId: string;
  frameUpdatedAt: string;
  sourceUpdatedAt: string;
  framingFingerprint: string;
  paintoverState: unknown;
  /**
   * Server-authoritative compat document used by downstream transactional
   * bindings (for example camera motion + duration). This is never serialized
   * to an API response and callers must treat it as immutable.
   */
  frameDocument: Readonly<Record<string, unknown>>;
}

function findCompatFrame(
  scenesValue: unknown,
  sceneId: string,
  frameId: string,
): {
  scenes: Record<string, unknown>[];
  sceneIndex: number;
  frameIndex: number;
  frame: Record<string, unknown>;
} | null {
  const scenes = jsonArray(scenesValue).filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
  );
  const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);
  if (sceneIndex < 0) return null;
  const scene = scenes[sceneIndex];
  const frames = jsonArray(scene.storyboardFrames).filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
  );
  const frameIndex = frames.findIndex((frame) => frame.id === frameId);
  if (frameIndex < 0) return null;
  return { scenes, sceneIndex, frameIndex, frame: frames[frameIndex] };
}

function compatFrameRasterPlacementFraming(
  frame: Record<string, unknown>,
): ShotFramingState | null {
  const drawingData = jsonObject(frame.drawingData);
  const width = Number(drawingData.width);
  const height = Number(drawingData.height);
  const legacyFraming = {
    version: 1,
    shotSize: frame.shotType,
    angle: frame.angle,
    lensMm: frame.lensMm,
    aspectRatio: Number.isFinite(width) && width > 0
      && Number.isFinite(height) && height > 0
      ? width / height : 16 / 9,
  };
  return normalizeShotFramingState(frame.shotFraming ?? legacyFraming) ?? null;
}

function compatFrameFramingFingerprint(
  frame: Record<string, unknown>,
): string | null {
  return shotFramingFingerprint(
    compatFrameRasterPlacementFraming(frame),
  ) ?? null;
}

async function readCompatFrameSource(
  pool: Pool | PoolClient,
  storyboard: Storyboard,
  expectedFramingFingerprint: string,
): Promise<CompatFrameSource> {
  if (!storyboard.sceneId || !storyboard.frameId) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_source_missing",
      "Storyboard-panelet mangler kobling til manuskriptshotet. Synk og prøv igjen.",
    );
  }
  const selected = await pool.query(
    `SELECT scene.manuscript_id, compat.store_value
       FROM casting_scenes scene
       JOIN legacy_compat_store compat
         ON compat.store_key = 'casting:scenes:' || scene.manuscript_id::text
      WHERE scene.id=$1 AND scene.project_id=$2
      LIMIT 1`,
    [storyboard.sceneId, storyboard.projectId],
  );
  const manuscriptId = selected.rows[0]?.manuscript_id
    ? String(selected.rows[0].manuscript_id) : "";
  const located = findCompatFrame(
    selected.rows[0]?.store_value,
    storyboard.sceneId,
    storyboard.frameId,
  );
  const frameUpdatedAt = located?.frame.updatedAt;
  const sourceUpdatedAt = located?.frame.sourceUpdatedAt
    ?? frameUpdatedAt;
  const framingFingerprint = located
    ? compatFrameFramingFingerprint(located.frame) : null;
  if (!manuscriptId || !located || typeof frameUpdatedAt !== "string"
      || !frameUpdatedAt.trim() || typeof sourceUpdatedAt !== "string"
      || !sourceUpdatedAt.trim()
      || framingFingerprint !== expectedFramingFingerprint) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_source_stale",
      "Manuskriptshotet er ikke synket med AI-konteksten. Synk og generer på nytt.",
    );
  }
  return {
    manuscriptId,
    sceneId: storyboard.sceneId,
    frameId: storyboard.frameId,
    frameUpdatedAt: frameUpdatedAt.trim(),
    sourceUpdatedAt: sourceUpdatedAt.trim(),
    framingFingerprint,
    paintoverState: located.frame.aiPaintoverState,
    frameDocument: located.frame,
  };
}

export interface StoryboardGenerationSnapshot {
  storyboard: Storyboard;
  sourceRevision: number;
  framingFingerprint: string;
  compatSource: CompatFrameSource;
}

/**
 * Verify the exact frame acknowledgement before cost reservation/provider IO.
 * The normalized revision protects the drawing raster/strokes; the compat
 * token protects the manuscript frame and camera/layer sidecars.
 */
export async function validateStoryboardGenerationSnapshot(
  pool: Pool,
  input: {
    storyboard: Storyboard;
    body: StoryboardImageGenerationBody;
  },
): Promise<StoryboardGenerationSnapshot> {
  const expectedSourceRevision = input.body.expectedSourceRevision;
  const expectedCompatFrameUpdatedAt =
    input.body.expectedCompatFrameUpdatedAt?.trim();
  if (expectedSourceRevision == null || !expectedCompatFrameUpdatedAt) {
    throw new StoryboardAIImageStageError(
      409,
      "source_snapshot_required",
      "Lagre og synk panelet før AI-generering.",
    );
  }
  const storyboard = await getStoryboard(pool, input.storyboard.id);
  if (!storyboard || storyboard.projectId !== input.storyboard.projectId
      || storyboard.frameId !== input.storyboard.frameId) {
    throw new StoryboardAIImageStageError(
      409,
      "source_snapshot_stale",
      "Storyboard-panelet ble endret eller fjernet. Last inn på nytt.",
    );
  }
  const framingFingerprint = requiredContextFramingFingerprint(input.body);
  const authoritativeFraming = metadataText(
    storyboard.metadata,
    "currentFramingFingerprint",
  );
  const sourceRevision = metadataRevision(storyboard.metadata);
  if (expectedSourceRevision !== sourceRevision
      || (authoritativeFraming
        && authoritativeFraming !== framingFingerprint)) {
    throw new StoryboardAIImageStageError(
      409,
      "source_snapshot_stale",
      "Panelet eller utsnittet ble endret. Synk og prøv igjen før AI-generering.",
    );
  }
  const compatSource = await readCompatFrameSource(
    pool,
    storyboard,
    framingFingerprint,
  );
  const mirroredSourceUpdatedAt = metadataText(
    storyboard.metadata,
    "compatSourceUpdatedAt",
  ) ?? metadataText(storyboard.metadata, "compatFrameUpdatedAt");
  if (compatSource.sourceUpdatedAt !== expectedCompatFrameUpdatedAt
      || mirroredSourceUpdatedAt !== compatSource.sourceUpdatedAt) {
    throw new StoryboardAIImageStageError(
      409,
      "source_snapshot_stale",
      "Shotet ble endret på en annen enhet. Synk og prøv igjen før AI-generering.",
    );
  }
  return { storyboard, sourceRevision, framingFingerprint, compatSource };
}

/**
 * Fail closed when the normalized storyboard mirror and live manuscript frame
 * disagree. Used immediately before video preflight/submission so a partial
 * compat commit can never spend video credits from stale approval metadata.
 */
export async function validateStoryboardCompatMirror(
  pool: Pool,
  input: { storyboard: Storyboard; shotFraming: unknown },
): Promise<StoryboardGenerationSnapshot> {
  const storyboard = await getStoryboard(pool, input.storyboard.id);
  if (!storyboard || storyboard.projectId !== input.storyboard.projectId
      || storyboard.frameId !== input.storyboard.frameId) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_mirror_stale",
      "Storyboard-panelet ble endret. Last inn på nytt før animasjon.",
    );
  }
  const framingFingerprint = shotFramingFingerprint(input.shotFraming);
  if (!framingFingerprint) {
    throw new StoryboardAIImageStageError(
      409,
      "framing_context_required",
      "Synk det anvendte kamerautsnittet før animasjon.",
    );
  }
  const compatSource = await readCompatFrameSource(
    pool,
    storyboard,
    framingFingerprint,
  );
  const mirroredSourceToken = metadataText(
    storyboard.metadata,
    "compatSourceUpdatedAt",
  ) ?? metadataText(storyboard.metadata, "compatFrameUpdatedAt");
  if (!mirroredSourceToken
      || mirroredSourceToken !== compatSource.sourceUpdatedAt) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_mirror_stale",
      "Manuskriptshotet er nyere enn AI-godkjenningen. Synk og regenerer før animasjon.",
    );
  }
  return {
    storyboard,
    sourceRevision: metadataRevision(storyboard.metadata),
    framingFingerprint,
    compatSource,
  };
}

/**
 * Final paid-video CAS. Caller must already hold the normalized storyboard row
 * lock; this acquires the shared compat advisory lock in the same global order
 * as image approval and blocks source edits through provider submission.
 */
export async function lockAndValidateStoryboardCompatSource(
  client: PoolClient,
  input: {
    storyboard: Storyboard;
    expectedSourceUpdatedAt: string;
    expectedFramingFingerprint: string;
  },
): Promise<CompatFrameSource> {
  if (!input.storyboard.sceneId) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_source_missing",
      "Storyboard-panelet mangler manuskriptkobling.",
    );
  }
  const scene = await client.query(
    `SELECT manuscript_id FROM casting_scenes
      WHERE id=$1 AND project_id=$2 LIMIT 1`,
    [input.storyboard.sceneId, input.storyboard.projectId],
  );
  const manuscriptId = scene.rows[0]?.manuscript_id
    ? String(scene.rows[0].manuscript_id) : "";
  if (!manuscriptId) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_source_missing",
      "Storyboard-panelet mangler manuskriptkobling.",
    );
  }
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`casting:scenes:${manuscriptId}`],
  );
  const source = await readCompatFrameSource(
    client,
    input.storyboard,
    input.expectedFramingFingerprint,
  );
  if (source.manuscriptId !== manuscriptId
      || source.sourceUpdatedAt !== input.expectedSourceUpdatedAt) {
    throw new StoryboardAIImageStageError(
      409,
      "compat_source_stale",
      "Storyboard-kilden ble endret etter forhåndskontrollen.",
    );
  }
  return source;
}

export async function ensureStoryboardAIImageStageSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_image_versions (
    id uuid PRIMARY KEY, project_id varchar(255) NOT NULL,
    storyboard_id uuid NOT NULL REFERENCES casting_storyboards(id) ON DELETE CASCADE,
    stage varchar(24) NOT NULL, parent_version_id uuid,
    status varchar(24) NOT NULL DEFAULT 'generated',
    source_fingerprint varchar(64) NOT NULL, compilation_fingerprint varchar(64),
    image_data text NOT NULL, width integer, height integer,
    model varchar(100), quality varchar(30), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by varchar(255), created_at timestamptz NOT NULL DEFAULT now(),
    approved_by varchar(255), approved_at timestamptz)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS storyboard_ai_image_versions_storyboard_idx
    ON storyboard_ai_image_versions (storyboard_id, created_at DESC)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_versions_approved_idx
    ON storyboard_ai_image_versions (storyboard_id, stage) WHERE status = 'approved'`);
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_image_operations (
    id uuid PRIMARY KEY, project_id varchar(255) NOT NULL,
    storyboard_id uuid NOT NULL REFERENCES casting_storyboards(id) ON DELETE CASCADE,
    stage varchar(24) NOT NULL, idempotency_key varchar(200) NOT NULL,
    operation_fingerprint varchar(64) NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'claimed', reservation_id uuid,
    version_id uuid REFERENCES storyboard_ai_image_versions(id) ON DELETE SET NULL,
    response jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(), lease_expires_at timestamptz,
    UNIQUE (project_id, storyboard_id, stage, idempotency_key))`);
  await pool.query(`ALTER TABLE storyboard_ai_image_operations
    ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz`);
  await pool.query(`CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_status_idx
    ON storyboard_ai_image_operations (status, updated_at)`);
}

async function latestVersion(
  pool: Pool | PoolClient,
  storyboardId: string,
  stage: StoryboardAIImageStage,
  statuses?: StoryboardAIImageVersionStatus[],
): Promise<StoryboardAIImageVersion | null> {
  const params: unknown[] = [storyboardId, stage];
  const statusClause = statuses?.length
    ? ` AND status = ANY($3::varchar[])` : "";
  if (statuses?.length) params.push(statuses);
  const result = await pool.query(
    `SELECT * FROM storyboard_ai_image_versions
       WHERE storyboard_id=$1 AND stage=$2${statusClause}
       ORDER BY created_at DESC LIMIT 1`,
    params,
  );
  return result.rows[0] ? mapVersion(result.rows[0]) : null;
}

type PencilSourceInput = {
  storyboard: Storyboard;
  projectId: string;
  userId: string;
  framingFingerprint: string;
  sourceRevision: number;
  compatSource: CompatFrameSource;
};

function isActiveAIOutput(storyboard: Storyboard): boolean {
  const workflow = storyboard.workflowLevel ?? "";
  return workflow === "ai-color-approved"
    || workflow === "ai-atmosphere-approved"
    || workflow.startsWith("animation-source-ai-");
}

function pencilVersionMatchesSource(
  existing: StoryboardAIImageVersion | null,
  input: PencilSourceInput,
): existing is StoryboardAIImageVersion {
  return Boolean(existing
    && existing.sourceFingerprint
    && optionalMetadataRevision(existing.metadata) === input.sourceRevision
    && metadataText(existing.metadata, "framingFingerprint")
      === input.framingFingerprint
    && metadataText(existing.metadata, "compatManuscriptId")
      === input.compatSource.manuscriptId
    && metadataText(existing.metadata, "compatSceneId")
      === input.compatSource.sceneId
    && metadataText(existing.metadata, "compatFrameId")
      === input.compatSource.frameId
    && metadataSourceCompatToken(existing.metadata)
      === input.compatSource.sourceUpdatedAt);
}

type StoryboardAIImageParentPreflight = {
  id: string | null;
  stage: "pencil" | "color";
  imageData: string;
  sourceFingerprint: string;
};

/** Read-only parent resolution used before credits/cost are reserved. */
async function inspectAuthoritativeParent(
  pool: Pool,
  input: PencilSourceInput & { stage: "color" | "atmosphere" },
): Promise<StoryboardAIImageParentPreflight> {
  if (input.stage === "atmosphere") {
    const approvedColor = await latestVersion(
      pool, input.storyboard.id, "color", ["approved"],
    );
    if (!approvedColor) {
      throw new StoryboardAIImageStageError(
        409,
        "approved_color_required",
        "Godkjenn en AI-generert fargeversjon før atmosfære genereres.",
      );
    }
    const parentFraming = metadataText(
      approvedColor.metadata, "framingFingerprint",
    );
    const parentRevision = optionalMetadataRevision(approvedColor.metadata);
    if (parentFraming !== input.framingFingerprint
        || parentRevision !== input.sourceRevision
        || metadataSourceCompatToken(approvedColor.metadata)
          !== input.compatSource.sourceUpdatedAt) {
      throw new StoryboardAIImageStageError(
        409,
        "approved_color_source_stale",
        "Godkjent AI Color tilhører en eldre Pencil-versjon. Regenerer Color først.",
      );
    }
    return {
      id: approvedColor.id,
      stage: "color",
      imageData: approvedColor.imageData,
      sourceFingerprint: decodeStoryboardImageData(
        approvedColor.imageData,
      ).fingerprint,
    };
  }

  const existing = await latestVersion(
    pool, input.storyboard.id, "pencil", ["source"],
  );
  const existingMatches = pencilVersionMatchesSource(existing, input);
  if (isActiveAIOutput(input.storyboard)) {
    if (!existingMatches) {
      throw new StoryboardAIImageStageError(
        409,
        "pencil_source_stale",
        "Pencil-kilden tilhører en eldre shot-versjon. Last opp det oppdaterte panelet.",
      );
    }
    return {
      id: existing.id,
      stage: "pencil",
      imageData: existing.imageData,
      sourceFingerprint: decodeStoryboardImageData(existing.imageData).fingerprint,
    };
  }
  if (!input.storyboard.imageData) {
    throw new StoryboardAIImageStageError(
      409,
      "pencil_source_missing",
      "Tegn eller importer et storyboard-panel før AI-fargelegging.",
    );
  }
  const decoded = decodeStoryboardImageData(input.storyboard.imageData);
  if (existingMatches && existing.sourceFingerprint === decoded.fingerprint) {
    return {
      id: existing.id,
      stage: "pencil",
      imageData: existing.imageData,
      sourceFingerprint: decoded.fingerprint,
    };
  }
  const matchesAIOutput = await pool.query(
    `SELECT 1 FROM storyboard_ai_image_versions
      WHERE storyboard_id=$1
        AND stage = ANY($2::varchar[])
        AND image_data=$3
      LIMIT 1`,
    [input.storyboard.id, ["color", "atmosphere"], input.storyboard.imageData],
  );
  if (matchesAIOutput.rows[0]) {
    throw new StoryboardAIImageStageError(
      409,
      "pencil_source_ai_output",
      "AI-resultatet kan ikke brukes som Pencil-kilde. Last opp den håndtegnede flaten på nytt.",
    );
  }
  return {
    id: null,
    stage: "pencil",
    imageData: input.storyboard.imageData,
    sourceFingerprint: decoded.fingerprint,
  };
}

async function createPencilSource(
  pool: Pool,
  input: PencilSourceInput,
): Promise<StoryboardAIImageVersion> {
  const { storyboard } = input;
  const existing = await latestVersion(pool, storyboard.id, "pencil", ["source"]);

  // Once an AI stage is approved, casting_storyboards.image_data is the active
  // preview rather than the drawing. The immutable Pencil version remains the
  // only valid source until the native client uploads a new pencil-source pass.
  const activeAIOutput = isActiveAIOutput(storyboard);
  const existingMatchesSource = pencilVersionMatchesSource(existing, input);
  if (activeAIOutput && existingMatchesSource && existing) return existing;
  if (activeAIOutput) {
    throw new StoryboardAIImageStageError(
      409,
      "pencil_source_stale",
      "Pencil-kilden tilhører en eldre shot-versjon. Last opp det oppdaterte panelet.",
    );
  }
  if (!storyboard.imageData) {
    throw new StoryboardAIImageStageError(
      409,
      "pencil_source_missing",
      "Tegn eller importer et storyboard-panel før AI-fargelegging.",
    );
  }
  let decoded;
  try {
    decoded = decodeStoryboardImageData(storyboard.imageData);
  } catch (error) {
    if (error instanceof StoryboardImageGenerationError) {
      throw new StoryboardAIImageStageError(error.status, error.code, error.safeDetail ?? error.code);
    }
    throw error;
  }
  if (existing?.sourceFingerprint === decoded.fingerprint
      && existingMatchesSource) return existing;

  // Never promote an approved/generated AI raster back into the immutable
  // Pencil lineage, even if a legacy client changes workflowLevel. A new Color
  // pass must start from a native-authored Pencil snapshot.
  const matchesAIOutput = await pool.query(
    `SELECT 1 FROM storyboard_ai_image_versions
      WHERE storyboard_id=$1
        AND stage = ANY($2::varchar[])
        AND image_data=$3
      LIMIT 1`,
    [storyboard.id, ["color", "atmosphere"], storyboard.imageData],
  );
  if (matchesAIOutput.rows[0]) {
    throw new StoryboardAIImageStageError(
      409,
      "pencil_source_ai_output",
      "AI-resultatet kan ikke brukes som Pencil-kilde. Last opp den håndtegnede flaten på nytt.",
    );
  }

  await pool.query(
    `UPDATE storyboard_ai_image_versions SET status='stale', approved_at=NULL, approved_by=NULL
       WHERE storyboard_id=$1 AND status <> 'stale'`,
    [storyboard.id],
  );
  const id = crypto.randomUUID();
  const inserted = await pool.query(
    `INSERT INTO storyboard_ai_image_versions
       (id,project_id,storyboard_id,stage,parent_version_id,status,source_fingerprint,
        image_data,width,height,metadata,created_by)
     VALUES ($1,$2,$3,'pencil',NULL,'source',$4,$5,$6,$7,$8::jsonb,$9)
     RETURNING *`,
    [
      id, input.projectId, storyboard.id, decoded.fingerprint,
      storyboard.imageData, storyboard.width, storyboard.height,
      JSON.stringify({
        immutable: true,
        capturedAt: new Date().toISOString(),
        framingFingerprint: input.framingFingerprint,
        sourceRevision: input.sourceRevision,
        compatManuscriptId: input.compatSource.manuscriptId,
        compatSceneId: input.compatSource.sceneId,
        compatFrameId: input.compatSource.frameId,
        compatFrameUpdatedAt: input.compatSource.frameUpdatedAt,
        compatSourceUpdatedAt: input.compatSource.sourceUpdatedAt,
      }),
      input.userId,
    ],
  );
  return mapVersion(inserted.rows[0]);
}

async function authoritativeParent(
  pool: Pool,
  input: {
    storyboard: Storyboard;
    projectId: string;
    userId: string;
    stage: Exclude<StoryboardAIImageStage, "pencil">;
    framingFingerprint: string;
    sourceRevision: number;
    compatSource: CompatFrameSource;
  },
): Promise<StoryboardAIImageVersion> {
  if (input.stage === "color") return createPencilSource(pool, input);
  const approvedColor = await latestVersion(pool, input.storyboard.id, "color", ["approved"]);
  if (!approvedColor) {
    throw new StoryboardAIImageStageError(
      409,
      "approved_color_required",
      "Godkjenn en AI-generert fargeversjon før atmosfære genereres.",
    );
  }
  return approvedColor;
}

export async function listStoryboardAIImageVersions(
  pool: Pool,
  input: { projectId: string; storyboardId: string },
): Promise<StoryboardAIImageVersionList> {
  await ensureStoryboardAIImageStageSchema(pool);
  const result = await pool.query(
    `SELECT version.*, storyboard.metadata AS storyboard_metadata
       FROM casting_storyboards storyboard
       LEFT JOIN storyboard_ai_image_versions version
         ON version.storyboard_id=storyboard.id
        AND version.project_id=storyboard.project_id
      WHERE storyboard.project_id=$1 AND storyboard.id=$2
      ORDER BY version.created_at ASC`,
    [input.projectId, input.storyboardId],
  );
  if (!result.rows[0]) {
    throw new StoryboardAIImageStageError(
      404,
      "not_found",
      "Storyboard-panelet finnes ikke.",
    );
  }
  const storyboardMetadata = jsonObject(result.rows[0].storyboard_metadata);
  const currentSourceRevision = metadataRevision(storyboardMetadata);
  return {
    versions: result.rows
      .filter((row) => row.id != null)
      .map((row) => ({
        ...mapVersion(row),
        currentSourceRevision,
      })),
    currentSourceRevision,
    compatFrameUpdatedAt: metadataText(
      storyboardMetadata,
      "compatFrameUpdatedAt",
    ),
    sourceUpdatedAt: metadataText(
      storyboardMetadata,
      "compatSourceUpdatedAt",
    ) ?? metadataText(storyboardMetadata, "compatFrameUpdatedAt"),
  };
}

export interface StoryboardAIImageStagePreflight {
  snapshot: StoryboardGenerationSnapshot;
  parent: StoryboardAIImageParentPreflight;
  model: string;
  compilationFingerprint: string;
  operationFingerprint: string;
  authoritativeSource: {
    imageData: string;
    stage: "pencil" | "color";
    fingerprint: string;
  };
  paintoverComposite: Record<string, unknown> | null;
}

async function validatedStagePaintoverComposite(input: {
  stage: "color" | "atmosphere";
  body: StoryboardImageGenerationBody;
  parent: StoryboardAIImageParentPreflight;
  snapshot: StoryboardGenerationSnapshot;
}): Promise<ValidatedStoryboardPaintoverComposite | null> {
  const supplied = input.body.paintoverComposite;
  const liveState = storyboardPaintoverBindingState(
    input.snapshot.compatSource.paintoverState,
  );
  if (input.stage === "color") {
    if (supplied) {
      throw new StoryboardAIImageStageError(
        400, "paintover_composite_wrong_stage",
        "Color genereres fra den immutable Pencil-kilden.",
      );
    }
    return null;
  }
  if (!supplied) {
    if (liveState?.colorHasContent) {
      throw new StoryboardAIImageStageError(
        409, "paintover_composite_required",
        "Synk og frys godkjent Color med det redigerbare Color-laget før Atmosphere.",
      );
    }
    return null;
  }
  if (!input.parent.id) {
    throw new StoryboardAIImageStageError(
      409, "paintover_base_missing",
      "Godkjent AI Color mangler før paintover kan fryses.",
    );
  }
  try {
    validateStoryboardPaintoverCompositeBinding({
      composite: supplied,
      expectedIncludedThroughStage: "color",
      expectedBaseVersionId: input.parent.id,
      liveFrameUpdatedAt: input.snapshot.compatSource.frameUpdatedAt,
      liveSourceUpdatedAt: input.snapshot.compatSource.sourceUpdatedAt,
      liveSourceRevision: input.snapshot.sourceRevision,
      liveFramingFingerprint: input.snapshot.framingFingerprint,
      livePaintoverState: input.snapshot.compatSource.paintoverState,
      mirroredPaintoverState: input.snapshot.storyboard.metadata.aiPaintoverState,
    });
    const targetAspect = input.body.context?.shot.shotFraming?.aspectRatio;
    if (!targetAspect) {
      throw new StoryboardPaintoverCompositeError(
        409, "framing_context_required",
        "Paintover-kilden mangler anvendt kamerautsnitt.",
      );
    }
    return await validateStoryboardPaintoverCompositeImage(supplied, targetAspect);
  } catch (error) {
    if (error instanceof StoryboardPaintoverCompositeError) {
      throw new StoryboardAIImageStageError(
        error.status, error.code, error.safeDetail,
      );
    }
    throw error;
  }
}

export type StoryboardAIImageOperationClaim =
  | { state: "claimed"; operationId: string }
  | { state: "in_flight"; operationId: string }
  | {
      state: "completed";
      operationId: string;
      response: Record<string, unknown>;
      reservationId: string | null;
    };

export async function claimStoryboardAIImageOperation(
  pool: Pool,
  input: {
    projectId: string;
    storyboardId: string;
    stage: "color" | "atmosphere";
    idempotencyKey: string;
    operationFingerprint: string;
  },
): Promise<StoryboardAIImageOperationClaim> {
  await ensureStoryboardAIImageStageSchema(pool);
  const operationId = crypto.randomUUID();
  const inserted = await pool.query(
    `INSERT INTO storyboard_ai_image_operations
       (id,project_id,storyboard_id,stage,idempotency_key,operation_fingerprint,
        status,lease_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,'claimed',NOW()+INTERVAL '15 minutes')
     ON CONFLICT (project_id,storyboard_id,stage,idempotency_key) DO NOTHING
     RETURNING id,status,operation_fingerprint,response,reservation_id,lease_expires_at`,
    [
      operationId, input.projectId, input.storyboardId, input.stage,
      input.idempotencyKey, input.operationFingerprint,
    ],
  );
  const row = inserted.rows[0] ?? (await pool.query(
    `SELECT id,status,operation_fingerprint,response,reservation_id,lease_expires_at
       FROM storyboard_ai_image_operations
      WHERE project_id=$1 AND storyboard_id=$2 AND stage=$3 AND idempotency_key=$4`,
    [input.projectId, input.storyboardId, input.stage, input.idempotencyKey],
  )).rows[0];
  if (!row) {
    throw new StoryboardAIImageStageError(
      503, "idempotency_unavailable", "Genereringslåsen kunne ikke opprettes.",
    );
  }
  if (String(row.operation_fingerprint) !== input.operationFingerprint) {
    throw new StoryboardAIImageStageError(
      409,
      "idempotency_key_reused",
      "Denne genereringsnøkkelen tilhører en annen kilde eller prompt.",
    );
  }
  const id = String(row.id);
  if (inserted.rows[0]) return { state: "claimed", operationId: id };
  if (String(row.status) === "completed" && row.response) {
    return {
      state: "completed",
      operationId: id,
      response: jsonObject(row.response),
      reservationId: row.reservation_id ? String(row.reservation_id) : null,
    };
  }
  if (String(row.status) === "failed") {
    throw new StoryboardAIImageStageError(
      409,
      "generation_attempt_failed",
      "Denne genereringen feilet tidligere. Start en ny generering.",
    );
  }
  if (String(row.status) === "processing") {
    const staleProviderBoundary = await pool.query(
      `SELECT 1 AS stale
         FROM storyboard_ai_image_operations
        WHERE id=$1 AND status='processing'
          AND COALESCE(lease_expires_at,created_at+INTERVAL '15 minutes')<=NOW()`,
      [id],
    );
    if (staleProviderBoundary.rows[0]) {
      throw new StoryboardAIImageStageError(
        409,
        "generation_result_unknown",
        "Leverandørresultatet er ukjent. Start ikke genereringen automatisk på nytt.",
      );
    }
    return { state: "in_flight", operationId: id };
  }
  const recovered = await pool.query(
    `UPDATE storyboard_ai_image_operations
        SET status='claimed',lease_expires_at=NOW()+INTERVAL '15 minutes',updated_at=NOW()
      WHERE id=$1 AND status='claimed'
        AND COALESCE(lease_expires_at,created_at+INTERVAL '15 minutes') <= NOW()
      RETURNING id`,
    [id],
  );
  return recovered.rowCount === 1
    ? { state: "claimed", operationId: id }
    : { state: "in_flight", operationId: id };
}

export async function markStoryboardAIImageOperationProcessing(
  pool: Pool,
  operationId: string,
  reservationId: string,
): Promise<void> {
  const updated = await pool.query(
    `UPDATE storyboard_ai_image_operations
        SET status='processing',reservation_id=$2,
            lease_expires_at=NOW()+INTERVAL '15 minutes',updated_at=NOW()
      WHERE id=$1 AND status='claimed' RETURNING id`,
    [operationId, reservationId],
  );
  if (updated.rowCount !== 1) {
    throw new StoryboardAIImageStageError(
      409, "generation_in_progress", "Genereringen er allerede startet.",
    );
  }
}

export async function completeStoryboardAIImageOperation(
  pool: Pool,
  input: {
    operationId: string;
    versionId: string;
    response: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `UPDATE storyboard_ai_image_operations
        SET status='completed',version_id=$2,response=$3::jsonb,error=NULL,
            lease_expires_at=NULL,updated_at=NOW()
      WHERE id=$1 AND status='processing'`,
    [input.operationId, input.versionId, JSON.stringify(input.response)],
  );
}

export async function failStoryboardAIImageOperation(
  pool: Pool,
  operationId: string,
  reason: string,
): Promise<void> {
  await pool.query(
    `UPDATE storyboard_ai_image_operations
        SET status='failed',error=$2,lease_expires_at=NULL,updated_at=NOW()
      WHERE id=$1 AND status IN ('claimed','processing')`,
    [operationId, reason.slice(0, 200)],
  ).catch(() => undefined);
}

/**
 * Read-only validation of source, immutable parent, references and compiled
 * prompt. Routes call this before reserving credits; generation repeats it to
 * close the validation-to-provider race.
 */
export async function preflightStoryboardAIImageStage(
  pool: Pool,
  input: {
    storyboard: Storyboard;
    projectId: string;
    userId: string;
    stage: "color" | "atmosphere";
    body: StoryboardImageGenerationBody;
  },
): Promise<StoryboardAIImageStagePreflight> {
  await ensureStoryboardAIImageStageSchema(pool);
  const snapshot = await validateStoryboardGenerationSnapshot(pool, input);
  const { storyboard, framingFingerprint, sourceRevision, compatSource } = snapshot;
  const parent = await inspectAuthoritativeParent(pool, {
    ...input,
    storyboard,
    framingFingerprint,
    sourceRevision,
    compatSource,
  });
  const composite = await validatedStagePaintoverComposite({
    stage: input.stage, body: input.body, parent, snapshot,
  });
  const authoritativeSource = composite ? {
    imageData: composite.imageData,
    stage: "color" as const,
    fingerprint: composite.fingerprint,
  } : {
    imageData: parent.imageData,
    stage: parent.stage,
    fingerprint: parent.sourceFingerprint,
  };
  const prepared = await prepareStoryboardImageGeneration({
    pool,
    storyboard,
    projectId: input.projectId,
    userId: input.userId,
    body: { ...input.body, quality: "hd", model: "gpt-image-2" },
    authoritativeSource,
  });
  const operationFingerprint = crypto.createHash("sha256")
    .update(JSON.stringify({
      storyboardId: storyboard.id,
      stage: input.stage,
      sourceRevision,
      sourceUpdatedAt: compatSource.sourceUpdatedAt,
      frameUpdatedAt: compatSource.frameUpdatedAt,
      framingFingerprint,
      parentVersionId: parent.id,
      parentSourceFingerprint: parent.sourceFingerprint,
      paintoverSourceFingerprint: composite?.fingerprint ?? null,
      paintoverState: input.body.paintoverComposite ? {
        colorRevision: input.body.paintoverComposite.colorRevision,
        atmosphereRevision: input.body.paintoverComposite.atmosphereRevision,
      } : null,
      model: prepared.model,
      compilationFingerprint: prepared.compilation.compilationFingerprint,
    }))
    .digest("hex");
  return {
    snapshot,
    parent,
    model: prepared.model,
    compilationFingerprint: prepared.compilation.compilationFingerprint,
    operationFingerprint,
    authoritativeSource,
    paintoverComposite: input.body.paintoverComposite && composite ? {
      includedThroughStage: input.body.paintoverComposite.includedThroughStage,
      baseVersionId: input.body.paintoverComposite.baseVersionId,
      frameUpdatedAt: input.body.paintoverComposite.frameUpdatedAt,
      sourceUpdatedAt: input.body.paintoverComposite.sourceUpdatedAt,
      sourceRevision: input.body.paintoverComposite.sourceRevision,
      framingFingerprint: input.body.paintoverComposite.framingFingerprint,
      colorRevision: input.body.paintoverComposite.colorRevision,
      atmosphereRevision: input.body.paintoverComposite.atmosphereRevision,
      colorFingerprint: input.body.paintoverComposite.colorFingerprint,
      atmosphereFingerprint: input.body.paintoverComposite.atmosphereFingerprint,
      sourceFingerprint: composite.fingerprint,
      width: composite.width, height: composite.height,
    } : null,
  };
}

export async function generateStoryboardAIImageStage(
  pool: Pool,
  input: {
    storyboard: Storyboard;
    projectId: string;
    userId: string;
    stage: "color" | "atmosphere";
    body: StoryboardImageGenerationBody;
    apiKey: string;
    expectedOperationFingerprint?: string;
    operation?: {
      id: string;
      reservationId: string;
      estimatedCostUsd: number;
    };
    fetchImpl?: typeof fetch;
  },
): Promise<{
  version: StoryboardAIImageVersion;
  generated: GeneratedStoryboardImage;
  operationResponse?: Record<string, unknown>;
}> {
  const checked = await preflightStoryboardAIImageStage(pool, input);
  if (input.expectedOperationFingerprint
      && checked.operationFingerprint !== input.expectedOperationFingerprint) {
    throw new StoryboardAIImageStageError(
      409,
      "idempotency_payload_changed",
      "Produksjonskonteksten ble endret før genereringen startet.",
    );
  }
  const { snapshot } = checked;
  const { storyboard, framingFingerprint, sourceRevision, compatSource } = snapshot;
  const aiRasterPlacementFraming = requiredContextRasterPlacementFraming(
    input.body);
  const parent = await authoritativeParent(pool, {
    ...input,
    storyboard,
    framingFingerprint,
    sourceRevision,
    compatSource,
  });
  const parentFramingFingerprint = metadataText(
    parent.metadata,
    "framingFingerprint",
  );
  const parentSourceRevision = optionalMetadataRevision(parent.metadata);
  if (parentFramingFingerprint !== framingFingerprint
      || parentSourceRevision !== sourceRevision
      || (parent.stage === "color"
        && metadataSourceCompatToken(parent.metadata)
          !== compatSource.sourceUpdatedAt)) {
    const isColorParent = parent.stage === "color";
    throw new StoryboardAIImageStageError(
      409,
      isColorParent ? "approved_color_source_stale" : "pencil_source_stale",
      isColorParent
        ? "Godkjent AI Color tilhører en eldre Pencil-versjon. Regenerer Color først."
        : "Pencil-kilden tilhører en eldre shot-versjon. Last opp panelet på nytt.",
    );
  }
  // The provider-free preflight above can race with a collaborator. Re-read
  // both normalized and compat source truth immediately before paid IO.
  const immediateSnapshot = await validateStoryboardGenerationSnapshot(pool, {
    storyboard,
    body: input.body,
  });
  const immediateComposite = await validatedStagePaintoverComposite({
    stage: input.stage,
    body: input.body,
    parent: checked.parent,
    snapshot: immediateSnapshot,
  });
  const immediateSource = immediateComposite ? {
    imageData: immediateComposite.imageData,
    stage: "color" as const,
    fingerprint: immediateComposite.fingerprint,
  } : {
    imageData: parent.imageData,
    stage: parent.stage === "pencil" ? "pencil" as const : "color" as const,
    fingerprint: decodeStoryboardImageData(parent.imageData).fingerprint,
  };
  if (immediateSnapshot.sourceRevision !== sourceRevision
      || immediateSnapshot.framingFingerprint !== framingFingerprint
      || immediateSnapshot.compatSource.sourceUpdatedAt
        !== compatSource.sourceUpdatedAt
      || immediateSnapshot.compatSource.frameUpdatedAt
        !== compatSource.frameUpdatedAt
      || parent.id !== checked.parent.id
      || immediateSource.fingerprint
        !== checked.authoritativeSource.fingerprint) {
    throw new StoryboardAIImageStageError(
      409,
      "source_snapshot_stale",
      "Panelet ble endret før generering. Synk og prøv igjen.",
    );
  }
  const generated = await generateStoryboardImage({
    pool,
    storyboard,
    projectId: input.projectId,
    userId: input.userId,
    body: { ...input.body, quality: "hd", model: "gpt-image-2" },
    apiKey: input.apiKey,
    authoritativeSource: immediateSource,
    providerIdempotencyKey: input.operation?.id,
    fetchImpl: input.fetchImpl,
  });
  const id = crypto.randomUUID();
  const metadata = {
    ...generated.metadata,
    parentVersionId: parent.id,
    humanApprovalRequired: true,
    framingFingerprint,
    aiRasterPlacementFraming,
    frameId: storyboard.frameId,
    sourceRevision,
    compatManuscriptId: compatSource.manuscriptId,
    compatSceneId: compatSource.sceneId,
    compatFrameId: compatSource.frameId,
    compatFrameUpdatedAt: compatSource.frameUpdatedAt,
    compatSourceUpdatedAt: compatSource.sourceUpdatedAt,
    paintoverComposite: checked.paintoverComposite,
  };
  const insertSQL = `INSERT INTO storyboard_ai_image_versions
       (id,project_id,storyboard_id,stage,parent_version_id,status,source_fingerprint,
        compilation_fingerprint,image_data,width,height,model,quality,metadata,created_by)
     VALUES ($1,$2,$3,$4,$5,'generated',$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
     RETURNING *`;
  const insertParams = [
    id, input.projectId, storyboard.id, input.stage, parent.id,
    immediateSource.fingerprint,
    String(generated.metadata.compilationFingerprint ?? ""),
    generated.imageData, generated.width, generated.height,
    generated.model, "hd", JSON.stringify(metadata), input.userId,
  ];
  if (!input.operation) {
    const inserted = await pool.query(insertSQL, insertParams);
    return { version: mapVersion(inserted.rows[0]), generated };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const inserted = await client.query(insertSQL, insertParams);
    const version = mapVersion(inserted.rows[0]);
    const response: Record<string, unknown> = {
      success: true,
      data: version,
      composedPrompt: generated.compiledPrompt,
      revisedPrompt: generated.revisedPrompt,
      model: generated.model,
      referenceCount: generated.referenceCount,
      referenceAssetIds: generated.referenceAssetIds,
      estimatedCostUsd: input.operation.estimatedCostUsd,
      operationId: input.operation.id,
    };
    const operationUpdate = await client.query(
      `UPDATE storyboard_ai_image_operations
          SET status='completed',version_id=$2,response=$3::jsonb,error=NULL,
              lease_expires_at=NULL,updated_at=NOW()
        WHERE id=$1 AND status='processing' AND reservation_id=$4
        RETURNING id`,
      [
        input.operation.id,
        version.id,
        JSON.stringify(response),
        input.operation.reservationId,
      ],
    );
    if (operationUpdate.rowCount !== 1) {
      throw new StoryboardAIImageStageError(
        409,
        "generation_operation_lost",
        "Genereringslåsen utløp før resultatet kunne lagres.",
      );
    }
    await client.query("COMMIT");
    return { version, generated, operationResponse: response };
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    if (error instanceof StoryboardImageProviderOutcomeUnknownError) throw error;
    throw new StoryboardImageProviderOutcomeUnknownError(
      "image_result_persistence_unknown",
      "Bildet ble generert, men kunne ikke lagres sikkert. Genereringen sendes ikke automatisk på nytt.",
    );
  } finally {
    client?.release();
  }
}

export async function approveStoryboardAIImageVersion(
  pool: Pool,
  input: {
    projectId: string;
    storyboardId: string;
    versionId: string;
    userId: string;
    expectedFramingFingerprint: string;
  },
): Promise<StoryboardAIImageVersion> {
  await ensureStoryboardAIImageStageSchema(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selectedStoryboard = await client.query(
      `SELECT storyboard.metadata, storyboard.scene_id, storyboard.frame_id,
              storyboard.width, storyboard.height,
              scene.manuscript_id
         FROM casting_storyboards storyboard
         LEFT JOIN casting_scenes scene
           ON scene.id=storyboard.scene_id
          AND scene.project_id=storyboard.project_id
        WHERE storyboard.id=$1 AND storyboard.project_id=$2
        FOR UPDATE OF storyboard`,
      [input.storyboardId, input.projectId],
    );
    if (!selectedStoryboard.rows[0]) {
      throw new StoryboardAIImageStageError(
        404, "not_found", "Storyboard-panelet finnes ikke.",
      );
    }
    const storyboardSceneId = selectedStoryboard.rows[0].scene_id
      ? String(selectedStoryboard.rows[0].scene_id) : "";
    const storyboardFrameId = selectedStoryboard.rows[0].frame_id
      ? String(selectedStoryboard.rows[0].frame_id) : "";
    const manuscriptId = selectedStoryboard.rows[0].manuscript_id
      ? String(selectedStoryboard.rows[0].manuscript_id) : "";
    if (!manuscriptId || !storyboardSceneId || !storyboardFrameId) {
      throw new StoryboardAIImageStageError(
        409,
        "candidate_compat_source_missing",
        "Storyboard-panelet mangler autoritativ manuskriptkobling.",
      );
    }
    const compatStoreKey = `casting:scenes:${manuscriptId}`;
    // Global lock order for approval is normalized storyboard -> compat key ->
    // every version row ordered by id. Concurrent approvals can therefore
    // never each hold one candidate while waiting for the other.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [compatStoreKey],
    );
    const selectedVersions = await client.query(
      `SELECT * FROM storyboard_ai_image_versions
         WHERE project_id=$1 AND storyboard_id=$2
         ORDER BY id FOR UPDATE`,
      [input.projectId, input.storyboardId],
    );
    const row = selectedVersions.rows.find(
      (candidate) => String(candidate.id) === input.versionId,
    );
    if (!row) {
      throw new StoryboardAIImageStageError(404, "version_not_found", "Bildeversjonen finnes ikke.");
    }
    const version = mapVersion(row);
    if (version.stage === "pencil" || version.status === "stale") {
      throw new StoryboardAIImageStageError(
        409, "version_not_approvable", "Denne bildeversjonen kan ikke godkjennes.",
      );
    }
    if (version.stage === "atmosphere") {
      const parentRow = selectedVersions.rows.find(
        (candidate) => String(candidate.id) === version.parentVersionId,
      );
      if (!parentRow || String(parentRow.stage) !== "color"
          || String(parentRow.status) !== "approved") {
        throw new StoryboardAIImageStageError(
          409,
          "atmosphere_parent_superseded",
          "AI Color-grunnlaget ble erstattet. Generer Atmosphere på nytt.",
        );
      }
    }
    const candidateFramingFingerprint = metadataText(
      version.metadata,
      "framingFingerprint",
    );
    if (!candidateFramingFingerprint
        || candidateFramingFingerprint !== input.expectedFramingFingerprint) {
      throw new StoryboardAIImageStageError(
        409,
        "candidate_framing_stale",
        "Kandidaten ble laget for et eldre utsnitt. Generer en ny kandidat.",
      );
    }
    const storyboardMetadata = jsonObject(selectedStoryboard.rows[0].metadata);
    const currentFramingFingerprint = metadataText(
      storyboardMetadata,
      "currentFramingFingerprint",
    );
    if (currentFramingFingerprint
        && currentFramingFingerprint !== input.expectedFramingFingerprint) {
      throw new StoryboardAIImageStageError(
        409,
        "current_framing_changed",
        "Utsnittet ble endret etter generering. Kandidaten kan ikke godkjennes.",
      );
    }
    const candidateSourceRevision = version.metadata.sourceRevision;
    const normalizedCandidateRevision = typeof candidateSourceRevision === "number"
      ? candidateSourceRevision
      : typeof candidateSourceRevision === "string"
        ? Number(candidateSourceRevision) : Number.NaN;
    if (!Number.isSafeInteger(normalizedCandidateRevision)
        || normalizedCandidateRevision < 0
        || normalizedCandidateRevision !== metadataRevision(storyboardMetadata)) {
      throw new StoryboardAIImageStageError(
        409,
        "candidate_source_stale",
        "Pencil-kilden ble endret etter generering. Generer en ny kandidat.",
      );
    }
    const candidateManuscriptId = metadataText(
      version.metadata,
      "compatManuscriptId",
    );
    const candidateSceneId = metadataText(version.metadata, "compatSceneId");
    const candidateFrameId = metadataText(version.metadata, "compatFrameId");
    const candidateCompatUpdatedAt = metadataSourceCompatToken(
      version.metadata,
    );
    if (!manuscriptId || !storyboardSceneId || !storyboardFrameId
        || candidateManuscriptId !== manuscriptId
        || candidateSceneId !== storyboardSceneId
        || candidateFrameId !== storyboardFrameId
        || !candidateCompatUpdatedAt) {
      throw new StoryboardAIImageStageError(
        409,
        "candidate_compat_source_missing",
        "Kandidaten mangler autoritativ shot-versjon. Generer en ny kandidat.",
      );
    }
    const selectedCompat = await client.query(
      `SELECT store_value FROM legacy_compat_store
        WHERE store_key=$1 FOR UPDATE`,
      [compatStoreKey],
    );
    const located = findCompatFrame(
      selectedCompat.rows[0]?.store_value,
      storyboardSceneId,
      storyboardFrameId,
    );
    const currentCompatUpdatedAt = located?.frame.updatedAt;
    const currentCompatSourceUpdatedAt = located?.frame.sourceUpdatedAt
      ?? currentCompatUpdatedAt;
    const currentCompatRasterPlacementFraming = located
      ? compatFrameRasterPlacementFraming(located.frame) : null;
    const currentCompatFraming = located
      ? shotFramingFingerprint(currentCompatRasterPlacementFraming) ?? null
      : null;
    const candidateHasRasterPlacement = Object.prototype.hasOwnProperty.call(
      version.metadata,
      "aiRasterPlacementFraming",
    );
    const storedCandidateRasterPlacement = normalizeShotFramingState(
      version.metadata.aiRasterPlacementFraming,
    );
    const aiRasterPlacementFraming = candidateHasRasterPlacement
      ? storedCandidateRasterPlacement : currentCompatRasterPlacementFraming;
    if (!located || currentCompatSourceUpdatedAt !== candidateCompatUpdatedAt
        || currentCompatFraming !== candidateFramingFingerprint
        || !aiRasterPlacementFraming
        || shotFramingFingerprint(aiRasterPlacementFraming)
          !== candidateFramingFingerprint) {
      throw new StoryboardAIImageStageError(
        409,
        "candidate_compat_source_stale",
        "Shotet ble endret etter generering. Kandidaten kan ikke godkjennes.",
      );
    }
    const livePaintover = storyboardPaintoverBindingState(
      located.frame.aiPaintoverState,
    );
    const mirroredPaintover = storyboardPaintoverBindingState(
      storyboardMetadata.aiPaintoverState,
    );
    const candidatePaintover = jsonObject(version.metadata.paintoverComposite);
    const candidateHasPaintover = Object.keys(candidatePaintover).length > 0;
    if (version.stage === "atmosphere"
        && (livePaintover?.colorHasContent || candidateHasPaintover)) {
      const candidateNumber = (key: string): number | null => {
        const value = candidatePaintover[key];
        const parsed = typeof value === "number" ? value
          : typeof value === "string" ? Number(value) : Number.NaN;
        return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
      };
      const exactPaintover = livePaintover && mirroredPaintover
        && livePaintover.colorRevision === mirroredPaintover.colorRevision
        && livePaintover.atmosphereRevision === mirroredPaintover.atmosphereRevision
        && livePaintover.colorFingerprint === mirroredPaintover.colorFingerprint
        && livePaintover.atmosphereFingerprint
          === mirroredPaintover.atmosphereFingerprint
        && candidatePaintover.baseVersionId === version.parentVersionId
        && candidatePaintover.frameUpdatedAt === currentCompatUpdatedAt
        && candidatePaintover.sourceUpdatedAt === currentCompatSourceUpdatedAt
        && candidateNumber("sourceRevision") === normalizedCandidateRevision
        && candidatePaintover.framingFingerprint === currentCompatFraming
        && candidateNumber("colorRevision") === livePaintover.colorRevision
        && candidateNumber("atmosphereRevision")
          === livePaintover.atmosphereRevision
        && String(candidatePaintover.colorFingerprint ?? "").toLowerCase()
          === livePaintover.colorFingerprint
        && String(candidatePaintover.atmosphereFingerprint ?? "").toLowerCase()
          === livePaintover.atmosphereFingerprint;
      if (!exactPaintover) {
        throw new StoryboardAIImageStageError(
          409,
          "candidate_paintover_stale",
          "Color-paintoveren ble endret etter Atmosphere-genereringen. Generer på nytt.",
        );
      }
    }
    const materializedPaintoverState = storyboardPaintoverStateForFrame(
      located.frame.aiPaintoverState,
      { colorChanged: false, atmosphereChanged: false },
      located.frame,
    );
    const adoptedPaintoverState = {
      ...materializedPaintoverState,
      atmosphereStale: version.stage === "atmosphere" ? false : true,
      videoStale: true,
    };
    const currentTimestamp = Date.parse(String(currentCompatUpdatedAt ?? ""));
    const adoptedFrameUpdatedAt = new Date(Math.max(
      Date.now(),
      Number.isFinite(currentTimestamp) ? currentTimestamp + 1 : 0,
    )).toISOString();
    const currentScene = located.scenes[located.sceneIndex];
    const currentFrames = jsonArray(currentScene.storyboardFrames).filter(
      (value): value is Record<string, unknown> =>
        Boolean(value) && typeof value === "object" && !Array.isArray(value),
    );
    const approvedFramingField = version.stage === "color"
      ? "aiColorFramingFingerprint"
      : "aiAtmosphereFramingFingerprint";
    const adoptedFrame = {
      ...located.frame,
      imageUrl: version.imageData,
      thumbnailUrl: version.imageData,
      imageSource: `ai-${version.stage}-approved`,
      aiStoryboardId: input.storyboardId,
      aiOutputStale: false,
      aiOutputStaleReason: "",
      aiSourceFramingFingerprint: candidateFramingFingerprint,
      aiRasterPlacementFraming,
      [approvedFramingField]: candidateFramingFingerprint,
      aiSourceRevision: normalizedCandidateRevision,
      aiPaintoverState: adoptedPaintoverState,
      sourceUpdatedAt: candidateCompatUpdatedAt,
      updatedAt: adoptedFrameUpdatedAt,
    };
    const nextFrames = currentFrames.slice();
    nextFrames[located.frameIndex] = adoptedFrame;
    const nextScenes = located.scenes.slice();
    nextScenes[located.sceneIndex] = {
      ...currentScene,
      storyboardFrames: nextFrames,
      updatedAt: adoptedFrameUpdatedAt,
    };
    await client.query(
      `UPDATE storyboard_ai_image_versions
         SET status='generated', approved_by=NULL, approved_at=NULL
       WHERE storyboard_id=$1 AND stage=$2 AND status='approved'`,
      [input.storyboardId, version.stage],
    );
    if (version.stage === "color") {
      await client.query(
        `UPDATE storyboard_ai_image_versions
           SET status='stale', approved_by=NULL, approved_at=NULL
         WHERE storyboard_id=$1 AND stage='atmosphere' AND status <> 'stale'`,
        [input.storyboardId],
      );
    }
    const approved = await client.query(
      `UPDATE storyboard_ai_image_versions
         SET status='approved', approved_by=$1, approved_at=NOW(),
             metadata=COALESCE(metadata,'{}'::jsonb)
               || jsonb_build_object(
                    'adoptedFrameUpdatedAt',$3::text,
                    'compatSourceUpdatedAt',$5::text,
                    'currentSourceRevision',$4::bigint,
                    'aiSourceRevision',$4::bigint,
                    'aiRasterPlacementFraming',$6::jsonb
                  )
       WHERE id=$2 RETURNING *`,
      [
        input.userId, input.versionId,
        adoptedFrameUpdatedAt, normalizedCandidateRevision,
        candidateCompatUpdatedAt,
        JSON.stringify(aiRasterPlacementFraming),
      ],
    );
    const aiPipeline = {
      selectedVersionId: version.id,
      selectedStage: version.stage,
      sourceFingerprint: version.sourceFingerprint,
      framingFingerprint: candidateFramingFingerprint,
      sourceRevision: normalizedCandidateRevision,
      rasterPlacementFraming: aiRasterPlacementFraming,
      sourceUpdatedAt: candidateCompatUpdatedAt,
      approvedAt: adoptedFrameUpdatedAt,
      sourceCanvasWidth: selectedStoryboard.rows[0].width == null
        ? null : Number(selectedStoryboard.rows[0].width),
      sourceCanvasHeight: selectedStoryboard.rows[0].height == null
        ? null : Number(selectedStoryboard.rows[0].height),
      outputWidth: version.width,
      outputHeight: version.height,
      outputAspectRatio: version.width && version.height
        ? version.width / version.height : null,
      paintoverComposite: Object.keys(candidatePaintover).length
        ? candidatePaintover : null,
    };
    const compatUpdate = await client.query(
      `UPDATE legacy_compat_store
          SET store_value=$2::jsonb, updated_at=NOW()
        WHERE store_key=$1`,
      [compatStoreKey, JSON.stringify(nextScenes)],
    );
    if (compatUpdate.rowCount !== 1) {
      throw new StoryboardAIImageStageError(
        409,
        "compat_source_missing",
        "Manuskriptshotet forsvant under godkjenning. Prøv igjen.",
      );
    }
    await client.query(
      `UPDATE legacy_compat_store
          SET store_value=jsonb_set(
                store_value,
                '{version}',
                to_jsonb(
                  CASE
                    WHEN COALESCE(store_value->>'version','') ~ '^[0-9]+$'
                      THEN (store_value->>'version')::bigint + 1
                    ELSE 1
                  END
                ),
                true
              ),
              updated_at=NOW()
        WHERE store_key=$1`,
      [`casting:manuscript:${manuscriptId}`],
    );
    const storyboardUpdate = await client.query(
      `UPDATE casting_storyboards
         SET image_data=$1,workflow_level=$2,
             metadata=COALESCE(metadata,'{}'::jsonb)
               || jsonb_build_object(
                    'aiPipeline',$3::jsonb,
                    'currentFramingFingerprint',$4::text,
                    'aiOutputStale',false,
                    'aiOutputStaleReason','',
                    'sourceRevision',$5::bigint,
                    'compatFrameUpdatedAt',$6::text,
                    'compatSourceUpdatedAt',$7::text,
                    'aiPaintoverState',$10::jsonb,
                    'aiRasterPlacementFraming',$11::jsonb,
                    'aiSourceRevision',$5::bigint
                  ),
             updated_at=NOW()
       WHERE id=$8 AND project_id=$9 RETURNING id`,
      [
        version.imageData,
        `ai-${version.stage}-approved`, JSON.stringify(aiPipeline),
        candidateFramingFingerprint, normalizedCandidateRevision,
        adoptedFrameUpdatedAt, candidateCompatUpdatedAt,
        input.storyboardId, input.projectId,
        JSON.stringify(adoptedPaintoverState),
        JSON.stringify(aiRasterPlacementFraming),
      ],
    );
    if (storyboardUpdate.rowCount !== 1) {
      throw new StoryboardAIImageStageError(404, "not_found", "Storyboard-panelet finnes ikke.");
    }
    await client.query("COMMIT");
    return {
      ...mapVersion(approved.rows[0]),
      currentSourceRevision: normalizedCandidateRevision,
      adoptedFrameUpdatedAt,
      sourceUpdatedAt: candidateCompatUpdatedAt,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function requireStoryboardForStage(
  pool: Pool,
  projectId: string,
  storyboardId: string,
): Promise<Storyboard> {
  const storyboard = await getStoryboard(pool, storyboardId);
  if (!storyboard || storyboard.projectId !== projectId || !storyboard.frameId) {
    throw new StoryboardAIImageStageError(404, "not_found", "Storyboard-panelet finnes ikke.");
  }
  return storyboard;
}
