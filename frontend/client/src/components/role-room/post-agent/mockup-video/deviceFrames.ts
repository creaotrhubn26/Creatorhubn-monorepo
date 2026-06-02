/**
 * deviceFrames.ts — ekte, fotorealistiske device-rammer (PNG).
 *
 * Kilde: PommePlate (https://github.com/ephread/PommePlate), CC0 1.0 Universal
 * — fri bruk, også kommersielt, uten attribusjon. Rammene er transparente PNG-er
 * med en mørk, ensfarget "skjerm"-flate. Vi plasserer video-framen i det
 * detekterte skjerm-rektangelet og legger PNG-rammen over for genuint utseende.
 *
 * Skjerm-rektanglene er detektert piksel-presist fra hver PNG (mørk fyllfarge).
 * Verdiene er i frame-PNG-ens egne piksler.
 */

import type { DeviceVariant } from './deviceGeometry';

export interface FrameSpec {
  /** Relativ asset-sti (lastes via new Image()). */
  src: string;
  frameW: number;
  frameH: number;
  /** Skjerm-rektangel i frame-PNG-piksler. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Hjørne-radius på skjermen (frame-piksler) for klipp. */
  screenRadius: number;
}

// Vite/bundler-importer av PNG-ene (gir riktig hashed URL i prod).
import iphoneFrame from './frames/iphone.png';
import ipadFrame from './frames/ipad.png';
import macbookFrame from './frames/macbook.png';

export const DEVICE_FRAMES: Record<DeviceVariant, FrameSpec> = {
  iphone: { src: iphoneFrame, frameW: 1296, frameH: 2592, sx: 40, sy: 114, sw: 1216, sh: 2446, screenRadius: 120 },
  ipad: { src: ipadFrame, frameW: 1861, frameH: 2581, sx: 16, sy: 73, sw: 1822, sh: 2492, screenRadius: 36 },
  macbook: { src: macbookFrame, frameW: 3910, frameH: 2236, sx: 389, sy: 94, sw: 3134, sh: 1978, screenRadius: 8 },
};

/** Forholdstall (bredde/høyde) for hele frame-PNG-en. */
export function frameAspect(variant: DeviceVariant): number {
  const f = DEVICE_FRAMES[variant];
  return f.frameW / f.frameH;
}

const cache = new Map<DeviceVariant, HTMLImageElement>();

/** Last (og cache) frame-PNG som HTMLImageElement. */
export function loadFrameImage(variant: DeviceVariant): Promise<HTMLImageElement> {
  const cached = cache.get(variant);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { cache.set(variant, img); resolve(img); };
    img.onerror = () => reject(new Error(`Kunne ikke laste frame: ${variant}`));
    img.src = DEVICE_FRAMES[variant].src;
  });
}
