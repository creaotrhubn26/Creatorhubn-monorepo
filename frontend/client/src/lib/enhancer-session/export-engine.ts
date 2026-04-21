import { dedupeFilenames, renderFilename } from './naming-tokens';
import type {
  ExportPreset,
  ExportResize,
  ExportWatermark,
  FilenameContext,
  SessionImage,
} from './types';

/**
 * Client-side export pipeline.
 *
 * For each image: load its final bitmap (enhanced if available, otherwise
 * the original preview), resize per preset, optionally composite a
 * watermark, encode to the preset's format, and produce a `{blob, filename}`
 * pair. Filenames are then deduped across the batch before return so two
 * images never collide on one output path.
 *
 * This module is the seam: if we later move export to the server, the
 * server's contract is the same `ExportPreset + FilenameContext[]` → a
 * stream of named blobs. The UI never has to change.
 */

export interface ExportRenderResult {
  id: string;
  blob: Blob;
  filename: string;
}

export interface ExportContext {
  projectName?: string;
  clientName?: string;
  customText?: string;
}

export interface ExportProgress {
  done: number;
  total: number;
  currentFilename: string;
}

export async function renderPresetForImages(
  images: SessionImage[],
  preset: ExportPreset,
  context: ExportContext,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportRenderResult[]> {
  if (images.length === 0) return [];
  const extension = extensionForFormat(preset.format);
  const filenameContexts: FilenameContext[] = images.map((image, index) => ({
    originalName: image.fileName,
    sequence: image.sequence > 0 ? image.sequence : index + 1,
    projectName: context.projectName,
    clientName: context.clientName,
    camera: undefined,
    customText: context.customText,
    shotAt: undefined,
  }));
  const rawNames = filenameContexts.map((ctx) =>
    renderFilename(preset.filenameTemplate, ctx, { extension }),
  );
  const uniqueNames = dedupeFilenames(rawNames);

  const results: ExportRenderResult[] = [];
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const filename = uniqueNames[i];
    onProgress?.({ done: i, total: images.length, currentFilename: filename });
    const blob = await renderOne(image, preset);
    results.push({ id: image.id, blob, filename });
  }
  onProgress?.({ done: images.length, total: images.length, currentFilename: '' });
  return results;
}

async function renderOne(image: SessionImage, preset: ExportPreset): Promise<Blob> {
  const src = image.enhancedUrl || image.previewUrl;
  const bitmap = await loadBitmap(src);
  const { width, height } = resolveDimensions(bitmap, preset.resize);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D-context er utilgjengelig — kan ikke eksportere.');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (preset.watermark && preset.watermark.text.trim().length > 0) {
    drawWatermark(ctx, width, height, preset.watermark);
  }
  return canvasToBlob(canvas, preset.format, preset.quality);
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wm: ExportWatermark,
): void {
  const size = Math.max(16, Math.round(Math.min(width, height) * 0.03));
  const padding = Math.round(size * 0.75);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, wm.opacity));
  ctx.font = `${size}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(wm.text);
  const textWidth = metrics.width;
  const textHeight = size;

  const [anchorY, anchorX] = wm.position.split('-');
  let x = padding;
  if (anchorX === 'center') x = (width - textWidth) / 2;
  if (anchorX === 'right') x = width - textWidth - padding;
  let y = padding + textHeight;
  if (anchorY === 'middle') y = (height + textHeight) / 2;
  if (anchorY === 'bottom') y = height - padding;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(wm.text, x + 1, y + 1);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(wm.text, x, y);
  ctx.restore();
}

export function resolveDimensions(
  source: { width: number; height: number },
  resize: ExportResize,
): { width: number; height: number } {
  const { width, height } = source;
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };

  const aspect = width / height;

  switch (resize.mode) {
    case 'none':
      return { width, height };
    case 'long_edge': {
      const longEdge = Math.max(width, height);
      if (longEdge <= resize.pixels) return { width, height };
      const scale = resize.pixels / longEdge;
      return round(width * scale, height * scale);
    }
    case 'short_edge': {
      const shortEdge = Math.min(width, height);
      if (shortEdge <= resize.pixels) return { width, height };
      const scale = resize.pixels / shortEdge;
      return round(width * scale, height * scale);
    }
    case 'width': {
      if (width <= resize.pixels) return { width, height };
      return round(resize.pixels, resize.pixels / aspect);
    }
    case 'height': {
      if (height <= resize.pixels) return { width, height };
      return round(resize.pixels * aspect, resize.pixels);
    }
    case 'percent': {
      const pct = Math.max(1, Math.min(100, resize.percent)) / 100;
      return round(width * pct, height * pct);
    }
  }
}

function round(w: number, h: number): { width: number; height: number } {
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

export function extensionForFormat(format: ExportPreset['format']): string {
  switch (format) {
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
  }
}

function loadBitmap(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kunne ikke laste bildet for eksport: ${url}`));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, format: ExportPreset['format'], quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
    const q = format === 'png' ? undefined : Math.max(0, Math.min(1, quality / 100));
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Canvas ga ikke ut en blob — eksport feilet.'));
        else resolve(blob);
      },
      mime,
      q,
    );
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
