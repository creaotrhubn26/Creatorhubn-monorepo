/**
 * Role Room — Printful Mockup Generator wrapper.
 *
 * Renders photorealistic merch previews (T-shirt, hoodie, polo, cap,
 * tote, mug) by submitting the customer's logo to Printful's mockup
 * generator API. Used by the Slice 5 mockup-preview UI in the
 * Role Room agent's Merch tab.
 *
 * Cost: free (Printful covers mockup generation in their API tier).
 * Latency: 5–30s per render; we cache aggressively because the same
 * logo + product combination always yields the same mockup.
 *
 * Auth: PRINTFUL_API_KEY in Render env (see render.yaml). When the key
 * is missing the routes return 503 so the UI can show a clear "wire
 * Printful first" message rather than a generic 500.
 *
 * Vehicle wrap is intentionally not supported here — Printful's catalog
 * doesn't carry vehicle wraps. The UI shows the customer's wrap-shop
 * suppliers (from Slice 1+2) and a note that they handle wrap mockups
 * directly.
 */

import crypto from "crypto";
import type { Pool } from "pg";

const PRINTFUL_API_BASE = "https://api.printful.com";
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;
const CACHE_TTL_DAYS = 30;

export type MerchMockupProductId =
  | "tshirt"
  | "hoodie"
  | "polo"
  | "cap"
  | "totebag"
  | "mug";

/** Hardcoded Printful product + variant + placement + print-area
 *  defaults per product. All IDs and placements verified against
 *  Printful's live Catalog + Mockup-Generator APIs (2026-05). The
 *  position is computed server-side from these dims so the logo
 *  lands centred, scaled to ~half the area width.
 *
 *  Placement list per product comes from
 *  GET /mockup-generator/printfiles/{product_id} → available_placements.
 *  Polo 670 has ONLY embroidery placements — no flat-print "front" — so
 *  we use embroidery_chest_left, the standard polo logo spot. */
const PRINTFUL_PRODUCT_MAP: Record<
  MerchMockupProductId,
  {
    productId: number;
    variantId: number;
    placement: string;
    /** Printable area dimensions, in pixels at the product's native dpi.
     *  Source: /mockup-generator/printfiles/{id} → printfiles[*]. */
    areaWidth: number;
    areaHeight: number;
    label: string;
  }
> = {
  // Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt — White S
  tshirt: { productId: 71, variantId: 4011, placement: "front", areaWidth: 1800, areaHeight: 2400, label: "T-skjorte" },
  // Gildan 18500 Unisex Heavy Blend Hooded Sweatshirt — White M
  hoodie: { productId: 146, variantId: 5523, placement: "front", areaWidth: 1800, areaHeight: 2400, label: "Hettegenser" },
  // Gildan 64800 Unisex Pique Polo Shirt — Black M. Polo 670's printfiles
  // are embroidery-only; use the standard chest-left placement.
  polo: { productId: 670, variantId: 16753, placement: "embroidery_chest_left", areaWidth: 1200, areaHeight: 1200, label: "Polo" },
  // Yupoong 7005 5-Panel Cap — Black, one size. Cap printfile is 600x300
  // (front panel), so logo must be wider than tall to look right.
  cap: { productId: 92, variantId: 4622, placement: "embroidery_front", areaWidth: 600, areaHeight: 300, label: "Caps" },
  // All-Over Print Tote Bag — Black 15"×15"
  totebag: { productId: 84, variantId: 4533, placement: "default", areaWidth: 2550, areaHeight: 2475, label: "Totebag" },
  // White Glossy Mug 11oz — wraparound print area is 2700x1050
  mug: { productId: 19, variantId: 1320, placement: "default", areaWidth: 2700, areaHeight: 1050, label: "Krus" },
};

/** Compute a centred logo position that fills ~50% of the area's
 *  shorter dimension, kept square. Top is offset 20% from top so chest
 *  logos land high rather than mid-torso. */
function computeLogoPosition(map: { areaWidth: number; areaHeight: number }): {
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  top: number;
  left: number;
} {
  const shorter = Math.min(map.areaWidth, map.areaHeight);
  const logoSide = Math.round(shorter * 0.5);
  const left = Math.round((map.areaWidth - logoSide) / 2);
  const top = Math.round(map.areaHeight * 0.2);
  return {
    area_width: map.areaWidth,
    area_height: map.areaHeight,
    width: logoSide,
    height: logoSide,
    top,
    left,
  };
}

export function isPrintfulConfigured(): boolean {
  const hasKey = typeof process.env.PRINTFUL_API_KEY === "string"
    && process.env.PRINTFUL_API_KEY.trim().length > 0;
  const hasStore = typeof process.env.PRINTFUL_STORE_ID === "string"
    && process.env.PRINTFUL_STORE_ID.trim().length > 0;
  // Printful's mockup-generator endpoints ALL require a store_id, even
  // for account-level tokens. We require both env vars to be set so
  // the route can fail fast with a clear 503 instead of confusing the
  // producer with a 400 from Printful at render time.
  return hasKey && hasStore;
}

/** Build the auth + store-context headers Printful's mockup-generator
 *  requires. Returns the headers and a friendly error if PRINTFUL_STORE_ID
 *  is missing — caller should check before issuing the request. */
function buildPrintfulHeaders(): Record<string, string> {
  const apiKey = process.env.PRINTFUL_API_KEY?.trim() ?? "";
  const storeId = process.env.PRINTFUL_STORE_ID?.trim() ?? "";
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-PF-Store-Id": storeId,
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

/** SHA-256 of (productId, variantId, designImageUrl). Same inputs always
 *  produce the same Printful mockup, so the cache is safe to hold for
 *  weeks. */
function buildCacheKey(productId: MerchMockupProductId, designImageUrl: string): string {
  const map = PRINTFUL_PRODUCT_MAP[productId];
  const h = crypto.createHash("sha256");
  h.update(`${map.productId}\x1f${map.variantId}\x1f${designImageUrl}`);
  return h.digest("hex");
}

interface CachedMockup {
  cacheKey: string;
  mockupUrl: string;
  productId: MerchMockupProductId;
  expiresAt: Date;
}

async function lookupCachedMockup(pool: Pool, cacheKey: string): Promise<CachedMockup | null> {
  try {
    const result = await pool.query(
      `SELECT cache_key, mockup_url, product_id, expires_at
         FROM role_room_merch_mockup_cache
         WHERE cache_key = $1
           AND expires_at > now()
         LIMIT 1`,
      [cacheKey],
    );
    if (!result.rows[0]) return null;
    return {
      cacheKey: result.rows[0].cache_key,
      mockupUrl: result.rows[0].mockup_url,
      productId: result.rows[0].product_id,
      expiresAt: result.rows[0].expires_at,
    };
  } catch {
    // Table may not exist yet on first deploy — fall through to live
    // request. The CREATE TABLE ships in the same release as this code.
    return null;
  }
}

async function storeCachedMockup(
  pool: Pool,
  params: { cacheKey: string; mockupUrl: string; productId: MerchMockupProductId },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO role_room_merch_mockup_cache (
         cache_key, product_id, mockup_url, expires_at
       ) VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)
       ON CONFLICT (cache_key) DO UPDATE SET
         mockup_url = EXCLUDED.mockup_url,
         expires_at = EXCLUDED.expires_at`,
      [params.cacheKey, params.productId, params.mockupUrl, String(CACHE_TTL_DAYS)],
    );
  } catch {
    // Cache writes are advisory.
  }
}

async function pollPrintfulTask(taskKey: string): Promise<string> {
  const headers = buildPrintfulHeaders();
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(
      `${PRINTFUL_API_BASE}/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      {
        headers,
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      throw new PrintfulMockupError(
        response.status,
        `Printful poll failed: ${response.status} ${response.statusText}`,
      );
    }
    const payload = (await response.json().catch(() => null)) as
      | { result?: { status?: string; mockups?: Array<{ mockup_url?: string }> } }
      | null;
    const status = payload?.result?.status;
    if (status === "completed") {
      const mockups = payload?.result?.mockups ?? [];
      const url = mockups[0]?.mockup_url;
      if (!url) {
        throw new PrintfulMockupError(502, "Printful task completed without mockup_url");
      }
      return url;
    }
    if (status === "failed") {
      throw new PrintfulMockupError(502, "Printful task failed");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new PrintfulMockupError(504, "Printful task timed out");
}

/**
 * End-to-end: create a Printful mockup task for the given product +
 * design image URL, poll until done, return the final mockup URL.
 * Uses the Postgres cache to short-circuit identical requests.
 */
export async function generateMerchMockup(
  pool: Pool,
  params: {
    productId: MerchMockupProductId;
    designImageUrl: string;
  },
): Promise<{ mockupUrl: string; cached: boolean; productLabel: string }> {
  const map = PRINTFUL_PRODUCT_MAP[params.productId];
  if (!map) {
    throw new PrintfulMockupError(400, `Unsupported productId: ${params.productId}`);
  }
  if (!params.designImageUrl || !/^https?:\/\//i.test(params.designImageUrl)) {
    throw new PrintfulMockupError(400, "designImageUrl must be a public http(s) URL");
  }
  if (!isPrintfulConfigured()) {
    throw new PrintfulMockupError(
      503,
      "PRINTFUL_API_KEY and PRINTFUL_STORE_ID must both be set in backend env",
    );
  }

  const cacheKey = buildCacheKey(params.productId, params.designImageUrl);
  const cached = await lookupCachedMockup(pool, cacheKey);
  if (cached) {
    return { mockupUrl: cached.mockupUrl, cached: true, productLabel: map.label };
  }

  // Create the mockup task. The body shape follows Printful's
  // mockup-generator spec — `placement` is product-specific, and
  // `image_url` must be publicly fetchable by Printful's renderer.
  const createResponse = await fetch(
    `${PRINTFUL_API_BASE}/mockup-generator/create-task/${map.productId}`,
    {
      method: "POST",
      headers: {
        ...buildPrintfulHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variant_ids: [map.variantId],
        format: "jpg",
        files: [
          {
            placement: map.placement,
            image_url: params.designImageUrl,
            // Printful errors with MG-4 "Position field is missing" if
            // we omit this. Centred logo, 50% of shorter side, chest-high.
            position: computeLogoPosition(map),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!createResponse.ok) {
    const body = await createResponse.text().catch(() => "");
    throw new PrintfulMockupError(
      createResponse.status,
      `Printful create-task failed: ${createResponse.status} ${body.slice(0, 200)}`,
    );
  }
  const createPayload = (await createResponse.json().catch(() => null)) as
    | { result?: { task_key?: string } }
    | null;
  const taskKey = createPayload?.result?.task_key;
  if (!taskKey) {
    throw new PrintfulMockupError(502, "Printful create-task did not return task_key");
  }

  const mockupUrl = await pollPrintfulTask(taskKey);
  await storeCachedMockup(pool, {
    cacheKey,
    mockupUrl,
    productId: params.productId,
  });

  return { mockupUrl, cached: false, productLabel: map.label };
}
