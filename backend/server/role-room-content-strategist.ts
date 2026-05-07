/**
 * role-room-content-strategist.ts
 *
 * Stage 2 of the Website-to-Carousel pipeline.
 *
 * Takes a BrandProfile (from role-room-website-analyzer.ts) plus the
 * Monday-of-week date and asks Claude to generate exactly 7 distinct
 * carousel concepts — one per day-of-week — with format-diversity
 * enforced.
 *
 * Format slots are fixed by day so Mon=humor every week (the
 * "Production Life: We've all been there" reference-format), Tue=edu,
 * Wed=BTS, Thu=customer-story, Fri=promo, Sat=seasonal, Sun=story.
 * If Claude returns fewer than 7 valid concepts the strategist
 * re-prompts up to 2x with the missing slots highlighted.
 *
 * See memory/website_to_carousel_architecture.md for the full design.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./role-room-website-analyzer.js";

// ─────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────

export type CarouselFormat =
  | "humor"
  | "educational"
  | "bts"
  | "customer_story"
  | "promo"
  | "seasonal"
  | "story_insight";

export type CarouselPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "pinterest"
  | "youtube";

export type SlideRole =
  | "cover"
  | "context"
  | "reveal"
  | "point"
  | "quote"
  | "cta";

export interface CarouselSlideSeed {
  role: SlideRole;
  text: string;
  imagePrompt: string;
}

export interface CarouselConcept {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Mon..6=Sun
  format: CarouselFormat;
  primaryPlatform: CarouselPlatform;
  hook: string;
  narrative: string;
  slides: CarouselSlideSeed[];
  caption: Record<CarouselPlatform, string>;
  optimalPostTime: string; // "HH:MM" 24h, brand-local time
}

export interface WeekPlan {
  weekStarting: string; // YYYY-MM-DD (Monday)
  concepts: CarouselConcept[]; // length 7
  generationNotes: string[];
}

// ─────────────────────────────────────────────────────────
// Format → day mapping (deterministic, matches roadmap)
// ─────────────────────────────────────────────────────────

export const DAY_FORMAT_SCHEDULE: Array<{
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  dayName: string;
  format: CarouselFormat;
  description: string;
}> = [
  {
    dayOfWeek: 0,
    dayName: "Mandag",
    format: "humor",
    description: "Humor / relatable — 'we've all been there'-style",
  },
  {
    dayOfWeek: 1,
    dayName: "Tirsdag",
    format: "educational",
    description: "Educational — 5 tips / how-to / framework",
  },
  {
    dayOfWeek: 2,
    dayName: "Onsdag",
    format: "bts",
    description: "Behind-the-scenes — process, team, real moments",
  },
  {
    dayOfWeek: 3,
    dayName: "Torsdag",
    format: "customer_story",
    description: "Customer story — quote, transformation, testimonial",
  },
  {
    dayOfWeek: 4,
    dayName: "Fredag",
    format: "promo",
    description: "Promo / CTA-heavy — offer, launch, booking-push",
  },
  {
    dayOfWeek: 5,
    dayName: "Lørdag",
    format: "seasonal",
    description: "Seasonal / trend tie-in — month, weather, holiday",
  },
  {
    dayOfWeek: 6,
    dayName: "Søndag",
    format: "story_insight",
    description: "Story / insight — long-form thinking, founder POV",
  },
];

// ─────────────────────────────────────────────────────────
// Anthropic client (test-injectable)
// ─────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}
export function __setStrategistAnthropic(client: Anthropic | null): void {
  anthropicClient = client;
}

// ─────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior social media strategist generating ONE WEEK of content for a brand.

Output requirements:
- Norwegian language UNLESS the brand description is clearly English-first
- Match the reference quality bar of the Role Room "Production Life" carousel:
  cover → setup → escalation → escalation → setup → resolution + CTA
- Hook in the first slide must scroll-stop
- Per platform, respect: Instagram caption ≤2200 char, LinkedIn ≤3000 char with formal tone, Facebook storytelling tone, Pinterest keyword-dense ≤500 char, YouTube Community ≤1500 char
- Return STRICT JSON only — no preamble, no code fences

Diversity contract:
- Exactly 7 concepts, one per day-of-week 0..6
- Each day must use the format prescribed by the user
- No two concepts may share the same hook or imagePrompt themes
- Each concept must have 4-6 slides`;

function buildUserPrompt(
  brand: BrandProfile,
  weekStarting: string,
  retryNotes: string[],
): string {
  const lines: string[] = [
    `BRAND: ${brand.businessName} — ${brand.tagline}`,
    `URL: ${brand.url}`,
    `INDUSTRY: ${brand.industry}`,
    `TONE: ${brand.toneOfVoice}`,
    `USPS: ${brand.usps.join(" | ")}`,
    `PRIMARY CTA: ${brand.primaryCTA}`,
    `TARGET AUDIENCE: ${brand.targetAudience}`,
    `WEEK STARTING (Monday): ${weekStarting}`,
    "",
    "DAY-FORMAT SCHEDULE (you must produce one concept per day, in this exact format):",
    ...DAY_FORMAT_SCHEDULE.map(
      (d) => `  ${d.dayOfWeek} (${d.dayName}) → format="${d.format}" — ${d.description}`,
    ),
    "",
    "Return JSON in exactly this shape — array of 7 objects:",
    "[",
    `  {`,
    `    "dayOfWeek": 0,`,
    `    "format": "humor",`,
    `    "primaryPlatform": "instagram" | "facebook" | "linkedin" | "pinterest" | "youtube",`,
    `    "hook": "<≤80 char scroll-stopper>",`,
    `    "narrative": "<2-sentence arc>",`,
    `    "slides": [`,
    `      { "role": "cover" | "context" | "reveal" | "point" | "quote" | "cta",`,
    `        "text": "<short overlay text>",`,
    `        "imagePrompt": "<photo / illustration prompt for this slide>" }`,
    `    ],   // 4-6 entries`,
    `    "caption": {`,
    `      "instagram": "<full caption, hashtags included, ≤2200 char>",`,
    `      "facebook": "<storytelling caption, ≤2200 char>",`,
    `      "linkedin": "<formal caption, 1500-3000 char>",`,
    `      "pinterest": "<keyword-dense title + description, ≤500 char>",`,
    `      "youtube": "<question-driven, ≤1500 char>"`,
    `    },`,
    `    "optimalPostTime": "HH:MM"`,
    `  }, … 7 total`,
    "]",
  ];
  if (retryNotes.length > 0) {
    lines.push("", "PREVIOUS ATTEMPT FAILED — fix these issues:");
    retryNotes.forEach((note) => lines.push(`  - ${note}`));
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────

const ALLOWED_FORMATS = new Set<CarouselFormat>([
  "humor",
  "educational",
  "bts",
  "customer_story",
  "promo",
  "seasonal",
  "story_insight",
]);
const ALLOWED_PLATFORMS = new Set<CarouselPlatform>([
  "instagram",
  "facebook",
  "linkedin",
  "pinterest",
  "youtube",
]);
const ALLOWED_ROLES = new Set<SlideRole>([
  "cover",
  "context",
  "reveal",
  "point",
  "quote",
  "cta",
]);

interface ValidationResult {
  ok: boolean;
  errors: string[];
  concepts: CarouselConcept[];
}

export function validateConcepts(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(raw)) {
    return { ok: false, errors: ["Response is not an array"], concepts: [] };
  }
  if (raw.length !== 7) {
    errors.push(`Expected 7 concepts, got ${raw.length}`);
  }

  const seenDays = new Set<number>();
  const expectedFormat = new Map<number, CarouselFormat>(
    DAY_FORMAT_SCHEDULE.map((d) => [d.dayOfWeek, d.format]),
  );

  const concepts: CarouselConcept[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] as Record<string, unknown>;
    const where = `Concept[${i}]`;
    if (typeof c?.dayOfWeek !== "number" || c.dayOfWeek < 0 || c.dayOfWeek > 6) {
      errors.push(`${where}: invalid dayOfWeek`);
      continue;
    }
    if (seenDays.has(c.dayOfWeek)) {
      errors.push(`${where}: duplicate dayOfWeek ${c.dayOfWeek}`);
      continue;
    }
    seenDays.add(c.dayOfWeek);

    const expectedF = expectedFormat.get(c.dayOfWeek);
    if (typeof c.format !== "string" || !ALLOWED_FORMATS.has(c.format as CarouselFormat)) {
      errors.push(`${where}: invalid format "${String(c.format)}"`);
      continue;
    }
    if (c.format !== expectedF) {
      errors.push(
        `${where}: day ${c.dayOfWeek} requires format "${expectedF}", got "${c.format}"`,
      );
      continue;
    }
    if (
      typeof c.primaryPlatform !== "string" ||
      !ALLOWED_PLATFORMS.has(c.primaryPlatform as CarouselPlatform)
    ) {
      errors.push(`${where}: invalid primaryPlatform "${String(c.primaryPlatform)}"`);
      continue;
    }
    if (typeof c.hook !== "string" || c.hook.length === 0 || c.hook.length > 100) {
      errors.push(`${where}: hook must be 1-100 chars`);
      continue;
    }
    if (typeof c.narrative !== "string" || c.narrative.length === 0) {
      errors.push(`${where}: missing narrative`);
      continue;
    }
    if (
      !Array.isArray(c.slides) ||
      c.slides.length < 4 ||
      c.slides.length > 6
    ) {
      errors.push(`${where}: slides must be 4-6 entries (got ${Array.isArray(c.slides) ? c.slides.length : "non-array"})`);
      continue;
    }
    const slidesValid = c.slides.every((s) => {
      const slide = s as Record<string, unknown>;
      return (
        typeof slide?.role === "string" &&
        ALLOWED_ROLES.has(slide.role as SlideRole) &&
        typeof slide?.text === "string" &&
        typeof slide?.imagePrompt === "string"
      );
    });
    if (!slidesValid) {
      errors.push(`${where}: one or more slides have invalid role/text/imagePrompt`);
      continue;
    }
    if (!c.caption || typeof c.caption !== "object") {
      errors.push(`${where}: caption must be an object`);
      continue;
    }
    const cap = c.caption as Record<string, unknown>;
    const captionPlatforms: CarouselPlatform[] = [
      "instagram",
      "facebook",
      "linkedin",
      "pinterest",
      "youtube",
    ];
    const missingCaptions = captionPlatforms.filter((p) => typeof cap[p] !== "string");
    if (missingCaptions.length > 0) {
      errors.push(`${where}: missing captions for ${missingCaptions.join(", ")}`);
      continue;
    }
    const igLen = (cap.instagram as string).length;
    const liLen = (cap.linkedin as string).length;
    const piLen = (cap.pinterest as string).length;
    if (igLen > 2200) errors.push(`${where}: Instagram caption ${igLen} > 2200 chars`);
    if (liLen > 3000) errors.push(`${where}: LinkedIn caption ${liLen} > 3000 chars`);
    if (piLen > 500) errors.push(`${where}: Pinterest caption ${piLen} > 500 chars`);
    if (errors.length > 0 && errors[errors.length - 1].startsWith(where)) continue;

    if (typeof c.optimalPostTime !== "string" || !/^\d{2}:\d{2}$/.test(c.optimalPostTime)) {
      errors.push(`${where}: optimalPostTime must be HH:MM`);
      continue;
    }

    concepts.push({
      dayOfWeek: c.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      format: c.format as CarouselFormat,
      primaryPlatform: c.primaryPlatform as CarouselPlatform,
      hook: c.hook,
      narrative: c.narrative as string,
      slides: c.slides as CarouselSlideSeed[],
      caption: cap as unknown as Record<CarouselPlatform, string>,
      optimalPostTime: c.optimalPostTime,
    });
  }

  // Day-coverage check
  for (let day = 0; day <= 6; day++) {
    if (!seenDays.has(day)) {
      const fmt = expectedFormat.get(day as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      errors.push(`Missing concept for day ${day} (${fmt})`);
    }
  }

  // Hook duplicate check
  const hooks = concepts.map((c) => c.hook.toLowerCase().trim());
  const dupHooks = hooks.filter((h, i) => hooks.indexOf(h) !== i);
  if (dupHooks.length > 0) {
    errors.push(`Duplicate hooks detected: ${[...new Set(dupHooks)].join("; ")}`);
  }

  return { ok: errors.length === 0, errors, concepts };
}

// ─────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────

export interface GenerateWeekOptions {
  /** Stop trying after this many Claude calls (default 3). */
  maxAttempts?: number;
}

export async function generateWeekPlan(
  brand: BrandProfile,
  weekStarting: string,
  options: GenerateWeekOptions = {},
): Promise<WeekPlan> {
  const maxAttempts = options.maxAttempts ?? 3;
  const client = getAnthropic();
  const generationNotes: string[] = [];
  let retryNotes: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userPrompt = buildUserPrompt(brand, weekStarting, retryNotes);
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const cleaned = text.replace(/^```(?:json)?|```$/gm, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      retryNotes = [`Previous response was not valid JSON: ${(e as Error).message}`];
      generationNotes.push(`Attempt ${attempt}: JSON parse failed`);
      continue;
    }

    const validation = validateConcepts(parsed);
    if (validation.ok) {
      generationNotes.push(`Attempt ${attempt}: validated 7 concepts`);
      return {
        weekStarting,
        concepts: validation.concepts.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
        generationNotes,
      };
    }
    retryNotes = validation.errors.slice(0, 12);
    generationNotes.push(
      `Attempt ${attempt}: ${validation.errors.length} validation errors`,
    );
  }

  throw new Error(
    `Strategist failed after ${maxAttempts} attempts. Notes: ${generationNotes.join(" | ")}`,
  );
}
