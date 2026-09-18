import crypto from 'node:crypto';
import { z } from 'zod';
import { compileStoryboardPrompt } from './storyboard-prompt-engine/index.js';

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
  }),
  continuity: z.object({
    previous: neighbourSchema,
    next: neighbourSchema,
  }).default({ previous: null, next: null }),
  directorNote: optionalText(1_200),
  visualStyle: optionalText(1_000),
});

export type StoryboardShotContext = z.infer<typeof storyboardShotContextSchema>;

export const STORYBOARD_IMAGE_MODEL = 'gpt-image-2';

export function storyboardImageProviderSize(
  requested: '1792x1024' | '1024x1024' | '1024x1792',
): '1536x1024' | '1024x1024' | '1024x1536' {
  if (requested === '1792x1024') return '1536x1024';
  if (requested === '1024x1792') return '1024x1536';
  return '1024x1024';
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
