/**
 * Normalize an arbitrary video into an Instagram-Reels-optimal MP4:
 *   - H.264 video / AAC audio
 *   - 1080×1920 portrait 9:16, scaled with aspect preserved + padded
 *     (black bars) when the source isn't already vertical
 *   - CRF 20 (high quality, perceptually near-lossless for web)
 *   - +faststart so Meta can start pulling the moov atom immediately
 *     instead of waiting for the whole buffer
 *   - Capped at 90s (IG's hard limit for reels) by trimming with -t
 *
 * The transcoder uses the ffmpeg binary via child_process. If ffmpeg
 * isn't on the PATH we pass the source through unchanged and flag it
 * via the returned `normalized: false` — callers can decide whether
 * to warn the user or just proceed. That keeps local dev working
 * without ffmpeg installed and lets us roll this out before Render
 * has the buildpack in place.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REEL_WIDTH = 1080;
const REEL_HEIGHT = 1920;
const REEL_MAX_SECONDS = 90;
// CRF 18 sits at the top of H.264's "visually transparent" window
// (18-22). At 1080p, this yields bitrates in the 8-12 Mbps range for
// typical content — IG re-encodes the upload anyway, so we want to
// hand it the cleanest source possible. Slow preset buys ~15-20%
// better compression efficiency at the same visual quality vs medium
// — acceptable extra encode time since a reel is 15-90s.
const REEL_CRF = '18';
const REEL_AUDIO_BITRATE = '320k'; // AAC LC at 320 — perceptually transparent
const REEL_PRESET = 'slow';
const TRANSCODE_TIMEOUT_MS = 5 * 60 * 1000;

export interface NormalizeResult {
  dataUrl: string;
  normalized: boolean;
  skipReason?: 'ffmpeg_missing' | 'transcode_failed' | 'source_not_video';
  sourceBytes: number;
  outputBytes?: number;
}

function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], 'base64') };
}

function extensionForVideoMime(contentType: string): string {
  if (contentType === 'video/mp4') return 'mp4';
  if (contentType === 'video/quicktime') return 'mov';
  if (contentType === 'video/webm') return 'webm';
  const slash = contentType.indexOf('/');
  return slash >= 0 ? contentType.slice(slash + 1) : 'bin';
}

export async function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Fetch the ffmpeg banner (first stdout line of `ffmpeg -version`).
 * Used by /api/health so ops can confirm the reel normaliser has a
 * working binary without shelling into the container.
 */
export async function ffmpegVersionLine(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      proc.stdout.on('data', (chunk) => chunks.push(chunk));
      proc.on('error', () => resolve(null));
      proc.on('close', (code) => {
        if (code !== 0) return resolve(null);
        const firstLine = Buffer.concat(chunks).toString('utf8').split('\n', 1)[0]?.trim() || null;
        resolve(firstLine);
      });
    } catch {
      resolve(null);
    }
  });
}

function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  // Filter graph:
  //   scale=W:H:force_original_aspect_ratio=decrease ensures the longest
  //   dimension fits inside the target without upscaling past source,
  //   then pad to exactly W×H with center alignment. SAR fix handles
  //   anamorphic / weird pixel-aspect-ratio sources. Audio is re-encoded
  //   to AAC 192k since IG re-encodes anyway — send a clean signal.
  const filter = [
    `scale=${REEL_WIDTH}:${REEL_HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos`,
    `pad=${REEL_WIDTH}:${REEL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`,
    'setsar=1',
    'format=yuv420p',
  ].join(',');
  const args = [
    '-y',
    '-i', inputPath,
    '-t', String(REEL_MAX_SECONDS),
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', REEL_PRESET,
    '-crf', REEL_CRF,
    '-profile:v', 'high',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', REEL_AUDIO_BITRATE,
    '-ar', '44100',
    '-ac', '2',
    outputPath,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderrChunks: Buffer[] = [];
    proc.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg timed out after ${TRANSCODE_TIMEOUT_MS}ms`));
    }, TRANSCODE_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (code === 0) return resolve();
      const tail = Buffer.concat(stderrChunks).toString('utf8').slice(-800);
      reject(new Error(`ffmpeg exit ${code}: ${tail}`));
    });
  });
}

/**
 * Normalize `dataUrl` to an IG-reel-friendly MP4. Returns a passthrough
 * result when ffmpeg is unavailable (the raw file is still uploaded
 * as-is; Meta will reject format mismatches with its own error — the
 * caller should pay attention to `normalized` + `skipReason`).
 */
export async function normalizeReelDataUrl(
  dataUrl: string,
): Promise<NormalizeResult> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded || !decoded.contentType.startsWith('video/')) {
    return {
      dataUrl,
      normalized: false,
      skipReason: 'source_not_video',
      sourceBytes: 0,
    };
  }
  const sourceBytes = decoded.bytes.length;
  if (!(await ffmpegAvailable())) {
    return {
      dataUrl,
      normalized: false,
      skipReason: 'ffmpeg_missing',
      sourceBytes,
    };
  }

  const dir = await mkdtemp(join(tmpdir(), 'rr-reel-'));
  const sourceExt = extensionForVideoMime(decoded.contentType);
  const inputPath = join(dir, `in.${sourceExt}`);
  const outputPath = join(dir, 'out.mp4');
  try {
    await writeFile(inputPath, decoded.bytes);
    try {
      await runFfmpeg(inputPath, outputPath);
    } catch (error) {
      console.error('[reel-normalize] ffmpeg failed', error);
      return {
        dataUrl,
        normalized: false,
        skipReason: 'transcode_failed',
        sourceBytes,
      };
    }
    const outputBuffer = await readFile(outputPath);
    return {
      dataUrl: `data:video/mp4;base64,${outputBuffer.toString('base64')}`,
      normalized: true,
      sourceBytes,
      outputBytes: outputBuffer.length,
    };
  } finally {
    // Best-effort cleanup — if this fails we leak a few MB in tmp, but
    // the OS clears /tmp eventually.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export const REEL_TARGET_WIDTH = REEL_WIDTH;
export const REEL_TARGET_HEIGHT = REEL_HEIGHT;
export const REEL_HARD_CAP_SECONDS = REEL_MAX_SECONDS;
