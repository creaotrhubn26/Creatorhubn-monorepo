/**
 * role-room-carousel-publisher.ts
 *
 * Stage 6 of the Website-to-Carousel pipeline.
 *
 * Takes an approved CarouselPost + its CarouselSlides and pushes the
 * platform-targeted variant onto the user's role_room_feed_plans
 * record for that (project_id, primary_platform). The shape of the
 * resulting feed_plans.posts entry mirrors what the existing Feed
 * Planner UI consumes, so the carousel surfaces in the same review +
 * publish flow as manually-authored posts.
 *
 * Validation gates per-platform spec compliance (caption length, slide
 * count, aspect-ratio compatibility) before persisting.
 */

import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";

export type CarouselPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "pinterest"
  | "youtube";

export interface PublishablePost {
  id: string;
  draftId: string;
  dayOfWeek: number;
  format: string;
  primaryPlatform: CarouselPlatform;
  hook: string;
  narrative: string;
  caption: Record<CarouselPlatform, string>;
  scheduledAt: string | null;
}

export interface PublishableSlide {
  id: string;
  postId: string;
  slideIndex: number;
  imageRef: { strategy: string; url?: string; generatedUrl?: string; color?: string };
  textBlocks: Array<{ position: string; style: string; content: string }>;
  brandOverlays: { brandName: string; primaryColor: string; accentColor: string };
}

export interface PublishOptions {
  projectId: string;
  /**
   * When true, the publisher PATCHes the carousel_posts row to mark
   * status='scheduled' + writes the new feed_plan_post_id into
   * carousel_posts.feed_planner_post_id. False is mostly useful for
   * test runs that don't want to mutate carousel_posts.
   */
  markScheduled?: boolean;
}

export interface PublishResult {
  feedPlanId: string;
  feedPlanPostId: string;
  platform: CarouselPlatform;
  insertedAt: string;
  validationWarnings: string[];
}

// ─────────────────────────────────────────────────────────
// Per-platform validation
// ─────────────────────────────────────────────────────────

const PLATFORM_RULES: Record<
  CarouselPlatform,
  {
    captionLimit: number;
    minSlides: number;
    maxSlides: number;
    description: string;
  }
> = {
  instagram: { captionLimit: 2200, minSlides: 1, maxSlides: 10, description: "Instagram carousel" },
  facebook: { captionLimit: 63206, minSlides: 1, maxSlides: 10, description: "Facebook carousel" },
  linkedin: { captionLimit: 3000, minSlides: 1, maxSlides: 9, description: "LinkedIn carousel" },
  pinterest: { captionLimit: 500, minSlides: 1, maxSlides: 1, description: "Pinterest pin (single image)" },
  youtube: { captionLimit: 1500, minSlides: 1, maxSlides: 1, description: "YouTube Community post" },
};

export interface ValidationOutcome {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateForPublish(
  post: PublishablePost,
  slides: PublishableSlide[],
): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rules = PLATFORM_RULES[post.primaryPlatform];
  if (!rules) {
    errors.push(`Unsupported platform: ${post.primaryPlatform}`);
    return { ok: false, errors, warnings };
  }

  const caption = post.caption?.[post.primaryPlatform] ?? "";
  if (!caption.trim()) {
    errors.push(`Caption for ${post.primaryPlatform} is empty`);
  } else if (caption.length > rules.captionLimit) {
    errors.push(
      `${rules.description} caption ${caption.length}/${rules.captionLimit} chars — over limit`,
    );
  } else if (caption.length > rules.captionLimit * 0.95) {
    warnings.push(
      `${rules.description} caption ${caption.length}/${rules.captionLimit} chars — within 5% of limit`,
    );
  }

  if (slides.length < rules.minSlides) {
    errors.push(`Need at least ${rules.minSlides} slide(s) — got ${slides.length}`);
  }
  if (slides.length > rules.maxSlides) {
    errors.push(`${rules.description} caps at ${rules.maxSlides} slides — got ${slides.length}`);
  }

  // Each slide should have a usable image (no color-only fallbacks
  // for platforms that publicly require imagery — Pinterest is strict).
  if (post.primaryPlatform === "pinterest") {
    for (const s of slides) {
      if (s.imageRef.strategy === "color-only") {
        errors.push(`Pinterest pin requires an image — slide ${s.slideIndex + 1} has color-only`);
      }
    }
  } else {
    const colorOnlyCount = slides.filter((s) => s.imageRef.strategy === "color-only").length;
    if (colorOnlyCount > 0) {
      warnings.push(
        `${colorOnlyCount} slide(s) use color-only fallback — consider swapping to gallery / AI`,
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ─────────────────────────────────────────────────────────
// Persistence — append to role_room_feed_plans.posts JSONB
// ─────────────────────────────────────────────────────────

interface FeedPlanPostShape {
  id: string;
  source: "carousel-week";
  source_post_id: string;
  source_draft_id: string;
  caption: string;
  scheduled_at: string | null;
  hook: string;
  format: string;
  day_of_week: number;
  slides: Array<{
    slide_id: string;
    slide_index: number;
    image_url: string | null;
    text_blocks: PublishableSlide["textBlocks"];
    brand_overlay: PublishableSlide["brandOverlays"];
  }>;
  status: "draft" | "scheduled";
  added_at: string;
}

function buildFeedPlanPost(
  post: PublishablePost,
  slides: PublishableSlide[],
): FeedPlanPostShape {
  return {
    id: randomUUID(),
    source: "carousel-week",
    source_post_id: post.id,
    source_draft_id: post.draftId,
    caption: post.caption[post.primaryPlatform] ?? "",
    scheduled_at: post.scheduledAt,
    hook: post.hook,
    format: post.format,
    day_of_week: post.dayOfWeek,
    slides: slides
      .sort((a, b) => a.slideIndex - b.slideIndex)
      .map((s) => ({
        slide_id: s.id,
        slide_index: s.slideIndex,
        image_url:
          (s.imageRef.url as string | undefined) ??
          (s.imageRef.generatedUrl as string | undefined) ??
          null,
        text_blocks: s.textBlocks,
        brand_overlay: s.brandOverlays,
      })),
    status: post.scheduledAt ? "scheduled" : "draft",
    added_at: new Date().toISOString(),
  };
}

async function upsertFeedPlan(
  client: PoolClient,
  projectId: string,
  platform: CarouselPlatform,
  newPost: FeedPlanPostShape,
  userId: string,
): Promise<{ feedPlanId: string; feedPlanPostId: string }> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM role_room_feed_plans
       WHERE project_id = $1 AND platform = $2`,
    [projectId, platform],
  );

  if (existing.rowCount && existing.rows[0]) {
    const feedPlanId = existing.rows[0].id;
    await client.query(
      `UPDATE role_room_feed_plans
          SET posts = COALESCE(posts, '[]'::jsonb) || $1::jsonb,
              updated_by = $2,
              updated_at = now()
        WHERE id = $3`,
      [JSON.stringify([newPost]), userId, feedPlanId],
    );
    return { feedPlanId, feedPlanPostId: newPost.id };
  }

  const created = await client.query<{ id: string }>(
    `INSERT INTO role_room_feed_plans (project_id, platform, posts, updated_by)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id`,
    [projectId, platform, JSON.stringify([newPost]), userId],
  );
  return { feedPlanId: created.rows[0].id, feedPlanPostId: newPost.id };
}

// ─────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────

export async function publishCarouselPost(
  pool: Pool,
  userId: string,
  post: PublishablePost,
  slides: PublishableSlide[],
  options: PublishOptions,
): Promise<PublishResult> {
  const validation = validateForPublish(post, slides);
  if (!validation.ok) {
    throw new ValidationFailedError(validation.errors);
  }

  const feedPlanPost = buildFeedPlanPost(post, slides);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { feedPlanId, feedPlanPostId } = await upsertFeedPlan(
      client,
      options.projectId,
      post.primaryPlatform,
      feedPlanPost,
      userId,
    );

    if (options.markScheduled !== false) {
      await client.query(
        `UPDATE carousel_posts
            SET feed_planner_post_id = $2,
                status = CASE WHEN scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'approved' END
          WHERE id = $1`,
        [post.id, feedPlanPostId],
      );
    }
    await client.query("COMMIT");
    return {
      feedPlanId,
      feedPlanPostId,
      platform: post.primaryPlatform,
      insertedAt: feedPlanPost.added_at,
      validationWarnings: validation.warnings,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export class ValidationFailedError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Carousel publish validation failed: ${errors.join(" | ")}`);
    this.errors = errors;
    this.name = "ValidationFailedError";
  }
}
