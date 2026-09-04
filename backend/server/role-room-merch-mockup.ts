/**
 * Role Room — Printful catalog + mockup adapter.
 *
 * The adapter exposes the real catalog variant/color used for a concept,
 * validates product-specific production limits and caches identical provider
 * renders. Provider URLs are temporary, so persisted concepts keep the exact
 * catalog metadata as well as every returned preview URL.
 */

import crypto from "crypto";
import type { Pool } from "pg";

const PRINTFUL_API_BASE = "https://api.printful.com";
const INITIAL_POLL_DELAY_MS = 10_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 60_000;
const CACHE_TTL_HOURS = 20;
const CATALOG_CACHE_TTL_MS = 30 * 60_000;
const PRINTFILE_CACHE_TTL_MS = 30 * 60_000;

export type MerchMockupProductId =
  "tshirt" | "hoodie" | "polo" | "cap" | "totebag" | "mug";

export type MerchProductionTechnique =
  | "screen_print"
  | "dtg"
  | "dtfilm"
  | "embroidery"
  | "cut_sew"
  | "sublimation"
  | "vinyl"
  | "promo_products";

export interface MerchPlacementSpec {
  id: string;
  label: string;
  maxWidthMm: number;
  maxHeightMm: number;
  defaultWidthMm: number;
  defaultHeightMm: number;
  techniques: MerchProductionTechnique[];
}

export interface MerchProductSpec {
  productId: MerchMockupProductId;
  label: string;
  provider: "printful";
  providerProductId: number;
  defaultVariantId: number;
  defaultColorName: string;
  defaultColorHex: string;
  techniques: MerchProductionTechnique[];
  placements: MerchPlacementSpec[];
}

export interface MerchCatalogVariant {
  id: number;
  productId: number;
  name: string;
  size: string | null;
  colorName: string;
  colorHex: string;
  colorHex2: string | null;
  imageUrl: string | null;
}

interface InternalPlacementSpec extends MerchPlacementSpec {
  providerPlacements: Partial<Record<MerchProductionTechnique, string[]>>;
}

interface InternalProductSpec extends Omit<MerchProductSpec, "placements"> {
  defaultPlacement: string;
  placements: InternalPlacementSpec[];
}

const PRINTFUL_PRODUCT_MAP: Record<MerchMockupProductId, InternalProductSpec> =
  {
    tshirt: {
      productId: "tshirt",
      label: "T-skjorte",
      provider: "printful",
      providerProductId: 71,
      defaultVariantId: 4011,
      defaultColorName: "White",
      defaultColorHex: "#FFFFFF",
      defaultPlacement: "front",
      techniques: ["dtg", "dtfilm", "embroidery"],
      placements: [
        {
          id: "front",
          label: "Front",
          maxWidthMm: 300,
          maxHeightMm: 400,
          defaultWidthMm: 220,
          defaultHeightMm: 180,
          techniques: ["dtg", "dtfilm"],
          providerPlacements: {
            dtg: ["front", "default"],
            dtfilm: ["front_dtf", "front"],
          },
        },
        {
          id: "back",
          label: "Rygg",
          maxWidthMm: 300,
          maxHeightMm: 400,
          defaultWidthMm: 250,
          defaultHeightMm: 220,
          techniques: ["dtg", "dtfilm"],
          providerPlacements: { dtg: ["back"], dtfilm: ["back_dtf", "back"] },
        },
        {
          id: "left_chest",
          label: "Venstre bryst",
          maxWidthMm: 100,
          maxHeightMm: 100,
          defaultWidthMm: 75,
          defaultHeightMm: 55,
          techniques: ["embroidery"],
          providerPlacements: { embroidery: ["embroidery_chest_left"] },
        },
      ],
    },
    hoodie: {
      productId: "hoodie",
      label: "Hettegenser",
      provider: "printful",
      providerProductId: 146,
      defaultVariantId: 5523,
      defaultColorName: "White",
      defaultColorHex: "#FFFFFF",
      defaultPlacement: "front",
      techniques: ["dtg", "dtfilm", "embroidery"],
      placements: [
        {
          id: "front",
          label: "Front",
          maxWidthMm: 300,
          maxHeightMm: 360,
          defaultWidthMm: 220,
          defaultHeightMm: 170,
          techniques: ["dtg", "dtfilm"],
          providerPlacements: {
            dtg: ["front", "default"],
            dtfilm: ["front_dtf", "front"],
          },
        },
        {
          id: "back",
          label: "Rygg",
          maxWidthMm: 300,
          maxHeightMm: 400,
          defaultWidthMm: 250,
          defaultHeightMm: 220,
          techniques: ["dtg", "dtfilm"],
          providerPlacements: { dtg: ["back"], dtfilm: ["back_dtf", "back"] },
        },
        {
          id: "left_chest",
          label: "Venstre bryst",
          maxWidthMm: 100,
          maxHeightMm: 100,
          defaultWidthMm: 75,
          defaultHeightMm: 55,
          techniques: ["embroidery"],
          providerPlacements: { embroidery: ["embroidery_chest_left"] },
        },
      ],
    },
    polo: {
      productId: "polo",
      label: "Polo",
      provider: "printful",
      providerProductId: 670,
      defaultVariantId: 16753,
      defaultColorName: "Black",
      defaultColorHex: "#171717",
      defaultPlacement: "left_chest",
      techniques: ["embroidery", "dtfilm"],
      placements: [
        {
          id: "left_chest",
          label: "Venstre bryst",
          maxWidthMm: 100,
          maxHeightMm: 100,
          defaultWidthMm: 75,
          defaultHeightMm: 55,
          techniques: ["embroidery", "dtfilm"],
          providerPlacements: {
            embroidery: ["embroidery_chest_left"],
            dtfilm: ["chest_left_dtf"],
          },
        },
      ],
    },
    cap: {
      productId: "cap",
      label: "Caps",
      provider: "printful",
      providerProductId: 92,
      defaultVariantId: 4622,
      defaultColorName: "Black",
      defaultColorHex: "#171717",
      defaultPlacement: "front",
      techniques: ["embroidery"],
      placements: [
        {
          id: "front",
          label: "Frontpanel",
          maxWidthMm: 100,
          maxHeightMm: 50,
          defaultWidthMm: 75,
          defaultHeightMm: 35,
          techniques: ["embroidery"],
          providerPlacements: {
            embroidery: ["embroidery_front", "front", "default"],
          },
        },
        {
          id: "back",
          label: "Bak",
          maxWidthMm: 100,
          maxHeightMm: 50,
          defaultWidthMm: 60,
          defaultHeightMm: 30,
          techniques: ["embroidery"],
          providerPlacements: { embroidery: ["embroidery_back", "back"] },
        },
      ],
    },
    totebag: {
      productId: "totebag",
      label: "Totebag",
      provider: "printful",
      providerProductId: 84,
      defaultVariantId: 4533,
      defaultColorName: "Black",
      defaultColorHex: "#171717",
      defaultPlacement: "default",
      techniques: ["cut_sew"],
      placements: [
        {
          id: "default",
          label: "All-over",
          maxWidthMm: 300,
          maxHeightMm: 300,
          defaultWidthMm: 220,
          defaultHeightMm: 180,
          techniques: ["cut_sew"],
          providerPlacements: { cut_sew: ["default"] },
        },
      ],
    },
    mug: {
      productId: "mug",
      label: "Krus",
      provider: "printful",
      providerProductId: 19,
      defaultVariantId: 1320,
      defaultColorName: "White",
      defaultColorHex: "#FFFFFF",
      defaultPlacement: "default",
      techniques: ["sublimation"],
      placements: [
        {
          id: "default",
          label: "Side / omslag",
          maxWidthMm: 210,
          maxHeightMm: 85,
          defaultWidthMm: 90,
          defaultHeightMm: 55,
          techniques: ["sublimation"],
          providerPlacements: { sublimation: ["default"] },
        },
      ],
    },
  };

export function getMerchProductSpec(
  productId: string,
): MerchProductSpec | null {
  const spec = PRINTFUL_PRODUCT_MAP[productId as MerchMockupProductId];
  if (!spec) return null;
  return {
    productId: spec.productId,
    label: spec.label,
    provider: spec.provider,
    providerProductId: spec.providerProductId,
    defaultVariantId: spec.defaultVariantId,
    defaultColorName: spec.defaultColorName,
    defaultColorHex: spec.defaultColorHex,
    techniques: [...spec.techniques],
    placements: spec.placements.map((placement) => ({
      id: placement.id,
      label: placement.label,
      maxWidthMm: placement.maxWidthMm,
      maxHeightMm: placement.maxHeightMm,
      defaultWidthMm: placement.defaultWidthMm,
      defaultHeightMm: placement.defaultHeightMm,
      techniques: [...placement.techniques],
    })),
  };
}

export function listMerchProductSpecs(): MerchProductSpec[] {
  return Object.keys(PRINTFUL_PRODUCT_MAP)
    .map((productId) => getMerchProductSpec(productId)!)
    .filter(Boolean);
}

export function isPrintfulConfigured(): boolean {
  return Boolean(
    process.env.PRINTFUL_API_KEY?.trim() &&
    process.env.PRINTFUL_STORE_ID?.trim(),
  );
}

function buildPrintfulHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY?.trim() ?? ""}`,
    "X-PF-Store-Id": process.env.PRINTFUL_STORE_ID?.trim() ?? "",
  };
}

export class PrintfulMockupError extends Error {
  readonly httpStatus: number;
  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "PrintfulMockupError";
    this.httpStatus = httpStatus;
  }
}

const catalogCache = new Map<
  MerchMockupProductId,
  { expiresAt: number; variants: MerchCatalogVariant[] }
>();

function preferredSizeScore(size: string | null): number {
  const normalized = (size ?? "").toUpperCase();
  if (normalized === "M") return 4;
  if (normalized === "L") return 3;
  if (normalized === "S") return 2;
  return 1;
}

export async function listMerchCatalogVariants(
  productId: MerchMockupProductId,
  forceRefresh = false,
): Promise<MerchCatalogVariant[]> {
  const spec = PRINTFUL_PRODUCT_MAP[productId];
  if (!spec)
    throw new PrintfulMockupError(400, `Unsupported productId: ${productId}`);
  if (!isPrintfulConfigured()) {
    throw new PrintfulMockupError(
      503,
      "PRINTFUL_API_KEY and PRINTFUL_STORE_ID must both be set in backend env",
    );
  }
  const cached = catalogCache.get(productId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now())
    return cached.variants;

  const collected: MerchCatalogVariant[] = [];
  let offset = 0;
  const limit = 100;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total && offset < 500) {
    const url = new URL(
      `${PRINTFUL_API_BASE}/v2/catalog-products/${spec.providerProductId}/catalog-variants`,
    );
    url.searchParams.set("selling_region_name", "europe");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: buildPrintfulHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new PrintfulMockupError(
        response.status,
        `Printful catalog failed: ${response.status} ${body.slice(0, 240)}`,
      );
    }
    const payload = (await response.json().catch(() => null)) as {
      data?: Array<{
        id?: unknown;
        catalog_product_id?: unknown;
        name?: unknown;
        size?: unknown;
        color?: unknown;
        color_code?: unknown;
        color_code2?: unknown;
        image?: unknown;
      }>;
      paging?: { total?: unknown };
    } | null;
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    for (const row of rows) {
      const id = Number(row.id);
      const catalogProductId = Number(row.catalog_product_id);
      const colorHex =
        typeof row.color_code === "string"
          ? row.color_code.trim().toUpperCase()
          : "";
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        catalogProductId !== spec.providerProductId ||
        !/^#[0-9A-F]{6}$/.test(colorHex)
      ) {
        continue;
      }
      collected.push({
        id,
        productId: catalogProductId,
        name:
          typeof row.name === "string"
            ? row.name.trim()
            : `${spec.label} variant ${id}`,
        size:
          typeof row.size === "string" && row.size.trim()
            ? row.size.trim()
            : null,
        colorName:
          typeof row.color === "string" && row.color.trim()
            ? row.color.trim()
            : colorHex,
        colorHex,
        colorHex2:
          typeof row.color_code2 === "string" &&
          /^#[0-9a-f]{6}$/i.test(row.color_code2.trim())
            ? row.color_code2.trim().toUpperCase()
            : null,
        imageUrl:
          typeof row.image === "string" && /^https:\/\//i.test(row.image.trim())
            ? row.image.trim()
            : null,
      });
    }
    const parsedTotal = Number(payload?.paging?.total);
    total =
      Number.isFinite(parsedTotal) && parsedTotal >= 0
        ? parsedTotal
        : offset + rows.length;
    if (rows.length < limit) break;
    offset += limit;
  }

  const byColor = new Map<string, MerchCatalogVariant>();
  for (const variant of collected) {
    const key = `${variant.colorHex}|${variant.colorHex2 ?? ""}`;
    const current = byColor.get(key);
    if (
      !current ||
      preferredSizeScore(variant.size) > preferredSizeScore(current.size)
    ) {
      byColor.set(key, variant);
    }
  }
  const variants = [...byColor.values()].sort((left, right) =>
    left.colorName.localeCompare(right.colorName, "en"),
  );
  if (variants.length === 0) {
    throw new PrintfulMockupError(
      502,
      `Printful catalog returned no usable colors for ${productId}`,
    );
  }
  catalogCache.set(productId, {
    expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    variants,
  });
  return variants;
}

interface PrintfileInfo {
  printfiles: Array<{
    printfile_id?: unknown;
    width?: unknown;
    height?: unknown;
  }>;
  variant_printfiles: Array<{
    variant_id?: unknown;
    placements?: Record<string, unknown>;
  }>;
}

interface ResolvedPrintfileArea {
  providerPlacement: string;
  areaWidth: number;
  areaHeight: number;
}

const PROVIDER_TECHNIQUE: Partial<Record<MerchProductionTechnique, string>> = {
  dtg: "DTG",
  dtfilm: "DTFILM",
  embroidery: "EMBROIDERY",
  cut_sew: "CUT-SEW",
  sublimation: "SUBLIMATION",
};

const printfileCache = new Map<
  string,
  { expiresAt: number; info: PrintfileInfo }
>();

async function getPrintfileInfo(
  spec: InternalProductSpec,
  technique: MerchProductionTechnique,
): Promise<PrintfileInfo> {
  const providerTechnique = PROVIDER_TECHNIQUE[technique];
  if (!providerTechnique) {
    throw new PrintfulMockupError(
      400,
      `Unsupported Printful technique: ${technique}`,
    );
  }
  const cacheKey = `${spec.providerProductId}:${providerTechnique}`;
  const cached = printfileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  const url = new URL(
    `${PRINTFUL_API_BASE}/mockup-generator/printfiles/${spec.providerProductId}`,
  );
  url.searchParams.set("technique", providerTechnique);
  const response = await fetch(url, {
    headers: buildPrintfulHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PrintfulMockupError(
      response.status,
      `Printful printfile lookup failed: ${response.status} ${body.slice(0, 240)}`,
    );
  }
  const payload = (await response.json().catch(() => null)) as {
    result?: Partial<PrintfileInfo>;
  } | null;
  const info: PrintfileInfo = {
    printfiles: Array.isArray(payload?.result?.printfiles)
      ? payload.result.printfiles
      : [],
    variant_printfiles: Array.isArray(payload?.result?.variant_printfiles)
      ? payload.result.variant_printfiles
      : [],
  };
  if (info.printfiles.length === 0 || info.variant_printfiles.length === 0) {
    throw new PrintfulMockupError(
      502,
      "Printful returned incomplete printfile metadata",
    );
  }
  printfileCache.set(cacheKey, {
    expiresAt: Date.now() + PRINTFILE_CACHE_TTL_MS,
    info,
  });
  return info;
}

async function resolvePrintfileArea(
  spec: InternalProductSpec,
  placement: InternalPlacementSpec,
  technique: MerchProductionTechnique,
  variantId: number,
): Promise<ResolvedPrintfileArea> {
  if (!placement.techniques.includes(technique)) {
    throw new PrintfulMockupError(
      400,
      `${technique} is not available for ${placement.label}`,
    );
  }
  const candidates = placement.providerPlacements[technique] ?? [];
  if (candidates.length === 0) {
    throw new PrintfulMockupError(
      400,
      "No provider placement is configured for this production choice",
    );
  }

  const info = await getPrintfileInfo(spec, technique);
  const variantMapping = info.variant_printfiles.find(
    (entry) => Number(entry.variant_id) === variantId,
  );
  const mappedPlacements = variantMapping?.placements ?? {};
  const providerPlacement = candidates.find((candidate) => {
    const printfileId = Number(mappedPlacements[candidate]);
    return Number.isSafeInteger(printfileId) && printfileId > 0;
  });
  if (!providerPlacement) {
    throw new PrintfulMockupError(
      400,
      `Selected variant does not support ${technique} at ${placement.label}`,
    );
  }

  const printfileId = Number(mappedPlacements[providerPlacement]);
  const printfile = info.printfiles.find(
    (entry) => Number(entry.printfile_id) === printfileId,
  );
  const areaWidth = Number(printfile?.width);
  const areaHeight = Number(printfile?.height);
  if (
    !Number.isFinite(areaWidth) ||
    areaWidth <= 0 ||
    !Number.isFinite(areaHeight) ||
    areaHeight <= 0
  ) {
    throw new PrintfulMockupError(
      502,
      "Printful returned invalid print area dimensions",
    );
  }
  return { providerPlacement, areaWidth, areaHeight };
}

function computeLogoPosition(
  area: ResolvedPrintfileArea,
  placement: MerchPlacementSpec,
  printWidthMm: number,
  printHeightMm: number,
): {
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  top: number;
  left: number;
} {
  const width = Math.max(
    1,
    Math.round(area.areaWidth * (printWidthMm / placement.maxWidthMm)),
  );
  const height = Math.max(
    1,
    Math.round(area.areaHeight * (printHeightMm / placement.maxHeightMm)),
  );
  return {
    area_width: area.areaWidth,
    area_height: area.areaHeight,
    width: Math.min(area.areaWidth, width),
    height: Math.min(area.areaHeight, height),
    top: Math.max(
      0,
      Math.round((area.areaHeight - Math.min(area.areaHeight, height)) * 0.28),
    ),
    left: Math.max(
      0,
      Math.round((area.areaWidth - Math.min(area.areaWidth, width)) / 2),
    ),
  };
}

function buildCacheKey(params: {
  productId: MerchMockupProductId;
  variantId: number;
  designImageUrl: string;
  placement: string;
  technique: MerchProductionTechnique;
  printWidthMm: number;
  printHeightMm: number;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        params.productId,
        params.variantId,
        params.designImageUrl,
        params.placement,
        params.technique,
        params.printWidthMm.toFixed(2),
        params.printHeightMm.toFixed(2),
      ].join("\x1f"),
    )
    .digest("hex");
}

interface CachedMockup {
  mockupUrls: string[];
  expiresAt: Date;
}

async function lookupCachedMockup(
  pool: Pool,
  cacheKey: string,
): Promise<CachedMockup | null> {
  try {
    const result = await pool.query(
      `SELECT mockup_url, mockup_urls, expires_at
         FROM role_room_merch_mockup_cache
        WHERE cache_key = $1 AND expires_at > now()
        LIMIT 1`,
      [cacheKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    const urls = Array.isArray(row.mockup_urls)
      ? row.mockup_urls.filter(
          (value: unknown): value is string =>
            typeof value === "string" && /^https:\/\//i.test(value),
        )
      : [];
    if (typeof row.mockup_url === "string" && !urls.includes(row.mockup_url))
      urls.unshift(row.mockup_url);
    return { mockupUrls: urls, expiresAt: row.expires_at };
  } catch {
    return null;
  }
}

async function storeCachedMockup(
  pool: Pool,
  params: {
    cacheKey: string;
    mockupUrls: string[];
    productId: MerchMockupProductId;
  },
): Promise<void> {
  if (!params.mockupUrls[0]) return;
  try {
    await pool.query(
      `INSERT INTO role_room_merch_mockup_cache (
         cache_key, product_id, mockup_url, mockup_urls, expires_at
       ) VALUES ($1, $2, $3, $4::jsonb, now() + ($5 || ' hours')::interval)
       ON CONFLICT (cache_key) DO UPDATE SET
         mockup_url = EXCLUDED.mockup_url,
         mockup_urls = EXCLUDED.mockup_urls,
         expires_at = EXCLUDED.expires_at`,
      [
        params.cacheKey,
        params.productId,
        params.mockupUrls[0],
        JSON.stringify(params.mockupUrls),
        String(CACHE_TTL_HOURS),
      ],
    );
  } catch {
    // Cache writes are advisory; rendering remains available during rollout.
  }
}

async function pollPrintfulTask(taskKey: string): Promise<string[]> {
  const startedAt = Date.now();
  await new Promise((resolve) => setTimeout(resolve, INITIAL_POLL_DELAY_MS));
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(
      `${PRINTFUL_API_BASE}/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      { headers: buildPrintfulHeaders(), signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new PrintfulMockupError(
        response.status,
        `Printful poll failed: ${response.status} ${body.slice(0, 240)}`,
      );
    }
    const payload = (await response.json().catch(() => null)) as {
      result?: {
        status?: string;
        error?: string;
        mockups?: Array<{
          mockup_url?: string;
          extra?: Array<{ url?: string }>;
        }>;
      };
    } | null;
    if (payload?.result?.status === "completed") {
      const urls = (payload.result.mockups ?? [])
        .flatMap((mockup) => [
          mockup.mockup_url,
          ...(mockup.extra ?? []).map((extra) => extra.url),
        ])
        .filter(
          (value): value is string =>
            typeof value === "string" && /^https:\/\//i.test(value),
        );
      const uniqueUrls = [...new Set(urls)];
      if (uniqueUrls.length === 0)
        throw new PrintfulMockupError(
          502,
          "Printful task completed without mockup URLs",
        );
      return uniqueUrls;
    }
    if (payload?.result?.status === "failed") {
      throw new PrintfulMockupError(
        502,
        `Printful task failed: ${payload.result.error || "no error detail"}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new PrintfulMockupError(504, "Printful task timed out");
}

export async function generateMerchMockup(
  pool: Pool,
  params: {
    productId: MerchMockupProductId;
    designImageUrl: string;
    variantId?: number | null;
    placement?: string | null;
    technique?: MerchProductionTechnique | null;
    printWidthMm?: number | null;
    printHeightMm?: number | null;
    forceRefresh?: boolean;
  },
): Promise<{
  mockupUrl: string;
  mockupUrls: string[];
  cached: boolean;
  productLabel: string;
  providerProductId: number;
  providerVariantId: number;
  providerColorName: string;
  providerColorHex: string;
  placement: string;
  providerPlacement: string;
  technique: MerchProductionTechnique;
  printWidthMm: number;
  printHeightMm: number;
}> {
  const spec = PRINTFUL_PRODUCT_MAP[params.productId];
  if (!spec)
    throw new PrintfulMockupError(
      400,
      `Unsupported productId: ${params.productId}`,
    );
  if (!params.designImageUrl || !/^https:\/\//i.test(params.designImageUrl)) {
    throw new PrintfulMockupError(
      400,
      "designImageUrl must be a public HTTPS URL",
    );
  }
  if (!isPrintfulConfigured()) {
    throw new PrintfulMockupError(
      503,
      "PRINTFUL_API_KEY and PRINTFUL_STORE_ID must both be set in backend env",
    );
  }

  const placementId = params.placement || spec.defaultPlacement;
  const placement = spec.placements.find(
    (candidate) => candidate.id === placementId,
  );
  if (!placement)
    throw new PrintfulMockupError(
      400,
      `Unsupported placement for ${params.productId}`,
    );
  const technique = params.technique ?? placement.techniques[0];
  if (!placement.techniques.includes(technique)) {
    throw new PrintfulMockupError(
      400,
      `${technique} is not available for ${placement.label}`,
    );
  }

  const printWidthMm = Number(params.printWidthMm ?? placement.defaultWidthMm);
  const printHeightMm = Number(
    params.printHeightMm ?? placement.defaultHeightMm,
  );
  if (
    !Number.isFinite(printWidthMm) ||
    !Number.isFinite(printHeightMm) ||
    printWidthMm <= 0 ||
    printHeightMm <= 0 ||
    printWidthMm > placement.maxWidthMm ||
    printHeightMm > placement.maxHeightMm
  ) {
    throw new PrintfulMockupError(
      400,
      `Print area must fit within ${placement.maxWidthMm} × ${placement.maxHeightMm} mm for ${placement.label}`,
    );
  }

  let variant: MerchCatalogVariant = {
    id: spec.defaultVariantId,
    productId: spec.providerProductId,
    name: `${spec.label} ${spec.defaultColorName}`,
    size: null,
    colorName: spec.defaultColorName,
    colorHex: spec.defaultColorHex,
    colorHex2: null,
    imageUrl: null,
  };
  if (params.variantId && params.variantId !== spec.defaultVariantId) {
    const catalog = await listMerchCatalogVariants(params.productId);
    const selected = catalog.find(
      (candidate) => candidate.id === params.variantId,
    );
    if (!selected) {
      throw new PrintfulMockupError(
        400,
        "variantId does not belong to the selected product catalog",
      );
    }
    variant = selected;
  } else if (params.variantId === spec.defaultVariantId) {
    const catalog = await listMerchCatalogVariants(params.productId).catch(
      () => [],
    );
    variant =
      catalog.find((candidate) => candidate.id === spec.defaultVariantId) ??
      variant;
  }

  const cacheKey = buildCacheKey({
    productId: params.productId,
    variantId: variant.id,
    designImageUrl: params.designImageUrl,
    placement: placement.id,
    technique,
    printWidthMm,
    printHeightMm,
  });
  const printfileArea = await resolvePrintfileArea(
    spec,
    placement,
    technique,
    variant.id,
  );

  if (!params.forceRefresh) {
    const cached = await lookupCachedMockup(pool, cacheKey);
    if (cached?.mockupUrls[0]) {
      return {
        mockupUrl: cached.mockupUrls[0],
        mockupUrls: cached.mockupUrls,
        cached: true,
        productLabel: spec.label,
        providerProductId: spec.providerProductId,
        providerVariantId: variant.id,
        providerColorName: variant.colorName,
        providerColorHex: variant.colorHex,
        placement: placement.id,
        providerPlacement: printfileArea.providerPlacement,
        technique,
        printWidthMm,
        printHeightMm,
      };
    }
  }

  const createResponse = await fetch(
    `${PRINTFUL_API_BASE}/mockup-generator/create-task/${spec.providerProductId}`,
    {
      method: "POST",
      headers: {
        ...buildPrintfulHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variant_ids: [variant.id],
        format: "jpg",
        width: 1400,
        product_options: { lifelike: true },
        files: [
          {
            placement: printfileArea.providerPlacement,
            image_url: params.designImageUrl,
            position: computeLogoPosition(
              printfileArea,
              placement,
              printWidthMm,
              printHeightMm,
            ),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!createResponse.ok) {
    const body = await createResponse.text().catch(() => "");
    console.error("[merch-mockup] create-task failed", {
      status: createResponse.status,
      productId: params.productId,
      variantId: variant.id,
      placement: printfileArea.providerPlacement,
      technique,
      body,
    });
    throw new PrintfulMockupError(
      createResponse.status,
      `Printful create-task failed: ${createResponse.status} ${body.slice(0, 400)}`,
    );
  }
  const createPayload = (await createResponse.json().catch(() => null)) as {
    result?: { task_key?: string };
  } | null;
  const taskKey = createPayload?.result?.task_key;
  if (!taskKey)
    throw new PrintfulMockupError(
      502,
      "Printful create-task did not return task_key",
    );

  const mockupUrls = await pollPrintfulTask(taskKey);
  await storeCachedMockup(pool, {
    cacheKey,
    mockupUrls,
    productId: params.productId,
  });
  return {
    mockupUrl: mockupUrls[0],
    mockupUrls,
    cached: false,
    productLabel: spec.label,
    providerProductId: spec.providerProductId,
    providerVariantId: variant.id,
    providerColorName: variant.colorName,
    providerColorHex: variant.colorHex,
    placement: placement.id,
    providerPlacement: printfileArea.providerPlacement,
    technique,
    printWidthMm,
    printHeightMm,
  };
}
