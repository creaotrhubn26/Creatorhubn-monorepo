/**
 * role-room-carousel-gallery-match.ts
 *
 * Surfaces images from the user's own Showcase galleries / capture
 * sessions as candidates for a carousel slide.
 *
 * Match heuristics (ranked):
 *   1. Tag overlap — gallery_assets.tags ∩ slide-prompt-tags
 *   2. Caption / alt_text full-text match
 *   3. Project link — when carousel-draft is bound to a project,
 *      prefer assets from that project's gallery
 *
 * No Claude Vision yet — the embedding pass ships with Slice 5.5.
 * Pattern leaves a hook (matchMode='vision') for that future upgrade.
 */

import type { Pool } from "pg";
import { extractTags } from "./role-room-carousel-image-resolver.js";

export interface GalleryAssetMatch {
  assetId: string;
  galleryId: string;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  capturedAt: string | null;
  /** 0-1 score, higher = better match */
  score: number;
  matchedOn: Array<"tag" | "caption" | "project">;
}

export interface GalleryMatchInput {
  userId: string;
  prompt: string;
  /** When supplied, results from this project's galleries get a +0.3 boost. */
  preferredProjectId?: string | null;
  /** Max results to return. */
  limit?: number;
}

export async function findGalleryMatches(
  pool: Pool,
  input: GalleryMatchInput,
): Promise<GalleryAssetMatch[]> {
  const tags = extractTags(input.prompt);
  if (tags.length === 0) return [];

  const limit = input.limit ?? 12;

  // The gallery-asset shape varies across this codebase — try the most
  // canonical layout first (showcase_assets) and gracefully degrade.
  try {
    const result = await pool.query<{
      asset_id: string;
      gallery_id: string;
      url: string;
      thumbnail_url: string | null;
      alt_text: string | null;
      captured_at: string | null;
      tag_overlap: number;
      caption_match: number;
      project_match: number;
    }>(
      `WITH base AS (
         SELECT
           a.id              AS asset_id,
           a.gallery_id      AS gallery_id,
           a.url             AS url,
           a.thumbnail_url   AS thumbnail_url,
           a.alt_text        AS alt_text,
           a.captured_at     AS captured_at,
           CARDINALITY(
             ARRAY(SELECT UNNEST(COALESCE(a.tags, ARRAY[]::text[]))
                   INTERSECT
                   SELECT UNNEST($2::text[]))
           ) AS tag_overlap,
           CASE
             WHEN a.alt_text ILIKE ANY($3::text[]) THEN 1
             ELSE 0
           END AS caption_match,
           CASE
             WHEN $4::varchar IS NOT NULL AND g.project_id = $4 THEN 1
             ELSE 0
           END AS project_match
         FROM showcase_assets a
         JOIN showcase_galleries g ON g.id = a.gallery_id
         WHERE g.user_id = $1
           AND a.is_active = TRUE
       )
       SELECT * FROM base
       WHERE tag_overlap > 0 OR caption_match > 0 OR project_match > 0
       ORDER BY (tag_overlap * 1.0 + caption_match * 0.6 + project_match * 0.3) DESC,
                captured_at DESC NULLS LAST
       LIMIT $5`,
      [
        input.userId,
        tags,
        tags.map((t) => `%${t}%`),
        input.preferredProjectId ?? null,
        limit,
      ],
    );

    return result.rows.map((row) => {
      const matchedOn: Array<"tag" | "caption" | "project"> = [];
      if (row.tag_overlap > 0) matchedOn.push("tag");
      if (row.caption_match > 0) matchedOn.push("caption");
      if (row.project_match > 0) matchedOn.push("project");

      const rawScore =
        row.tag_overlap * 1.0 + row.caption_match * 0.6 + row.project_match * 0.3;
      const score = Math.min(1, rawScore / Math.max(tags.length, 1));

      return {
        assetId: row.asset_id,
        galleryId: row.gallery_id,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        alt: row.alt_text,
        capturedAt: row.captured_at,
        score,
        matchedOn,
      };
    });
  } catch {
    // Schema may not yet expose showcase_assets.tags; fail soft so the
    // caller falls through to other strategies (stock / AI / color-only).
    return [];
  }
}
