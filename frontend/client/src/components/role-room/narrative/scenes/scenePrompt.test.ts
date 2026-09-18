import { describe, expect, it } from 'vitest';
import { buildScenePrompt, SCENE_PROMPT_MAX } from './scenePrompt';

describe('buildScenePrompt (Fase 8f)', () => {
  it('setter sammen scene, epoke, sted, felt, lokasjonsprofil og visuell retning — uten forfatterfasit', () => {
    const p = buildScenePrompt({
      scene: { code: 'P01', title: 'Skoleveien', era: '1797', beforeState: 'Bok hos Elise, løs skolisse.', action: 'Nora tar boken og knyter skolissen.', environment: 'Grusvei mellom bjørker' },
      location: { name: 'Skoleveien', profile: { continuity: 'Steingjerdet til høyre hele veien.', props: ['bok', 'filleball', 'skolisse'], summary: 'x' } },
      visualDirection: { lookAndFeel: 'Filmisk, lykt nær ansikt.', lighting: 'Dynamisk direkte lys nær spilleren.', authorTruth: 'HEMMELIG', fog: 'Bevar nære silhuetter.' },
      extraRules: ['Ingen våpen synlige.'],
    });
    expect(p).toContain('P01');
    expect(p).toContain('1797, norsk bygd');
    expect(p).toContain('Sted: Skoleveien');
    expect(p).toContain('Handling: Nora tar boken');
    expect(p).toContain('Rekvisitter som skal være synlige: bok, filleball, skolisse.');
    expect(p).toContain('Uttrykk: Filmisk');
    expect(p).toContain('Tåke: Bevar');
    expect(p).toContain('Ingen våpen synlige.');
    expect(p).not.toContain('HEMMELIG');
    expect(p.endsWith('Ingen moderne gjenstander.')).toBe(true);
  });

  it('klipper lange felt og holder seg under maksgrensen', () => {
    const long = 'a'.repeat(5000);
    const p = buildScenePrompt({ scene: { code: 'G03A', title: long, beforeState: long, action: long, environment: long }, visualDirection: { lighting: long, materials: long, camera: long } });
    expect(p.length).toBeLessThanOrEqual(SCENE_PROMPT_MAX);
    expect(p).toContain('…');
  });

  it('tåler tomt scenekort', () => {
    const p = buildScenePrompt({ scene: { code: 'S1', title: '' } });
    expect(p).toContain('S1');
    expect(p).not.toContain('Sted:');
  });
});
