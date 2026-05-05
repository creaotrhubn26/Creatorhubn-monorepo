/**
 * One-shot validation: load the bridal CR3 (already converted to JPEG by
 * sips), build a mask over the bottom-right window, run the inpaint
 * executor with a hard-coded patch_clone recipe (skipping Claude so the
 * run doesn't need ANTHROPIC_API_KEY), and write the result so we can
 * eyeball it.
 *
 * Run:
 *   cd backend && npx tsx scripts/inpaint-bridal-demo.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { executeInpaint } from '../server/photo-enhancer-inpaint-executor.js';

const SRC = '/tmp/_L9A7437.jpg';
const OUT = '/tmp/_L9A7437_inpainted.jpg';
const MASK_DEBUG = '/tmp/_L9A7437_mask.png';
const SIDE_BY_SIDE = '/tmp/_L9A7437_compare.jpg';

const imageBuffer = readFileSync(SRC);
const meta = await sharp(imageBuffer).metadata();
const W = meta.width!;
const H = meta.height!;
console.log(`source: ${W}×${H}`);

// Window bounding box in 2000×1334 coords (eyeballed from the visible
// preview — a real shoot would brush this in the editor).
const MASK = { x: 1430, y: 1180, w: 470, h: 154 };
// Donor: clean white wall up and to the left, well clear of subjects.
const DONOR = { x: 1500, y: 300, w: 470, h: 200 };

// Build a binary mask PNG at full image resolution.
const maskRaw = Buffer.alloc(W * H);
for (let y = MASK.y; y < MASK.y + MASK.h; y++) {
  for (let x = MASK.x; x < MASK.x + MASK.w; x++) {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      maskRaw[y * W + x] = 255;
    }
  }
}
const maskBuffer = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } })
  .png()
  .toBuffer();
writeFileSync(MASK_DEBUG, maskBuffer);
console.log(`mask written: ${MASK_DEBUG}`);

const recipe = {
  strategy: 'patch_clone' as const,
  radiusPx: 0,
  featherPx: 24,
  sourceRegions: [DONOR],
  avoidRegions: [
    { x: 200, y: 200, w: 1100, h: 1100 },
  ],
  postFreqSepSkin: false,
  warnings: [],
  rationale: 'manual demo: window mask, donor from clean wall',
};

console.time('executeInpaint');
const result = await executeInpaint({
  imageBuffer,
  maskBuffer,
  recipe,
  intensity: 1,
  outputMime: 'image/jpeg',
});
console.timeEnd('executeInpaint');

writeFileSync(OUT, result.buffer);
console.log(`result written: ${OUT}  (${result.buffer.length} bytes)`);
console.log(`strategyUsed: ${result.strategyUsed}`);
console.log(`maskBounds:   ${JSON.stringify(result.maskBounds)}`);
console.log(`warnings:     ${JSON.stringify(result.warnings)}`);

// Stitch original | inpainted side-by-side at half-res for easy preview.
const halfW = Math.floor(W / 2);
const halfH = Math.floor(H / 2);
const orig = await sharp(imageBuffer).resize(halfW, halfH).toBuffer();
const fix = await sharp(result.buffer).resize(halfW, halfH).toBuffer();
const compare = await sharp({
  create: { width: halfW * 2 + 8, height: halfH, channels: 3, background: { r: 0, g: 0, b: 0 } },
})
  .composite([
    { input: orig, left: 0, top: 0 },
    { input: fix, left: halfW + 8, top: 0 },
  ])
  .jpeg({ quality: 92 })
  .toBuffer();
writeFileSync(SIDE_BY_SIDE, compare);
console.log(`compare written: ${SIDE_BY_SIDE}`);
