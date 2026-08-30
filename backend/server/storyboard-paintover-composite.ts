import crypto from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";

type JsonRecord = Record<string, unknown>;

export const storyboardPaintoverCompositeSchema = z.object({
  imageData: z.string().min(32).max(36_000_000),
  width: z.number().int().min(64).max(8_192),
  height: z.number().int().min(64).max(8_192),
  includedThroughStage: z.enum(["color", "atmosphere"]),
  baseVersionId: z.string().uuid(),
  frameUpdatedAt: z.string().trim().min(1).max(80),
  sourceUpdatedAt: z.string().trim().min(1).max(80),
  sourceRevision: z.number().int().nonnegative(),
  framingFingerprint: z.string().trim().min(8).max(512),
  colorRevision: z.number().int().nonnegative(),
  atmosphereRevision: z.number().int().nonnegative(),
  colorFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
  atmosphereFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export type StoryboardPaintoverComposite = z.infer<
  typeof storyboardPaintoverCompositeSchema
>;

export interface ValidatedStoryboardPaintoverComposite {
  imageData: string;
  bytes: Buffer;
  contentType: "image/png";
  width: number;
  height: number;
  fingerprint: string;
}

export interface StoryboardPaintoverBindingState {
  colorRevision: number;
  atmosphereRevision: number;
  colorFingerprint: string;
  atmosphereFingerprint: string;
  colorHasContent: boolean;
  atmosphereHasContent: boolean;
}

const IGNORED_ATMOSPHERE_FINGERPRINT = "0".repeat(64);

/**
 * Render intent is cumulative by stage: Color binds Color only, while
 * Atmosphere binds both Color and Atmosphere. Neutralizing irrelevant fields
 * gives every consumer one canonical identity instead of ad-hoc comparisons.
 */
export function storyboardPaintoverBindingForStage(
  binding: StoryboardPaintoverBindingState,
  stage: "color" | "atmosphere",
): StoryboardPaintoverBindingState {
  return stage === "atmosphere" ? { ...binding } : {
    ...binding,
    atmosphereRevision: 0,
    atmosphereFingerprint: IGNORED_ATMOSPHERE_FINGERPRINT,
    atmosphereHasContent: false,
  };
}

export class StoryboardPaintoverCompositeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly safeDetail: string,
  ) {
    super(code);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function revision(value: unknown): number | null {
  const parsed = typeof value === "number" ? value
    : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function fingerprint(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function storyboardPaintoverBindingState(
  value: unknown,
): StoryboardPaintoverBindingState | null {
  if (!isRecord(value)) return null;
  const colorRevision = revision(value.colorRevision);
  const atmosphereRevision = revision(value.atmosphereRevision);
  const colorFingerprint = fingerprint(value.colorFingerprint);
  const atmosphereFingerprint = fingerprint(value.atmosphereFingerprint);
  const colorHasContent = value.colorHasContent === true;
  const atmosphereHasContent = value.atmosphereHasContent === true;
  if (colorRevision == null || atmosphereRevision == null
      || !colorFingerprint || !atmosphereFingerprint) return null;
  return {
    colorRevision,
    atmosphereRevision,
    colorFingerprint,
    atmosphereFingerprint,
    colorHasContent,
    atmosphereHasContent,
  };
}

/**
 * Validates the client-rendered freeze before it can be archived or sent to a
 * provider. Native emits PNG; accepting no other MIME keeps declared and
 * decoded formats identical and avoids SVG/polyglot payloads.
 */
export async function validateStoryboardPaintoverCompositeImage(
  composite: StoryboardPaintoverComposite,
  targetAspectRatio: number,
): Promise<ValidatedStoryboardPaintoverComposite> {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(
    composite.imageData.trim(),
  );
  if (!match) {
    throw new StoryboardPaintoverCompositeError(
      400,
      "paintover_composite_invalid_type",
      "Paintover-kilden må være en PNG-data-URL.",
    );
  }
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 64 || bytes.length > 25 * 1024 * 1024) {
    throw new StoryboardPaintoverCompositeError(
      413,
      "paintover_composite_invalid_size",
      "Paintover-kilden har ugyldig filstørrelse.",
    );
  }
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: 50_000_000,
    }).metadata();
  } catch {
    throw new StoryboardPaintoverCompositeError(
      400,
      "paintover_composite_invalid_image",
      "Paintover-kilden kunne ikke dekodes som PNG.",
    );
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (metadata.format !== "png" || width !== composite.width
      || height !== composite.height || width < 64 || height < 64
      || width > 8_192 || height > 8_192
      || width * height > 50_000_000) {
    throw new StoryboardPaintoverCompositeError(
      400,
      "paintover_composite_dimension_mismatch",
      "Paintover-kildens deklarerte størrelse samsvarer ikke med PNG-bildet.",
    );
  }
  const actualAspect = width / height;
  const onePixelTolerance = Math.max(1 / height, targetAspectRatio / width);
  if (!Number.isFinite(targetAspectRatio) || targetAspectRatio <= 0
      || Math.abs(actualAspect - targetAspectRatio) > onePixelTolerance) {
    throw new StoryboardPaintoverCompositeError(
      400,
      "paintover_composite_aspect_mismatch",
      "Paintover-kilden samsvarer ikke med det anvendte kamerautsnittet.",
    );
  }
  return {
    imageData: composite.imageData,
    bytes,
    contentType: "image/png",
    width,
    height,
    fingerprint: crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 32),
  };
}

/**
 * Stage-scoped OCC/CAS binding for a client-rendered immutable paintover freeze.
 */
export function validateStoryboardPaintoverCompositeBinding(input: {
  composite: StoryboardPaintoverComposite;
  expectedIncludedThroughStage: "color" | "atmosphere";
  expectedBaseVersionId: string;
  liveFrameUpdatedAt: string;
  liveSourceUpdatedAt: string;
  liveSourceRevision: number;
  liveFramingFingerprint: string;
  livePaintoverState: unknown;
  mirroredPaintoverState?: unknown;
}): StoryboardPaintoverBindingState {
  const rawLive = storyboardPaintoverBindingState(input.livePaintoverState);
  const rawMirrored = input.mirroredPaintoverState === undefined
    ? rawLive : storyboardPaintoverBindingState(input.mirroredPaintoverState);
  const composite = input.composite;
  const stage = input.expectedIncludedThroughStage;
  const live = rawLive
    ? storyboardPaintoverBindingForStage(rawLive, stage) : null;
  const mirrored = rawMirrored
    ? storyboardPaintoverBindingForStage(rawMirrored, stage) : null;
  const compositeBinding = rawLive
    ? storyboardPaintoverBindingForStage({
      ...rawLive,
      colorRevision: composite.colorRevision,
      atmosphereRevision: composite.atmosphereRevision,
      colorFingerprint: composite.colorFingerprint.toLowerCase(),
      atmosphereFingerprint: composite.atmosphereFingerprint.toLowerCase(),
    }, stage)
    : null;
  const exactState = live && mirrored && compositeBinding
    && live.colorRevision === mirrored.colorRevision
    && live.atmosphereRevision === mirrored.atmosphereRevision
    && live.colorFingerprint === mirrored.colorFingerprint
    && live.atmosphereFingerprint === mirrored.atmosphereFingerprint
    && live.colorHasContent === mirrored.colorHasContent
    && live.atmosphereHasContent === mirrored.atmosphereHasContent
    && live.colorRevision === compositeBinding.colorRevision
    && live.atmosphereRevision === compositeBinding.atmosphereRevision
    && live.colorFingerprint === compositeBinding.colorFingerprint
    && live.atmosphereFingerprint === compositeBinding.atmosphereFingerprint;
  if (composite.includedThroughStage !== stage
      || composite.baseVersionId !== input.expectedBaseVersionId
      || (stage === "atmosphere"
        && composite.frameUpdatedAt !== input.liveFrameUpdatedAt)
      || composite.sourceUpdatedAt !== input.liveSourceUpdatedAt
      || composite.sourceRevision !== input.liveSourceRevision
      || composite.framingFingerprint !== input.liveFramingFingerprint
      || !exactState || !live) {
    throw new StoryboardPaintoverCompositeError(
      409,
      "paintover_composite_stale",
      "Paintover-kilden ble endret etter at bildet ble fryst. Synk og prøv igjen.",
    );
  }
  return live;
}
