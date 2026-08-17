/**
 * deviceGeometry.ts — parametriske dimensjoner for 3D-enheter (ren, testbar).
 *
 * Verdenskoordinater i Three: bredde 1 = referanse. Fase 1 = telefon
 * (iPhone/Android). glTF-slot (ekte scan) kommer i en senere fase.
 */

export type Device3DVariant = 'iphone' | 'android' | 'ipad' | 'tablet' | 'macbook';

export interface DeviceDims {
  /** slab = flat plate (telefon/tablet); clamshell = skjerm + base m/ hengsel (laptop). */
  kind: 'slab' | 'clamshell';
  bodyW: number;
  bodyH: number;
  bodyD: number;
  bezel: number;
  cornerR: number;
  screenInset: number;
  /** Kun clamshell: base-dybde (tastatur-dekk) + hengsel-vinkel (grader fra vannrett base). */
  baseDepth?: number;
  hingeDeg?: number;
}

const DIMS: Record<Device3DVariant, DeviceDims> = {
  iphone:  { kind: 'slab', bodyW: 1.0, bodyH: 2.06, bodyD: 0.11, bezel: 0.045, cornerR: 0.16, screenInset: 0.055 },
  android: { kind: 'slab', bodyW: 1.0, bodyH: 2.22, bodyD: 0.10, bezel: 0.035, cornerR: 0.14, screenInset: 0.045 },
  ipad:    { kind: 'slab', bodyW: 1.0, bodyH: 1.334, bodyD: 0.055, bezel: 0.035, cornerR: 0.05, screenInset: 0.045 },
  tablet:  { kind: 'slab', bodyW: 1.0, bodyH: 1.266, bodyD: 0.05, bezel: 0.03, cornerR: 0.045, screenInset: 0.04 },
  // laptop: skjerm-plate 16:10 (bodyW×bodyH) + base like dyp som skjermen er bred.
  macbook: { kind: 'clamshell', bodyW: 1.6, bodyH: 1.0, bodyD: 0.03, bezel: 0.03, cornerR: 0.02, screenInset: 0.035, baseDepth: 1.1, hingeDeg: 100 },
};

export function deviceDims(variant: Device3DVariant): DeviceDims {
  return DIMS[variant];
}

const THREE_D_VARIANTS = new Set<string>(['iphone', 'android', 'ipad', 'tablet', 'macbook']);

/** Er varianten støttet av 3D-renderen? (Ekskluderer watch/browser/ipad_landscape.) */
export function is3dVariant(v: string): v is Device3DVariant {
  return THREE_D_VARIANTS.has(v);
}

/** Stabil cache-nøkkel for et bake-kall. */
export function cacheKey(parts: (string | number)[]): string {
  return parts.join('|');
}
