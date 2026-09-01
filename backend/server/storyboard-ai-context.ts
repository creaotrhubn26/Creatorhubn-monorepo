import crypto from 'node:crypto';
import { z } from 'zod';
import { compileStoryboardPrompt } from './storyboard-prompt-engine/index.js';
import { storyboardScenarioSelectionSchema } from './storyboard-prompt-engine/scenario-packs.js';

const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

const neighbourSchema = z.object({
  shotNumber: optionalText(40),
  description: optionalText(1_200),
}).nullable().optional().default(null);

const productionReferenceSchema = z.object({
  id: optionalText(200),
  name: optionalText(300),
  description: optionalText(1_200),
  referenceImageIds: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  locked: z.boolean().default(true),
});

export const STORYBOARD_PRODUCTION_MARK_KINDS = [
  'gesture', 'silhouette', 'focus', 'depth', 'perspective', 'camera',
  'motion', 'light', 'emotion', 'negativeSpace', 'eyeLine', 'staging',
  'continuity', 'storyBeat', 'concrete', 'woodGrain', 'fabric',
  'brushedMetal', 'glassReflection', 'groundGravel', 'skinOrganic',
  'filmGrain', 'dustSmoke', 'rainWetSurface', 'foliage', 'crowd',
  'architectureFill', 'shadowTexture', 'lightTexture', 'faceDetail',
  'hairDetail', 'clothingDetail', 'handDetail', 'objectDetail',
  'architectureDetail', 'vehicleDetail', 'surfaceDetail', 'techDetail',
  'foodDetail', 'natureDetail', 'microShadow', 'edgeDetail',
] as const;

export const storyboardProductionMarkKindSchema = z.enum(
  STORYBOARD_PRODUCTION_MARK_KINDS,
);

const normalizedPointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});

const productionStampParameterKeySchema = z.enum([
  'density', 'activity', 'species', 'season', 'wind', 'windowType', 'state',
  'vehicleType', 'view', 'chairType', 'emotion', 'intensity', 'pose',
  'interaction', 'rigType', 'movement',
]);

const productionStampParameterValueSchema = z.enum([
  'sparse', 'medium', 'dense', 'standing', 'moving-right', 'gathered',
  'reacting', 'deciduous', 'summer', 'conifer', 'evergreen', 'strong-right',
  'winter', 'four-pane', 'closed', 'tall', 'casement', 'open',
  'industrial-grid', 'sedan', 'side', 'suv', 'three-quarter', 'van',
  'police-car', 'dining', 'empty', 'office', 'armchair', 'director',
  'surprised', 'high', 'happy', 'worried', 'angry', 'open-palm', 'none',
  'pointing', 'directing', 'fist', 'grip', 'holding-prop', 'tripod',
  'static', 'handheld', 'dolly', 'track', 'crane',
]);

const storyboardProductionStampSchema = z.object({
  variant: z.number().int().min(0).max(31),
  // Kun inspector-label. Promptkompilatoren bruker de allow-listede
  // parameterne under, aldri denne bruker-/klientkontrollerte teksten.
  variantName: z.string().trim().max(100).optional().default(''),
  seed: z.number().int().min(0).max(4_294_967_295),
  scale: z.number().finite().min(0.1).max(8),
  rotationDegrees: z.number().finite().min(-360).max(360),
  flipX: z.boolean(),
  depth: z.enum(['foreground', 'midground', 'background']),
  styleProfileId: z.string().trim().regex(/^[a-z0-9._-]{1,100}$/i),
  continuityId: z.string().trim()
    .regex(/^[a-z0-9._:-]{1,120}$/i).nullable().optional().default(null),
  renderLayer: z.enum(['artwork', 'productionOverlay']),
  perspectiveSkew: z.number().finite().min(-0.45).max(0.45)
    .optional().default(0),
  parameters: z.record(
    productionStampParameterKeySchema,
    productionStampParameterValueSchema,
  ).optional().default({}),
});

const storyboardProductionMarkSchema = z.object({
  strokeId: z.string().trim().min(1).max(200),
  kind: storyboardProductionMarkKindSchema,
  center: normalizedPointSchema,
  bounds: z.object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().min(0).max(1),
    height: z.number().finite().min(0).max(1),
  }),
  direction: z.object({
    dx: z.number().finite().min(-1).max(1),
    dy: z.number().finite().min(-1).max(1),
    angleDegrees: z.number().finite().min(-360).max(360),
  }).nullable().optional().default(null),
  averagePressure: z.number().finite().min(0).max(1).optional().default(0.5),
  pointCount: z.number().int().min(1).max(100_000).optional().default(1),
  stamp: storyboardProductionStampSchema.nullable().optional().default(null),
});

/**
 * The non-destructive viewport applied by Storyboard Room. The artwork stays
 * in source coordinates; this snapshot records the crop the artist actually
 * approved and therefore belongs in the production context sent to every
 * interchangeable image/video model.
 */
export const storyboardShotFramingSchema = z.object({
  version: z.literal(1).default(1),
  centerX: z.number().finite().min(0).max(1),
  centerY: z.number().finite().min(0).max(1),
  zoom: z.number().finite().min(1).max(16),
  rollDegrees: z.number().finite().min(-180).max(180),
  aspectRatio: z.number().finite().min(0.1).max(10),
  focusAnchorX: z.number().finite().min(0).max(1).optional(),
  focusAnchorY: z.number().finite().min(0).max(1).optional(),
  mode: z.enum(['automatic', 'manual', 'recomposed']),
  intentFingerprint: z.string().trim().min(1).max(200).optional(),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  shotSize: optionalText(120),
  angle: optionalText(80),
  lensMm: z.number().int().min(1).max(2_000).optional(),
}).superRefine((value, context) => {
  if ((value.focusAnchorX == null) !== (value.focusAnchorY == null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'focusAnchorX and focusAnchorY must be provided together',
      path: [value.focusAnchorX == null ? 'focusAnchorX' : 'focusAnchorY'],
    });
  }
});

/**
 * A provider-neutral snapshot of everything that gives one storyboard shot
 * meaning. It is intentionally independent of OpenAI/fal/Higgsfield so the
 * exact same production context can be used for a still and its animation.
 */
export const storyboardShotContextSchema = z.object({
  version: z.literal('storyboard-shot-v1').default('storyboard-shot-v1'),
  manuscriptTitle: optionalText(300),
  project: z.object({
    styleProfileId: optionalText(100),
    creativeDirection: optionalText(1_000),
  }).default({ styleProfileId: 'story-pencil', creativeDirection: '' }),
  production: z.object({
    characters: z.array(productionReferenceSchema).max(40).default([]),
    wardrobe: z.array(productionReferenceSchema).max(40).default([]),
    locations: z.array(productionReferenceSchema).max(20).default([]),
    props: z.array(productionReferenceSchema).max(40).default([]),
  }).default({ characters: [], wardrobe: [], locations: [], props: [] }),
  scenario: storyboardScenarioSelectionSchema.nullable().optional().default(null),
  scene: z.object({
    id: optionalText(200),
    number: z.number().int().min(0).max(100_000).nullable().optional().default(null),
    heading: optionalText(500),
    intExt: optionalText(40),
    location: optionalText(500),
    timeOfDay: optionalText(100),
    action: optionalText(4_000),
    characters: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  }),
  shot: z.object({
    id: optionalText(200),
    number: optionalText(40),
    description: optionalText(2_000),
    notes: optionalText(1_200),
    shotType: optionalText(120),
    angle: optionalText(80),
    lensMm: z.number().int().min(1).max(2_000).nullable().optional().default(null),
    movement: optionalText(160),
    lighting: optionalText(500),
    durationSec: z.number().min(0).max(600).nullable().optional().default(null),
    transition: optionalText(160),
    focusDepth: optionalText(160),
    timeOfDay: optionalText(100),
    weather: optionalText(160),
    beat: optionalText(240),
    tags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    shotFraming: storyboardShotFramingSchema.nullable().optional().default(null),
  }),
  continuity: z.object({
    previous: neighbourSchema,
    next: neighbourSchema,
  }).default({ previous: null, next: null }),
  directorNote: optionalText(1_200),
  visualStyle: optionalText(1_000),
  // Redigerbare artistmerker fra iPad. Kun typed geometri godtas; fritekst som
  // kan forsøke å instruere modellen blir strippet av Zod-kontrakten.
  productionMarks: z.array(storyboardProductionMarkSchema).max(200).optional(),
});

export type StoryboardProductionMark = z.infer<typeof storyboardProductionMarkSchema>;

export interface StoryboardAppliedViewport {
  /** Must stay mathematically identical to native ShotFramingGeometry. */
  version: 'shot-framing-geometry-v1';
  sourceSize: { width: number; height: number };
  viewportSize: { width: number; height: number };
  /** Null when the source-space focus anchor is outside the rendered crop. */
  focusAnchor: { x: number; y: number } | null;
  /** Visible, clipped mark geometry in the pixels the model actually receives. */
  productionMarks: StoryboardProductionMark[];
}

/**
 * `appliedViewport` is intentionally not part of the public Zod input schema.
 * Unknown client fields are stripped at the API boundary, then the backend
 * derives this view from trusted canvas dimensions and canonical framing.
 */
export type StoryboardShotContext = z.infer<typeof storyboardShotContextSchema> & {
  appliedViewport?: StoryboardAppliedViewport;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizedDegrees(value: number): number {
  let result = value % 360;
  if (result <= -180) result += 360;
  if (result > 180) result -= 360;
  return result;
}

interface UnclampedPoint {
  x: number;
  y: number;
}

/**
 * Backend counterpart of native `ShotFramingGeometry`. Coordinates are
 * top-left/y-down and positive roll is clockwise. The chosen viewport height
 * is arbitrary; normalized output only depends on its aspect ratio.
 */
function appliedViewportGeometry(
  context: StoryboardShotContext,
  sourceWidth: number,
  sourceHeight: number,
): StoryboardAppliedViewport | null {
  const framing = context.shot.shotFraming;
  if (!framing) return null;

  const safeWidth = Number.isFinite(sourceWidth) && sourceWidth > 0
    ? sourceWidth : 1_920;
  const safeHeight = Number.isFinite(sourceHeight) && sourceHeight > 0
    ? sourceHeight : 1_080;
  const viewportHeight = safeHeight;
  const viewportWidth = viewportHeight * framing.aspectRatio;
  const aspectFillScale = Math.max(
    viewportWidth / safeWidth,
    viewportHeight / safeHeight,
  );
  const sourceScale = aspectFillScale * framing.zoom;
  const radians = framing.rollDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  const project = (point: UnclampedPoint): UnclampedPoint => {
    const translatedX = point.x * safeWidth - framing.centerX * safeWidth;
    const translatedY = point.y * safeHeight - framing.centerY * safeHeight;
    const rotatedX = translatedX * cosine - translatedY * sine;
    const rotatedY = translatedX * sine + translatedY * cosine;
    return {
      x: (viewportWidth / 2 + rotatedX * sourceScale) / viewportWidth,
      y: (viewportHeight / 2 + rotatedY * sourceScale) / viewportHeight,
    };
  };

  const projectDirection = (
    mark: StoryboardProductionMark,
  ): StoryboardProductionMark['direction'] => {
    if (!mark.direction) return null;
    let rotatedX: number;
    let rotatedY: number;
    if (mark.stamp) {
      const directionRadians = (mark.direction.angleDegrees
        + framing.rollDegrees) * Math.PI / 180;
      rotatedX = Math.cos(directionRadians);
      rotatedY = Math.sin(directionRadians);
    } else {
      const sourceX = mark.direction.dx * safeWidth;
      const sourceY = mark.direction.dy * safeHeight;
      rotatedX = sourceX * cosine - sourceY * sine;
      rotatedY = sourceX * sine + sourceY * cosine;
    }
    const length = Math.hypot(rotatedX, rotatedY);
    if (length <= 0.000_001) {
      const fallbackRadians = (mark.direction.angleDegrees
        + framing.rollDegrees) * Math.PI / 180;
      rotatedX = Math.cos(fallbackRadians);
      rotatedY = Math.sin(fallbackRadians);
    }
    const normalizedLength = Math.max(0.000_001, Math.hypot(rotatedX, rotatedY));
    return {
      dx: rotatedX / normalizedLength,
      dy: rotatedY / normalizedLength,
      angleDegrees: normalizedDegrees(Math.atan2(rotatedY, rotatedX) * 180 / Math.PI),
    };
  };

  const productionMarks = (context.productionMarks ?? []).flatMap((mark) => {
    const left = mark.bounds.x;
    const top = mark.bounds.y;
    const right = left + mark.bounds.width;
    const bottom = top + mark.bounds.height;
    const corners = [
      project({ x: left, y: top }),
      project({ x: right, y: top }),
      project({ x: right, y: bottom }),
      project({ x: left, y: bottom }),
    ];
    const projectedLeft = Math.min(...corners.map((point) => point.x));
    const projectedTop = Math.min(...corners.map((point) => point.y));
    const projectedRight = Math.max(...corners.map((point) => point.x));
    const projectedBottom = Math.max(...corners.map((point) => point.y));
    const clippedLeft = clamp01(projectedLeft);
    const clippedTop = clamp01(projectedTop);
    const clippedRight = clamp01(projectedRight);
    const clippedBottom = clamp01(projectedBottom);
    if (projectedRight < 0 || projectedLeft > 1
        || projectedBottom < 0 || projectedTop > 1) return [];

    const projectedCenter = project(mark.center);
    const viewportStamp = mark.stamp ? {
      ...mark.stamp,
      rotationDegrees: normalizedDegrees(
        mark.stamp.rotationDegrees + framing.rollDegrees,
      ),
    } : null;
    return [{
      ...mark,
      center: {
        x: clamp01(projectedCenter.x),
        y: clamp01(projectedCenter.y),
      },
      bounds: {
        x: clippedLeft,
        y: clippedTop,
        width: Math.max(0, clippedRight - clippedLeft),
        height: Math.max(0, clippedBottom - clippedTop),
      },
      direction: projectDirection(mark),
      stamp: viewportStamp,
    }];
  });

  const sourceFocus = framing.focusAnchorX != null
      && framing.focusAnchorY != null
    ? project({ x: framing.focusAnchorX, y: framing.focusAnchorY }) : null;
  const focusAnchor = sourceFocus
      && sourceFocus.x >= 0 && sourceFocus.x <= 1
      && sourceFocus.y >= 0 && sourceFocus.y <= 1
    ? sourceFocus : null;

  return {
    version: 'shot-framing-geometry-v1',
    sourceSize: { width: safeWidth, height: safeHeight },
    viewportSize: { width: viewportWidth, height: viewportHeight },
    focusAnchor,
    productionMarks,
  };
}

/**
 * Server-side fallback for storyboard rows that contain native strokes but
 * were saved before drawingData.productionMarks existed. Client-provided
 * interpretation text is deliberately ignored; only the allow-listed kind
 * and measured geometry survive.
 */
export function productionMarksFromStrokes(
  strokes: unknown[],
  canvasWidth = 1_920,
  canvasHeight = 1_080,
): StoryboardProductionMark[] {
  const safeWidth = Math.max(1, canvasWidth);
  const safeHeight = Math.max(1, canvasHeight);
  return strokes.flatMap((rawStroke): StoryboardProductionMark[] => {
    const stroke = asRecord(rawStroke);
    const brush = asRecord(stroke.brush);
    const released = asRecord(stroke.releasedStampContext);
    const brushKind = storyboardProductionMarkKindSchema.safeParse(
      brush.productionMark,
    );
    const releasedKind = storyboardProductionMarkKindSchema.safeParse(
      released.kind,
    );
    const parsedKind = brushKind.success ? brushKind : releasedKind;
    if (!parsedKind.success) return [];
    const points = (Array.isArray(stroke.points) ? stroke.points : [])
      .map(asRecord)
      .flatMap((point) => {
        const x = finiteNumber(point.x);
        const y = finiteNumber(point.y);
        if (x == null || y == null) return [];
        return [{ x, y, pressure: finiteNumber(point.pressure) ?? 0.5 }];
      });
    if (!points.length) return [];
    const sourceId = typeof released.originalStrokeId === 'string'
      ? released.originalStrokeId : stroke.id;
    const id = typeof sourceId === 'string' && sourceId.trim()
      ? sourceId.trim().slice(0, 200)
      : `production-mark-${parsedKind.data}-${points.length}`;
    const radius = Math.max(
      0.5,
      (finiteNumber(stroke.width) ?? finiteNumber(brush.size) ?? 1) / 2,
    );
    const parsedStamp = storyboardProductionStampSchema.safeParse(
      stroke.stampInstance ?? released.stamp,
    );
    const stamp = parsedStamp.success ? parsedStamp.data : null;
    const depthScale = stamp?.depth === 'foreground'
      ? 1.18 : (stamp?.depth === 'background' ? 0.72 : 1);
    const releasedBaseSize = finiteNumber(released.baseSize);
    const hasReleasedGeometry = releasedKind.success && stamp != null
      && releasedBaseSize != null && releasedBaseSize > 0
      && finiteNumber(released.centerX) != null
      && finiteNumber(released.centerY) != null;
    const effectiveRadius = hasReleasedGeometry
      ? Math.min(Math.max(safeWidth, safeHeight) * 8, releasedBaseSize!) / 2
      : radius * (stamp?.scale ?? 1) * depthScale;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const centerX = hasReleasedGeometry
      ? finiteNumber(released.centerX)! : points.reduce((sum, point) => sum + point.x, 0)
        / points.length;
    const centerY = hasReleasedGeometry
      ? finiteNumber(released.centerY)! : points.reduce((sum, point) => sum + point.y, 0)
        / points.length;
    const left = clamp01(((hasReleasedGeometry ? centerX : Math.min(...xs))
      - effectiveRadius) / safeWidth);
    const top = clamp01(((hasReleasedGeometry ? centerY : Math.min(...ys))
      - effectiveRadius) / safeHeight);
    const right = clamp01(((hasReleasedGeometry ? centerX : Math.max(...xs))
      + effectiveRadius) / safeWidth);
    const bottom = clamp01(((hasReleasedGeometry ? centerY : Math.max(...ys))
      + effectiveRadius) / safeHeight);
    const first = points[0];
    const last = points.at(-1)!;
    const dx = (last.x - first.x) / safeWidth;
    const dy = (last.y - first.y) / safeHeight;
    const hasDirection = Math.hypot(dx, dy) > 0.0001;
    const stampRadians = (stamp?.rotationDegrees ?? 0) * Math.PI / 180;
    return [{
      strokeId: id,
      kind: parsedKind.data,
      center: {
        x: clamp01(centerX / safeWidth),
        y: clamp01(centerY / safeHeight),
      },
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
      direction: stamp
        ? {
          dx: Math.cos(stampRadians),
          dy: Math.sin(stampRadians),
          angleDegrees: stamp.rotationDegrees,
        }
        : hasDirection
          ? { dx, dy, angleDegrees: Math.atan2(dy, dx) * 180 / Math.PI }
          : null,
      averagePressure: clamp01(points.reduce(
        (sum, point) => sum + point.pressure, 0,
      ) / points.length),
      pointCount: points.length,
      stamp,
    }];
  }).slice(0, 200);
}

export function enrichStoryboardContextWithStrokes(
  context: StoryboardShotContext,
  strokes: unknown[],
  canvasWidth?: number | null,
  canvasHeight?: number | null,
): StoryboardShotContext {
  const sourceWidth = canvasWidth ?? 1_920;
  const sourceHeight = canvasHeight ?? 1_080;
  const marks = context.productionMarks?.length
    ? context.productionMarks
    : productionMarksFromStrokes(strokes, sourceWidth, sourceHeight);
  const sourceContext: StoryboardShotContext = marks.length
    ? { ...context, productionMarks: marks }
    : context;
  const appliedViewport = appliedViewportGeometry(
    sourceContext,
    sourceWidth,
    sourceHeight,
  );
  if (!appliedViewport) {
    const { appliedViewport: _ignored, ...withoutStaleViewport } = sourceContext;
    return withoutStaleViewport;
  }
  return { ...sourceContext, appliedViewport };
}

export const STORYBOARD_IMAGE_MODEL = 'gpt-image-2';

export type StoryboardImageAspectRequest =
  | '1792x1024'
  | '1024x1024'
  | '1024x1792';

export interface StoryboardImageAspectPolicy {
  requested: StoryboardImageAspectRequest;
  providerSize: '1536x1024' | '1024x1024' | '1024x1536';
  canonicalLabel: '16:9' | '1:1' | '9:16';
  canonicalUnits: { width: number; height: number };
  canonicalAspectRatio: number;
  normalization: 'center-crop-no-upscale';
}

/**
 * The old OpenAI/DALL-E wire tokens are orientation hints, not the aspect of
 * the finished storyboard panel. GPT Image currently returns 3:2 / 2:3 for
 * landscape / portrait. Every provider result is therefore center-cropped,
 * never stretched or upscaled, to the canonical Storyboard Room aspect.
 */
export function storyboardImageAspectPolicy(
  requested: StoryboardImageAspectRequest,
): StoryboardImageAspectPolicy {
  if (requested === '1792x1024') {
    return {
      requested,
      providerSize: '1536x1024',
      canonicalLabel: '16:9',
      canonicalUnits: { width: 16, height: 9 },
      canonicalAspectRatio: 16 / 9,
      normalization: 'center-crop-no-upscale',
    };
  }
  if (requested === '1024x1792') {
    return {
      requested,
      providerSize: '1024x1536',
      canonicalLabel: '9:16',
      canonicalUnits: { width: 9, height: 16 },
      canonicalAspectRatio: 9 / 16,
      normalization: 'center-crop-no-upscale',
    };
  }
  return {
    requested,
    providerSize: '1024x1024',
    canonicalLabel: '1:1',
    canonicalUnits: { width: 1, height: 1 },
    canonicalAspectRatio: 1,
    normalization: 'center-crop-no-upscale',
  };
}

export function storyboardImageProviderSize(
  requested: StoryboardImageAspectRequest,
): '1536x1024' | '1024x1024' | '1024x1536' {
  return storyboardImageAspectPolicy(requested).providerSize;
}

export function storyboardImageProviderQuality(
  requested: 'standard' | 'hd',
): 'medium' | 'high' {
  return requested === 'hd' ? 'high' : 'medium';
}

/**
 * Conservative guardrail estimate. GPT Image is token-priced, so the exact
 * amount is known only after generation; these ceilings intentionally sit
 * above the current typical medium/high landscape estimates.
 */
export function storyboardImageEstimatedCostUsd(requested: 'standard' | 'hd'): number {
  return requested === 'hd' ? 0.22 : 0.06;
}

export function storyboardContextFingerprint(context: StoryboardShotContext): string {
  return crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 16);
}

export function storyboardContextSummary(context: StoryboardShotContext): string {
  const sceneLabel = [context.scene.number ? `Scene ${context.scene.number}` : '', context.scene.heading]
    .filter(Boolean).join(' · ');
  const camera = [context.shot.shotType, context.shot.lensMm ? `${context.shot.lensMm} mm` : '', context.shot.movement]
    .filter(Boolean).join(' · ');
  return [
    sceneLabel,
    context.shot.number ? `Shot ${context.shot.number}` : '',
    camera,
    context.scene.characters.length ? context.scene.characters.join(', ') : '',
  ].filter(Boolean).join(' | ');
}

/** Rich composition prompt. Screenplay content is delimited as production data. */
export function composeStoryboardImagePrompt(context: StoryboardShotContext): string {
  return compileStoryboardPrompt({
    kind: 'storyboard-image',
    modelId: STORYBOARD_IMAGE_MODEL,
    context,
  }).compiledPrompt;
}

/** Concise motion prompt for image-to-video providers; the source panel owns appearance. */
export function composeStoryboardVideoPrompt(context: StoryboardShotContext): string {
  return compileStoryboardPrompt({
    kind: 'storyboard-video',
    modelId: 'longcat-video-i2v',
    context,
  }).compiledPrompt;
}

/** Backward-compatible context for callers that have not adopted Shot Context v1. */
export function contextFromLegacyStoryboardInput(input: {
  storyboardId?: string;
  title?: string | null;
  sceneDescription?: string;
  intExt?: string;
  timeOfDay?: string;
  locationName?: string;
  shotType?: string;
  prompt?: string;
  styleNote?: string;
}): StoryboardShotContext {
  return storyboardShotContextSchema.parse({
    version: 'storyboard-shot-v1',
    manuscriptTitle: '',
    project: {
      styleProfileId: input.styleNote || 'story-pencil',
      creativeDirection: input.styleNote || '',
    },
    production: { characters: [], wardrobe: [], locations: [], props: [] },
    scenario: null,
    scene: {
      id: '', number: null, heading: '', intExt: input.intExt || '',
      location: input.locationName || '', timeOfDay: input.timeOfDay || '',
      action: input.sceneDescription || '', characters: [],
    },
    shot: {
      id: input.storyboardId || '', number: '', description: input.title || '',
      notes: '', shotType: input.shotType || '', angle: '', lensMm: null, movement: '', lighting: '',
      durationSec: null, transition: '', focusDepth: '', timeOfDay: input.timeOfDay || '',
      weather: '', beat: '', tags: [],
    },
    continuity: { previous: null, next: null },
    directorNote: input.prompt || '',
    visualStyle: input.styleNote || '',
  });
}
