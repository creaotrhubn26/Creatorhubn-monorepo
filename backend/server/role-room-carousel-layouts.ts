/**
 * role-room-carousel-layouts.ts
 *
 * The 8 slide layouts the Carousel pipeline ships with. Each layout
 * declares:
 *   - allowed slide-roles (so the generator picks the right layout
 *     per role automatically)
 *   - text-block slots (where headline / sticker / counter sit)
 *   - image-fit hint (cover|contain|color-only)
 *   - aspect-ratios it supports
 *
 * Layouts are pure data — server-side Satori rendering reads from
 * them in a follow-up slice. The Editor UI (Slice 4) renders client-
 * side from the same shape.
 */

import type { SlideRole } from "./role-room-content-strategist.js";

export type LayoutId =
  | "cover-fullbleed"        // big headline + brand top-left + counter top-right (the reference cover)
  | "fullbleed-photo-text"   // photo bg + small headline + sticker (Production Life: "The Plan")
  | "split-50-50"            // 50/50 photo + text
  | "centered-quote"         // pull-quote with attribution
  | "tablet-mockup"          // tablet/phone mockup with product screenshot (the resolution slide)
  | "big-number"             // huge stat + caption
  | "before-after"           // two side-by-side images
  | "list-item";             // numbered point in a series (educational format)

export type AspectRatio = "1:1" | "4:5" | "1.91:1" | "2:3" | "16:9";

export type TextStyle = "headline" | "tagline" | "caption" | "sticker" | "number" | "quote";

export interface TextSlot {
  position: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right" | "left-half" | "right-half";
  style: TextStyle;
  maxChars: number;
  required: boolean;
}

export interface LayoutDef {
  id: LayoutId;
  description: string;
  allowedRoles: SlideRole[];
  textSlots: TextSlot[];
  imageMode: "cover" | "contain" | "split-left" | "split-right" | "two-image" | "color-only";
  showLogo: boolean;
  showCounter: boolean;
  supportedAspects: AspectRatio[];
  /** True when the layout works well even without a sourced image (e.g. text-on-color). */
  worksWithoutImage: boolean;
}

export const CAROUSEL_LAYOUTS: Record<LayoutId, LayoutDef> = {
  "cover-fullbleed": {
    id: "cover-fullbleed",
    description: "Reference-style cover: brand top-left, counter top-right, big bold headline + tagline",
    allowedRoles: ["cover"],
    textSlots: [
      { position: "left-half", style: "headline", maxChars: 80, required: true },
      { position: "left-half", style: "tagline", maxChars: 120, required: false },
    ],
    imageMode: "cover",
    showLogo: true,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: false,
  },
  "fullbleed-photo-text": {
    id: "fullbleed-photo-text",
    description: "Photo bg + slide-label top-left + short headline + optional sticker overlay",
    allowedRoles: ["context", "reveal", "point"],
    textSlots: [
      { position: "top-left", style: "caption", maxChars: 30, required: true }, // "THE PLAN"
      { position: "top-left", style: "headline", maxChars: 80, required: true },
      { position: "bottom-right", style: "sticker", maxChars: 200, required: false }, // post-it style
    ],
    imageMode: "cover",
    showLogo: false,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: false,
  },
  "split-50-50": {
    id: "split-50-50",
    description: "50/50 photo + text — photo on either side, text-block on the other",
    allowedRoles: ["context", "point", "reveal"],
    textSlots: [
      { position: "left-half", style: "headline", maxChars: 100, required: true },
      { position: "left-half", style: "caption", maxChars: 240, required: false },
    ],
    imageMode: "split-right",
    showLogo: false,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: false,
  },
  "centered-quote": {
    id: "centered-quote",
    description: "Pull-quote, centered, with attribution underneath",
    allowedRoles: ["quote"],
    textSlots: [
      { position: "center", style: "quote", maxChars: 220, required: true },
      { position: "center", style: "caption", maxChars: 60, required: false }, // attribution
    ],
    imageMode: "color-only",
    showLogo: true,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: true,
  },
  "tablet-mockup": {
    id: "tablet-mockup",
    description: "Tablet / device mockup carrying a product screenshot — the closing reveal slide",
    allowedRoles: ["cta", "reveal"],
    textSlots: [
      { position: "top-left", style: "caption", maxChars: 30, required: true },
      { position: "top-left", style: "headline", maxChars: 100, required: true },
      { position: "top-left", style: "tagline", maxChars: 200, required: false },
    ],
    imageMode: "contain",
    showLogo: true,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: false,
  },
  "big-number": {
    id: "big-number",
    description: "Huge stat / metric with one-line caption underneath",
    allowedRoles: ["point", "reveal"],
    textSlots: [
      { position: "center", style: "number", maxChars: 12, required: true },
      { position: "center", style: "caption", maxChars: 120, required: true },
    ],
    imageMode: "color-only",
    showLogo: true,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: true,
  },
  "before-after": {
    id: "before-after",
    description: "Two side-by-side images (or before/after vertical-half split)",
    allowedRoles: ["reveal", "point"],
    textSlots: [
      { position: "top-left", style: "caption", maxChars: 30, required: true },
      { position: "bottom-left", style: "caption", maxChars: 60, required: false },
      { position: "bottom-right", style: "caption", maxChars: 60, required: false },
    ],
    imageMode: "two-image",
    showLogo: true,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: false,
  },
  "list-item": {
    id: "list-item",
    description: "Numbered list-item with optional small image",
    allowedRoles: ["point"],
    textSlots: [
      { position: "top-left", style: "number", maxChars: 4, required: true }, // "01" / "1."
      { position: "top-left", style: "headline", maxChars: 100, required: true },
      { position: "top-left", style: "caption", maxChars: 240, required: false },
    ],
    imageMode: "split-right",
    showLogo: true,
    showCounter: true,
    supportedAspects: ["1:1", "4:5"],
    worksWithoutImage: true,
  },
};

/**
 * Pick the best layout for a given role + format combination.
 *
 * The carousel-generator calls this for every slide. The mapping is
 * deterministic so the same brand always produces the same look,
 * which keeps the visual feel consistent across a 7-day plan.
 */
export function pickLayout(
  role: SlideRole,
  context: { format: string; slideIndex: number; totalSlides: number; hasImage: boolean },
): LayoutId {
  const isLast = context.slideIndex === context.totalSlides - 1;
  const isFirst = context.slideIndex === 0;

  if (isFirst || role === "cover") return "cover-fullbleed";
  if (isLast || role === "cta") return "tablet-mockup";
  if (role === "quote") return "centered-quote";

  // Educational format leans on numbered list-items
  if (context.format === "educational" && role === "point") return "list-item";

  // No image source → pick a layout that works text-only
  if (!context.hasImage) return "big-number";

  // BTS / customer story → prefer split layout (photo + text)
  if (context.format === "bts" || context.format === "customer_story") return "split-50-50";

  // Default to the cinematic fullbleed
  return "fullbleed-photo-text";
}
