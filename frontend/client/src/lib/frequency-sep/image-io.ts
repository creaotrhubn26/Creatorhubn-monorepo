/**
 * Image I/O between the frequency-sep editor and the surrounding
 * photo-enhancer pipeline.
 *
 * Decode: take whatever the enhancer already has (File, Blob, or blob:/
 * data:/http URL) and turn it into an 8-bit `Rgba8Buffer` that the
 * editor can consume.
 *
 * Encode: take the editor's committed buffer and turn it back into a
 * `File` (PNG, lossless) so it can slot in as the new enhance-pipeline
 * input — the pipeline already accepts File uploads, so the retouch
 * round-trips through the same code path as a fresh upload.
 *
 * Both helpers rely on browser `createImageBitmap` / canvas, so they
 * won't run in node tests. We keep them DOM-only by convention; the
 * editor core tests exercise `Rgba8Buffer` shape directly without
 * needing a real canvas.
 */

import type { Rgba8Buffer } from './decomposition';

/**
 * Decode any image source to an 8-bit RGBA pixel buffer at the image's
 * natural dimensions. `createImageBitmap` is preferred because it's
 * off-main-thread on modern browsers and handles colour management.
 */
export async function decodeToRgba8Buffer(
  source: File | Blob | string,
): Promise<Rgba8Buffer> {
  let bitmap: ImageBitmap;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    bitmap = await createImageBitmap(blob);
  } else {
    bitmap = await createImageBitmap(source);
  }
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    // OffscreenCanvas ships in every browser we target (Chrome 69+, FF 105+,
    // Safari 16.4+, iPad 16.4+); avoids a DOM canvas detour that would
    // require the document to be visible.
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = (canvas as OffscreenCanvas).getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error('failed to acquire 2D context for decoding');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    return { data: imageData.data, width, height };
  } finally {
    bitmap.close?.();
  }
}

/**
 * Encode an 8-bit RGBA buffer back to a Blob. PNG is the default
 * (lossless) so the enhance pipeline sees the retouch bit-for-bit;
 * callers can opt into JPEG / WebP for transport cases where file size
 * matters more than pixel fidelity.
 */
export async function encodeRgba8BufferToBlob(
  buffer: Rgba8Buffer,
  options: { mimeType?: string; quality?: number } = {},
): Promise<Blob> {
  const { width, height } = buffer;
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = (canvas as OffscreenCanvas).getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('failed to acquire 2D context for encoding');
  // ImageData constructor requires a tightly-packed Uint8ClampedArray
  // over ArrayBuffer; our `Rgba8Buffer` already is one. Copy into the
  // context's own backing store via `createImageData` to dodge the TS
  // 5.x `Uint8ClampedArray<ArrayBuffer>` overload quirk (same reason
  // FrequencySepEditor uses `createImageData` instead of `new ImageData`).
  const target = ctx.createImageData(width, height);
  target.data.set(buffer.data);
  ctx.putImageData(target, 0, 0);

  const mimeType = options.mimeType ?? 'image/png';
  if ('convertToBlob' in canvas) {
    const opts: ImageEncodeOptions = { type: mimeType };
    if (options.quality !== undefined) opts.quality = options.quality;
    return (canvas as OffscreenCanvas).convertToBlob(opts);
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      mimeType,
      options.quality,
    );
  });
}

/**
 * Convenience: bundle the blob into a `File` with a sensible derived
 * filename so the photo-enhancer's upload layer sees it as a first-class
 * image replacement. Appends a `.retouched` suffix before the extension
 * so the original upload is distinguishable in server logs.
 */
export async function encodeRgba8BufferToFile(
  buffer: Rgba8Buffer,
  originalFilename: string,
  options: { mimeType?: string; quality?: number } = {},
): Promise<File> {
  const blob = await encodeRgba8BufferToBlob(buffer, options);
  const mime = options.mimeType ?? 'image/png';
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  const base = stripExtension(originalFilename) || 'retouch';
  return new File([blob], `${base}.retouched.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  });
}

function stripExtension(name: string): string {
  const slash = name.lastIndexOf('/');
  const bare = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = bare.lastIndexOf('.');
  return dot > 0 ? bare.slice(0, dot) : bare;
}
