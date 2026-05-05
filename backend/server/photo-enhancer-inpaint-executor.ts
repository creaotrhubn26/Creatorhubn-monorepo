/**
 * Object-removal executor. Consumes the recipe Claude Vision returned
 * (see suggestInpaintRecipe in photo-enhancer-claude-vision.ts) and
 * actually paints the pixels.
 *
 * Strategies:
 *   - patch_clone: copy from a sourceRegion, feather-blend over mask.
 *                  Sharp-only, no native deps. Primary studio-cleanup path.
 *   - telea / ns:  OpenCV INPAINT_TELEA / INPAINT_NS via @techstark/opencv-js
 *                  (WASM, lazy-init once per process).
 *   - freq_sep:    not implemented in Slice 1 — falls through to patch_clone.
 *                  Real freq-sep skin pass arrives in a later slice; until
 *                  then a freq_sep recipe still gets a sensible result.
 *
 * Performance note: we crop to the mask bounding box (plus a margin equal
 * to featherPx + recipe radius) before running the heavy ops, then
 * composite back. A 5000×3000 image with a 200px mask region runs in tens
 * of ms instead of seconds because OpenCV / sharp only ever sees the
 * crop, not the whole frame.
 */

import sharp from 'sharp';
import type { InpaintRecipeRecommendation, InpaintRegion } from './photo-enhancer-claude-vision.js';

export interface ExecuteInpaintInput {
  imageBuffer: Buffer;
  /** PNG-encoded mask, same dimensions as the image. White = remove. */
  maskBuffer: Buffer;
  recipe: InpaintRecipeRecommendation;
  /** [0, 1] blend strength between original and inpainted result. */
  intensity: number;
  /** Output encoding. PNG preserves edges, JPEG is much smaller. */
  outputMime: 'image/png' | 'image/jpeg';
}

export interface ExecuteInpaintResult {
  buffer: Buffer;
  /** Strategy actually executed (may differ from recipe.strategy when we
   *  fell back — e.g. freq_sep → patch_clone in Slice 1). */
  strategyUsed: InpaintRecipeRecommendation['strategy'];
  /** Bounding box of the mask in the input image, post-binarisation. */
  maskBounds: { x: number; y: number; w: number; h: number } | null;
  /** Diagnostic warnings the executor itself raised (separate from
   *  recipe.warnings, which come from Claude). */
  warnings: string[];
}

interface MaskAnalysis {
  width: number;
  height: number;
  /** Tight bbox covering ALL white pixels in the mask. `null` when the
   *  mask is empty. Kept for callers that don't care about per-region
   *  granularity (warnings / size checks). */
  bounds: { x: number; y: number; w: number; h: number } | null;
  /** Connected components of white pixels. Each has its own bbox. The
   *  executor processes one component at a time so a multi-region mask
   *  (e.g. cable bottom-left + flash top-right) doesn't trigger an
   *  image-spanning crop — each component touches only its own neighbourhood. */
  components: Array<{ bounds: { x: number; y: number; w: number; h: number } }>;
  /** Raw greyscale mask, one byte per pixel, row-major. */
  raw: Buffer;
}

/** Cap to keep degenerate masks (noise dust, jagged edges) from spawning
 *  hundreds of inpaint passes. Slice 3 detect-distractions is capped at
 *  8 anyway, so the realistic range is 1–8. */
const MAX_MASK_COMPONENTS = 16;
/** Components smaller than this many pixels are dropped — they're
 *  almost always artefacts of mask serialisation, not real removals. */
const MIN_COMPONENT_PIXELS = 4;

/** Iterative DFS connected-component labelling, 4-connected. Mutates a
 *  visited buffer parallel to the mask. O(W×H). Returns one bbox per
 *  component found. The total mask bbox is computed in the same pass. */
async function analyseMask(maskBuffer: Buffer): Promise<MaskAnalysis> {
  const img = sharp(maskBuffer).greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  let totalMinX = w;
  let totalMinY = h;
  let totalMaxX = -1;
  let totalMaxY = -1;
  const components: MaskAnalysis['components'] = [];
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (visited[idx] || data[idx] < 128) continue;

      // Flood-fill this component.
      let cMinX = x, cMinY = y, cMaxX = x, cMaxY = y;
      let pixelCount = 0;
      stack.length = 0;
      stack.push(idx);
      visited[idx] = 1;
      while (stack.length > 0) {
        const i = stack.pop()!;
        pixelCount++;
        const cx = i % w;
        const cy = (i - cx) / w;
        if (cx < cMinX) cMinX = cx;
        if (cx > cMaxX) cMaxX = cx;
        if (cy < cMinY) cMinY = cy;
        if (cy > cMaxY) cMaxY = cy;
        if (cx > 0) {
          const n = i - 1;
          if (!visited[n] && data[n] >= 128) { visited[n] = 1; stack.push(n); }
        }
        if (cx < w - 1) {
          const n = i + 1;
          if (!visited[n] && data[n] >= 128) { visited[n] = 1; stack.push(n); }
        }
        if (cy > 0) {
          const n = i - w;
          if (!visited[n] && data[n] >= 128) { visited[n] = 1; stack.push(n); }
        }
        if (cy < h - 1) {
          const n = i + w;
          if (!visited[n] && data[n] >= 128) { visited[n] = 1; stack.push(n); }
        }
      }

      if (pixelCount < MIN_COMPONENT_PIXELS) continue;

      if (cMinX < totalMinX) totalMinX = cMinX;
      if (cMinY < totalMinY) totalMinY = cMinY;
      if (cMaxX > totalMaxX) totalMaxX = cMaxX;
      if (cMaxY > totalMaxY) totalMaxY = cMaxY;

      components.push({
        bounds: { x: cMinX, y: cMinY, w: cMaxX - cMinX + 1, h: cMaxY - cMinY + 1 },
      });

      if (components.length >= MAX_MASK_COMPONENTS) {
        // Stop scanning — any further components are noise we don't want
        // to process anyway. Sort + truncate by area handled at the end.
        break;
      }
    }
    if (components.length >= MAX_MASK_COMPONENTS) break;
  }

  if (components.length === 0) {
    return { width: w, height: h, bounds: null, components: [], raw: data };
  }

  // Largest components first — under the cap, processing biggest
  // visible removals first gives the most visual progress per ms.
  components.sort((a, b) => b.bounds.w * b.bounds.h - a.bounds.w * a.bounds.h);

  return {
    width: w,
    height: h,
    bounds: {
      x: totalMinX,
      y: totalMinY,
      w: totalMaxX - totalMinX + 1,
      h: totalMaxY - totalMinY + 1,
    },
    components,
    raw: data,
  };
}

function expandRegion(
  region: { x: number; y: number; w: number; h: number },
  margin: number,
  maxW: number,
  maxH: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, region.x - margin);
  const y = Math.max(0, region.y - margin);
  const right = Math.min(maxW, region.x + region.w + margin);
  const bottom = Math.min(maxH, region.y + region.h + margin);
  return { x, y, w: right - x, h: bottom - y };
}

function regionsOverlap(a: InpaintRegion, b: InpaintRegion): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Mean RGB of a region. Sharp's .stats() ignores upstream .extract()
 *  (it always reads the original full-image input), so we materialise
 *  the region into its own buffer first before calling stats. */
async function sampleRegionMeanColor(
  imageBuffer: Buffer,
  region: InpaintRegion,
): Promise<RGB> {
  const regionPng = await sharp(imageBuffer)
    .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
    .removeAlpha()
    .png()
    .toBuffer();
  const stats = await sharp(regionPng).stats();
  const ch = stats.channels;
  return {
    r: ch[0]?.mean ?? 0,
    g: ch[1]?.mean ?? 0,
    b: ch[2]?.mean ?? 0,
  };
}

/** Sample the mean colour of a thin band of pixels JUST OUTSIDE the
 *  mask bbox. This is what the donor needs to match — the wall / floor /
 *  backdrop colour at the seam itself, not the average of the whole
 *  image (which can be skewed by subjects in the foreground). */
async function samplePerimeterColor(
  imageBuffer: Buffer,
  bounds: { x: number; y: number; w: number; h: number },
  imgW: number,
  imgH: number,
): Promise<RGB> {
  const band = 8;
  // Build up to four 1D bands (top / bottom / left / right) clamped to
  // image bounds. Skip any band that falls outside the image entirely.
  const bands: InpaintRegion[] = [];
  if (bounds.y >= band) {
    bands.push({ x: bounds.x, y: bounds.y - band, w: bounds.w, h: band });
  }
  if (bounds.y + bounds.h + band <= imgH) {
    bands.push({ x: bounds.x, y: bounds.y + bounds.h, w: bounds.w, h: band });
  }
  if (bounds.x >= band) {
    bands.push({ x: bounds.x - band, y: bounds.y, w: band, h: bounds.h });
  }
  if (bounds.x + bounds.w + band <= imgW) {
    bands.push({ x: bounds.x + bounds.w, y: bounds.y, w: band, h: bounds.h });
  }

  if (bands.length === 0) {
    // Mask covers the whole frame — nothing to perimeter-sample. Fall
    // back to the global mean.
    return await sampleRegionMeanColor(imageBuffer, {
      x: 0, y: 0, w: imgW, h: imgH,
    });
  }

  const colors = await Promise.all(bands.map((b) => sampleRegionMeanColor(imageBuffer, b)));
  let r = 0, g = 0, b = 0;
  for (const c of colors) {
    r += c.r; g += c.g; b += c.b;
  }
  return { r: r / colors.length, g: g / colors.length, b: b / colors.length };
}

function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Generate up to four synthesised donor candidates around the mask
 *  (above / right / left / below). Used as fallbacks when Claude didn't
 *  supply a usable region — and as additional candidates when Claude's
 *  pick happens to colour-match worse than a nearby alternative. */
function synthesiseDonorCandidates(
  bounds: { x: number; y: number; w: number; h: number },
  imgW: number,
  imgH: number,
): InpaintRegion[] {
  const padding = 16;
  const candidates: InpaintRegion[] = [];
  if (bounds.y - bounds.h - padding >= 0) {
    candidates.push({ x: bounds.x, y: bounds.y - bounds.h - padding, w: bounds.w, h: bounds.h });
  }
  if (bounds.x + bounds.w * 2 + padding <= imgW) {
    candidates.push({ x: bounds.x + bounds.w + padding, y: bounds.y, w: bounds.w, h: bounds.h });
  }
  if (bounds.x - bounds.w - padding >= 0) {
    candidates.push({ x: bounds.x - bounds.w - padding, y: bounds.y, w: bounds.w, h: bounds.h });
  }
  if (bounds.y + bounds.h * 2 + padding <= imgH) {
    candidates.push({ x: bounds.x, y: bounds.y + bounds.h + padding, w: bounds.w, h: bounds.h });
  }
  return candidates;
}

/**
 * Pick the best donor region for patch_clone. The "best" donor is the
 * one whose mean colour most closely matches the perimeter of the mask
 * — that's what makes the seam invisible after feather-blend.
 *
 * Strategy:
 *   1. Sample the mask perimeter colour ONCE.
 *   2. Score every Claude-supplied sourceRegion that fits and isn't in
 *      an avoidRegion — by colour distance to the perimeter.
 *   3. ALSO score up to four synthesised "above/right/left/below"
 *      candidates so we never pick a colour-mismatched Claude region
 *      when a nearby clean patch would obviously work better.
 *   4. Return the lowest-distance candidate. Falls back to a clamped
 *      bounds-shifted region if nothing scored — so the executor never
 *      runs without a donor to copy from.
 */
async function pickDonor(
  imageBuffer: Buffer,
  recipe: InpaintRecipeRecommendation,
  maskBbox: { x: number; y: number; w: number; h: number },
  imgW: number,
  imgH: number,
): Promise<InpaintRegion> {
  const perimeter = await samplePerimeterColor(imageBuffer, maskBbox, imgW, imgH);

  const claudeCandidates = recipe.sourceRegions
    .filter((src) => src.w >= maskBbox.w && src.h >= maskBbox.h)
    .filter((src) => !recipe.avoidRegions.some((av) => regionsOverlap(src, av)))
    .filter((src) => src.x + src.w <= imgW && src.y + src.h <= imgH);

  const synthCandidates = synthesiseDonorCandidates(maskBbox, imgW, imgH).filter(
    (src) => !recipe.avoidRegions.some((av) => regionsOverlap(src, av)),
  );

  const allCandidates = [...claudeCandidates, ...synthCandidates];

  if (allCandidates.length === 0) {
    // Nothing fits anywhere; clamp a copy of the mask bbox into the image.
    return {
      x: Math.max(0, Math.min(imgW - maskBbox.w, maskBbox.x + 16)),
      y: Math.max(0, Math.min(imgH - maskBbox.h, maskBbox.y + 16)),
      w: maskBbox.w,
      h: maskBbox.h,
    };
  }

  // Score each candidate by colour distance. Prefer Claude's picks
  // marginally (-2 distance bonus) so we don't override a deliberate
  // strategic choice over a tiny colour-match win.
  const scored = await Promise.all(
    allCandidates.map(async (cand, idx) => {
      const colour = await sampleRegionMeanColor(imageBuffer, cand);
      const isClaudeChoice = idx < claudeCandidates.length;
      const distance = colorDistance(colour, perimeter) - (isClaudeChoice ? 2 : 0);
      return { cand, distance };
    }),
  );
  scored.sort((a, b) => a.distance - b.distance);
  return scored[0].cand;
}

/**
 * Build a per-pixel feathered alpha mask. The base mask is binary (white
 * = remove, black = keep); we Gaussian-blur it by featherPx so the seam
 * is soft.
 *
 * Edge handling: when the mask abuts an image boundary, we PAD the mask
 * crop with white in that direction before blurring, then crop back.
 * Without this, the gaussian blur fades to ~0.5 alpha at the boundary
 * (the kernel sees half mask, half "out of bounds" = 0), which leaves a
 * visible 50%-blended donor strip along the image edge — that was the
 * exact seam visible on the bridal-photo demo.
 */
async function featherMask(
  maskCropPng: Buffer,
  cropW: number,
  cropH: number,
  featherPx: number,
  edgePad: { top: number; bottom: number; left: number; right: number },
): Promise<Buffer> {
  const sigma = Math.max(0.3, featherPx * 0.5);
  const paddedW = cropW + edgePad.left + edgePad.right;
  const paddedH = cropH + edgePad.top + edgePad.bottom;

  // Build the padded greyscale mask manually (sharp's .extend with RGB
  // background silently upgrades a 1-channel input to 3 channels, which
  // then breaks all alpha-byte indexing downstream — keeping it raw +
  // explicit avoids that whole class of bug). White-fill the requested
  // edges so blur doesn't fade alpha to ~0.5 along image boundaries.
  let padded: Buffer;
  if (paddedW === cropW && paddedH === cropH) {
    padded = await sharp(maskCropPng).greyscale().raw().toBuffer();
  } else {
    const cropRaw = await sharp(maskCropPng).greyscale().raw().toBuffer();
    padded = Buffer.alloc(paddedW * paddedH, 255); // fill with white
    // Copy the unpadded mask into its position inside the padded buffer.
    for (let y = 0; y < cropH; y++) {
      cropRaw.copy(
        padded,
        (edgePad.top + y) * paddedW + edgePad.left,
        y * cropW,
        y * cropW + cropW,
      );
    }
  }

  // Blur the padded buffer. Sharp's .blur() silently promotes a
  // 1-channel input to 3 channels, so we explicitly drop back to 'b-w'
  // before the .raw() to keep the alpha index math correct.
  const blurred = await sharp(padded, {
    raw: { width: paddedW, height: paddedH, channels: 1 },
  })
    .blur(sigma)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  // Crop the padded blurred mask back to the original crop dimensions.
  // Same .toColourspace('b-w') guard as above — sharp loves to promote
  // a 1-channel raw output back to 3 channels otherwise.
  if (paddedW === cropW && paddedH === cropH) {
    return blurred;
  }
  return await sharp(blurred, {
    raw: { width: paddedW, height: paddedH, channels: 1 },
  })
    .extract({ left: edgePad.left, top: edgePad.top, width: cropW, height: cropH })
    .toColourspace('b-w')
    .raw()
    .toBuffer();
}

/**
 * Execute the patch_clone strategy on a SINGLE mask component. The
 * caller (executeInpaint) iterates over all connected components and
 * composites each result onto a working image so a multi-region mask
 * doesn't trigger an image-spanning crop.
 *
 * Returns the inpainted CROP (component bbox + featherPx margin), not the
 * full image. The caller composites the crop back into the working image.
 */
async function executePatchClone(
  imageBuffer: Buffer,
  maskAnalysis: MaskAnalysis,
  componentBounds: { x: number; y: number; w: number; h: number },
  recipe: InpaintRecipeRecommendation,
): Promise<{ cropPng: Buffer; cropBox: { x: number; y: number; w: number; h: number } }> {
  const margin = Math.max(8, recipe.featherPx);
  const cropBox = expandRegion(componentBounds, margin, maskAnalysis.width, maskAnalysis.height);

  // Pick the best-matching donor: scores Claude's regions + synthesised
  // fallbacks by perimeter colour distance. Always returns something, so
  // the executor can't run without a donor to copy from.
  const donor = await pickDonor(
    imageBuffer,
    recipe,
    componentBounds,
    maskAnalysis.width,
    maskAnalysis.height,
  );

  // Extract donor as raw RGBA, resize to match the component bbox, then place
  // it inside an empty crop-sized canvas at the component's position-in-crop.
  const donorBuf = await sharp(imageBuffer)
    .extract({ left: donor.x, top: donor.y, width: donor.w, height: donor.h })
    .resize(componentBounds.w, componentBounds.h, { fit: 'fill' })
    .png()
    .toBuffer();

  const maskOffsetX = componentBounds.x - cropBox.x;
  const maskOffsetY = componentBounds.y - cropBox.y;

  const originalCrop = await sharp(imageBuffer)
    .extract({ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h })
    .png()
    .toBuffer();

  const maskCropPng = await sharp(maskAnalysis.raw, {
    raw: { width: maskAnalysis.width, height: maskAnalysis.height, channels: 1 },
  })
    .extract({ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h })
    .png()
    .toBuffer();

  // Detect which crop edges abut the image boundary AND have the
  // component touching them. Those are the edges where featherMask will
  // pad the mask with white before blurring, so the alpha stays at full
  // opacity along the image boundary instead of fading to ~0.5.
  const compTouchesTop = componentBounds.y === 0;
  const compTouchesBottom = componentBounds.y + componentBounds.h === maskAnalysis.height;
  const compTouchesLeft = componentBounds.x === 0;
  const compTouchesRight = componentBounds.x + componentBounds.w === maskAnalysis.width;
  const padPx = Math.ceil(Math.max(8, recipe.featherPx));
  const edgePad = {
    top: compTouchesTop ? padPx : 0,
    bottom: compTouchesBottom ? padPx : 0,
    left: compTouchesLeft ? padPx : 0,
    right: compTouchesRight ? padPx : 0,
  };

  // Build a feathered alpha mask the size of the CROP, with the donor
  // sitting at maskOffset inside it.
  const featheredAlpha = await featherMask(
    maskCropPng,
    cropBox.w,
    cropBox.h,
    recipe.featherPx,
    edgePad,
  );

  // Compose the donor onto a transparent crop-sized canvas, then attach
  // the feathered mask as alpha so we can composite over the original.
  const donorOnCanvasRaw = await sharp({
    create: {
      width: cropBox.w,
      height: cropBox.h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: donorBuf, left: maskOffsetX, top: maskOffsetY }])
    .raw()
    .toBuffer();

  // Slot the feathered alpha into the alpha channel of the donor canvas.
  // donorOnCanvasRaw is RGBA, featheredAlpha is greyscale (1 channel).
  const totalPx = cropBox.w * cropBox.h;
  for (let i = 0; i < totalPx; i++) {
    donorOnCanvasRaw[i * 4 + 3] = featheredAlpha[i];
  }

  const donorWithAlpha = await sharp(donorOnCanvasRaw, {
    raw: { width: cropBox.w, height: cropBox.h, channels: 4 },
  })
    .png()
    .toBuffer();

  const composited = await sharp(originalCrop)
    .composite([{ input: donorWithAlpha, blend: 'over' }])
    .png()
    .toBuffer();

  return { cropPng: composited, cropBox };
}

// ---- OpenCV.js lazy init ----------------------------------------------------

let cvReady: Promise<any> | null = null;

async function getCv(): Promise<any> {
  if (cvReady) return cvReady;
  cvReady = (async () => {
    const mod: any = await import('@techstark/opencv-js');
    const cv = mod.default ?? mod;
    if (cv?.Mat) return cv;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (cv?.Mat) resolve();
        else setTimeout(check, 25);
      };
      cv.onRuntimeInitialized = () => resolve();
      check();
    });
    return cv;
  })();
  return cvReady;
}

/** OpenCV-backed Telea/NS inpaint on a SINGLE component crop. Operates
 *  on a bounded crop so a 5K image with a 200px mask doesn't load 60MB
 *  into WASM heap. The caller iterates components. */
async function executeOpenCvInpaint(
  imageBuffer: Buffer,
  maskAnalysis: MaskAnalysis,
  componentBounds: { x: number; y: number; w: number; h: number },
  recipe: InpaintRecipeRecommendation,
): Promise<{ cropPng: Buffer; cropBox: { x: number; y: number; w: number; h: number } }> {
  const cv = await getCv();
  const margin = Math.max(8, recipe.radiusPx * 2);
  const cropBox = expandRegion(componentBounds, margin, maskAnalysis.width, maskAnalysis.height);

  const cropRgbaRaw = await sharp(imageBuffer)
    .extract({ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const maskCropRaw = await sharp(maskAnalysis.raw, {
    raw: { width: maskAnalysis.width, height: maskAnalysis.height, channels: 1 },
  })
    .extract({ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h })
    .raw()
    .toBuffer();

  const src = cv.matFromArray
    ? cv.matFromArray(cropBox.h, cropBox.w, cv.CV_8UC4, cropRgbaRaw)
    : new cv.Mat(cropBox.h, cropBox.w, cv.CV_8UC4);
  if (!cv.matFromArray) src.data.set(cropRgbaRaw);

  const mask = new cv.Mat(cropBox.h, cropBox.w, cv.CV_8UC1);
  mask.data.set(maskCropRaw);

  const srcRgb = new cv.Mat();
  cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB);

  const dst = new cv.Mat();
  const flag = recipe.strategy === 'ns' ? cv.INPAINT_NS : cv.INPAINT_TELEA;
  const radius = Math.max(1, recipe.radiusPx);
  cv.inpaint(srcRgb, mask, dst, radius, flag);

  const dstRgba = new cv.Mat();
  cv.cvtColor(dst, dstRgba, cv.COLOR_RGB2RGBA);

  const out = Buffer.from(dstRgba.data);

  src.delete();
  srcRgb.delete();
  mask.delete();
  dst.delete();
  dstRgba.delete();

  const cropPng = await sharp(out, {
    raw: { width: cropBox.w, height: cropBox.h, channels: 4 },
  })
    .png()
    .toBuffer();

  return { cropPng, cropBox };
}

/**
 * Top-level entry point. Routes by recipe.strategy, runs the executor on
 * the mask bbox crop, composites the result back into the full image
 * with an intensity blend, and returns the encoded buffer.
 */
export async function executeInpaint(
  input: ExecuteInpaintInput,
): Promise<ExecuteInpaintResult> {
  const { imageBuffer, maskBuffer, recipe, intensity, outputMime } = input;

  const imgMeta = await sharp(imageBuffer).metadata();
  if (!imgMeta.width || !imgMeta.height) {
    throw new Error('inpaint: source image has no dimensions');
  }

  const maskAnalysis = await analyseMask(maskBuffer);
  if (maskAnalysis.width !== imgMeta.width || maskAnalysis.height !== imgMeta.height) {
    throw new Error(
      `inpaint: mask dimensions ${maskAnalysis.width}×${maskAnalysis.height} do not match image ${imgMeta.width}×${imgMeta.height}`,
    );
  }

  const warnings: string[] = [];

  if (!maskAnalysis.bounds || maskAnalysis.components.length === 0) {
    // Empty mask — nothing to do, return the original re-encoded.
    const out = await sharp(imageBuffer).toFormat(outputMime === 'image/png' ? 'png' : 'jpeg').toBuffer();
    return { buffer: out, strategyUsed: recipe.strategy, maskBounds: null, warnings: ['Tom maske — ingenting endret.'] };
  }

  let strategyUsed: InpaintRecipeRecommendation['strategy'] = recipe.strategy;
  let effectiveRecipe = recipe;
  if (recipe.strategy === 'freq_sep') {
    // Slice 1 fallback: real freq-sep skin pass arrives later. Until
    // then, treat skin masks as a soft patch_clone — the result is at
    // least defensible (smooth tone from a nearby donor) rather than
    // failing.
    warnings.push('freq_sep ikke implementert ennå — kjører patch_clone som fallback');
    strategyUsed = 'patch_clone';
    effectiveRecipe = {
      ...recipe,
      strategy: 'patch_clone',
      featherPx: Math.max(recipe.featherPx, 24),
    };
  } else if (
    recipe.strategy !== 'patch_clone' &&
    recipe.strategy !== 'telea' &&
    recipe.strategy !== 'ns'
  ) {
    throw new Error(`inpaint: unknown strategy ${recipe.strategy}`);
  }

  // Process each connected component independently. Working image
  // accumulates per-component patches as PNG so quality stays lossless
  // through the inner loop; only the final encode honours outputMime.
  let workingImage = await sharp(imageBuffer).png().toBuffer();
  for (const comp of maskAnalysis.components) {
    const cropResult =
      effectiveRecipe.strategy === 'patch_clone'
        ? await executePatchClone(workingImage, maskAnalysis, comp.bounds, effectiveRecipe)
        : await executeOpenCvInpaint(workingImage, maskAnalysis, comp.bounds, effectiveRecipe);

    const blendedCrop =
      intensity >= 0.999
        ? cropResult.cropPng
        : await blendCropWithIntensity(
            workingImage,
            cropResult.cropPng,
            cropResult.cropBox,
            intensity,
          );

    workingImage = await sharp(workingImage)
      .composite([
        { input: blendedCrop, left: cropResult.cropBox.x, top: cropResult.cropBox.y, blend: 'over' },
      ])
      .png()
      .toBuffer();
  }

  const finalImage = await sharp(workingImage)
    .toFormat(outputMime === 'image/png' ? 'png' : 'jpeg')
    .toBuffer();

  return {
    buffer: finalImage,
    strategyUsed,
    maskBounds: maskAnalysis.bounds,
    warnings,
  };
}

/** Linear-blend the inpainted crop with the original at the same
 *  position, weighted by intensity. Returns a PNG buffer the size of the
 *  crop, ready to composite back at cropBox. */
async function blendCropWithIntensity(
  imageBuffer: Buffer,
  inpaintedCropPng: Buffer,
  cropBox: { x: number; y: number; w: number; h: number },
  intensity: number,
): Promise<Buffer> {
  const t = Math.max(0, Math.min(1, intensity));

  const originalCrop = await sharp(imageBuffer)
    .extract({ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const inpaintCrop = await sharp(inpaintedCropPng)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const out = Buffer.alloc(originalCrop.length);
  for (let i = 0; i < originalCrop.length; i += 4) {
    out[i + 0] = Math.round(originalCrop[i + 0] * (1 - t) + inpaintCrop[i + 0] * t);
    out[i + 1] = Math.round(originalCrop[i + 1] * (1 - t) + inpaintCrop[i + 1] * t);
    out[i + 2] = Math.round(originalCrop[i + 2] * (1 - t) + inpaintCrop[i + 2] * t);
    out[i + 3] = 255;
  }

  return await sharp(out, {
    raw: { width: cropBox.w, height: cropBox.h, channels: 4 },
  })
    .png()
    .toBuffer();
}
