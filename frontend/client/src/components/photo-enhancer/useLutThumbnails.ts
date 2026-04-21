import { useEffect, useRef, useState } from 'react';
import {
  encodeLutAtlas,
  sampleLutAtlasJs,
  type LutAtlas,
} from '../../services/preview-shader/lut-atlas';
import { fetchLutTable, type LutRegistryEntry } from '../../lib/enhancer-session/lut-registry';

/**
 * Generate per-LUT preview thumbnails for the dropdown. Each thumbnail is
 * a 64×64 JPEG data-URL of the active image rendered through the LUT at
 * full strength, so the photographer can see the effect before picking.
 *
 * Implementation notes:
 *   * Runs entirely on the main thread — 64² × N_luts × 8 atlas lookups is
 *     cheap enough (~0.5 ms per LUT on a 2020 laptop). No worker needed.
 *   * Thumbnails are cached by ``${imageKey}:${lutId}`` so switching
 *     images doesn't invalidate all thumbnails if the user bounces back.
 *   * Generation is cooperative — one LUT per rAF tick so the UI stays
 *     responsive when the registry grows past ~10 entries.
 */

const THUMBNAIL_SIZE = 64;

export type LutThumbnailMap = Record<string, string>;

export function useLutThumbnails(
  imageUrl: string | null | undefined,
  entries: LutRegistryEntry[],
  imageKey: string | null | undefined,
): LutThumbnailMap {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [thumbnails, setThumbnails] = useState<LutThumbnailMap>({});

  useEffect(() => {
    if (!imageUrl || !imageKey || entries.length === 0) {
      setThumbnails({});
      return;
    }
    let cancelled = false;

    const run = async () => {
      const baseBuffer = await renderBaseBuffer(imageUrl, THUMBNAIL_SIZE);
      if (cancelled || !baseBuffer) return;

      const next: LutThumbnailMap = {};
      for (const entry of entries) {
        if (cancelled) return;
        const cacheKey = `${imageKey}:${entry.id}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          next[entry.id] = cached;
          setThumbnails({ ...next });
          continue;
        }

        const atlas = await loadAtlas(entry.id);
        if (cancelled) return;
        if (!atlas) continue;

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const tick = () => {
            try {
              const url = applyLutToBufferAsDataUrl(baseBuffer, atlas);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          };
          window.requestAnimationFrame(tick);
        });

        if (cancelled) return;
        cacheRef.current.set(cacheKey, dataUrl);
        next[entry.id] = dataUrl;
        setThumbnails({ ...next });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, imageKey, entries]);

  return thumbnails;
}

async function renderBaseBuffer(url: string, size: number): Promise<ImageData | null> {
  return new Promise<ImageData | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        const scale = Math.max(size / image.width, size / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;
        ctx.drawImage(image, x, y, w, h);
        resolve(ctx.getImageData(0, 0, size, size));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function loadAtlas(lutId: string): Promise<LutAtlas | null> {
  const payload = await fetchLutTable(lutId);
  if (!payload) return null;
  try {
    return encodeLutAtlas(payload.size, payload.table);
  } catch {
    return null;
  }
}

function applyLutToBufferAsDataUrl(buffer: ImageData, atlas: LutAtlas): string {
  const { width, height } = buffer;
  const copy = new Uint8ClampedArray(buffer.data);
  for (let i = 0; i < copy.length; i += 4) {
    const rgb = sampleLutAtlasJs(atlas, copy[i] / 255, copy[i + 1] / 255, copy[i + 2] / 255);
    copy[i] = rgb[0];
    copy[i + 1] = rgb[1];
    copy[i + 2] = rgb[2];
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(new ImageData(copy, width, height), 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}
