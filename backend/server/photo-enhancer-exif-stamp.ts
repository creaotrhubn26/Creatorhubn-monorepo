/**
 * Stamp EXIF metadata (copyright, artist, keywords) onto an exported
 * image blob. The canvas-side export pipeline strips all metadata —
 * `canvas.toBlob` just emits pixels — so this route is the one surface
 * the frontend can hit after rendering to get attribution onto the
 * delivered file.
 *
 * Uses `exiftool` (already installed on the Render box; see
 * `install-photo-raw-tools.mjs`). exiftool handles both JPEG/PNG/WebP
 * and knows how to build the right APP1 EXIF segment or PNG tEXt
 * chunks without us hand-rolling bit-packers.
 *
 * Scope is deliberately narrow for the first slice — only copyright,
 * artist, creator, keywords. Holy Crust needs attribution on delivered
 * product shots; the rest of the EXIF fields (camera model, lens,
 * shutter / ISO) are a follow-up because they require reading the
 * source image's metadata and merging rather than just writing fresh.
 */

import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface StampFields {
  copyright?: string;
  artist?: string;
  creator?: string;
  /** Free-form list — exiftool writes one `-Keywords` per entry. */
  keywords?: string[];
}

export type StampResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; error: 'exiftool_unavailable' | 'stamp_failed'; detail?: string };

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

async function commandPath(command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [command], {
      timeout: 3000,
      env: { ...process.env, LC_ALL: 'C' },
    });
    const line = String(stdout || '').trim().split('\n')[0];
    return line || null;
  } catch {
    return null;
  }
}

function hasAnyField(fields: StampFields): boolean {
  if (fields.copyright && fields.copyright.trim().length > 0) return true;
  if (fields.artist && fields.artist.trim().length > 0) return true;
  if (fields.creator && fields.creator.trim().length > 0) return true;
  if (Array.isArray(fields.keywords) && fields.keywords.length > 0) return true;
  return false;
}

export function buildExifArgs(fields: StampFields, inputPath: string): string[] {
  // `-overwrite_original` stops exiftool from leaving a `_original`
  // sibling behind; `-fast` skips some heavy scans we don't need for a
  // plain stamp pass.
  const args: string[] = ['-overwrite_original', '-fast'];
  if (fields.copyright && fields.copyright.trim()) {
    args.push(`-Copyright=${fields.copyright.trim()}`);
    args.push(`-XMP:Rights=${fields.copyright.trim()}`);
    args.push(`-IPTC:CopyrightNotice=${fields.copyright.trim()}`);
  }
  if (fields.artist && fields.artist.trim()) {
    args.push(`-Artist=${fields.artist.trim()}`);
  }
  if (fields.creator && fields.creator.trim()) {
    args.push(`-Creator=${fields.creator.trim()}`);
    args.push(`-XMP:Creator=${fields.creator.trim()}`);
  }
  if (Array.isArray(fields.keywords)) {
    for (const kw of fields.keywords) {
      const trimmed = kw.trim();
      if (trimmed) args.push(`-Keywords=${trimmed}`);
    }
  }
  args.push(inputPath);
  return args;
}

/**
 * Stamp the given fields onto `bytes` and return the modified buffer.
 * Returns `{ ok: false, error: 'exiftool_unavailable' }` when exiftool
 * isn't on the box — callers should fall back to returning the
 * untouched bytes rather than failing the export.
 */
export async function stampExif(
  bytes: Buffer,
  fields: StampFields,
  originalExtension: string,
): Promise<StampResult> {
  if (!hasAnyField(fields)) {
    return { ok: true, bytes };
  }
  const ext = originalExtension.startsWith('.') ? originalExtension : `.${originalExtension}`;
  if (!ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
    // Unknown format — pass through untouched rather than trying to
    // write tags exiftool doesn't support.
    return { ok: true, bytes };
  }

  const exiftool = await commandPath('exiftool');
  if (!exiftool) {
    return { ok: false, error: 'exiftool_unavailable' };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ch-exif-stamp-'));
  const inputPath = path.join(tempDir, `source${ext}`);
  try {
    await fs.writeFile(inputPath, bytes);
    const args = buildExifArgs(fields, inputPath);
    await execFileAsync(exiftool, args, {
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    });
    const stamped = await fs.readFile(inputPath);
    return { ok: true, bytes: stamped };
  } catch (err) {
    return {
      ok: false,
      error: 'stamp_failed',
      detail: String((err as Error)?.message ?? err),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
