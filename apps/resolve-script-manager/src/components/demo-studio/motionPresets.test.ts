import { beforeEach, describe, expect, it } from 'vitest';

import { loadPresets, savePreset, deletePreset } from './motionPresets.js';
import { buildMotionSuggestPrompt } from './motionAI.js';

describe('motionPresets (localStorage-basert stil-lagring)', () => {
  beforeEach(() => {
    const mem: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: (k: string) => { delete mem[k]; },
      clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
      key: () => null, length: 0,
    } as Storage;
  });

  it('tom start, lagre, overskriv ved samme navn, slett', () => {
    expect(loadPresets()).toHaveLength(0);
    savePreset({ name: 'Hus', arch: 'sting', format: '16:9', place: { theme: 'dark' }, tempo: 'normal' });
    savePreset({ name: 'Reels', arch: 'stat', format: '9:16', place: {}, tempo: 'fast' });
    expect(loadPresets()).toHaveLength(2);
    savePreset({ name: 'Hus', arch: 'list', format: '1:1', place: {}, tempo: 'slow' });
    expect(loadPresets()).toHaveLength(2);
    expect(loadPresets().find((p) => p.name === 'Hus')?.arch).toBe('list');
    deletePreset('Reels');
    expect(loadPresets().map((p) => p.name)).toEqual(['Hus']);
  });

  it('korrupt/manglende localStorage → tom liste, ingen kast', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem('trrpa.motion.presets', 'ikke-json');
    expect(loadPresets()).toEqual([]);
  });
});

describe('buildMotionSuggestPrompt (AI make-it-move)', () => {
  it('lister felt + arketyper + ber om JSON', () => {
    const p = buildMotionSuggestPrompt({ doors: '1240', pipe: '312000 kr' });
    expect(p).toContain('doors: 1240');
    expect(p).toContain('sting');
    expect(p).toContain('JSON');
  });
});
