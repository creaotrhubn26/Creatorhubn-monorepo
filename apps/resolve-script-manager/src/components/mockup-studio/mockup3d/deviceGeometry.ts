/**
 * deviceGeometry.ts — parametriske dimensjoner for 3D-enheter (ren, testbar).
 *
 * Verdenskoordinater i Three: bredde 1 = referanse. Fase 1 = telefon
 * (iPhone/Android). glTF-slot (ekte scan) kommer i en senere fase.
 */

export type Device3DVariant = 'iphone' | 'android';

export interface DeviceDims {
  bodyW: number;
  bodyH: number;
  bodyD: number;
  bezel: number;
  cornerR: number;
  screenInset: number;
}

const DIMS: Record<Device3DVariant, DeviceDims> = {
  iphone:  { bodyW: 1.0, bodyH: 2.06, bodyD: 0.11, bezel: 0.045, cornerR: 0.16, screenInset: 0.055 },
  android: { bodyW: 1.0, bodyH: 2.22, bodyD: 0.10, bezel: 0.035, cornerR: 0.14, screenInset: 0.045 },
};

export function deviceDims(variant: Device3DVariant): DeviceDims {
  return DIMS[variant];
}

/** Stabil cache-nøkkel for et bake-kall. */
export function cacheKey(parts: (string | number)[]): string {
  return parts.join('|');
}
