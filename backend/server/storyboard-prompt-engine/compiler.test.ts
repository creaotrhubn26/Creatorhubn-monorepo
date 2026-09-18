import { describe, expect, it } from 'vitest';
import { storyboardShotContextSchema } from '../storyboard-ai-context.js';
import {
  compileStoryboardPrompt,
  PROMPT_ENGINE_VERSION,
  validateGeneratedImageBase64,
} from './index.js';

const moduleOrder = [
  'base-cinematography', 'project-style', 'character', 'wardrobe', 'location', 'prop',
  'shot', 'camera', 'lighting', 'continuity', 'user-intent', 'model-rules',
];

const trollContext = storyboardShotContextSchema.parse({
  manuscriptTitle: 'TROLL',
  project: {
    styleProfileId: 'story-pencil',
    creativeDirection: 'Urolig norsk folkeeventyrrealisme.',
  },
  production: {
    characters: [{
      id: 'nora', name: 'Nora', description: '19 år, mørk bob-frisyre.',
      referenceImageIds: ['nora-turnaround'], locked: true,
    }],
    wardrobe: [{
      id: 'nora-train', name: 'Noras togkostyme', description: 'Mørk ullfrakk.',
      referenceImageIds: ['wardrobe-nora-01'], locked: true,
    }],
    locations: [{
      id: 'train', name: 'Nattoget', description: 'Slitt norsk togkupé.',
      referenceImageIds: ['train-location-01'], locked: true,
    }],
    props: [{
      id: 'route-screen', name: 'Ruteskjerm', description: 'Pulserende blå rute.',
      referenceImageIds: [], locked: true,
    }],
  },
  scene: {
    id: 'scene-3', number: 3, heading: 'INT. TOG — NATT', intExt: 'INT',
    location: 'Tog gjennom Dovrefjell', timeOfDay: 'NATT',
    action: 'Nora ser et troll speilet i togvinduet.', characters: ['Nora'],
  },
  shot: {
    id: '3b', number: '3B', description: 'Et troll-omriss kommer gradvis frem bak Nora.',
    notes: '', shotType: 'MCU', angle: 'Low Angle', lensMm: 50, movement: 'Push In',
    lighting: 'Varm skjermglød, kald månespeiling.', durationSec: 4, transition: 'Cut',
    focusDepth: 'Shallow', timeOfDay: 'NATT', weather: 'Snøstorm', beat: 'Varsel', tags: [],
  },
  continuity: {
    previous: { shotNumber: '3A', description: 'Nora følger ruten.' },
    next: { shotNumber: '3C', description: 'Toget går inn i tunnelen.' },
  },
  directorNote: 'Hold trollet nesten usynlig til siste sekund.',
  visualStyle: '',
});

describe('The Role Room Prompt Engine', () => {
  it('komponerer alle produksjonsmodulene i stabil rekkefølge', () => {
    const result = compileStoryboardPrompt({
      kind: 'storyboard-image', modelId: 'gpt-image-2', context: trollContext,
      userAction: 'Generate low-angle MCU',
    });

    expect(result.version).toBe(PROMPT_ENGINE_VERSION);
    expect(result.modules.map((entry) => entry.id)).toEqual(moduleOrder);
    expect(result.compiledPrompt).toContain('monochrome production storyboard drawing');
    expect(result.compiledPrompt).toContain('medium close-up');
    expect(result.compiledPrompt).toContain('low-angle camera');
    expect(result.compiledPrompt).toContain('50 mm lens');
    expect(result.compiledPrompt).toContain('slow motivated push-in');
    expect(result.validation.valid).toBe(true);
  });

  it('gir en forklarbar Inspector uten å kalle en modell', () => {
    const result = compileStoryboardPrompt({
      kind: 'storyboard-image', modelId: 'gpt-image-2', context: trollContext,
      userAction: 'Generate low-angle MCU',
    });

    expect(result.inspector.intent).toBe('Generate low-angle MCU');
    expect(result.inspector.characterCount).toBe(1);
    expect(result.inspector.characterReferenceCount).toBe(1);
    expect(result.inspector.locationReferenceCount).toBe(1);
    expect(result.inspector.styleProfileLabel).toBe('TRR Story Pencil');
    expect(result.inspector.lockedProperties).toContain('style');
    expect(result.inspector.model.id).toBe('gpt-image-2');
    expect(result.inspector.inheritedConstraintCount).toBeGreaterThan(18);
  });

  it('bytter modellregler uten å endre produksjonskonteksten', () => {
    const longcat = compileStoryboardPrompt({
      kind: 'storyboard-video', modelId: 'longcat-video-i2v', context: trollContext,
    });
    const seedance = compileStoryboardPrompt({
      kind: 'storyboard-video', modelId: 'seedance-2-i2v', context: trollContext,
    });

    expect(longcat.contextFingerprint).toBe(seedance.contextFingerprint);
    expect(longcat.compilationFingerprint).not.toBe(seedance.compilationFingerprint);
    expect(longcat.inspector.model.id).toBe('longcat-video-i2v');
    expect(seedance.inspector.model.id).toBe('seedance-2-i2v');
    expect(longcat.compiledPrompt).toContain('troll-omriss');
    expect(seedance.compiledPrompt).toContain('troll-omriss');
    expect(longcat.compiledPrompt.length).toBeLessThanOrEqual(1_200);
    expect(seedance.compiledPrompt.length).toBeLessThanOrEqual(1_200);
  });

  it('stopper manglende shot-intensjon før generering', () => {
    const empty = storyboardShotContextSchema.parse({
      ...trollContext,
      scene: { ...trollContext.scene, action: '' },
      shot: { ...trollContext.shot, description: '' },
      directorNote: '',
    });
    const result = compileStoryboardPrompt({
      kind: 'storyboard-image', modelId: 'gpt-image-2', context: empty,
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.map((issue) => issue.code)).toContain('missing_shot_action');
  });

  it('validerer leverandørens bildepayload etter generering', () => {
    expect(validateGeneratedImageBase64('ikke-base64!').valid).toBe(false);
    expect(validateGeneratedImageBase64(Buffer.alloc(2_048, 1).toString('base64')).valid).toBe(true);
  });
});
