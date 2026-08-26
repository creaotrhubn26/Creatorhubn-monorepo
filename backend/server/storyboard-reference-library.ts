import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

export type StoryboardReferenceEntityType =
  | "character"
  | "wardrobe"
  | "location"
  | "prop"
  | "storyboard";

export type StoryboardReferenceApprovalStatus =
  | "draft"
  | "approved"
  | "rejected";

export interface StoryboardReferenceAsset {
  id: string;
  projectId: string;
  packId: string;
  packVersion: string;
  entityType: StoryboardReferenceEntityType;
  entityId: string;
  sceneIds: string[];
  name: string;
  description: string;
  referenceImageId: string;
  approvalStatus: StoryboardReferenceApprovalStatus;
  locked: boolean;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReferenceAssetRow {
  id: unknown;
  project_id: unknown;
  pack_id: unknown;
  pack_version: unknown;
  entity_type: unknown;
  entity_id: unknown;
  scene_ids: unknown;
  name: unknown;
  description: unknown;
  reference_image_id: unknown;
  approval_status: unknown;
  locked: unknown;
  metadata: unknown;
  created_by: unknown;
  approved_by: unknown;
  approved_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

interface BuiltInReferenceDescriptor {
  relativePath: string;
  contentType: "image/png";
}

/**
 * Explicit allow-list. A DB value is never interpreted as a filesystem path
 * or fetched as a URL. This keeps approved project data from becoming an SSRF
 * or path-traversal primitive inside image generation.
 */
const BUILT_IN_REFERENCES: Readonly<
  Record<string, BuiltInReferenceDescriptor>
> = {
  "builtin://troll/v1/nora-character-wardrobe": {
    relativePath:
      "storyboard-reference-packs/troll/v1/nora-character-wardrobe-draft-v1.png",
    contentType: "image/png",
  },
  "builtin://troll/v1/troll-creature-scale": {
    relativePath:
      "storyboard-reference-packs/troll/v1/troll-creature-scale-draft-v1.png",
    contentType: "image/png",
  },
  "builtin://troll/v1/dovrefjell-location": {
    relativePath:
      "storyboard-reference-packs/troll/v1/dovrefjell-location-draft-v1.png",
    contentType: "image/png",
  },
  "builtin://troll/v1/scene-8-storyboard-sequence": {
    relativePath:
      "storyboard-reference-packs/troll/v1/scene-8-storyboard-sequence-draft-v1.png",
    contentType: "image/png",
  },
};

const MAX_REFERENCE_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_PROVIDER_REFERENCE_IMAGES = 4;

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value
    : value == null
      ? fallback
      : String(value);
}

function stringArray(value: unknown): string[] {
  const raw = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  return raw.filter((item): item is string => typeof item === "string");
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isoValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return stringValue(value);
}

export function mapStoryboardReferenceAsset(
  row: ReferenceAssetRow,
): StoryboardReferenceAsset {
  const entityType = stringValue(
    row.entity_type,
  ) as StoryboardReferenceEntityType;
  const approvalStatus = stringValue(
    row.approval_status,
  ) as StoryboardReferenceApprovalStatus;
  return {
    id: stringValue(row.id),
    projectId: stringValue(row.project_id),
    packId: stringValue(row.pack_id),
    packVersion: stringValue(row.pack_version),
    entityType,
    entityId: stringValue(row.entity_id),
    sceneIds: stringArray(row.scene_ids),
    name: stringValue(row.name),
    description: stringValue(row.description),
    referenceImageId: stringValue(row.reference_image_id),
    approvalStatus,
    locked: row.locked === true,
    metadata: objectValue(row.metadata),
    createdBy: row.created_by == null ? null : stringValue(row.created_by),
    approvedBy: row.approved_by == null ? null : stringValue(row.approved_by),
    approvedAt: row.approved_at == null ? null : isoValue(row.approved_at),
    createdAt: isoValue(row.created_at),
    updatedAt: isoValue(row.updated_at),
  };
}

export async function listStoryboardReferenceAssets(
  pool: Pool,
  projectId: string,
): Promise<StoryboardReferenceAsset[]> {
  const result = await pool.query<ReferenceAssetRow>(
    `SELECT *
       FROM storyboard_reference_assets
      WHERE project_id = $1
      ORDER BY pack_id, entity_type, name, created_at`,
    [projectId],
  );
  return result.rows.map(mapStoryboardReferenceAsset);
}

export async function listApprovedStoryboardReferenceAssets(
  pool: Pool,
  projectId: string,
): Promise<StoryboardReferenceAsset[]> {
  const result = await pool.query<ReferenceAssetRow>(
    `SELECT *
       FROM storyboard_reference_assets
      WHERE project_id = $1
        AND approval_status = 'approved'
      ORDER BY
        CASE entity_type
          WHEN 'character' THEN 1
          WHEN 'wardrobe' THEN 2
          WHEN 'location' THEN 3
          WHEN 'prop' THEN 4
          ELSE 5
        END,
        created_at`,
    [projectId],
  );
  return result.rows.map(mapStoryboardReferenceAsset);
}

export function libraryReferenceId(assetId: string): string {
  return `library:${assetId}`;
}

export function parseLibraryReferenceId(value: string): string | null {
  const match = /^library:([A-Za-z0-9._:-]{1,255})$/.exec(value.trim());
  return match?.[1] ?? null;
}

function resolveAssetsRoot(): string {
  // Render starts the service with backend/ as cwd. Tests may start from the
  // monorepo root, so accept that layout without reading outside the repo.
  const cwd = process.cwd();
  return path.basename(cwd) === "backend"
    ? path.resolve(cwd, "assets")
    : path.resolve(cwd, "backend", "assets");
}

export function builtInReferenceDescriptor(
  referenceImageId: string,
): BuiltInReferenceDescriptor | null {
  return BUILT_IN_REFERENCES[referenceImageId] ?? null;
}

export async function readBuiltInStoryboardReference(
  referenceImageId: string,
): Promise<{ bytes: Buffer; contentType: "image/png"; filename: string }> {
  const descriptor = builtInReferenceDescriptor(referenceImageId);
  if (!descriptor) throw new Error("unsupported_reference_image");

  const root = resolveAssetsRoot();
  const absolutePath = path.resolve(root, descriptor.relativePath);
  const relative = path.relative(root, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("invalid_reference_path");
  }

  const fileStat = await stat(absolutePath);
  if (
    !fileStat.isFile() ||
    fileStat.size <= 0 ||
    fileStat.size > MAX_REFERENCE_IMAGE_BYTES
  ) {
    throw new Error("invalid_reference_size");
  }
  const bytes = await readFile(absolutePath);
  // PNG signature. Do not trust a filename when handing bytes to a provider.
  if (
    bytes.length < 8 ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new Error("invalid_reference_content");
  }
  return {
    bytes,
    contentType: descriptor.contentType,
    filename: path.basename(descriptor.relativePath),
  };
}

/**
 * Re-validates project ownership + approval at provider-call time. Client
 * context can mention arbitrary IDs; only rows selected here are ever read.
 */
export async function resolveApprovedProviderReferences(
  pool: Pool,
  input: { projectId: string; referenceIds: string[] },
): Promise<
  Array<{
    asset: StoryboardReferenceAsset;
    bytes: Buffer;
    contentType: "image/png";
    filename: string;
  }>
> {
  const assetIds = [
    ...new Set(
      input.referenceIds
        .map(parseLibraryReferenceId)
        .filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, MAX_PROVIDER_REFERENCE_IMAGES);
  if (!assetIds.length) return [];

  const result = await pool.query<ReferenceAssetRow>(
    `SELECT *
       FROM storyboard_reference_assets
      WHERE project_id = $1
        AND approval_status = 'approved'
        AND id = ANY($2::varchar[])
      ORDER BY array_position($2::varchar[], id)`,
    [input.projectId, assetIds],
  );

  const resolved = [];
  for (const row of result.rows) {
    const asset = mapStoryboardReferenceAsset(row);
    const file = await readBuiltInStoryboardReference(asset.referenceImageId);
    resolved.push({ asset, ...file });
  }
  return resolved;
}
