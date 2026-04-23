/**
 * Per-stroke undo history for the frequency-sep brush.
 *
 * Brush edits are qualitatively different from slider edits — each
 * stroke mutates pixel data in place on Float32 band buffers — so they
 * can't be represented as compact `EnhancementSettings` snapshots the
 * way the existing enhancer-session history is. Doing the naive thing
 * (snapshotting the whole bands per stroke) would OOM at 24MP stills
 * after a handful of strokes.
 *
 * Strategy: **chunk-based copy-on-write**. The image is divided into a
 * grid of 64×64 chunks. During a stroke, the first time any stamp
 * touches a chunk, we snapshot that chunk's band data into the stroke
 * recorder's "before" set. Subsequent stamps on the same chunk are
 * ignored (we already have its pre-state). At stroke end, we capture
 * the corresponding "after" chunks and package them into a StrokePatch.
 *
 * Undo/redo is then just "swap before ↔ after for each chunk in the
 * patch" — a localised memcpy operation, not a full-image restore.
 *
 * Memory is bounded by the union of chunks touched by a stroke. A
 * typical retouch brush covers a small area relative to the full image,
 * so each stroke patch is on the order of a few hundred KB to a few MB.
 * The ring-buffer capacity (30 by default, matching the slider history)
 * caps total memory at a few hundred MB in the worst case.
 */

import type { DecompositionBands, Float32Image } from './decomposition';
import type { Rect } from './compositor';

/** Side length of each snapshot chunk, in pixels. Chosen so that typical
 *  brush stamps touch only a handful of chunks and so that the chunk
 *  mask itself fits in cache at common image sizes. */
export const BRUSH_CHUNK_SIZE = 64;

/**
 * Packed snapshot of one chunk's band data. Lengths are `chunkW × chunkH × 4`
 * (RGBA). Chunks on the right/bottom edge of the image may be shorter
 * than `BRUSH_CHUNK_SIZE` — `chunkW`/`chunkH` carry the actual size.
 */
export type ChunkSnapshot = {
  /** Top-left image-space coordinate of the chunk. */
  x: number;
  y: number;
  chunkW: number;
  chunkH: number;
  low: Float32Array;
  mid: Float32Array | null;
  high: Float32Array;
};

export type StrokePatch = {
  /** "Before" snapshots for every chunk the stroke touched. */
  chunksBefore: ChunkSnapshot[];
  /** "After" snapshots — same chunks in the same order. */
  chunksAfter: ChunkSnapshot[];
  /** Union of all touched chunks, for quick canvas repaint on undo/redo. */
  rect: Rect;
  /** Short label surfaced in the history panel ("Heal", "Jevn tone", …). */
  label: string;
  /** Epoch ms at stroke end. */
  at: number;
};

export type BrushHistory = {
  entries: StrokePatch[];
  /** Pointer to current entry. -1 when empty; 0 after the first stroke. */
  index: number;
  /** Ring capacity — oldest entries are dropped when exceeded. */
  capacity: number;
};

export const DEFAULT_BRUSH_HISTORY_CAPACITY = 30;

export const EMPTY_BRUSH_HISTORY: BrushHistory = {
  entries: [],
  index: -1,
  capacity: DEFAULT_BRUSH_HISTORY_CAPACITY,
};

// --- Recorder: accumulates touched chunks during an in-progress stroke -------

export type StrokeRecorder = {
  bands: DecompositionBands;
  /** Image-resolution grid of boolean markers — 1 byte per chunk. */
  chunkMask: Uint8Array;
  chunkCols: number;
  chunkRows: number;
  /** Snapshots of chunks in the order they were first touched. */
  chunksBefore: ChunkSnapshot[];
  rect: Rect;
  label: string;
};

function copyChunk(
  band: Float32Image,
  x: number,
  y: number,
  w: number,
  h: number,
): Float32Array {
  const out = new Float32Array(w * h * band.channels);
  const stride = band.width * band.channels;
  let dst = 0;
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * band.width + x) * band.channels;
    out.set(band.data.subarray(srcStart, srcStart + w * band.channels), dst);
    dst += w * band.channels;
  }
  return out;
}

function writeChunkData(
  band: Float32Image,
  x: number,
  y: number,
  chunkW: number,
  chunkH: number,
  src: Float32Array,
): void {
  const channels = band.channels;
  for (let row = 0; row < chunkH; row++) {
    const dstStart = ((y + row) * band.width + x) * channels;
    const srcStart = row * chunkW * channels;
    band.data.set(src.subarray(srcStart, srcStart + chunkW * channels), dstStart);
  }
}

export function beginStrokeRecorder(
  bands: DecompositionBands,
  label: string,
): StrokeRecorder {
  const width = bands.low.width;
  const height = bands.low.height;
  const chunkCols = Math.ceil(width / BRUSH_CHUNK_SIZE);
  const chunkRows = Math.ceil(height / BRUSH_CHUNK_SIZE);
  return {
    bands,
    chunkMask: new Uint8Array(chunkCols * chunkRows),
    chunkCols,
    chunkRows,
    chunksBefore: [],
    rect: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    label,
  };
}

/**
 * Mark every chunk intersecting `rect` as touched, snapshotting any
 * chunk that hasn't been seen yet in this stroke. Safe to call many
 * times per stroke — only the first touch of each chunk copies data.
 */
export function recordRectInStroke(recorder: StrokeRecorder, rect: Rect): void {
  if (rect.x1 < rect.x0 || rect.y1 < rect.y0) return;
  const { bands, chunkMask, chunkCols, chunksBefore } = recorder;
  const width = bands.low.width;
  const height = bands.low.height;
  const cx0 = Math.max(0, Math.floor(rect.x0 / BRUSH_CHUNK_SIZE));
  const cy0 = Math.max(0, Math.floor(rect.y0 / BRUSH_CHUNK_SIZE));
  const cx1 = Math.min(chunkCols - 1, Math.floor(rect.x1 / BRUSH_CHUNK_SIZE));
  const cy1 = Math.min(recorder.chunkRows - 1, Math.floor(rect.y1 / BRUSH_CHUNK_SIZE));

  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const idx = cy * chunkCols + cx;
      if (chunkMask[idx]) continue;
      chunkMask[idx] = 1;

      const x = cx * BRUSH_CHUNK_SIZE;
      const y = cy * BRUSH_CHUNK_SIZE;
      const chunkW = Math.min(BRUSH_CHUNK_SIZE, width - x);
      const chunkH = Math.min(BRUSH_CHUNK_SIZE, height - y);

      chunksBefore.push({
        x,
        y,
        chunkW,
        chunkH,
        low: copyChunk(bands.low, x, y, chunkW, chunkH),
        mid:
          bands.kind === 'three-band'
            ? copyChunk(bands.mid, x, y, chunkW, chunkH)
            : null,
        high: copyChunk(bands.high, x, y, chunkW, chunkH),
      });

      if (x < recorder.rect.x0) recorder.rect.x0 = x;
      if (y < recorder.rect.y0) recorder.rect.y0 = y;
      if (x + chunkW - 1 > recorder.rect.x1) recorder.rect.x1 = x + chunkW - 1;
      if (y + chunkH - 1 > recorder.rect.y1) recorder.rect.y1 = y + chunkH - 1;
    }
  }
}

/**
 * Close out the recorder by capturing the "after" state for every chunk
 * in `chunksBefore`. Returns null if the stroke ended up touching zero
 * chunks (e.g. user pressed then released without moving, out of bounds).
 */
export function finishStrokeRecorder(recorder: StrokeRecorder): StrokePatch | null {
  if (recorder.chunksBefore.length === 0) return null;
  const { bands } = recorder;
  const chunksAfter: ChunkSnapshot[] = recorder.chunksBefore.map((chunk) => ({
    x: chunk.x,
    y: chunk.y,
    chunkW: chunk.chunkW,
    chunkH: chunk.chunkH,
    low: copyChunk(bands.low, chunk.x, chunk.y, chunk.chunkW, chunk.chunkH),
    mid:
      bands.kind === 'three-band'
        ? copyChunk(bands.mid, chunk.x, chunk.y, chunk.chunkW, chunk.chunkH)
        : null,
    high: copyChunk(bands.high, chunk.x, chunk.y, chunk.chunkW, chunk.chunkH),
  }));
  return {
    chunksBefore: recorder.chunksBefore,
    chunksAfter,
    rect: { ...recorder.rect },
    label: recorder.label,
    at: Date.now(),
  };
}

// --- History --------------------------------------------------------------

export function createBrushHistory(
  capacity = DEFAULT_BRUSH_HISTORY_CAPACITY,
): BrushHistory {
  return { entries: [], index: -1, capacity };
}

/**
 * Push a new stroke onto the history. Truncates any entries past the
 * current pointer (undo-then-edit branching) and drops the oldest entry
 * if the ring is at capacity.
 */
export function pushBrushPatch(history: BrushHistory, patch: StrokePatch): BrushHistory {
  const capacity = history.capacity || DEFAULT_BRUSH_HISTORY_CAPACITY;
  const truncated = history.entries.slice(0, history.index + 1);
  truncated.push(patch);
  if (truncated.length > capacity) {
    truncated.splice(0, truncated.length - capacity);
  }
  return { entries: truncated, index: truncated.length - 1, capacity };
}

export function canBrushUndo(history: BrushHistory): boolean {
  return history.index >= 0;
}

export function canBrushRedo(history: BrushHistory): boolean {
  return history.index < history.entries.length - 1;
}

/** Apply a set of chunks back to the given bands. Used by undo + redo. */
export function applyChunksToBands(
  bands: DecompositionBands,
  chunks: ChunkSnapshot[],
): void {
  for (const chunk of chunks) {
    writeChunkData(bands.low, chunk.x, chunk.y, chunk.chunkW, chunk.chunkH, chunk.low);
    if (chunk.mid && bands.kind === 'three-band') {
      writeChunkData(bands.mid, chunk.x, chunk.y, chunk.chunkW, chunk.chunkH, chunk.mid);
    }
    writeChunkData(bands.high, chunk.x, chunk.y, chunk.chunkW, chunk.chunkH, chunk.high);
  }
}

/**
 * Undo one stroke: writes the current entry's "before" chunks back into
 * `bands` and moves the pointer back. Returns the patch that was undone
 * (so the caller can repaint its rect) or null if there's nothing to undo.
 */
export function undoBrushStroke(
  history: BrushHistory,
  bands: DecompositionBands,
): { history: BrushHistory; patch: StrokePatch | null } {
  if (!canBrushUndo(history)) return { history, patch: null };
  const patch = history.entries[history.index];
  applyChunksToBands(bands, patch.chunksBefore);
  return { history: { ...history, index: history.index - 1 }, patch };
}

/**
 * Redo one stroke: re-applies the "after" chunks and advances the
 * pointer. Returns null when there's nothing to redo.
 */
export function redoBrushStroke(
  history: BrushHistory,
  bands: DecompositionBands,
): { history: BrushHistory; patch: StrokePatch | null } {
  if (!canBrushRedo(history)) return { history, patch: null };
  const nextIndex = history.index + 1;
  const patch = history.entries[nextIndex];
  applyChunksToBands(bands, patch.chunksAfter);
  return { history: { ...history, index: nextIndex }, patch };
}

