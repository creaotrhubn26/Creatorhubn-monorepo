/**
 * deviceGeometry.ts
 *
 * Maskin-lesbar geometri for hver device-mockup. Dette er "fasiten" for
 * hvor skjermen sitter inne i rammen — utledet fra DeviceMockup.tsx sine
 * CSS-mål, men uttrykt som rene tall slik at vi kan tegne dem på en
 * <canvas> (for video-eksport) i stedet for bare i DOM.
 *
 * Alle mål er i "design-piksler" (samme skala som DeviceMockup.tsx). En
 * renderer multipliserer med `pixelRatio` for å få ut-oppløsning, så
 * geometrien her er oppløsnings-uavhengig.
 *
 * Se også [[fitRect]] for hvordan video plasseres inn i `screen`.
 */

import type { Rect } from './fitRect';

export type DeviceVariant = 'macbook' | 'ipad' | 'ipad_landscape' | 'iphone';

/** Et avrundet rektangel — radius brukes til canvas-klipping. */
export interface RoundedRect extends Rect {
  radius: number;
}

/**
 * En svart overlay-detalj som tegnes OPPÅ skjermen (notch / Dynamic Island /
 * kamera-prikk). Holder mockupen autentisk uten eksterne bilder.
 */
export interface DeviceOverlay extends RoundedRect {
  kind: 'notch' | 'island' | 'camera';
}

/** En rektangulær detalj tegnet UTENPÅ rammen (f.eks. MacBook-hengsel). */
export interface DeviceAccent extends RoundedRect {
  /** Fyll-farge (kan være gradient-stopp-par via `gradientTo`). */
  fill: string;
  gradientTo?: string;
}

export interface DeviceGeometry {
  variant: DeviceVariant;
  /** Hele rammens bounding box (design-piksler). */
  width: number;
  height: number;
  /** Selve ramme-kroppen (kan være mindre enn bounding box, jf. hengsel). */
  body: RoundedRect;
  /** Skjerm-området der video tegnes/klippes. */
  screen: RoundedRect;
  /** Ramme-gradient topp→bunn. */
  bezelFrom: string;
  bezelTo: string;
  /** Svarte detaljer oppå skjermen. */
  overlays: DeviceOverlay[];
  /** Detaljer utenpå rammen (hengsel osv.). */
  accents: DeviceAccent[];
}

/**
 * Base-geometri per variant. Tallene speiler DeviceMockup.tsx:
 *   macbook outer 460×310, screen-body inset 0/0/24/0, padding 14/14/16/14
 *   ipad    outer 360×270, padding 12, radius 6
 *   iphone  outer 200×420, padding 10, radius 22, island 70×18 @ top 18
 */
function baseGeometry(variant: DeviceVariant): DeviceGeometry {
  switch (variant) {
    case 'macbook': {
      // MacBook Pro 14"-aktig: skjerm-lokk (16:10 m/ notch) + tynn hake +
      // hengsel + tilspisset metall-base. Base stikker litt utenfor lokket.
      const width = 470;
      const lidHeight = 296;       // selve skjerm-lokket
      const height = 316;          // inkl. base
      const body: RoundedRect = { x: 0, y: 0, width, height: lidHeight, radius: 18 };
      const padX = 12, padT = 12, padChin = 16; // tynn, lik bezel; litt hake under
      const screen: RoundedRect = {
        x: padX, y: padT,
        width: width - padX * 2,
        height: lidHeight - padT - padChin,
        radius: 8,
      };
      return {
        variant, width, height, body, screen,
        bezelFrom: '#161617', bezelTo: '#0c0c0e',
        overlays: [
          // Notch: smal, sentrert på topp av skjermen.
          { kind: 'notch', x: width / 2 - 38, y: padT - 2, width: 76, height: 12, radius: 6 },
        ],
        accents: [
          // Hengsel/skygge mellom lokk og base.
          { x: width * 0.16, y: lidHeight - 2, width: width * 0.68, height: 4, radius: 2, fill: '#050506' },
          // Metall-base (bredere enn lokket, tilspisset inntrykk via gradient).
          { x: -width * 0.035, y: lidHeight + 2, width: width * 1.07, height: 16, radius: 7, fill: '#3a3a3d', gradientTo: '#1a1a1c' },
          // Finger-slot midt på basens forkant.
          { x: width / 2 - 34, y: lidHeight + 2, width: 68, height: 5, radius: 3, fill: '#0a0a0b' },
        ],
      };
    }
    case 'ipad': {
      // iPad Pro 11" landscape: tynne, helt uniforme bezels, modest radius,
      // front-kamera midt på toppkant, power + volum på toppkanten.
      const width = 384;
      const height = 273;          // ≈ 1.407 (11"-forhold)
      const radius = 22;
      const body: RoundedRect = { x: 0, y: 0, width, height, radius };
      const pad = 9;               // tynn, uniform
      const screen: RoundedRect = {
        x: pad, y: pad,
        width: width - pad * 2,
        height: height - pad * 2,
        radius: radius - pad,      // concentric
      };
      return {
        variant, width, height, body, screen,
        bezelFrom: '#1a1a1d', bezelTo: '#101012',
        overlays: [
          // Front-kamera sentrert på toppkanten (landscape).
          { kind: 'camera', x: width / 2 - 2, y: 4, width: 4, height: 4, radius: 2 },
        ],
        accents: [
          // Power-knapp (toppkant, mot høyre).
          { x: width - 70, y: -2, width: 30, height: 3, radius: 2, fill: '#141417', gradientTo: '#202024' },
          // Volum-knapper (toppkant, mot venstre).
          { x: 46, y: -2, width: 22, height: 3, radius: 2, fill: '#141417', gradientTo: '#202024' },
          { x: 74, y: -2, width: 22, height: 3, radius: 2, fill: '#141417', gradientTo: '#202024' },
        ],
      };
    }
    case 'iphone':
    default: {
      // iPhone 15 Pro-aktig: tynne uniforme bezels, stor concentric radius,
      // Dynamic Island, og fysiske sideknapper (action+volum venstre, power høyre).
      const width = 204;
      const height = 430;          // ≈ 0.474 (9:19-aktig)
      const radius = 44;           // stor, moderne
      const body: RoundedRect = { x: 0, y: 0, width, height, radius };
      const pad = 9;               // tynn, uniform bezel
      const screen: RoundedRect = {
        x: pad, y: pad,
        width: width - pad * 2,
        height: height - pad * 2,
        radius: radius - pad,      // concentric corners
      };
      return {
        variant: 'iphone', width, height, body, screen,
        bezelFrom: '#1c1c20', bezelTo: '#0a0a0c',
        overlays: [
          // Dynamic Island: kompakt pille, sentrert nær toppen.
          { kind: 'island', x: width / 2 - 31, y: 16, width: 62, height: 17, radius: 9 },
        ],
        accents: [
          // Venstre: Action-knapp + volum opp/ned.
          { x: -2, y: 78, width: 3, height: 16, radius: 2, fill: '#141417', gradientTo: '#26262b' },
          { x: -2, y: 104, width: 3, height: 30, radius: 2, fill: '#141417', gradientTo: '#26262b' },
          { x: -2, y: 142, width: 3, height: 30, radius: 2, fill: '#141417', gradientTo: '#26262b' },
          // Høyre: Power-knapp.
          { x: width - 1, y: 120, width: 3, height: 46, radius: 2, fill: '#141417', gradientTo: '#26262b' },
        ],
      };
    }
  }
}

/** Skaler en RoundedRect med en faktor (rundt origo). */
function scaleRounded<T extends RoundedRect>(r: T, k: number): T {
  return { ...r, x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k, radius: r.radius * k };
}

/**
 * Hent geometri for en variant, skalert med `pixelRatio`.
 *
 * `pixelRatio = 1` gir DeviceMockup-skala (fin til preview). For eksport
 * vil du typisk bruke 4–6 slik at skjerm-området får ekte oppløsning
 * (f.eks. iphone × 6 ≈ 1080px bred skjerm).
 */
export function getDeviceGeometry(variant: DeviceVariant, pixelRatio = 1): DeviceGeometry {
  const g = baseGeometry(variant);
  if (pixelRatio === 1) return g;
  return {
    ...g,
    width: g.width * pixelRatio,
    height: g.height * pixelRatio,
    body: scaleRounded(g.body, pixelRatio),
    screen: scaleRounded(g.screen, pixelRatio),
    overlays: g.overlays.map((o) => scaleRounded(o, pixelRatio)),
    accents: g.accents.map((a) => scaleRounded(a, pixelRatio)),
  };
}

/** Forholdstall (bredde/høyde) for hele rammen — nyttig for layout. */
export function deviceAspectRatio(variant: DeviceVariant): number {
  const g = baseGeometry(variant);
  return g.width / g.height;
}
