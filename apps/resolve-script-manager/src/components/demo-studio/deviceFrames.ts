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
  /** Skjerm-rektangel (bounding-box av skjermflaten), relativt til frame-PNG (0..1). */
  screen: { x: number; y: number; w: number; h: number };
  /** Skjerm-hjørneradius som andel av frame-bredde. */
  radius: number;
  /** Valgfri presis skjerm-QUAD (4 hjørner rel. frame 0..1) for enheter der skjermen
   *  har perspektiv/keystone (f.eks. den vinklede MacBook-en). Når satt, corner-pinnes
   *  innholdet nøyaktig til disse hjørnene i stedet for å fylle et akse-rett rektangel
   *  → ser ut akkurat som på en ekte skjerm. Flate enheter (telefon/nettbrett) trenger
   *  ingen quad. Rekkefølge: TL, TR, BR, BL. */
  quad?: { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] };
}

// Rene mockups (Daniels Desktop-kilder, 2026-06-03), skjerm presist detektert:
//   iphone  1086x1448  screen 248,86 588x1274
//   ipad    1086x1448  screen 130,114 822x1220
//   ipad-L  1448x1086  screen 114,134 1220x820  (ipad rotert 90° CCW)
//   macbook 1586x992   display-hull piksel-detektert: hjørner TL(259,30) TR(1324,30)
//     BR(1323,759) BL(262,759) → rect 259,30 1064x729. (Skjermen er ~rektangulær:
//     topp-bredde 1065 vs bunn 1061 = 0,4% keystone, neglisjerbart. Før var rekt
//     for høyt oppe (8px inn i notch-kanten) + 23px for kort i bunn → svart glipe.)
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
    // screen = bounding-box av display-quaden; quad = de fire ekte hjørnene (kant-fit
    // fra macbook.png): TL(256,20) TR(1329,20) BR(1325,759) BL(260,759). Topp-bredde
    // 1073 vs bunn 1065 → subtil keystone som corner-pinnes i FramedDevice/eksport.
    src: macbookFrame, aspect: 1586 / 992,
    screen: { x: 256 / 1586, y: 20 / 992, w: 1073 / 1586, h: 739 / 992 },
    quad: {
      tl: [256 / 1586, 20 / 992], tr: [1329 / 1586, 20 / 992],
      br: [1325 / 1586, 759 / 992], bl: [260 / 1586, 759 / 992],
    },
    radius: 6 / 1586,
  },
};
