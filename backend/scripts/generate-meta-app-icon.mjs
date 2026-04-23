#!/usr/bin/env node
/**
 * Generate a 1024×1024 PNG app icon for Meta App Review.
 *
 * Source: TheRoleRoom_App_Logo.png (841×473) — rounded-square app icon
 *   design sitting inside white padding on a wide canvas.
 * Pipeline:
 *   1. Scan the source for the non-white content bounding box so we
 *      extract only the icon itself (no white bars).
 *   2. Contain-resize the cropped icon into 1024×1024, padding the
 *      remaining strip with a dark-purple background that matches the
 *      icon's own gradient (#13071f) so the join is invisible.
 *   3. Flatten onto an opaque PNG — Meta rejects icons with
 *      transparency.
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const src = path.join(root, 'frontend/client/public/TheRoleRoom_App_Logo.png');
const outSquare = path.join(root, 'frontend/client/public/theroleroom-app-icon-1024.png');
const outFlat = path.join(root, 'theroleroom-app-icon-1024.png');

const BACKGROUND = '#13071f'; // dark purple matching the icon's own background
const NEAR_WHITE_SUM = 600; // r+g+b threshold (255*3 = 765 is pure white)

async function contentBoundingBox(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r + g + b < NEAR_WHITE_SUM) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function build() {
  const sourceBuf = await sharp(src).toBuffer();
  const bbox = await contentBoundingBox(sourceBuf);
  console.log(`Content bbox: ${bbox.width}×${bbox.height} at (${bbox.left}, ${bbox.top})`);

  // Extract just the icon content.
  const cropped = await sharp(sourceBuf).extract(bbox).toBuffer();

  // Contain-resize into 1024×1024; matching-color background means any
  // padding blends with the icon's existing dark-purple background.
  await sharp(cropped)
    .resize(1024, 1024, { fit: 'contain', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(outSquare);

  await sharp(outSquare).toFile(outFlat);

  const outMeta = await sharp(outSquare).metadata();
  console.log(`✓ ${outSquare} → ${outMeta.width}×${outMeta.height} ${outMeta.format}`);
  console.log(`✓ ${outFlat} (same file at repo root for easy upload)`);
}

build().catch((err) => {
  console.error('Icon build failed:', err);
  process.exit(1);
});
