/**
 * role-room-carousel-generator.ts
 *
 * Stage 3 of the Website-to-Carousel pipeline.
 *
 * Takes the WeekPlan from the strategist + the BrandProfile, runs each
 * slide through layout-selection + image-resolution, and persists the
 * full draft (carousel_drafts + carousel_posts + carousel_slides) in
 * one transaction.
 *
 * No image rendering happens here — that's a follow-up slice. The
 * editor (Slice 4) and the per-platform render pipeline (post-slice)
 * read from the persisted slide rows.
 */

import type { Pool, PoolClient } from "pg";
import type { BrandProfile } from "./role-room-website-analyzer.js";
import type {
  WeekPlan,
  CarouselConcept,
  CarouselSlideSeed,
} from "./role-room-content-strategist.js";
import {
  CAROUSEL_LAYOUTS,
  pickLayout,
  type LayoutId,
  type LayoutDef,
} from "./role-room-carousel-layouts.js";
import {
  resolveImage,
  type ImageRef,
  type ResolverContext,
} from "./role-room-carousel-image-resolver.js";

// ─────────────────────────────────────────────────────────
// Types — shape returned to the caller after persistence
// ─────────────────────────────────────────────────────────

export interface PersistedSlide {
  id: string;
  postId: string;
  slideIndex: number;
  role: CarouselSlideSeed["role"];
  layout: LayoutId;
  textBlocks: ResolvedTextBlock[];
  imageRef: ImageRef;
  brandOverlays: BrandOverlays;
}

export interface ResolvedTextBlock {
  position: string;
  style: string;
  content: string;
}

export interface BrandOverlays {
  showLogo: boolean;
  showCounter: boolean;
  counterFormat: string; // e.g. "1/6"
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export interface PersistedPost {
  id: string;
  draftId: string;
  dayOfWeek: number;
  format: CarouselConcept["format"];
  primaryPlatform: CarouselConcept["primaryPlatform"];
  hook: string;
  narrative: string;
  caption: CarouselConcept["caption"];
  status: "draft";
  slides: PersistedSlide[];
}

export interface PersistedDraft {
  id: string;
  userId: string;
  websiteAnalysisId: string;
  weekStarting: string;
  status: "ready" | "failed";
  totalPosts: number;
  posts: PersistedPost[];
}

// ─────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────

export interface GenerateCarouselDraftInput {
  userId: string;
  websiteAnalysisId: string;
  weekPlan: WeekPlan;
  brand: BrandProfile;
}

export async function generateCarouselDraft(
  pool: Pool,
  input: GenerateCarouselDraftInput,
  resolverCtx: ResolverContext,
): Promise<PersistedDraft> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const draftRow = await client.query<{ id: string }>(
      `INSERT INTO carousel_drafts
         (user_id, website_analysis_id, week_starting, status,
          generation_started_at, total_posts)
       VALUES ($1, $2, $3, 'generating', now(), 7)
       RETURNING id`,
      [input.userId, input.websiteAnalysisId, input.weekPlan.weekStarting],
    );
    const draftId = draftRow.rows[0].id;

    const persistedPosts: PersistedPost[] = [];

    for (const concept of input.weekPlan.concepts) {
      const post = await persistPost(client, draftId, concept, input, resolverCtx);
      persistedPosts.push(post);
    }

    await client.query(
      `UPDATE carousel_drafts
          SET status = 'ready', generation_completed_at = now()
        WHERE id = $1`,
      [draftId],
    );

    await client.query("COMMIT");

    return {
      id: draftId,
      userId: input.userId,
      websiteAnalysisId: input.websiteAnalysisId,
      weekStarting: input.weekPlan.weekStarting,
      status: "ready",
      totalPosts: persistedPosts.length,
      posts: persistedPosts,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────
// Per-post persistence
// ─────────────────────────────────────────────────────────

async function persistPost(
  client: PoolClient,
  draftId: string,
  concept: CarouselConcept,
  input: GenerateCarouselDraftInput,
  resolverCtx: ResolverContext,
): Promise<PersistedPost> {
  const postRow = await client.query<{ id: string }>(
    `INSERT INTO carousel_posts
       (draft_id, day_of_week, format, primary_platform, hook, narrative, caption, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft')
     RETURNING id`,
    [
      draftId,
      concept.dayOfWeek,
      concept.format,
      concept.primaryPlatform,
      concept.hook,
      concept.narrative,
      JSON.stringify(concept.caption),
    ],
  );
  const postId = postRow.rows[0].id;

  const persistedSlides: PersistedSlide[] = [];
  const total = concept.slides.length;

  for (let idx = 0; idx < total; idx++) {
    const seed = concept.slides[idx];
    const layoutId = pickLayout(seed.role, {
      format: concept.format,
      slideIndex: idx,
      totalSlides: total,
      hasImage: true, // optimistic — resolver may downgrade to color-only
    });
    const layoutDef = CAROUSEL_LAYOUTS[layoutId];

    const imageRef = await resolveImage(
      {
        userId: input.userId,
        imagePrompt: seed.imagePrompt,
        worksWithoutImage: layoutDef.worksWithoutImage,
      },
      resolverCtx,
    );

    // Re-pick layout if image resolution failed and current layout requires
    // imagery — fall back to a layout that's text-only-safe.
    const finalLayoutId =
      imageRef.strategy === "color-only" && !layoutDef.worksWithoutImage
        ? pickLayout(seed.role, {
            format: concept.format,
            slideIndex: idx,
            totalSlides: total,
            hasImage: false,
          })
        : layoutId;
    const finalLayoutDef = CAROUSEL_LAYOUTS[finalLayoutId];

    const textBlocks = composeTextBlocks(seed, finalLayoutDef, idx, total);

    const overlays: BrandOverlays = {
      showLogo: finalLayoutDef.showLogo,
      showCounter: finalLayoutDef.showCounter,
      counterFormat: `${idx + 1}/${total}`,
      brandName: input.brand.businessName,
      logoUrl: input.brand.logoUrl,
      primaryColor: input.brand.colors.primary,
      accentColor: input.brand.colors.accent,
    };

    const slideRow = await client.query<{ id: string }>(
      `INSERT INTO carousel_slides
         (post_id, slide_index, role, layout, text_blocks, image_ref, brand_overlays, pressroom_template_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
       RETURNING id`,
      [
        postId,
        idx,
        seed.role,
        finalLayoutId,
        JSON.stringify(textBlocks),
        JSON.stringify(imageRef),
        JSON.stringify(overlays),
        finalLayoutId, // template-id mirrors layout-id for now
      ],
    );

    persistedSlides.push({
      id: slideRow.rows[0].id,
      postId,
      slideIndex: idx,
      role: seed.role,
      layout: finalLayoutId,
      textBlocks,
      imageRef,
      brandOverlays: overlays,
    });
  }

  return {
    id: postId,
    draftId,
    dayOfWeek: concept.dayOfWeek,
    format: concept.format,
    primaryPlatform: concept.primaryPlatform,
    hook: concept.hook,
    narrative: concept.narrative,
    caption: concept.caption,
    status: "draft",
    slides: persistedSlides,
  };
}

// ─────────────────────────────────────────────────────────
// Text-block composition
// ─────────────────────────────────────────────────────────

/**
 * Maps the strategist's free-form `text` field onto the layout's
 * structured text-slots. The first slot (usually a label like
 * "THE PLAN") receives a derived caption from role + slide-index;
 * the headline slot receives the strategist's text. Optional slots
 * are filled when the layout exposes them and the role expects it.
 */
function composeTextBlocks(
  seed: CarouselSlideSeed,
  layout: LayoutDef,
  slideIndex: number,
  totalSlides: number,
): ResolvedTextBlock[] {
  const blocks: ResolvedTextBlock[] = [];
  const slots = layout.textSlots;
  if (slots.length === 0) return blocks;

  // Strategy: required slots get filled in declaration order.
  // - First "caption" or "tagline" slot → role-derived label (e.g. "THE PROBLEM")
  // - First "headline" / "quote" / "number" slot → strategist's text
  // - Remaining slots → secondary derivations or empty when optional
  const used = new Set<number>();

  // Slot 0 — short label
  const labelSlotIdx = slots.findIndex(
    (s, i) => !used.has(i) && (s.style === "caption" || s.style === "tagline"),
  );
  if (labelSlotIdx >= 0) {
    used.add(labelSlotIdx);
    blocks.push({
      position: slots[labelSlotIdx].position,
      style: slots[labelSlotIdx].style,
      content: deriveLabel(seed.role, slideIndex, totalSlides),
    });
  }

  // Headline / quote / number
  const headSlotIdx = slots.findIndex(
    (s, i) =>
      !used.has(i) &&
      (s.style === "headline" || s.style === "quote" || s.style === "number"),
  );
  if (headSlotIdx >= 0) {
    used.add(headSlotIdx);
    blocks.push({
      position: slots[headSlotIdx].position,
      style: slots[headSlotIdx].style,
      content: clip(seed.text, slots[headSlotIdx].maxChars),
    });
  } else {
    // No structured headline slot — write text into the first unused slot
    const firstFreeIdx = slots.findIndex((_, i) => !used.has(i));
    if (firstFreeIdx >= 0) {
      used.add(firstFreeIdx);
      blocks.push({
        position: slots[firstFreeIdx].position,
        style: slots[firstFreeIdx].style,
        content: clip(seed.text, slots[firstFreeIdx].maxChars),
      });
    }
  }

  // Secondary required slots — fill with placeholder note so the
  // editor can highlight them; downstream UI lets user edit.
  slots.forEach((slot, i) => {
    if (used.has(i)) return;
    if (!slot.required) return;
    blocks.push({
      position: slot.position,
      style: slot.style,
      content: "",
    });
  });

  return blocks;
}

function deriveLabel(
  role: CarouselSlideSeed["role"],
  slideIndex: number,
  totalSlides: number,
): string {
  const counter = `${String(slideIndex + 1).padStart(2, "0")}/${String(totalSlides).padStart(2, "0")}`;
  const labels: Record<CarouselSlideSeed["role"], string> = {
    cover: counter,
    context: "THE CONTEXT",
    reveal: "THE REVEAL",
    point: "THE POINT",
    quote: "THEY SAID",
    cta: "THE NEXT STEP",
  };
  return labels[role] ?? counter;
}

function clip(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trim() + "…";
}
