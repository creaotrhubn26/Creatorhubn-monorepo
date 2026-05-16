/**
 * moodBoardPalette — ekstraherer dominerende farger fra mood-board-bilder
 * (dataURL) ved å tegne dem på en liten offscreen-canvas og bygge et
 * RGB-bucket-histogram. Resultatet brukes som target-palett i
 * `analyzeStyleDrift` slik at frame-drift kan måles mot intendert stil.
 *
 * Strategien matcher `styleConsistency.ts` (samme bucket-shift, samme
 * ColorBin-format) så paletter er drop-in-kompatible.
 */

import type { ColorBin } from './styleConsistency';

const SAMPLE_SIZE = 64; // 64×64 = 4096 piksler per bilde — billig + nok signal
const BUCKET_SHIFT = 4; // 16 buckets per kanal (matcher styleConsistency)

interface RGB {
  r: number;
  g: number;
  b: number;
}

function bucketKey(rgb: RGB): string {
  const r = rgb.r >> BUCKET_SHIFT;
  const g = rgb.g >> BUCKET_SHIFT;
  const b = rgb.b >> BUCKET_SHIFT;
  return `${r}:${g}:${b}`;
}

function bucketCenter(key: string): RGB {
  const [r, g, b] = key.split(':').map(Number);
  const half = 1 << (BUCKET_SHIFT - 1);
  return {
    r: (r << BUCKET_SHIFT) + half,
    g: (g << BUCKET_SHIFT) + half,
    b: (b << BUCKET_SHIFT) + half,
  };
}

function rgbToHex(rgb: RGB): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Filtrer bort piksler som ikke gir signal: nær-hvit, nær-svart,
 * nær-grå (lav metning). Disse dominerer ofte foto-thumbnails men
 * beskriver ikke "stilen".
 */
function isInformative(r: number, g: number, b: number, a: number): boolean {
  if (a < 200) return false; // gjennomsiktige piksler
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 24) return false; // nær-svart
  if (min > 232) return false; // nær-hvit
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.08 && max > 60 && max < 200) return false; // nøytral grå
  return true;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Klarte ikke laste bildet'));
    img.src = src;
  });
}

/**
 * Trekk en palett (topp-N farger) fra én dataURL.
 */
export async function extractPaletteFromDataUrl(
  dataUrl: string,
  topN = 5,
): Promise<ColorBin[]> {
  if (typeof document === 'undefined') return [];
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return [];
  }
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  } catch {
    // CORS-tainted canvas — kan skje hvis bildet ikke kommer fra dataURL.
    return [];
  }
  const buckets = new Map<string, number>();
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!isInformative(r, g, b, a)) continue;
    const key = bucketKey({ r, g, b });
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([key, weight]) => ({ color: rgbToHex(bucketCenter(key)), weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

/**
 * Kombiner paletter fra flere bilder til én samlet target-palett.
 * Vekter slås sammen per bucket, så bilder som deler farger forsterker
 * hverandre — det er ofte ønsket (samme genre → konvergerer).
 */
export async function extractCombinedPalette(
  images: Array<{ dataUrl: string }>,
  topN = 6,
): Promise<ColorBin[]> {
  if (images.length === 0) return [];
  const palettes = await Promise.all(
    images.map((image) => extractPaletteFromDataUrl(image.dataUrl, 8)),
  );
  const merged = new Map<string, number>();
  for (const palette of palettes) {
    for (const bin of palette) {
      merged.set(bin.color, (merged.get(bin.color) ?? 0) + bin.weight);
    }
  }
  return Array.from(merged.entries())
    .map(([color, weight]) => ({ color, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}
