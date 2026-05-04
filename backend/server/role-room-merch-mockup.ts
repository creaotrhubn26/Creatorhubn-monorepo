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

/** Hardcoded Printful product + variant + placement defaults per product.
 *  Variant IDs picked as the most photogenic neutral colour (white / black
 *  for caps where white isn't a stocked variant). Producers can later
 *  override variants once we add a variant picker. */
const PRINTFUL_PRODUCT_MAP: Record<
  MerchMockupProductId,
  {
    productId: number;
    variantId: number;
    placement: string;
    label: string;
  }
> = {
  // Bella + Canvas 3001 Unisex Jersey — white S
  tshirt: { productId: 71, variantId: 4011, placement: "front", label: "T-skjorte" },
  // Gildan 18500 Heavy Blend Hoodie — white S
  hoodie: { productId: 146, variantId: 5530, placement: "front", label: "Hettegenser" },
  // Polo Shirt — white S
  polo: { productId: 167, variantId: 7762, placement: "front", label: "Polo" },
  // Snapback Hat — black
  cap: { productId: 92, variantId: 4459, placement: "embroidery_front", label: "Caps" },
  // All-Over Print Tote Bag (Liberty Bags 8804) — natural
  totebag: { productId: 84, variantId: 6318, placement: "default", label: "Totebag" },
  // White Glossy Mug 11oz
  mug: { productId: 19, variantId: 1320, placement: "default", label: "Krus" },
};

export function isPrintfulConfigured(): boolean {
  return typeof process.env.PRINTFUL_API_KEY === "string"
    && process.env.PRINTFUL_API_KEY.trim().length > 0;
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

async function pollPrintfulTask(taskKey: string, apiKey: string): Promise<string> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(
      `${PRINTFUL_API_BASE}/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
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
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new PrintfulMockupError(503, "PRINTFUL_API_KEY not configured");
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
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variant_ids: [map.variantId],
        format: "jpg",
        files: [
          {
            placement: map.placement,
            image_url: params.designImageUrl,
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

  const mockupUrl = await pollPrintfulTask(taskKey, apiKey);
  await storeCachedMockup(pool, {
    cacheKey,
    mockupUrl,
    productId: params.productId,
  });

  return { mockupUrl, cached: false, productLabel: map.label };
}
