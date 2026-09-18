import { describe, expect, it } from 'vitest';
import type { SceneBreakdown } from '../../models/casting';
import { mergeSceneOptions, sceneOptionName, sceneSortKey } from './sceneOptions';

const scene = (over: Partial<SceneBreakdown>): SceneBreakdown => ({ id: 's', ...over } as SceneBreakdown);

describe('sceneOptionName', () => {
  it('setter nummer foran tittel, slik en innspillingsplan leses', () => {
    expect(sceneOptionName(scene({ id: 'x', sceneNumber: 12, sceneName: 'Tobias våkner' })))
      .toBe('12 — Tobias våkner');
  });

  it('bruker overskriften når scenen ikke har eget navn', () => {
    expect(sceneOptionName(scene({ id: 'x', sceneNumber: 3, heading: 'INT. HYTTE – NATT' })))
      .toBe('3 — INT. HYTTE – NATT');
  });

  it('faller tilbake på id når scenen ikke sier noe om seg selv', () => {
    expect(sceneOptionName(scene({ id: 'troll-scene-9' }))).toBe('troll-scene-9');
  });
});

describe('mergeSceneOptions', () => {
  it('tar med manusscener det lokale prosjektet ikke kjenner', () => {
    // Dette var feilen: Troll hadde ti scener i manuset og fire med shotliste,
    // og velgeren tilbød de fire.
    const merged = mergeSceneOptions(
      [scene({ id: 'scene-1', sceneNumber: 1 }), scene({ id: 'scene-2', sceneNumber: 2 })],
      [{ id: 'scene-1', name: 'Scene scene-1' }],
    );

    expect(merged.map((option) => option.id)).toEqual(['scene-1', 'scene-2']);
  });

  it('beholder en scene som bare finnes lokalt', () => {
    const merged = mergeSceneOptions([], [{ id: 'scene-4', name: 'Scene scene-4' }]);
    expect(merged.map((option) => option.id)).toEqual(['scene-4']);
  });

  it('lar manuset bestemme navnet', () => {
    const merged = mergeSceneOptions(
      [scene({ id: 'scene-9', sceneNumber: 9, sceneName: 'Brua' })],
      [{ id: 'scene-9', name: 'Scene scene-9' }],
    );
    expect(merged[0].name).toBe('9 — Brua');
  });

  it('beholder miniatyrbildet prosjektet hadde', () => {
    const merged = mergeSceneOptions(
      [scene({ id: 'scene-9', sceneNumber: 9, sceneName: 'Brua' })],
      [{ id: 'scene-9', name: 'Scene scene-9', thumbnail: 'https://bilde' }],
    );
    expect(merged[0].thumbnail).toBe('https://bilde');
  });

  it('sorterer i scenerekkefølge, ikke alfabetisk', () => {
    const merged = mergeSceneOptions(
      [
        scene({ id: 'scene-10', sceneNumber: 10 }),
        scene({ id: 'scene-2', sceneNumber: 2 }),
        scene({ id: 'scene-1', sceneNumber: 1 }),
      ],
      [],
    );
    expect(merged.map((option) => option.id)).toEqual(['scene-1', 'scene-2', 'scene-10']);
  });

  it('legger scener uten nummer sist i stedet for midt i rekka', () => {
    const merged = mergeSceneOptions(
      [scene({ id: 'ekstra', sceneName: 'Pickup' }), scene({ id: 'scene-3', sceneNumber: 3 })],
      [],
    );
    expect(merged.map((option) => option.id)).toEqual(['scene-3', 'ekstra']);
  });
});

describe('sceneSortKey', () => {
  it('leser nummeret fra id-en når navnet ikke har ett', () => {
    expect(sceneSortKey({ id: 'troll-1780071501773-scene-9', name: 'Scene' })).toBe(9);
  });

  it('svarer null når ingenting ligner et scenenummer', () => {
    expect(sceneSortKey({ id: 'pickup', name: 'Pickup' })).toBeNull();
  });
});
