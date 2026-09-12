import crypto from "crypto";
import type { Pool, PoolClient } from "pg";
import {
  getMerchProductSpec,
  type MerchMockupProductId,
  type MerchProductionTechnique,
} from "./role-room-merch-mockup.js";

export type MerchLogoVariant = "original" | "light" | "dark";
export type MerchConceptProvider = "concept" | "printful";
export type MerchConceptStatus = "draft" | "approved" | "archived";

export interface MerchConceptInput {
  productId: MerchMockupProductId;
  supplierKey?: string | null;
  supplierName?: string | null;
  provider: MerchConceptProvider;
  providerProductId?: number | null;
  providerVariantId?: number | null;
  providerColorName?: string | null;
  providerColorHex?: string | null;
  requestedColorHex: string;
  logoUrl: string;
  logoVariant: MerchLogoVariant;
  placement: string;
  printWidthMm: number;
  printHeightMm: number;
  technique: MerchProductionTechnique;
  mockupUrls?: string[];
}

export interface MerchConceptRecord extends MerchConceptInput {
  id: string;
  projectId: string;
  conceptKey: string;
  status: MerchConceptStatus;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class MerchConceptError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = "MerchConceptError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const HTTPS_URL_PATTERN = /^https:\/\//i;
const ALLOWED_LOGO_VARIANTS = new Set<MerchLogoVariant>([
  "original",
  "light",
  "dark",
]);
const ALLOWED_PROVIDERS = new Set<MerchConceptProvider>([
  "concept",
  "printful",
]);
const ALLOWED_STATUSES = new Set<MerchConceptStatus>([
  "draft",
  "approved",
  "archived",
]);

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function requireHex(value: unknown, field: string): string {
  if (typeof value !== "string" || !HEX_PATTERN.test(value.trim())) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      `${field} must be a six-digit HEX color`,
    );
  }
  return value.trim().toUpperCase();
}

function optionalPositiveInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      `${field} must be a positive integer`,
    );
  }
  return parsed;
}

function requirePositiveNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      `${field} must be a positive number`,
    );
  }
  return Math.round(parsed * 100) / 100;
}

function normalizeMockupUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => HTTPS_URL_PATTERN.test(entry))
    .slice(0, 12);
  return [...new Set(urls)];
}

export function normalizeMerchConceptInput(value: unknown): MerchConceptInput {
  if (!value || typeof value !== "object") {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      "Merch concept body is required",
    );
  }
  const input = value as Record<string, unknown>;
  const productId = String(input.productId ?? "") as MerchMockupProductId;
  const productSpec = getMerchProductSpec(productId);
  if (!productSpec) {
    throw new MerchConceptError(
      400,
      "invalid_product",
      `Unsupported productId: ${productId}`,
    );
  }

  const provider = String(input.provider ?? "concept") as MerchConceptProvider;
  if (!ALLOWED_PROVIDERS.has(provider)) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      "provider must be concept or printful",
    );
  }
  const logoVariant = String(
    input.logoVariant ?? "original",
  ) as MerchLogoVariant;
  if (!ALLOWED_LOGO_VARIANTS.has(logoVariant)) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      "logoVariant must be original, light or dark",
    );
  }
  const placement = optionalText(input.placement, 64);
  if (
    !placement ||
    !productSpec.placements.some((candidate) => candidate.id === placement)
  ) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      `Unsupported placement for ${productId}`,
    );
  }
  const technique = String(
    input.technique ?? productSpec.techniques[0],
  ) as MerchProductionTechnique;
  if (!productSpec.techniques.includes(technique)) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      `Unsupported technique for ${productId}`,
    );
  }

  const printWidthMm = requirePositiveNumber(
    input.printWidthMm,
    "printWidthMm",
  );
  const printHeightMm = requirePositiveNumber(
    input.printHeightMm,
    "printHeightMm",
  );
  const placementSpec = productSpec.placements.find(
    (candidate) => candidate.id === placement,
  )!;
  if (!placementSpec.techniques.includes(technique)) {
    throw new MerchConceptError(
      400,
      "invalid_merch_concept",
      `${technique} is not available for ${placementSpec.label}`,
    );
  }
  if (
    printWidthMm > placementSpec.maxWidthMm ||
    printHeightMm > placementSpec.maxHeightMm
  ) {
    throw new MerchConceptError(
      400,
      "invalid_print_area",
      `Print area exceeds ${placementSpec.maxWidthMm} × ${placementSpec.maxHeightMm} mm for ${placementSpec.label}`,
    );
  }

  const logoUrl = optionalText(input.logoUrl, 2048);
  if (!logoUrl || !HTTPS_URL_PATTERN.test(logoUrl)) {
    throw new MerchConceptError(
      400,
      "invalid_logo_url",
      "logoUrl must be a public HTTPS URL",
    );
  }
  const providerProductId = optionalPositiveInteger(
    input.providerProductId,
    "providerProductId",
  );
  const providerVariantId = optionalPositiveInteger(
    input.providerVariantId,
    "providerVariantId",
  );
  const providerColorHex =
    input.providerColorHex === null || input.providerColorHex === undefined
      ? null
      : requireHex(input.providerColorHex, "providerColorHex");
  if (
    provider === "printful" &&
    (!providerProductId || !providerVariantId || !providerColorHex)
  ) {
    throw new MerchConceptError(
      400,
      "invalid_provider_variant",
      "Printful concepts require provider product, variant and catalog color",
    );
  }

  if (
    provider === "printful" &&
    providerProductId !== productSpec.providerProductId
  ) {
    throw new MerchConceptError(
      400,
      "invalid_provider_product",
      "Printful product does not match the selected merch product",
    );
  }

  return {
    productId,
    supplierKey: optionalText(input.supplierKey, 512),
    supplierName: optionalText(input.supplierName, 512),
    provider,
    providerProductId,
    providerVariantId,
    providerColorName: optionalText(input.providerColorName, 160),
    providerColorHex,
    requestedColorHex: requireHex(input.requestedColorHex, "requestedColorHex"),
    logoUrl,
    logoVariant,
    placement,
    printWidthMm,
    printHeightMm,
    technique,
    mockupUrls: normalizeMockupUrls(input.mockupUrls),
  };
}

export function buildMerchConceptKey(input: MerchConceptInput): string {
  const payload = {
    productId: input.productId,
    supplierKey: input.supplierKey ?? "",
    provider: input.provider,
    providerProductId: input.providerProductId ?? null,
    providerVariantId: input.providerVariantId ?? null,
    providerColorHex: input.providerColorHex ?? null,
    requestedColorHex: input.requestedColorHex,
    logoUrl: input.logoUrl,
    logoVariant: input.logoVariant,
    placement: input.placement,
    printWidthMm: input.printWidthMm,
    printHeightMm: input.printHeightMm,
    technique: input.technique,
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function mapRow(row: Record<string, unknown>): MerchConceptRecord {
  const mockupUrls = Array.isArray(row.mockup_urls)
    ? row.mockup_urls.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    conceptKey: String(row.concept_key),
    productId: String(row.product_id) as MerchMockupProductId,
    supplierKey: optionalText(row.supplier_key, 512),
    supplierName: optionalText(row.supplier_name, 512),
    provider: String(row.provider) as MerchConceptProvider,
    providerProductId:
      row.provider_product_id === null ? null : Number(row.provider_product_id),
    providerVariantId:
      row.provider_variant_id === null ? null : Number(row.provider_variant_id),
    providerColorName: optionalText(row.provider_color_name, 160),
    providerColorHex: optionalText(row.provider_color_hex, 7),
    requestedColorHex: String(row.requested_color_hex),
    logoUrl: String(row.logo_url),
    logoVariant: String(row.logo_variant) as MerchLogoVariant,
    placement: String(row.placement),
    printWidthMm: Number(row.print_width_mm),
    printHeightMm: Number(row.print_height_mm),
    technique: String(row.technique) as MerchProductionTechnique,
    mockupUrls,
    status: String(row.status) as MerchConceptStatus,
    createdByUserId: optionalText(row.created_by_user_id, 512),
    updatedByUserId: optionalText(row.updated_by_user_id, 512),
    approvedByUserId: optionalText(row.approved_by_user_id, 512),
    approvedAt: row.approved_at ? iso(row.approved_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const RETURNING_COLUMNS = `
  id, project_id, concept_key, product_id, supplier_key, supplier_name,
  provider, provider_product_id, provider_variant_id, provider_color_name,
  provider_color_hex, requested_color_hex, logo_url, logo_variant, placement,
  print_width_mm, print_height_mm, technique, mockup_urls, status,
  created_by_user_id, updated_by_user_id, approved_by_user_id, approved_at,
  created_at, updated_at`;

export async function saveMerchConcept(
  pool: Pool,
  projectId: string,
  userId: string | null,
  rawInput: unknown,
): Promise<{ concept: MerchConceptRecord; deduplicated: boolean }> {
  if (!projectId)
    throw new MerchConceptError(
      400,
      "invalid_project",
      "projectId is required",
    );
  const input = normalizeMerchConceptInput(rawInput);
  const conceptKey = buildMerchConceptKey(input);
  const result = await pool.query(
    `INSERT INTO role_room_merch_concepts (
       project_id, concept_key, product_id, supplier_key, supplier_name,
       provider, provider_product_id, provider_variant_id, provider_color_name,
       provider_color_hex, requested_color_hex, logo_url, logo_variant, placement,
       print_width_mm, print_height_mm, technique, mockup_urls,
       created_by_user_id, updated_by_user_id
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18::jsonb, $19, $19
     )
     ON CONFLICT (project_id, concept_key) DO UPDATE SET
       supplier_name = EXCLUDED.supplier_name,
       mockup_urls = CASE
         WHEN jsonb_array_length(EXCLUDED.mockup_urls) > 0 THEN EXCLUDED.mockup_urls
         ELSE role_room_merch_concepts.mockup_urls
       END,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = now()
     RETURNING ${RETURNING_COLUMNS}, (xmax <> 0) AS deduplicated`,
    [
      projectId,
      conceptKey,
      input.productId,
      input.supplierKey ?? "",
      input.supplierName,
      input.provider,
      input.providerProductId,
      input.providerVariantId,
      input.providerColorName,
      input.providerColorHex,
      input.requestedColorHex,
      input.logoUrl,
      input.logoVariant,
      input.placement,
      input.printWidthMm,
      input.printHeightMm,
      input.technique,
      JSON.stringify(input.mockupUrls ?? []),
      userId,
    ],
  );
  return {
    concept: mapRow(result.rows[0] as Record<string, unknown>),
    deduplicated: result.rows[0]?.deduplicated === true,
  };
}

export async function listMerchConcepts(
  pool: Pool,
  projectId: string,
): Promise<MerchConceptRecord[]> {
  const result = await pool.query(
    `SELECT ${RETURNING_COLUMNS}
       FROM role_room_merch_concepts
      WHERE project_id = $1
      ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
               updated_at DESC`,
    [projectId],
  );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

async function updateSimpleStatus(
  client: Pool | PoolClient,
  projectId: string,
  conceptId: string,
  status: Exclude<MerchConceptStatus, "approved">,
  userId: string | null,
): Promise<MerchConceptRecord> {
  const result = await client.query(
    `UPDATE role_room_merch_concepts
        SET status = $3,
            approved_at = NULL,
            approved_by_user_id = NULL,
            updated_by_user_id = $4,
            updated_at = now()
      WHERE id = $1 AND project_id = $2
      RETURNING ${RETURNING_COLUMNS}`,
    [conceptId, projectId, status, userId],
  );
  if (!result.rows[0]) {
    throw new MerchConceptError(
      404,
      "merch_concept_not_found",
      "Merch concept not found",
    );
  }
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function setMerchConceptStatus(
  pool: Pool,
  projectId: string,
  conceptId: string,
  statusValue: unknown,
  userId: string | null,
): Promise<MerchConceptRecord> {
  const status = String(statusValue ?? "") as MerchConceptStatus;
  if (!ALLOWED_STATUSES.has(status)) {
    throw new MerchConceptError(
      400,
      "invalid_merch_status",
      "status must be draft, approved or archived",
    );
  }
  if (status !== "approved") {
    return updateSimpleStatus(pool, projectId, conceptId, status, userId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(
      `SELECT product_id
         FROM role_room_merch_concepts
        WHERE id = $1 AND project_id = $2
        FOR UPDATE`,
      [conceptId, projectId],
    );
    if (!target.rows[0]) {
      throw new MerchConceptError(
        404,
        "merch_concept_not_found",
        "Merch concept not found",
      );
    }
    const productId = String(target.rows[0].product_id);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${projectId}:${productId}`,
    ]);
    await client.query(
      `UPDATE role_room_merch_concepts
          SET status = 'draft', approved_at = NULL, approved_by_user_id = NULL,
              updated_by_user_id = $3, updated_at = now()
        WHERE project_id = $1 AND product_id = $2 AND status = 'approved' AND id <> $4`,
      [projectId, productId, userId, conceptId],
    );
    const approved = await client.query(
      `UPDATE role_room_merch_concepts
          SET status = 'approved', approved_at = now(), approved_by_user_id = $3,
              updated_by_user_id = $3, updated_at = now()
        WHERE id = $1 AND project_id = $2
        RETURNING ${RETURNING_COLUMNS}`,
      [conceptId, projectId, userId],
    );
    await client.query("COMMIT");
    return mapRow(approved.rows[0] as Record<string, unknown>);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
