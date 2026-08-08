/**
 * mockupScenes.ts — lifestyle-scener (fotografiske bakgrunner der skjermbildet
 * warpes inn i en perspektiv-quad). Daniels egne ChatGPT-genererte scener
 * (ingen lisens). Quad-hjørner (TL,TR,BR,BL) piksel-detektert (største svarte
 * region), uttrykt relativt (0..1).
 */

import sceneDesk from './scenes/scene_desk.jpg';
import sceneHand from './scenes/scene_hand.jpg';
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
];

export function sceneById(id: string | undefined): MockupScene | undefined {
  return id ? MOCKUP_SCENES.find((s) => s.id === id) : undefined;
}
