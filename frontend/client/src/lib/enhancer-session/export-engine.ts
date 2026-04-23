import { dedupeFilenames, renderFilename } from './naming-tokens';
import { save16bitPng } from '../frequency-sep/save-16bit';
import { computeCropRect } from './export-crop';
import { applySharpenToCanvas } from './export-sharpen';
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

function hasAnyMetadata(md: ExportPreset['metadata']): boolean {
  if (!md) return false;
  if (md.copyright && md.copyright.trim()) return true;
  if (md.artist && md.artist.trim()) return true;
  if (md.creator && md.creator.trim()) return true;
  if (Array.isArray(md.keywords) && md.keywords.some((k) => k.trim())) return true;
  return false;
}

/**
 * Pipe the rendered blob through the server's exiftool stamper. The
 * endpoint round-trips the bytes untouched when no metadata is set or
 * when exiftool isn't available on the box — so callers don't need to
 * special-case "no metadata configured" paths, they can always stamp.
 */
async function stampMetadataOnBlob(
  blob: Blob,
  filename: string,
  metadata: NonNullable<ExportPreset['metadata']>,
): Promise<Blob> {
  const form = new FormData();
  form.append('image', blob, filename);
  if (metadata.copyright) form.append('copyright', metadata.copyright);
  if (metadata.artist) form.append('artist', metadata.artist);
  if (metadata.creator) form.append('creator', metadata.creator);
  if (metadata.keywords && metadata.keywords.length > 0) {
    // Comma-joined — the server splits + trims. Keeps multipart
    // payload flat instead of repeating the key.
    form.append('keywords', metadata.keywords.join(','));
  }
  const response = await fetch('/api/photo-enhancer/export/stamp-metadata', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    // Don't fail the whole export over a metadata failure — the
    // delivered pixels are still correct. Log + fall back.
    console.warn(
      `[export-engine] EXIF stamp failed (${response.status}); delivering unstamped.`,
    );
    return blob;
  }
  return response.blob();
}

async function renderOne(image: SessionImage, preset: ExportPreset): Promise<Blob> {
  const src = image.enhancedUrl || image.previewUrl;
  const bitmap = await loadBitmap(src);
  // Order matters: crop first (to the requested aspect ratio), then
  // compute the resize against the cropped dimensions — otherwise a
  // "long edge 2048px" on a wide landscape would land at 2048×1365,
  // then cropped to 1:1 → 1365×1365, surprising the user who asked
  // for 2048-edge output.
  const cropRect = computeCropRect(bitmap.naturalWidth, bitmap.naturalHeight, preset.crop);
  const { width, height } = resolveDimensions(
    { width: cropRect.w, height: cropRect.h },
    preset.resize,
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Pass `colorSpace` to the context so `canvas.toBlob` embeds the
  // matching ICC profile in JPEG APP2 / PNG iCCP chunks automatically.
  // Supported in Chrome 80+, Safari 16.4+, Firefox 113+ — which covers
  // every browser the CreatorHub frontend already targets. Falls back
  // gracefully to sRGB when the type isn't recognised.
  const ctx = canvas.getContext('2d', {
    colorSpace: preset.colorSpace,
  }) as CanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error('Canvas 2D-context er utilgjengelig — kan ikke eksportere.');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Source-sub-rect draw: pulls only the crop region and scales it to
  // the target size in a single paint.
  ctx.drawImage(
    bitmap,
    cropRect.x,
    cropRect.y,
    cropRect.w,
    cropRect.h,
    0,
    0,
    width,
    height,
  );
  // Output sharpening runs at final resolution — tuning unsharp sigma
  // in pixels only makes sense against the *delivered* dimensions,
  // not the source. Must also run before the watermark so we don't
  // accidentally sharpen the watermark text into aliasing artefacts.
  if (preset.sharpen && preset.sharpen !== 'none') {
    applySharpenToCanvas(ctx, width, height, preset.sharpen);
  }
  if (preset.watermark && preset.watermark.text.trim().length > 0) {
    drawWatermark(ctx, width, height, preset.watermark);
  }
  // 16-bit PNG: route through backend. Resize and watermark are already
  // baked into the canvas, so the path from here is the same as any
  // other save — we just swap 8-bit canvas.toBlob for the backend encoder.
  const rendered =
    preset.format === 'png-16bit'
      ? await encodeCanvasAs16bitPng(ctx, width, height)
      : await canvasToBlob(canvas, preset.format, preset.quality);

  // Stamp EXIF/IPTC/XMP when the preset carries metadata. The server
  // does the actual embedding; we just hand off the blob + fields. The
  // stamped blob returns untouched if exiftool is unavailable, so this
  // never breaks an otherwise-successful export.
  if (hasAnyMetadata(preset.metadata)) {
    return stampMetadataOnBlob(rendered, image.fileName, preset.metadata!);
  }
  return rendered;
}

/**
 * Route a canvas through the backend 16-bit PNG encoder. Extracts the
 * canvas's 8-bit RGBA pixels, promotes each channel to 16-bit (×257 —
 * the reversible 8→16 expansion that maps 255 → 65535 exactly), and
 * posts to the `/api/photo-enhancer/frequency-sep/save-16bit` route.
 *
 * Caveat: starting from an 8-bit canvas we can't *invent* 16-bit
 * precision — the output has the same visual content as an 8-bit PNG.
 * The 16-bit envelope matters for archival pipelines (downstream print
 * prep, colour-managed workflows) that refuse 8-bit inputs, and for
 * retouch buffers that were Float32 internally before being rasterised.
 * A future path will keep Float32 end-to-end by pulling from the
 * frequency-sep editor's band state directly.
 */
async function encodeCanvasAs16bitPng(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<Blob> {
  const imageData = ctx.getImageData(0, 0, width, height);
  const u8 = imageData.data;
  const u16 = new Uint16Array(width * height * 4);
  for (let i = 0; i < u8.length; i++) {
    // 257 × n gives an exact bijection 0..255 → 0..65535 (257 = 65535/255).
    u16[i] = u8[i] * 257;
  }
  return save16bitPng({
    kind: 'u16',
    data: u16,
    width,
    height,
    channels: 4,
  });
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
    case 'png-16bit':
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

/**
 * Encode a canvas to a blob using browser-native formats. `png-16bit` is
 * NOT handled here — it takes a separate backend path in `renderOne` —
 * and is excluded from the signature so TypeScript catches any caller
 * that forgets the branch.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: Exclude<ExportPreset['format'], 'png-16bit'>,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime =
      format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
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
