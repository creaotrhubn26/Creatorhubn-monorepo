/**
 * role-room-carousel-image-resolver.ts
 *
 * Resolves image refs for carousel slides. Strategy ranked by cost
 * + brand-fit (cheapest + most on-brand first):
 *
 *   1. brand-asset    — R2 lookup (free, most on-brand)
 *   2. user-gallery   — Showcase / capture sessions (free, on-brand)
 *   3. stock          — Unsplash + Pexels (free-tier APIs)
 *   4. ai             — Replicate SDXL (paid, deferred to Slice 5)
 *   5. color-only     — fallback when no image source matches
 *
 * Slice 3 ships strategies 1, 3, and 5. Strategies 2 + 4 ship in
 * Slice 5 alongside the AI generator.
 */

export type ImageStrategy =
  | "brand-asset"
  | "user-gallery"
  | "stock"
  | "ai"
  | "color-only";

export interface BrandAssetImageRef {
  strategy: "brand-asset";
  assetId: string;
  url: string;
  alt: string;
}
export interface UserGalleryImageRef {
  strategy: "user-gallery";
  galleryId: string;
  assetId: string;
  url: string;
  alt: string;
}
export interface StockImageRef {
  strategy: "stock";
  provider: "unsplash" | "pexels";
  photoId: string;
  url: string;
  thumbnailUrl: string;
  attribution: string;
  attributionUrl: string;
}
export interface AiImageRef {
  strategy: "ai";
  prompt: string;
  generatedUrl: string;
  cost: number;
  model: string;
}
export interface ColorOnlyImageRef {
  strategy: "color-only";
  /** Hex string used as the slide background */
  color: string;
  /** When true the slide layout must work without imagery (validated upstream). */
  textFirst: true;
}

export type ImageRef =
  | BrandAssetImageRef
  | UserGalleryImageRef
  | StockImageRef
  | AiImageRef
  | ColorOnlyImageRef;

// ─────────────────────────────────────────────────────────
// Resolver context — pluggable strategies for testability
// ─────────────────────────────────────────────────────────

export interface BrandAssetLookupParams {
  userId: string;
  prompt: string;
  /** Tags to match against (extracted from imagePrompt). */
  tags: string[];
}
export type BrandAssetLookup = (
  params: BrandAssetLookupParams,
) => Promise<BrandAssetImageRef | null>;

export interface StockSearchParams {
  query: string;
  orientation?: "landscape" | "portrait" | "square";
  perPage?: number;
}
export type StockSearchFn = (
  params: StockSearchParams,
) => Promise<StockImageRef | null>;

export interface ResolverContext {
  brandAssetLookup: BrandAssetLookup;
  stockSearch: StockSearchFn;
  /** Hex color to fall back to when nothing else matches. */
  fallbackColor: string;
  /** When true we'll skip stock/AI and stick to brand-asset + color-only. */
  brandFirstOnly?: boolean;
}

// ─────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────

export interface ResolveImageInput {
  userId: string;
  imagePrompt: string;
  /** Layout's `worksWithoutImage` flag — if true we can fall back to color-only without warning. */
  worksWithoutImage: boolean;
}

export async function resolveImage(
  input: ResolveImageInput,
  ctx: ResolverContext,
): Promise<ImageRef> {
  const tags = extractTags(input.imagePrompt);

  // 1. Brand-asset
  try {
    const brand = await ctx.brandAssetLookup({
      userId: input.userId,
      prompt: input.imagePrompt,
      tags,
    });
    if (brand) return brand;
  } catch {
    // Continue to next strategy
  }

  // 2. Stock (unless brand-first-only)
  if (!ctx.brandFirstOnly) {
    try {
      const stock = await ctx.stockSearch({
        query: input.imagePrompt,
        orientation: "square",
        perPage: 5,
      });
      if (stock) return stock;
    } catch {
      // Continue to fallback
    }
  }

  // 3. Color-only fallback
  return {
    strategy: "color-only",
    color: ctx.fallbackColor,
    textFirst: true,
  };
}

// ─────────────────────────────────────────────────────────
// Tag extraction — light NLP, stop-word filtering
// ─────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "with",
  "for", "by", "from", "as", "is", "was", "were", "are", "be", "been",
  "et", "en", "og", "eller", "av", "i", "på", "til", "med", "for",
  "fra", "som", "er", "var", "være", "blitt",
]);

export function extractTags(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9æøåéà\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8);
}

// ─────────────────────────────────────────────────────────
// Default DB-backed brand-asset lookup
// ─────────────────────────────────────────────────────────

import type { Pool } from "pg";

export function makeBrandAssetLookup(pool: Pool): BrandAssetLookup {
  return async ({ userId, tags }) => {
    if (tags.length === 0) return null;
    try {
      const result = await pool.query<{
        id: string;
        url: string;
        alt_text: string | null;
      }>(
        `SELECT id, url, alt_text
           FROM brand_assets
          WHERE user_id = $1
            AND is_active = true
            AND (
              tags && $2
              OR keyword_match($1, alt_text, $3)
            )
          ORDER BY relevance_score DESC NULLS LAST
          LIMIT 1`,
        [userId, tags, tags.join(" ")],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        strategy: "brand-asset",
        assetId: row.id,
        url: row.url,
        alt: row.alt_text ?? "",
      };
    } catch {
      // Schema may not exist yet (brand_assets tabell ikke ferdig);
      // resolver tolerates this and falls through to next strategy.
      return null;
    }
  };
}

// ─────────────────────────────────────────────────────────
// Unsplash search (free-tier, demo-key fallback)
// ─────────────────────────────────────────────────────────

interface UnsplashSearchResponse {
  results: Array<{
    id: string;
    urls: { regular: string; small: string };
    user: { name: string; links: { html: string } };
    alt_description: string | null;
  }>;
}

export function makeUnsplashSearch(): StockSearchFn {
  return async ({ query, orientation = "square", perPage = 5 }) => {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return null;

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", orientation);
    url.searchParams.set("per_page", String(perPage));

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as UnsplashSearchResponse;
    const photo = data.results?.[0];
    if (!photo) return null;
    return {
      strategy: "stock",
      provider: "unsplash",
      photoId: photo.id,
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      attribution: photo.user.name,
      attributionUrl: photo.user.links.html,
    };
  };
}

// ─────────────────────────────────────────────────────────
// Convenience: build a default ResolverContext
// ─────────────────────────────────────────────────────────

export function makeDefaultResolverContext(
  pool: Pool,
  fallbackColor: string,
): ResolverContext {
  return {
    brandAssetLookup: makeBrandAssetLookup(pool),
    stockSearch: makeUnsplashSearch(),
    fallbackColor,
  };
}
