/**
 * Aspect-ratio crop maths for the export pipeline.
 *
 * Centre-crops source pixel dimensions to a named aspect so exports
 * land at the ratio social platforms expect (IG feed 1:1 and 4:5, IG
 * reels 9:16, FB cover 16:9, print 3:2). The output always stays within
 * the source — we never upscale or pad, only remove pixels from the
 * longer axis.
 */

import type { ExportCrop, ExportCropAspect } from './types';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Reduce an `ExportCrop` (either a named preset string or a custom
 * `{ w, h }` object) to a canonical `{ w, h }` ratio. Returns null for
 * `'none'`, unparseable strings, or non-positive custom values — in
 * every null case the caller treats the crop as a no-op.
 */
export function parseCrop(crop: ExportCrop | undefined): { w: number; h: number } | null {
  if (!crop || crop === 'none') return null;
  if (typeof crop === 'object') {
    const { w, h } = crop;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { w, h };
  }
  const parts = crop.split(':');
  if (parts.length !== 2) return null;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/** @deprecated Kept for API compatibility — new callers use `parseCrop`. */
export const parseCropAspect = parseCrop as (
  aspect: ExportCropAspect | undefined,
) => { w: number; h: number } | null;

/**
 * Compute a centred crop rect within a source image so the cropped
 * region has the requested aspect. When the source already matches
 * (or `crop` is `'none'` / unparseable), returns the full source rect.
 *
 * Rounds half-pixels outward on the *kept* axis and inward on the
 * cropped axis so the result is always strictly within the source.
 */
export function computeCropRect(
  srcW: number,
  srcH: number,
  crop: ExportCrop | undefined,
): CropRect {
  if (srcW <= 0 || srcH <= 0) {
    return { x: 0, y: 0, w: srcW, h: srcH };
  }
  const parsed = parseCrop(crop);
  if (!parsed) return { x: 0, y: 0, w: srcW, h: srcH };

  const srcAspect = srcW / srcH;
  const targetAspect = parsed.w / parsed.h;

  // Tolerance — 0.5 pixel on either dimension is already a no-op crop.
  if (Math.abs(srcAspect - targetAspect) < 1e-6) {
    return { x: 0, y: 0, w: srcW, h: srcH };
  }

  if (srcAspect > targetAspect) {
    // Source is wider than target — trim the width.
    const newW = Math.floor(srcH * targetAspect);
    const x = Math.floor((srcW - newW) / 2);
    return { x, y: 0, w: newW, h: srcH };
  }
  // Source is taller — trim the height.
  const newH = Math.floor(srcW / targetAspect);
  const y = Math.floor((srcH - newH) / 2);
  return { x: 0, y, w: srcW, h: newH };
}

/**
 * Human-readable label for the crop picker UI. Kept here (not in the
 * component) so tests can pin the strings and any localisation swap
 * has a single place to touch.
 */
export function describeCropAspect(aspect: ExportCropAspect): string {
  switch (aspect) {
    case 'none':
      return 'Ingen beskjæring';
    case '1:1':
      return '1:1 (IG feed, kvadrat)';
    case '4:5':
      return '4:5 (IG portrett)';
    case '5:4':
      return '5:4 (landskap)';
    case '3:2':
      return '3:2 (klassisk, print)';
    case '2:3':
      return '2:3 (portrett, print)';
    case '4:3':
      return '4:3 (sensor, utskrift)';
    case '3:4':
      return '3:4 (portrett)';
    case '16:9':
      return '16:9 (widescreen)';
    case '9:16':
      return '9:16 (Reels, Stories)';
  }
}

/** All aspects in display order — used to populate the dropdown. */
export const EXPORT_CROP_ASPECTS: readonly ExportCropAspect[] = [
  'none',
  '1:1',
  '4:5',
  '5:4',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
] as const;
