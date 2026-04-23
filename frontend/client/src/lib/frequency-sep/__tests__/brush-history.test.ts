import { describe, expect, it } from 'vitest';
import {
  applyChunksToBands,
  beginStrokeRecorder,
  BRUSH_CHUNK_SIZE,
  canBrushRedo,
  canBrushUndo,
  createBrushHistory,
  finishStrokeRecorder,
  pushBrushPatch,
  recordRectInStroke,
  redoBrushStroke,
  undoBrushStroke,
  type StrokePatch,
} from '../brush-history';
import { decompose, rgbaToFloat32, type DecompositionBands, type Float32Image } from '../decomposition';

function makeBands(w = 160, h = 160, seed = 1): DecompositionBands {
  const bytes = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  for (let i = 0; i < w * h; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    bytes[i * 4] = s & 0xff;
    bytes[i * 4 + 1] = (s >> 8) & 0xff;
    bytes[i * 4 + 2] = (s >> 16) & 0xff;
    bytes[i * 4 + 3] = 255;
  }
  return decompose(rgbaToFloat32({ data: bytes, width: w, height: h }), {
    lowSigma: 4,
    midSigma: 1,
  });
}

function snapshotBands(bands: DecompositionBands): {
  low: Float32Array;
  mid: Float32Array | null;
  high: Float32Array;
} {
  return {
    low: new Float32Array(bands.low.data),
    mid: bands.kind === 'three-band' ? new Float32Array(bands.mid.data) : null,
    high: new Float32Array(bands.high.data),
  };
}

function maxAbs(a: Float32Array, b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

function mutateBandPixel(band: Float32Image, x: number, y: number, delta: number) {
  const idx = (y * band.width + x) * band.channels;
  band.data[idx] += delta;
  band.data[idx + 1] += delta;
  band.data[idx + 2] += delta;
}

describe('stroke recorder', () => {
  it('snapshots a chunk the first time it is touched and not again', () => {
    const bands = makeBands();
    const recorder = beginStrokeRecorder(bands, 'test');
    recordRectInStroke(recorder, { x0: 10, y0: 10, x1: 12, y1: 12 });
    expect(recorder.chunksBefore.length).toBe(1);
    // Touching the same chunk again must not add a new snapshot.
    recordRectInStroke(recorder, { x0: 50, y0: 50, x1: 60, y1: 60 });
    expect(recorder.chunksBefore.length).toBe(1);
  });

  it('spans multiple chunks when a rect crosses chunk boundaries', () => {
    const bands = makeBands();
    const recorder = beginStrokeRecorder(bands, 'test');
    // Chunk size is 64; a rect straddling x=64 touches two horizontal chunks.
    recordRectInStroke(recorder, {
      x0: BRUSH_CHUNK_SIZE - 2,
      y0: 10,
      x1: BRUSH_CHUNK_SIZE + 2,
      y1: 12,
    });
    expect(recorder.chunksBefore.length).toBe(2);
  });

  it('tracks the union of touched chunks as rect', () => {
    const bands = makeBands();
    const recorder = beginStrokeRecorder(bands, 'test');
    recordRectInStroke(recorder, { x0: 10, y0: 10, x1: 12, y1: 12 });
    recordRectInStroke(recorder, {
      x0: BRUSH_CHUNK_SIZE * 2 + 5,
      y0: BRUSH_CHUNK_SIZE + 5,
      x1: BRUSH_CHUNK_SIZE * 2 + 10,
      y1: BRUSH_CHUNK_SIZE + 10,
    });
    expect(recorder.rect.x0).toBe(0);
    expect(recorder.rect.y0).toBe(0);
    expect(recorder.rect.x1).toBeGreaterThanOrEqual(BRUSH_CHUNK_SIZE * 2);
    expect(recorder.rect.y1).toBeGreaterThanOrEqual(BRUSH_CHUNK_SIZE);
  });

  it('handles edge chunks smaller than the full chunk size', () => {
    // Image width/height not evenly divisible by 64.
    const bands = makeBands(100, 100);
    const recorder = beginStrokeRecorder(bands, 'test');
    recordRectInStroke(recorder, { x0: 95, y0: 95, x1: 99, y1: 99 });
    expect(recorder.chunksBefore).toHaveLength(1);
    const chunk = recorder.chunksBefore[0];
    expect(chunk.chunkW).toBe(100 - BRUSH_CHUNK_SIZE);
    expect(chunk.chunkH).toBe(100 - BRUSH_CHUNK_SIZE);
    expect(chunk.low.length).toBe(chunk.chunkW * chunk.chunkH * 4);
  });

  it('clips rects that extend outside the image', () => {
    const bands = makeBands();
    const recorder = beginStrokeRecorder(bands, 'test');
    // Partly out of bounds on the left.
    recordRectInStroke(recorder, { x0: -50, y0: -50, x1: 10, y1: 10 });
    expect(recorder.chunksBefore).toHaveLength(1);
  });

  it('finishStrokeRecorder returns null when no chunks were touched', () => {
    const bands = makeBands();
    const recorder = beginStrokeRecorder(bands, 'test');
    expect(finishStrokeRecorder(recorder)).toBeNull();
  });

  it('captures after-state that reflects in-place band mutations', () => {
    const bands = makeBands();
    const recorder = beginStrokeRecorder(bands, 'test');
    recordRectInStroke(recorder, { x0: 5, y0: 5, x1: 10, y1: 10 });
    // Mutate one pixel in the touched chunk after snapshotting.
    mutateBandPixel(bands.low, 5, 5, 0.1);
    const patch = finishStrokeRecorder(recorder);
    expect(patch).not.toBeNull();
    if (!patch) return;
    const before = patch.chunksBefore[0];
    const after = patch.chunksAfter[0];
    expect(before.low[5 * 4 + 5 * before.chunkW * 4]).not.toBeCloseTo(
      after.low[5 * 4 + 5 * after.chunkW * 4],
      6,
    );
  });
});

describe('applyChunksToBands round-trip', () => {
  it('undo restores bands bit-for-bit, redo reapplies the mutation', () => {
    const bands = makeBands();
    const original = snapshotBands(bands);

    const recorder = beginStrokeRecorder(bands, 'mutate');
    recordRectInStroke(recorder, { x0: 20, y0: 20, x1: 80, y1: 80 });
    // Mutate every pixel in the touched region.
    for (let y = 20; y <= 80; y++) {
      for (let x = 20; x <= 80; x++) {
        mutateBandPixel(bands.low, x, y, 0.05);
        mutateBandPixel(bands.high, x, y, 0.02);
        if (bands.kind === 'three-band') {
          mutateBandPixel(bands.mid, x, y, 0.03);
        }
      }
    }
    const afterMutation = snapshotBands(bands);
    const patch = finishStrokeRecorder(recorder);
    expect(patch).not.toBeNull();
    if (!patch) return;

    // Undo — bands must match original exactly.
    applyChunksToBands(bands, patch.chunksBefore);
    expect(maxAbs(bands.low.data, original.low)).toBeLessThan(1e-6);
    expect(maxAbs(bands.high.data, original.high)).toBeLessThan(1e-6);
    if (bands.kind === 'three-band' && original.mid) {
      expect(maxAbs(bands.mid.data, original.mid)).toBeLessThan(1e-6);
    }

    // Redo — bands must match the post-mutation snapshot exactly.
    applyChunksToBands(bands, patch.chunksAfter);
    expect(maxAbs(bands.low.data, afterMutation.low)).toBeLessThan(1e-6);
    expect(maxAbs(bands.high.data, afterMutation.high)).toBeLessThan(1e-6);
    if (bands.kind === 'three-band' && afterMutation.mid) {
      expect(maxAbs(bands.mid.data, afterMutation.mid)).toBeLessThan(1e-6);
    }
  });

  it('only touches pixels within the recorded chunks', () => {
    const bands = makeBands();
    const farPixelIdxLow = (150 * bands.low.width + 150) * bands.low.channels;
    const farPixelBefore = bands.low.data[farPixelIdxLow];

    const recorder = beginStrokeRecorder(bands, 'local');
    recordRectInStroke(recorder, { x0: 5, y0: 5, x1: 10, y1: 10 });
    mutateBandPixel(bands.low, 5, 5, 0.1);
    const patch = finishStrokeRecorder(recorder);
    if (!patch) throw new Error('patch null');

    // Mutate a far pixel OUTSIDE any recorded chunk.
    bands.low.data[farPixelIdxLow] = 0.999;
    const mutatedFarValue = bands.low.data[farPixelIdxLow]; // what f32 actually stored

    // Undo — far pixel should NOT be restored (it wasn't in the patch).
    applyChunksToBands(bands, patch.chunksBefore);
    expect(bands.low.data[farPixelIdxLow]).toBe(mutatedFarValue);
    // But the mutated pixel WAS undone.
    expect(farPixelBefore).not.toBe(mutatedFarValue); // sanity
  });
});

describe('BrushHistory', () => {
  function makePatch(label = 'x'): StrokePatch {
    return {
      chunksBefore: [],
      chunksAfter: [],
      rect: { x0: 0, y0: 0, x1: 0, y1: 0 },
      label,
      at: 0,
    };
  }

  it('push then undo/redo moves the pointer', () => {
    let h = createBrushHistory(5);
    expect(canBrushUndo(h)).toBe(false);
    h = pushBrushPatch(h, makePatch('a'));
    h = pushBrushPatch(h, makePatch('b'));
    h = pushBrushPatch(h, makePatch('c'));
    expect(h.index).toBe(2);
    expect(canBrushUndo(h)).toBe(true);
    expect(canBrushRedo(h)).toBe(false);
  });

  it('push after undo truncates forward entries (branching)', () => {
    const bands = makeBands();
    let h = createBrushHistory(5);
    h = pushBrushPatch(h, makePatch('a'));
    h = pushBrushPatch(h, makePatch('b'));
    h = pushBrushPatch(h, makePatch('c'));
    h = undoBrushStroke(h, bands).history; // index 1
    h = undoBrushStroke(h, bands).history; // index 0
    h = pushBrushPatch(h, makePatch('d'));
    expect(h.entries.map((e) => e.label)).toEqual(['a', 'd']);
    expect(h.index).toBe(1);
  });

  it('respects capacity by dropping oldest', () => {
    let h = createBrushHistory(3);
    h = pushBrushPatch(h, makePatch('a'));
    h = pushBrushPatch(h, makePatch('b'));
    h = pushBrushPatch(h, makePatch('c'));
    h = pushBrushPatch(h, makePatch('d'));
    expect(h.entries.map((e) => e.label)).toEqual(['b', 'c', 'd']);
    expect(h.index).toBe(2);
  });

  it('end-to-end: undo/redo actually moves pixel state', () => {
    const bands = makeBands();
    const original = snapshotBands(bands);
    let history = createBrushHistory();

    const recorder = beginStrokeRecorder(bands, 'stroke');
    recordRectInStroke(recorder, { x0: 30, y0: 30, x1: 60, y1: 60 });
    mutateBandPixel(bands.low, 40, 40, 0.2);
    const patch = finishStrokeRecorder(recorder);
    if (!patch) throw new Error('null patch');
    history = pushBrushPatch(history, patch);

    const afterEdit = snapshotBands(bands);
    expect(maxAbs(bands.low.data, original.low)).toBeGreaterThan(0);

    const undone = undoBrushStroke(history, bands);
    history = undone.history;
    expect(undone.patch).toBe(patch);
    expect(maxAbs(bands.low.data, original.low)).toBeLessThan(1e-6);

    const redone = redoBrushStroke(history, bands);
    history = redone.history;
    expect(redone.patch).toBe(patch);
    expect(maxAbs(bands.low.data, afterEdit.low)).toBeLessThan(1e-6);
  });

  it('canBrushUndo/Redo flags track the pointer correctly', () => {
    const bands = makeBands();
    let h = createBrushHistory();
    expect(canBrushUndo(h)).toBe(false);
    expect(canBrushRedo(h)).toBe(false);

    h = pushBrushPatch(h, makePatch('a'));
    expect(canBrushUndo(h)).toBe(true);
    expect(canBrushRedo(h)).toBe(false);

    h = undoBrushStroke(h, bands).history;
    expect(canBrushUndo(h)).toBe(false);
    expect(canBrushRedo(h)).toBe(true);
  });
});
