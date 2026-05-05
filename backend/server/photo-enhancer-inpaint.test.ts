/**
 * Tests for the object-removal stack: sanitiser (pure function) +
 * executor end-to-end (sharp + opencv-js).
 *
 * Goals:
 *   - sanitiseInpaintRecipe never returns out-of-bounds coords or
 *     unknown strategies, no matter what Claude emits.
 *   - executePatchClone actually replaces masked pixels with donor
 *     colour, leaves unmasked pixels untouched.
 *   - executeInpaint round-trips a real Holy-Crust-style JPEG without
 *     blowing up. (Claude planner is not invoked — we hand the executor
 *     a recipe directly so the test runs without ANTHROPIC_API_KEY.)
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { sanitiseDistractions, sanitiseInpaintRecipe } from './photo-enhancer-claude-vision.js';
import { executeInpaint } from './photo-enhancer-inpaint-executor.js';
import type { InpaintRecipeRecommendation } from './photo-enhancer-claude-vision.js';

describe('sanitiseInpaintRecipe', () => {
  it('returns null for non-objects', () => {
    expect(sanitiseInpaintRecipe(null, 100, 100)).toBeNull();
    expect(sanitiseInpaintRecipe('garbage', 100, 100)).toBeNull();
    expect(sanitiseInpaintRecipe(42, 100, 100)).toBeNull();
  });

  it('clamps source / avoid regions into image bounds', () => {
    const out = sanitiseInpaintRecipe(
      {
        strategy: 'patch_clone',
        radiusPx: 0,
        featherPx: 16,
        sourceRegions: [
          { x: -50, y: -10, w: 999_999, h: 999_999 },
          { x: 50, y: 50, w: 200, h: 200 },
        ],
        avoidRegions: [{ x: 10, y: 10, w: 30, h: 30 }],
        postFreqSepSkin: false,
        warnings: [],
        rationale: 'test',
      },
      100,
      100,
    );
    expect(out).not.toBeNull();
    expect(out!.sourceRegions).toHaveLength(2);
    for (const r of out!.sourceRegions) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(100);
      expect(r.y + r.h).toBeLessThanOrEqual(100);
    }
  });

  it('coerces unknown strategy to patch_clone (the safe studio default)', () => {
    const out = sanitiseInpaintRecipe(
      {
        strategy: 'magic_eraser_pro',
        radiusPx: 5,
        featherPx: 16,
        sourceRegions: [],
        avoidRegions: [],
        postFreqSepSkin: false,
        warnings: [],
        rationale: '',
      },
      100,
      100,
    );
    expect(out!.strategy).toBe('patch_clone');
  });

  it('caps warnings at 4 entries and 200 chars each', () => {
    const out = sanitiseInpaintRecipe(
      {
        strategy: 'telea',
        radiusPx: 6,
        featherPx: 0,
        sourceRegions: [],
        avoidRegions: [],
        postFreqSepSkin: false,
        warnings: [
          'a'.repeat(500),
          'b',
          'c',
          'd',
          'e (should be dropped — over the limit)',
          'f',
        ],
        rationale: '',
      },
      100,
      100,
    );
    expect(out!.warnings).toHaveLength(4);
    expect(out!.warnings[0]).toHaveLength(200);
  });

  it('caps source / avoid regions at 8 entries', () => {
    const many = Array.from({ length: 20 }, () => ({ x: 0, y: 0, w: 10, h: 10 }));
    const out = sanitiseInpaintRecipe(
      {
        strategy: 'patch_clone',
        radiusPx: 0,
        featherPx: 16,
        sourceRegions: many,
        avoidRegions: many,
        postFreqSepSkin: false,
        warnings: [],
        rationale: '',
      },
      100,
      100,
    );
    expect(out!.sourceRegions).toHaveLength(8);
    expect(out!.avoidRegions).toHaveLength(8);
  });
});

describe('sanitiseDistractions', () => {
  it('returns empty list for non-objects', () => {
    expect(sanitiseDistractions(null, 1000, 1000).detections).toEqual([]);
    expect(sanitiseDistractions('garbage', 1000, 1000).detections).toEqual([]);
    expect(sanitiseDistractions(42, 1000, 1000).detections).toEqual([]);
  });

  it('drops detections with confidence below 0.55 threshold', () => {
    const out = sanitiseDistractions(
      {
        detections: [
          { type: 'cable', bbox: { x: 10, y: 10, w: 50, h: 50 }, confidence: 0.9, description: 'visible cable' },
          { type: 'cable', bbox: { x: 200, y: 10, w: 50, h: 50 }, confidence: 0.4, description: 'low confidence guess' },
          { type: 'cable', bbox: { x: 400, y: 10, w: 50, h: 50 }, confidence: 0.55, description: 'edge of threshold' },
        ],
        rationale: '',
      },
      1000,
      1000,
    );
    expect(out.detections).toHaveLength(2);
    expect(out.detections.every((d) => d.confidence >= 0.55)).toBe(true);
  });

  it('clamps bbox coordinates into image bounds', () => {
    const out = sanitiseDistractions(
      {
        detections: [
          { type: 'flash_strobe', bbox: { x: -50, y: -10, w: 9999, h: 9999 }, confidence: 0.9, description: 'overflowing bbox' },
        ],
        rationale: '',
      },
      500,
      500,
    );
    expect(out.detections).toHaveLength(1);
    const b = out.detections[0].bbox;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(500);
    expect(b.y + b.h).toBeLessThanOrEqual(500);
  });

  it('coerces unknown distraction type to other_distraction', () => {
    const out = sanitiseDistractions(
      {
        detections: [
          { type: 'magic_eraser_thingy', bbox: { x: 10, y: 10, w: 50, h: 50 }, confidence: 0.9, description: 'x' },
        ],
        rationale: '',
      },
      1000,
      1000,
    );
    expect(out.detections[0].type).toBe('other_distraction');
  });

  it('caps detections at 8 per image', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      type: 'cable',
      bbox: { x: 10 + i * 5, y: 10, w: 30, h: 30 },
      confidence: 0.9,
      description: `cable ${i}`,
    }));
    const out = sanitiseDistractions({ detections: many, rationale: '' }, 1000, 1000);
    expect(out.detections.length).toBeLessThanOrEqual(8);
  });

  it('assigns stable ids that include type and position', () => {
    const out = sanitiseDistractions(
      {
        detections: [
          { type: 'cable', bbox: { x: 100, y: 200, w: 50, h: 50 }, confidence: 0.9, description: 'x' },
        ],
        rationale: '',
      },
      1000,
      1000,
    );
    expect(out.detections[0].id).toContain('cable');
    expect(out.detections[0].id).toContain('100');
    expect(out.detections[0].id).toContain('200');
  });

  it('caps rationale at 300 chars', () => {
    const out = sanitiseDistractions({ detections: [], rationale: 'a'.repeat(500) }, 1000, 1000);
    expect(out.rationale).toHaveLength(300);
  });
});

describe('executeInpaint patch_clone (synthetic)', () => {
  it('replaces a defect in a uniform field with the surrounding colour', async () => {
    // Image: pure blue 200×100 with a 5×5 RED defect at (148, 48). This
    // is the "kabel mot vegg" archetype — small foreign object on a
    // clean uniform backdrop. After inpaint with a mask covering the
    // defect, the area should be blue everywhere.
    const W = 200;
    const H = 100;
    const raw = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 255; // blue
      }
    }
    for (let y = 48; y < 53; y++) {
      for (let x = 148; x < 153; x++) {
        const i = (y * W + x) * 3;
        raw[i] = 255; raw[i + 1] = 0; raw[i + 2] = 0; // red defect
      }
    }
    const imageBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();

    // Mask: 20×20 covering the defect with a margin of clean blue.
    const maskRaw = Buffer.alloc(W * H);
    for (let y = 40; y < 60; y++) {
      for (let x = 140; x < 160; x++) {
        maskRaw[y * W + x] = 255;
      }
    }
    const maskBuffer = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer();

    const recipe: InpaintRecipeRecommendation = {
      strategy: 'patch_clone',
      radiusPx: 0,
      featherPx: 4,
      // Hand the picker one good blue candidate; it'll also synth more.
      sourceRegions: [{ x: 60, y: 30, w: 40, h: 40 }],
      avoidRegions: [],
      postFreqSepSkin: false,
      warnings: [],
      rationale: 'defect on uniform blue field',
    };

    const result = await executeInpaint({
      imageBuffer,
      maskBuffer,
      recipe,
      intensity: 1,
      outputMime: 'image/png',
    });

    expect(result.maskBounds).toEqual({ x: 140, y: 40, w: 20, h: 20 });
    expect(result.strategyUsed).toBe('patch_clone');

    const outRaw = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const data = outRaw.data;
    const stride = outRaw.info.channels;

    // Centre of the masked patch — defect must be gone, area is blue.
    const centreIdx = (50 * W + 150) * stride;
    expect(data[centreIdx]).toBeLessThan(50);         // R low (no more red)
    expect(data[centreIdx + 2]).toBeGreaterThan(200); // B high (blue)

    // Far-right pixel (well outside mask) — untouched blue.
    const farIdx = (10 * W + 195) * stride;
    expect(data[farIdx + 2]).toBeGreaterThan(200);
  });

  it('picks a colour-matched synth donor over a colour-mismatched Claude region', async () => {
    // Image: RED left half, BLUE right half (sharp seam at x=100). A
    // small RED defect (which doesn't belong on the blue side) sits at
    // (148, 48). The recipe deliberately points at the RED left half as
    // a sourceRegion — a poor colour match for a defect on the blue
    // side. The picker should reject Claude's pick on perimeter colour
    // grounds and synthesise a blue donor instead. The masked area
    // ends up BLUE (correct), not RED (would be wrong).
    const W = 200;
    const H = 100;
    const raw = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        if (x < W / 2) {
          raw[i] = 255; raw[i + 1] = 0; raw[i + 2] = 0;
        } else {
          raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 255;
        }
      }
    }
    const imageBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();

    const maskRaw = Buffer.alloc(W * H);
    for (let y = 40; y < 60; y++) {
      for (let x = 140; x < 160; x++) {
        maskRaw[y * W + x] = 255;
      }
    }
    const maskBuffer = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer();

    const recipe: InpaintRecipeRecommendation = {
      strategy: 'patch_clone',
      radiusPx: 0,
      featherPx: 4,
      sourceRegions: [{ x: 10, y: 30, w: 40, h: 40 }], // red half — wrong colour
      avoidRegions: [],
      postFreqSepSkin: false,
      warnings: [],
      rationale: 'Claude points at red half but mask is in blue half',
    };

    const result = await executeInpaint({
      imageBuffer,
      maskBuffer,
      recipe,
      intensity: 1,
      outputMime: 'image/png',
    });

    const outRaw = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const data = outRaw.data;
    const stride = outRaw.info.channels;

    // Centre of the masked patch — should be BLUE because the picker
    // colour-matched against the perimeter (which is blue).
    const centreIdx = (50 * W + 150) * stride;
    expect(data[centreIdx]).toBeLessThan(50);         // R low
    expect(data[centreIdx + 2]).toBeGreaterThan(200); // B high
  });

  it('processes multiple disjoint mask regions independently', async () => {
    // Image: 200×200 solid blue with TWO red defects far apart — one
    // top-left, one bottom-right. A single mask covers both. The
    // executor must split into two connected components and inpaint
    // each, leaving the wide blue middle untouched (without this
    // refactor, the executor would have used one image-spanning crop
    // and processed everything in a single 200×200 pass).
    const W = 200;
    const H = 200;
    const raw = Buffer.alloc(W * H * 3);
    for (let i = 0; i < raw.length; i += 3) {
      raw[i + 2] = 255;
    }
    // Defect A: top-left, x=20..40, y=20..40
    for (let y = 20; y < 40; y++) {
      for (let x = 20; x < 40; x++) {
        const i = (y * W + x) * 3;
        raw[i] = 255; raw[i + 1] = 0; raw[i + 2] = 0;
      }
    }
    // Defect B: bottom-right, x=160..180, y=160..180
    for (let y = 160; y < 180; y++) {
      for (let x = 160; x < 180; x++) {
        const i = (y * W + x) * 3;
        raw[i] = 255; raw[i + 1] = 0; raw[i + 2] = 0;
      }
    }
    const imageBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

    const maskRaw = Buffer.alloc(W * H);
    for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) maskRaw[y * W + x] = 255;
    for (let y = 160; y < 180; y++) for (let x = 160; x < 180; x++) maskRaw[y * W + x] = 255;
    const maskBuffer = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();

    const result = await executeInpaint({
      imageBuffer,
      maskBuffer,
      recipe: {
        strategy: 'patch_clone',
        radiusPx: 0,
        featherPx: 4,
        sourceRegions: [],
        avoidRegions: [],
        postFreqSepSkin: false,
        warnings: [],
        rationale: 'two disjoint defects',
      },
      intensity: 1,
      outputMime: 'image/png',
    });

    const outRaw = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const stride = outRaw.info.channels;

    // Both defect centres should now be blue (defects removed).
    const idxA = (30 * W + 30) * stride;
    expect(outRaw.data[idxA]).toBeLessThan(50);
    expect(outRaw.data[idxA + 2]).toBeGreaterThan(200);

    const idxB = (170 * W + 170) * stride;
    expect(outRaw.data[idxB]).toBeLessThan(50);
    expect(outRaw.data[idxB + 2]).toBeGreaterThan(200);

    // Wide middle of the image, far from any mask — untouched blue.
    const idxMid = (100 * W + 100) * stride;
    expect(outRaw.data[idxMid + 2]).toBeGreaterThan(200);
  });

  it('keeps alpha at full opacity along an image edge the mask touches', async () => {
    // Image: solid blue 100×100. Mask: 20×20 anchored to the bottom edge.
    // Without edge-pad, gaussian blur fades the alpha to ~0.5 along the
    // bottom — the donor would only be 50%-applied there and the
    // pre-inpaint pixels would bleed through as a visible band. With
    // edge-pad the alpha stays at 1.0, so the bottom row is fully
    // donor-coloured.
    const W = 100;
    const H = 100;
    const raw = Buffer.alloc(W * H * 3);
    for (let i = 0; i < raw.length; i += 3) {
      raw[i + 2] = 255; // blue everywhere
    }
    // Sprinkle a noisy red defect in the bottom-edge mask region.
    for (let y = 80; y < 100; y++) {
      for (let x = 40; x < 60; x++) {
        const i = (y * W + x) * 3;
        raw[i] = 255; raw[i + 1] = 0; raw[i + 2] = 0;
      }
    }
    const imageBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();

    const maskRaw = Buffer.alloc(W * H);
    for (let y = 80; y < 100; y++) {
      for (let x = 40; x < 60; x++) {
        maskRaw[y * W + x] = 255;
      }
    }
    const maskBuffer = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer();

    const result = await executeInpaint({
      imageBuffer,
      maskBuffer,
      recipe: {
        strategy: 'patch_clone',
        radiusPx: 0,
        featherPx: 12,
        sourceRegions: [{ x: 0, y: 0, w: 40, h: 40 }], // top-left, blue
        avoidRegions: [],
        postFreqSepSkin: false,
        warnings: [],
        rationale: 'mask anchored to bottom edge',
      },
      intensity: 1,
      outputMime: 'image/png',
    });

    const outRaw = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const data = outRaw.data;
    const stride = outRaw.info.channels;

    // Bottom row, centre of mask: must be fully blue (not the leaked
    // red defect at 50% blend).
    const bottomIdx = (99 * W + 50) * stride;
    expect(data[bottomIdx]).toBeLessThan(40);          // R low — no leak
    expect(data[bottomIdx + 2]).toBeGreaterThan(200);  // B high — donor
  });

  it('returns the original image unchanged when the mask is empty', async () => {
    const W = 60;
    const H = 60;
    const raw = Buffer.alloc(W * H * 3, 128);
    const imageBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();
    const emptyMask = await sharp(Buffer.alloc(W * H), {
      raw: { width: W, height: H, channels: 1 },
    })
      .png()
      .toBuffer();

    const result = await executeInpaint({
      imageBuffer,
      maskBuffer: emptyMask,
      recipe: {
        strategy: 'patch_clone',
        radiusPx: 0,
        featherPx: 8,
        sourceRegions: [],
        avoidRegions: [],
        postFreqSepSkin: false,
        warnings: [],
        rationale: '',
      },
      intensity: 1,
      outputMime: 'image/png',
    });

    expect(result.maskBounds).toBeNull();
    expect(result.warnings).toContain('Tom maske — ingenting endret.');
  });

  it('intensity=0 returns the original (no inpaint applied)', async () => {
    const W = 80;
    const H = 80;
    const raw = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        raw[i + 2] = 200; // pure blue everywhere
      }
    }
    const imageBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();

    // Small mask in the centre.
    const maskRaw = Buffer.alloc(W * H);
    for (let y = 35; y < 45; y++) {
      for (let x = 35; x < 45; x++) {
        maskRaw[y * W + x] = 255;
      }
    }
    const maskBuffer = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer();

    const result = await executeInpaint({
      imageBuffer,
      maskBuffer,
      recipe: {
        strategy: 'patch_clone',
        radiusPx: 0,
        featherPx: 0,
        sourceRegions: [{ x: 0, y: 0, w: 20, h: 20 }], // fake red donor
        avoidRegions: [],
        postFreqSepSkin: false,
        warnings: [],
        rationale: '',
      },
      intensity: 0,
      outputMime: 'image/png',
    });

    const outRaw = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const stride = outRaw.info.channels;
    // Centre of masked region must remain pure blue at intensity=0.
    const centreIdx = (40 * W + 40) * stride;
    expect(outRaw.data[centreIdx + 2]).toBeGreaterThanOrEqual(195);
  });
});

describe('executeInpaint round-trip on a real photo', () => {
  const realPhoto = path.resolve(__dirname, '../../preview-thumb.jpg');

  it.skipIf(!existsSync(realPhoto))(
    'inpaints a small mask region without throwing',
    async () => {
      const imageBuffer = readFileSync(realPhoto);
      const meta = await sharp(imageBuffer).metadata();
      const W = meta.width!;
      const H = meta.height!;

      // Mask: a 32×32 patch about a quarter-way in from top-left — far
      // from any face/subject in a typical Holy Crust shot.
      const maskRaw = Buffer.alloc(W * H);
      const mx0 = Math.round(W * 0.2);
      const my0 = Math.round(H * 0.2);
      for (let y = my0; y < my0 + 32; y++) {
        for (let x = mx0; x < mx0 + 32; x++) {
          maskRaw[y * W + x] = 255;
        }
      }
      const maskBuffer = await sharp(maskRaw, {
        raw: { width: W, height: H, channels: 1 },
      })
        .png()
        .toBuffer();

      const result = await executeInpaint({
        imageBuffer,
        maskBuffer,
        recipe: {
          strategy: 'patch_clone',
          radiusPx: 0,
          featherPx: 12,
          // Donor a bit further in — patch above the mask.
          sourceRegions: [
            { x: mx0, y: Math.max(0, my0 - 64), w: 32, h: 32 },
          ],
          avoidRegions: [],
          postFreqSepSkin: false,
          warnings: [],
          rationale: 'real-photo round-trip',
        },
        intensity: 1,
        outputMime: 'image/jpeg',
      });

      expect(result.buffer.length).toBeGreaterThan(1000);
      expect(result.maskBounds).toEqual({ x: mx0, y: my0, w: 32, h: 32 });

      // Output must decode as a valid image with the same dimensions.
      const outMeta = await sharp(result.buffer).metadata();
      expect(outMeta.width).toBe(W);
      expect(outMeta.height).toBe(H);
    },
    30_000,
  );
});
