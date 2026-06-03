/**
 * deviceFrames.ts (Tauri-app) — ekte device-mockup-rammer for Guided Recorder-
 * preview. Speiler frontend-modulens spesifikasjon (egne ChatGPT-mockups,
 * transparent bakgrunn, ren svart skjerm). Skjerm-rektanglene er detektert
 * piksel-presist; her uttrykt RELATIVT (0..1) så de er oppløsnings-uavhengige
 * og kan brukes til å plassere en live <iframe> i skjerm-hullet.
 */

import iphoneFrame from './frames/iphone.png';
import ipadFrame from './frames/ipad.png';
import macbookFrame from './frames/macbook.png';

export type FrameVariant = 'iphone' | 'ipad' | 'macbook';

export interface FrameSpec {
  src: string;
  aspect: number; // frameW / frameH
  /** Skjerm-rektangel, relativt til hele frame-PNG-en (0..1). */
  screen: { x: number; y: number; w: number; h: number };
  /** Skjerm-hjørneradius som andel av frame-bredde. */
  radius: number;
}

// Verdier fra piksel-deteksjon (deviceFrames i frontend):
//   iphone  1086x1448  screen 248,85 588x1275
//   ipad    1086x1448  screen 131,112 823x1222
//   macbook 1586x932   screen 261,39 1064x698  (base glattet + avrundet, slab fjernet)
export const DEVICE_FRAMES: Record<FrameVariant, FrameSpec> = {
  iphone: {
    src: iphoneFrame, aspect: 1086 / 1448,
    screen: { x: 248 / 1086, y: 85 / 1448, w: 588 / 1086, h: 1275 / 1448 },
    radius: 56 / 1086,
  },
  ipad: {
    src: ipadFrame, aspect: 1086 / 1448,
    screen: { x: 131 / 1086, y: 112 / 1448, w: 823 / 1086, h: 1222 / 1448 },
    radius: 20 / 1086,
  },
  macbook: {
    src: macbookFrame, aspect: 1586 / 932,
    screen: { x: 261 / 1586, y: 39 / 932, w: 1064 / 1586, h: 698 / 932 },
    radius: 6 / 1586,
  },
};
