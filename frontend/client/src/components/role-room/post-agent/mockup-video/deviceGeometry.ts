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

export type DeviceVariant = 'macbook' | 'ipad' | 'iphone';

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
      const width = 460;
      const height = 310;
      const bodyHeight = height - 24; // screen-body inset bottom 24
      const body: RoundedRect = { x: 0, y: 0, width, height: bodyHeight, radius: 14 };
      const padL = 14, padT = 14, padR = 14, padB = 16;
      const screen: RoundedRect = {
        x: padL,
        y: padT,
        width: width - padL - padR,
        height: bodyHeight - padT - padB,
        radius: 4,
      };
      return {
        variant,
        width,
        height,
        body,
        screen,
        bezelFrom: '#1a1a1c',
        bezelTo: '#0f0f12',
        overlays: [
          // Notch: 90×14 sentrert på topp av skjerm-kroppen.
          { kind: 'notch', x: width / 2 - 45, y: 0, width: 90, height: 14, radius: 7 },
        ],
        accents: [
          // Hengsel-bånd: 12px høyt, litt bredere enn rammen, ved bunn.
          {
            x: -width * 0.03,
            y: height - 16,
            width: width * 1.06,
            height: 12,
            radius: 6,
            fill: '#232325',
            gradientTo: '#131316',
          },
        ],
      };
    }
    case 'ipad': {
      const width = 360;
      const height = 270;
      const body: RoundedRect = { x: 0, y: 0, width, height, radius: 18 };
      const pad = 12;
      const screen: RoundedRect = {
        x: pad,
        y: pad,
        width: width - pad * 2,
        height: height - pad * 2,
        radius: 6,
      };
      return {
        variant,
        width,
        height,
        body,
        screen,
        bezelFrom: '#1c1c1f',
        bezelTo: '#111114',
        overlays: [
          // Front-kamera-prikk på venstre side (landscape).
          { kind: 'camera', x: 5, y: height / 2 - 2, width: 4, height: 4, radius: 2 },
        ],
        accents: [],
      };
    }
    case 'iphone':
    default: {
      const width = 200;
      const height = 420;
      const body: RoundedRect = { x: 0, y: 0, width, height, radius: 32 };
      const pad = 10;
      const screen: RoundedRect = {
        x: pad,
        y: pad,
        width: width - pad * 2,
        height: height - pad * 2,
        radius: 22,
      };
      return {
        variant: 'iphone',
        width,
        height,
        body,
        screen,
        bezelFrom: '#1f1f22',
        bezelTo: '#0d0d10',
        overlays: [
          // Dynamic Island: 70×18 sentrert, 18px fra rammens topp.
          { kind: 'island', x: width / 2 - 35, y: 18, width: 70, height: 18, radius: 9 },
        ],
        accents: [],
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
