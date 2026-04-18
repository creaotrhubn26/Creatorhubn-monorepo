#!/usr/bin/env node
/**
 * Generate a 1024×1024 iOS AppIcon for CreatorHub Capture.
 *
 * Source: frontend/client/public/creatorhub-icon.png — 303×326 gold
 *   "CH" monogram on transparent background.
 *
 * Pipeline:
 *   1. Trim transparent padding.
 *   2. Resize the mark to ~62% of the 1024×1024 canvas (standard iOS
 *      AppIcon "safe area" ratio — Apple's Human Interface Guidelines
 *      recommend leaving the outer ~20% for the rounded-corner
 *      treatment the OS applies).
 *   3. Composite centered on a dark-slate gradient matching
 *      CreatorHub's brand (#0b1220 → #111c33).
 *   4. Flatten to opaque PNG — App Store Connect rejects icons with
 *      alpha channels.
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const src = path.join(root, 'frontend/client/public/creatorhub-icon.png');
const outAppIcon = path.join(
  root,
  'ipad/CaptureApp/CaptureApp/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png',
);

const CANVAS = 1024;
const MARK_FRACTION = 0.62; // mark fills 62% of width, leaving comfortable padding

async function buildGradient(width, height) {
  // Top-to-bottom #0b1220 → #111c33 gradient, realised by stacking two
  // solid colours into an SVG and rasterising through sharp.
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b1220"/>
          <stop offset="100%" stop-color="#111c33"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );
  return sharp(svg).png().toBuffer();
}

async function build() {
  const background = await buildGradient(CANVAS, CANVAS);

  const markSize = Math.round(CANVAS * MARK_FRACTION);
  const mark = await sharp(src)
    .trim({ threshold: 10 })
    .resize({ width: markSize, height: markSize, fit: 'inside' })
    .png()
    .toBuffer();
  const markMeta = await sharp(mark).metadata();

  const top = Math.round((CANVAS - markMeta.height) / 2);
  const left = Math.round((CANVAS - markMeta.width) / 2);

  await sharp(background)
    .composite([{ input: mark, top, left }])
    .flatten({ background: '#0b1220' })
    .png({ compressionLevel: 9 })
    .toFile(outAppIcon);

  const outMeta = await sharp(outAppIcon).metadata();
  console.log(`✓ ${outAppIcon}`);
  console.log(`  → ${outMeta.width}×${outMeta.height} ${outMeta.format}, no alpha`);
}

build().catch((err) => {
  console.error('Icon build failed:', err);
  process.exit(1);
});
