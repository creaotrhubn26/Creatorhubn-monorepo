// Crop a 600×300 area around the window from both original and
// inpainted, stitch side-by-side at full res so the seam is visible.
import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

const ZOOM = { left: 1380, top: 1100, width: 620, height: 234 };

const orig = await sharp('/tmp/_L9A7437.jpg')
  .extract(ZOOM)
  .png()
  .toBuffer();
const fix = await sharp('/tmp/_L9A7437_inpainted.jpg')
  .extract(ZOOM)
  .png()
  .toBuffer();

const compare = await sharp({
  create: { width: ZOOM.width * 2 + 12, height: ZOOM.height, channels: 3, background: { r: 40, g: 40, b: 40 } },
})
  .composite([
    { input: orig, left: 0, top: 0 },
    { input: fix, left: ZOOM.width + 12, top: 0 },
  ])
  .jpeg({ quality: 95 })
  .toBuffer();

writeFileSync('/tmp/_L9A7437_window_zoom.jpg', compare);
console.log('zoom written: /tmp/_L9A7437_window_zoom.jpg');
