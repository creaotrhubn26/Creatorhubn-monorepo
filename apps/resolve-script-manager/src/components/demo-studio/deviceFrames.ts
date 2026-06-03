/**
 * deviceFrames.ts (Tauri-app) — ekte device-mockup-rammer for Guided Recorder-
 * preview. Speiler frontend-modulens spesifikasjon (egne ChatGPT-mockups,
 * transparent bakgrunn, ren svart skjerm). Skjerm-rektanglene er detektert
 * piksel-presist; her uttrykt RELATIVT (0..1) så de er oppløsnings-uavhengige
 * og kan brukes til å plassere en live <iframe> i skjerm-hullet.
 */

import iphoneFrame from './frames/iphone.png';
import ipadFrame from './frames/ipad.png';
import ipadLandscapeFrame from './frames/ipad-landscape.png';
import macbookFrame from './frames/macbook.png';

export type FrameVariant = 'iphone' | 'ipad' | 'ipad_landscape' | 'macbook';

export interface FrameSpec {
  src: string;
  aspect: number; // frameW / frameH
  /** Skjerm-rektangel, relativt til hele frame-PNG-en (0..1). */
  screen: { x: number; y: number; w: number; h: number };
  /** Skjerm-hjørneradius som andel av frame-bredde. */
  radius: number;
}

// Rene mockups (Daniels Desktop-kilder, 2026-06-03), skjerm presist detektert:
//   iphone  1086x1448  screen 248,86 588x1274
//   ipad    1086x1448  screen 130,114 822x1220
//   ipad-L  1448x1086  screen 114,134 1220x820  (ipad rotert 90° CCW)
//   macbook 1586x992   screen 258,22 1070x714   (HELE laptopen, ingen beskjæring)
export const DEVICE_FRAMES: Record<FrameVariant, FrameSpec> = {
  iphone: {
    src: iphoneFrame, aspect: 1086 / 1448,
    screen: { x: 248 / 1086, y: 86 / 1448, w: 588 / 1086, h: 1274 / 1448 },
    radius: 56 / 1086,
  },
  ipad: {
    src: ipadFrame, aspect: 1086 / 1448,
    screen: { x: 130 / 1086, y: 114 / 1448, w: 822 / 1086, h: 1220 / 1448 },
    radius: 20 / 1086,
  },
  ipad_landscape: {
    src: ipadLandscapeFrame, aspect: 1448 / 1086,
    screen: { x: 114 / 1448, y: 134 / 1086, w: 1220 / 1448, h: 820 / 1086 },
    radius: 20 / 1448,
  },
  macbook: {
    src: macbookFrame, aspect: 1586 / 992,
    screen: { x: 258 / 1586, y: 22 / 992, w: 1070 / 1586, h: 714 / 992 },
    radius: 6 / 1586,
  },
};
