/**
 * mockupScenes.ts — lifestyle-scener (fotografiske bakgrunner der skjermbildet
 * warpes inn i en perspektiv-quad). Daniels egne ChatGPT-genererte scener
 * (ingen lisens). Quad-hjørner (TL,TR,BR,BL) piksel-detektert (største svarte
 * region), uttrykt relativt (0..1).
 */

import sceneDesk from './scenes/scene_desk.jpg';
import sceneHand from './scenes/scene_hand.jpg';
import sceneField from './scenes/scene_field.jpg';
import sceneOffice from './scenes/scene_office.jpg';
import type { Quad } from './mockupSceneWarp';

export interface MockupScene {
  id: string;
  label: string;
  src: string;
  aspect: number; // W/H
  /** Skjerm-quad relativt (0..1): TL, TR, BR, BL. */
  screen: Quad;
}

export const MOCKUP_SCENES: MockupScene[] = [
  {
    id: 'scene_desk', label: 'Skrivebord (rett på)', src: sceneDesk, aspect: 1122 / 1402,
    screen: [[0.3449, 0.219], [0.6524, 0.214], [0.6551, 0.7946], [0.3467, 0.7939]],
  },
  {
    id: 'scene_hand', label: 'Hånd-holdt (vinklet)', src: sceneHand, aspect: 1122 / 1402,
    screen: [[0.3226, 0.1498], [0.6373, 0.1369], [0.7184, 0.6912], [0.3939, 0.7083]],
  },
  {
    // Auto-detektert quad (scripts/detect-scene-quad.py). Higgsfield-generert, ingen lisens.
    id: 'scene_field', label: 'Arbeidsfelt (håndholdt)', src: sceneField, aspect: 1122 / 1496,
    screen: [[0.2325, 0.1914], [0.8, 0.2233], [0.84, 0.7824], [0.215, 0.8105]],
  },
  {
    id: 'scene_office', label: 'Kontor (håndholdt)', src: sceneOffice, aspect: 1122 / 1496,
    screen: [[0.2025, 0.3396], [0.785, 0.349], [0.7925, 0.728], [0.2725, 0.7411]],
  },
];

export function sceneById(id: string | undefined): MockupScene | undefined {
  return id ? MOCKUP_SCENES.find((s) => s.id === id) : undefined;
}
