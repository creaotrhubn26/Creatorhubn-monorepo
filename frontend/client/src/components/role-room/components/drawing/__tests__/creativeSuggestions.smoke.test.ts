// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  suggestShotsForScene,
  analyzeCoverage,
  suggestReferences,
} from '../creativeSuggestions';

function makeScene(overrides: any = {}): any {
  return {
    id: 's1',
    sceneNumber: 1,
    description: '',
    characters: [],
    propsNeeded: [],
    storyboardFrames: [],
    ...overrides,
  };
}

describe('Sprint A.7 — suggestShotsForScene', () => {
  it('EXT-scene foreslår etablerende wide som critical', () => {
    const scene = makeScene({ intExt: 'EXT', timeOfDay: 'DAY', description: 'En park.' });
    const suggestions = suggestShotsForScene(scene);
    const establishing = suggestions.find((s) => s.shotType === 'establishing');
    expect(establishing).toBeDefined();
    expect(establishing?.priority).toBe('critical');
  });

  it('INT-scene foreslår wide istedenfor establishing', () => {
    const scene = makeScene({ intExt: 'INT', timeOfDay: 'DAY', description: 'Et kjøkken.' });
    const suggestions = suggestShotsForScene(scene);
    expect(suggestions.find((s) => s.shotType === 'wide')).toBeDefined();
    expect(suggestions.find((s) => s.shotType === 'establishing')).toBeUndefined();
  });

  it('Dialog med flere talere foreslår OTS + two-shot + reaction-CU', () => {
    const scene = makeScene({ intExt: 'INT', description: 'To venner snakker.' });
    const dialogue = [
      { sceneId: 's1', characterName: 'ANNA', dialogueText: 'Hei' },
      { sceneId: 's1', characterName: 'BJØRN', dialogueText: 'Hei selv' },
      { sceneId: 's1', characterName: 'ANNA', dialogueText: 'Hvor har du vært?' },
      { sceneId: 's1', characterName: 'BJØRN', dialogueText: 'Borte.' },
    ];
    const suggestions = suggestShotsForScene(scene, dialogue);
    expect(suggestions.find((s) => s.shotType === 'two-shot')).toBeDefined();
    expect(suggestions.find((s) => s.shotType === 'ots')).toBeDefined();
  });

  it('Action-verb i beskrivelsen foreslår tracking + wide', () => {
    const scene = makeScene({ description: 'Hun løper gjennom gaten.' });
    const suggestions = suggestShotsForScene(scene);
    expect(suggestions.find((s) => s.shotType === 'tracking')).toBeDefined();
    expect(suggestions.find((s) => s.shotType === 'wide')).toBeDefined();
  });

  it('Reveal-verb foreslår reaction FØR POV', () => {
    const scene = makeScene({ description: 'Han oppdager liket bak døren.' });
    const suggestions = suggestShotsForScene(scene);
    const reaction = suggestions.find((s) => s.shotType === 'reaction');
    const pov = suggestions.find((s) => s.shotType === 'pov');
    expect(reaction).toBeDefined();
    expect(pov).toBeDefined();
    // Begge er critical — sortert først
    expect(reaction?.priority).toBe('critical');
  });

  it('Emosjonelt verb foreslår close-up som critical', () => {
    const scene = makeScene({ description: 'Hun gråter ved vinduet.' });
    const suggestions = suggestShotsForScene(scene);
    const cu = suggestions.find((s) => s.shotType === 'close-up');
    expect(cu).toBeDefined();
    expect(cu?.priority).toBe('critical');
  });

  it('Props foreslår insert', () => {
    const scene = makeScene({ propsNeeded: ['nøkkel', 'pistol'], description: 'Han finner nøkkelen.' });
    const suggestions = suggestShotsForScene(scene);
    const insert = suggestions.find((s) => s.shotType === 'insert');
    expect(insert).toBeDefined();
    expect(insert?.rationale).toContain('nøkkel');
  });

  it('Tom scene faller tilbake til "wide first"-default', () => {
    const scene = makeScene({});
    const suggestions = suggestShotsForScene(scene);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].shotType).toBe('wide');
  });

  it('Solo karakter uten dialog foreslår kontemplativ medium', () => {
    const scene = makeScene({ characters: ['ALEX'], intExt: 'INT', description: 'Alex står stille.' });
    const suggestions = suggestShotsForScene(scene);
    expect(suggestions.find((s) => s.shotType === 'medium')).toBeDefined();
  });

  it('Sorterer critical først, så recommended, så try', () => {
    const scene = makeScene({
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      description: 'Hun løper.',
      propsNeeded: ['kniv'],
    });
    const suggestions = suggestShotsForScene(scene);
    const priorities = suggestions.map((s) => s.priority);
    // Ingen critical etter recommended/try
    let seenNonCritical = false;
    for (const p of priorities) {
      if (p !== 'critical') seenNonCritical = true;
      if (p === 'critical' && seenNonCritical) {
        throw new Error('Critical etter non-critical — sortering brutt');
      }
    }
  });
});

describe('Sprint A.7 — analyzeCoverage', () => {
  it('Scene uten frames flagges som critical med no-frames-gap', () => {
    const scenes = [
      makeScene({ id: 's1', description: 'Lang scene med mye ord her ' }),
    ];
    const report = analyzeCoverage(scenes);
    expect(report[0].severity).toBe('critical');
    expect(report[0].gaps.find((g) => g.kind === 'no-frames')).toBeDefined();
  });

  it('Scene med frames i samme shot-type flagges som no-coverage-variation', () => {
    const scenes = [
      makeScene({
        id: 's1',
        description: 'En scene med flere beats.',
        storyboardFrames: [
          { id: 'f1', shotNumber: '1A', description: 'wide of room' },
          { id: 'f2', shotNumber: '1B', description: 'wide angle again' },
          { id: 'f3', shotNumber: '1C', description: 'wide third take' },
        ],
      }),
    ];
    const report = analyzeCoverage(scenes);
    expect(report[0].gaps.find((g) => g.kind === 'no-coverage-variation')).toBeDefined();
  });

  it('Scene uten close-up med mye tekst flagges', () => {
    const scenes = [
      makeScene({
        id: 's1',
        description: 'Lang scene med mer enn femti ord — '.repeat(10),
        storyboardFrames: [
          { id: 'f1', shotNumber: '1A', description: 'wide angle' },
          { id: 'f2', shotNumber: '1B', description: 'medium shot' },
        ],
      }),
    ];
    const report = analyzeCoverage(scenes);
    expect(report[0].gaps.find((g) => g.kind === 'no-close-up')).toBeDefined();
  });

  it('Velkomponert scene med wide+CU+medium er ok', () => {
    const scenes = [
      makeScene({
        id: 's1',
        description: 'En grei scene med dekning.',
        storyboardFrames: [
          { id: 'f1', shotNumber: '1A', description: 'wide of the room' },
          { id: 'f2', shotNumber: '1B', description: 'medium shot of Anna' },
          { id: 'f3', shotNumber: '1C', description: 'close-up of her hand' },
        ],
      }),
    ];
    const report = analyzeCoverage(scenes);
    expect(report[0].severity).toBe('ok');
    expect(report[0].gaps).toHaveLength(0);
  });

  it('Beregner ord-til-frame-ratio når frames finnes', () => {
    const scenes = [
      makeScene({
        id: 's1',
        description: 'Ord her '.repeat(20),
        storyboardFrames: [
          { id: 'f1', description: 'wide' },
          { id: 'f2', description: 'close-up' },
        ],
      }),
    ];
    const report = analyzeCoverage(scenes);
    expect(report[0].wordsPerFrame).toBe(20);
  });
});

describe('Sprint A.7 — suggestReferences', () => {
  it('EXT NIGHT trekker fram night/atmosfære-referanser', () => {
    const scene = makeScene({ intExt: 'EXT', timeOfDay: 'NIGHT' });
    const refs = suggestReferences(scene);
    expect(refs.length).toBeGreaterThan(0);
    // Forventer at Blade Runner-typen (ext+night) er med på topp
    expect(refs.some((r) => r.tags.includes('night'))).toBe(true);
  });

  it('Action-scene trekker fram tracking/long-take-referanser', () => {
    const scene = makeScene({ description: 'Hun løper.' });
    const refs = suggestReferences(scene);
    expect(refs.some((r) => r.tags.includes('action') || r.tags.includes('tracking'))).toBe(true);
  });

  it('Solo karakter trekker fram contemplative-referanser', () => {
    const scene = makeScene({ characters: ['ALEX'], description: 'Alex venter.' });
    const refs = suggestReferences(scene);
    expect(refs.some((r) => r.tags.includes('solo') || r.tags.includes('contemplative'))).toBe(true);
  });

  it('Returnerer fallback når ingen tags matcher', () => {
    const scene = makeScene({});
    const refs = suggestReferences(scene, 3);
    expect(refs.length).toBe(3);
  });
});
