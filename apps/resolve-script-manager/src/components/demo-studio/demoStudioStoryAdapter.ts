/**
 * demoStudioStoryAdapter — bro mellom Demo Studio sin scene-først-modell og
 * den eksisterende Story-modulen (StoryView/useNarrativeStructure).
 *
 * Story-modulen er pick-derivert (NarrativePick + ChapterDef → narrativ
 * struktur). Demo Studio er scene-først. Denne adapteren projiserer
 * demo-scener til NarrativePick[] + en product_demo-ChapterDef[], slik at vi
 * kan gjenbruke HELE StoryView (arc / emotional flow / beats / scene graph /
 * Story Director) uten å duplisere visualiseringene.
 *
 * Mapping:
 *   - Hver DemoScene → én NarrativePick (varighet, rekkefølge, chapter=scene.id-prefiks)
 *   - scene.duration → durationSec; akkumulert startSec/endSec
 *   - en syntetisk "energi"-kurve utledes fra scenens beat-rolle, slik at
 *     StoryArcPanel/EmotionalFlowPanel viser en meningsfull bue.
 *   - hver scene får en ChapterDef med eksplisitt narrativeBeat (basert på
 *     posisjon i flow-en), så useNarrativeStructure plasserer dem riktig.
 */

import type { NarrativePick } from '../../hooks/useNarrativeStructure';
import type { ChapterDef } from '../../agents/types';
import type { DemoScene } from './demoStudioModel';

type UniversalBeat = NonNullable<ChapterDef['narrativeBeat']>;

/**
 * Heuristikk: plassér en scene i et universelt beat basert på relativ posisjon
 * i flow-en. Første ~15 % = hook, deretter setup/build, midten = peak,
 * mot slutten = celebration, siste = outro. Matcher inferBeat i
 * useNarrativeStructure, men scene-først (ingen signals å gå på).
 */
function beatForScene(index: number, total: number): UniversalBeat {
  if (total <= 1) return 'peak';
  const ratio = index / (total - 1);
  if (ratio <= 0.0) return 'hook';
  if (ratio < 0.25) return 'setup';
  if (ratio < 0.55) return 'build';
  if (ratio < 0.7) return 'peak';
  if (ratio < 0.9) return 'celebration';
  return 'outro';
}

/** Syntetisk energi per beat — gir StoryArcPanel en naturlig dramaturgisk bue. */
const BEAT_ENERGY: Record<UniversalBeat, number> = {
  hook: 0.45,
  setup: 0.35,
  build: 0.6,
  peak: 0.95,
  celebration: 0.75,
  outro: 0.3,
};

/** Chapter-id per scene: stabil og unik så useNarrativeStructure kan slå opp. */
export function chapterIdForScene(scene: DemoScene): string {
  return `demo_${scene.index}`;
}

/**
 * Bygg ChapterDef[] som matcher scenene. Hver scene blir sitt eget "chapter"
 * med eksplisitt narrativeBeat, slik at Story-strukturen blir forutsigbar.
 */
export function demoChapters(scenes: DemoScene[]): ChapterDef[] {
  return scenes.map((s) => {
    const beat = beatForScene(s.index, scenes.length);
    const priorityHint: ChapterDef['priorityHint'] =
      beat === 'peak' ? 'emotional-peak'
      : beat === 'build' || beat === 'celebration' ? 'high-energy'
      : beat === 'outro' ? 'atmospheric'
      : 'informational';
    return {
      id: chapterIdForScene(s),
      label: s.title,
      description: s.narration || s.requiredAction || s.title,
      pacingPct: undefined,
      priorityHint,
      narrativeBeat: beat,
    };
  });
}

/**
 * Projisér demo-scener til NarrativePick[]. Pick.index = scene.index så
 * onFocusPick fra StoryView mapper 1:1 tilbake til scenen.
 */
export function demoScenesToPicks(scenes: DemoScene[]): NarrativePick[] {
  let cursor = 0;
  return scenes.map((s) => {
    const startSec = cursor;
    const durationSec = Math.max(0.1, s.duration || 0);
    cursor += durationSec;
    const beat = beatForScene(s.index, scenes.length);
    const energy = BEAT_ENERGY[beat];
    return {
      index: s.index,
      startSec,
      endSec: startSec + durationSec,
      durationSec,
      score: energy,
      chapter: chapterIdForScene(s),
      thumbnailPath: undefined,
      // useNarrativeStructure.computeEnergyForPick leser disse signal-nøklene.
      signals: {
        emotional_peak: energy,
        action: beat === 'build' || beat === 'peak' ? 0.6 : 0.2,
        faces: 0,
      },
    };
  });
}
