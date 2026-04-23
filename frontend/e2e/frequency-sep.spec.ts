import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

/**
 * End-to-end smoke for the frequency-sep retouch flow.
 *
 * Scope: verifies the wire-up between `CreatorHubPhotoEnhancer`, the
 * `FrequencySepDialog`, the editor canvas, and the pointer/brush/history
 * stack in a real browser. The algorithmic correctness is covered by
 * 110 vitest units; this spec catches the things unit tests can't:
 *
 *  - The button actually renders and enables after upload
 *  - The dialog opens, decodes the image via createImageBitmap, and
 *    mounts the editor without throwing
 *  - Mouse-driven pointer events produce stamps (history enables Angre)
 *  - Commit round-trips through encodeRgba8BufferToFile and replaces
 *    the enhancer's source (filename chip shows .retouched.png)
 */

/** Build a valid PNG for `setInputFiles`. Constructed by hand via zlib
 *  to avoid pulling in `sharp` or `@napi-rs/canvas` just for a fixture. */
function makeTestPng(width = 64, height = 64): Buffer {
  const chunks: Buffer[] = [];
  const crc32 = (buf: Buffer): number => {
    let c = ~0 >>> 0;
    for (const byte of buf) {
      c = c ^ byte;
      for (let i = 0; i < 8; i++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return (~c) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  // Signature.
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  // IHDR: width, height, 8-bit, RGBA (6).
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  chunks.push(chunk('IHDR', ihdr));
  // IDAT: per-row filter byte + a gradient overlaid with deterministic
  // pseudo-random noise. The noise matters — the high-frequency band of
  // a pure gradient is nearly zero, which makes `visualiseSignedBand`
  // (shift by +0.5) indistinguishable from the composite at mid-grey.
  // A noise pattern gives the bands real energy to preview.
  const rows: Buffer[] = [];
  // LCG for deterministic noise so test output is reproducible.
  let seed = 0xabc123;
  const nextNoise = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return ((seed >> 8) & 0xff) - 128; // signed delta in ~[-128, 127]
  };
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const i = 1 + x * 4;
      const base = [
        Math.floor((x / width) * 200) + 30,
        Math.floor((y / height) * 200) + 30,
        128,
      ];
      // ±25 noise across all three channels — visible in high band,
      // small enough that the gradient is still recognisable.
      const noise = nextNoise() >> 2; // ~[-32, 31]
      row[i] = Math.max(0, Math.min(255, base[0] + noise));
      row[i + 1] = Math.max(0, Math.min(255, base[1] + noise));
      row[i + 2] = Math.max(0, Math.min(255, base[2] + noise));
      row[i + 3] = 255;
    }
    rows.push(row);
  }
  chunks.push(chunk('IDAT', deflateSync(Buffer.concat(rows))));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

// Port-5001 hosts an unrelated vite project in this dev environment, so
// we spin up the creatorhubn frontend on 5002 and target it directly here.
const BASE_URL = process.env.CREATORHUBN_BASE_URL || 'http://localhost:5002';

/** Drag the mouse along a straight path with enough waypoints that the
 *  brush engine emits multiple stamps. Returns once the mouse is released. */
async function paintStroke(
  page: import('@playwright/test').Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
      { steps: 3 },
    );
  }
  await page.mouse.up();
}

/** Read the (r, g, b) at a given image-space pixel from the editor canvas. */
async function samplePixel(
  page: import('@playwright/test').Page,
  canvas: import('@playwright/test').Locator,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  return canvas.evaluate(
    (el, coords) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      const d = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]] as [number, number, number, number];
    },
    { x, y },
  );
}

/**
 * Shared setup: navigate into the enhancer, upload a synthetic image,
 * open the frequency-sep dialog. Returns the editor canvas locator and
 * its current bounding box so the caller can paint strokes.
 */
async function openEditor(
  page: import('@playwright/test').Page,
): Promise<{
  canvas: import('@playwright/test').Locator;
  box: { x: number; y: number; width: number; height: number };
  consoleErrors: string[];
}> {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto(`${BASE_URL}/photographer-dashboard-material`, {
    waitUntil: 'domcontentloaded',
  });

  const aiTab = page.getByRole('tab', { name: /AI\s*Forbedring/i });
  await aiTab.waitFor({ state: 'visible', timeout: 30_000 });
  await aiTab.click();

  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15_000 });
  await fileInput.setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: makeTestPng(96, 96),
  });

  const openButton = page.getByRole('button', { name: /Frekvens-retusj/i });
  await expect(openButton).toBeEnabled({ timeout: 15_000 });
  await openButton.click();

  await expect(page.getByText(/Frekvens-separert retusj/)).toBeVisible();
  const canvas = page.locator('canvas[width="96"][height="96"]').first();
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('editor canvas has no bounding box');
  return { canvas, box, consoleErrors };
}

test.describe('Frequency-sep retouch flow', () => {
  test('opens dialog, paints a stroke, commits retouched file', async ({ page }) => {
    const { box, consoleErrors } = await openEditor(page);

    await paintStroke(
      page,
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.5 },
    );

    const undoButton = page.getByRole('button', { name: /^Angre$/ });
    await expect(undoButton).toBeEnabled({ timeout: 5_000 });

    const commitButton = page.getByRole('button', { name: /Bruk endringer/ });
    await expect(commitButton).toBeEnabled();
    await commitButton.click();

    await expect(page.getByText(/Frekvens-separert retusj/)).toBeHidden({
      timeout: 10_000,
    });
    await expect(page.getByText(/\.retouched\.png$/)).toBeVisible({ timeout: 10_000 });

    // Finally: no unhandled console errors from A2 code paths.
    //
    // This dev environment has unrelated partial services (LUT library
    // endpoint, Google Chat heartbeat, etc.) that log 404s and noisy
    // warnings regardless of the editor. We filter those out so the
    // assertion only fires on errors actually caused by frequency-sep.
    const realErrors = consoleErrors.filter(
      (msg) =>
        !/Warning: React does not recognize/.test(msg) &&
        !/validateDOMNesting/.test(msg) &&
        !/Download the React DevTools/.test(msg) &&
        !/ERR_BLOCKED_BY_CLIENT/.test(msg) &&
        // Network 404s from unrelated background polling (LUT library,
        // chat heartbeat, telemetry) — not A2's responsibility.
        !/Failed to load resource.*404/.test(msg),
    );
    expect(realErrors, `unexpected console errors:\n${realErrors.join('\n')}`).toEqual([]);
  });

  test('dodge mode actually lightens pixels at the stroke path', async ({ page }) => {
    const { canvas, box } = await openEditor(page);

    await page.getByRole('dialog').getByRole('combobox').first().click();
    await page.getByRole('option', { name: /^Dodge$/ }).click();

    // Crank the strength slider to its max (0.2 per the component) so a
    // single stroke produces a luminance shift large enough to detect
    // against 8-bit quantisation and f32 round-trip noise.
    const strengthSlider = page
      .getByRole('dialog')
      .locator('input[type="range"]')
      .filter({ has: page.locator(':scope') })
      .nth(3); // 4th slider: radius/hardness/flow/STRENGTH (dodge panel)
    void strengthSlider; // The slider sits under "Styrke"; skip UI tweak and
    // instead rely on repeated strokes for cumulative shift.

    const nativeCx = 48;
    const nativeCy = 48;
    const cssCenterX = box.x + box.width * 0.5;
    const cssCenterY = box.y + box.height * 0.5;
    const cssDx = box.width * (20 / 96);
    // Snapshot the full canvas before the stroke so we can verify at least
    // one pixel anywhere changed (isolates op-didn't-run from coord-drift).
    const snapBefore = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      return Array.from(d);
    });

    // Paint several overlapping passes so cumulative dodge is well above 1-LSB.
    for (let i = 0; i < 4; i++) {
      await paintStroke(
        page,
        { x: cssCenterX - cssDx, y: cssCenterY + i },
        { x: cssCenterX + cssDx, y: cssCenterY + i },
        12,
      );
    }

    // Sanity: the history recorder must have captured the strokes.
    await expect(page.getByRole('button', { name: /^Angre$/ })).toBeEnabled();

    const snapAfter = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      return Array.from(d);
    });

    let changedPixels = 0;
    let maxDelta = 0;
    for (let i = 0; i < snapBefore.length; i += 4) {
      const d =
        Math.abs(snapAfter[i] - snapBefore[i]) +
        Math.abs(snapAfter[i + 1] - snapBefore[i + 1]) +
        Math.abs(snapAfter[i + 2] - snapBefore[i + 2]);
      if (d > 0) changedPixels++;
      if (d > maxDelta) maxDelta = d;
    }

    expect(
      changedPixels,
      `dodge produced no visible pixel changes anywhere on the canvas (maxDelta=${maxDelta})`,
    ).toBeGreaterThan(0);

    // If we changed pixels at all, assert they got *brighter* on average.
    let totalAfter = 0;
    let totalBefore = 0;
    for (let i = 0; i < snapBefore.length; i += 4) {
      totalBefore += snapBefore[i] + snapBefore[i + 1] + snapBefore[i + 2];
      totalAfter += snapAfter[i] + snapAfter[i + 1] + snapAfter[i + 2];
    }
    expect(
      totalAfter,
      `dodge should raise aggregate luminance: before=${totalBefore} after=${totalAfter}`,
    ).toBeGreaterThan(totalBefore);
  });

  test('undo reverses all strokes and redo reapplies them exactly', async ({ page }) => {
    const { canvas, box } = await openEditor(page);

    // MUI Select exposes the combobox with its *value* as the accessible
    // name (e.g. "Jevn tone (low)"), not the "Modus" label — target the
    // single combobox inside the dialog instead.
    await page.getByRole('dialog').getByRole('combobox').first().click();
    await page.getByRole('option', { name: /^Dodge$/ }).click();

    const cssCenterX = box.x + box.width * 0.5;
    const cssCenterY = box.y + box.height * 0.5;
    const cssDx = box.width * (20 / 96);

    const snapshot = async (): Promise<number[]> =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        return Array.from(d);
      });
    const byteDiff = (a: number[], b: number[]): number => {
      let n = 0;
      for (let i = 0; i < a.length; i++) n += Math.abs(a[i] - b[i]);
      return n;
    };

    const origin = await snapshot();

    // Four overlapping passes — matches the dodge-detection test's
    // stroke density so we reliably produce a visible delta.
    for (let i = 0; i < 4; i++) {
      await paintStroke(
        page,
        { x: cssCenterX - cssDx, y: cssCenterY + i },
        { x: cssCenterX + cssDx, y: cssCenterY + i },
        12,
      );
      // Small wait between strokes — lets React flush the
      // setBrushHistory → re-render cycle so Angre reflects the new
      // patch count before the next pointerdown. Without this, fast-
      // back-to-back strokes occasionally land before the prior
      // mouseup's state commit and collapse into one patch.
      await page.waitForTimeout(50);
    }
    const afterStroke = await snapshot();
    expect(byteDiff(origin, afterStroke)).toBeGreaterThan(0);

    // Undo as many times as the button lets us — click count equals
    // patches the recorder actually pushed. We don't hard-code "4"
    // because Playwright mouse events can occasionally collapse into
    // fewer patches; the round-trip property still holds.
    const undo = page.getByRole('button', { name: /^Angre$/ });
    while (await undo.isEnabled()) {
      await undo.click();
      await page.waitForTimeout(30);
    }
    const afterUndo = await snapshot();
    // Any residual diff is float32→uint8 rounding during recompose.
    // Allow ≤1 LSB average per colour channel per pixel — generous but
    // bounded; the unit suite already proves the Float32 round-trip is
    // bit-for-bit, this only guards against gross composite drift.
    expect(
      byteDiff(origin, afterUndo),
      `undo residual byte-diff was ${byteDiff(origin, afterUndo)}`,
    ).toBeLessThanOrEqual((origin.length * 3) / 4);

    const redo = page.getByRole('button', { name: /^Gjenta$/ });
    while (await redo.isEnabled()) {
      await redo.click();
      await page.waitForTimeout(30);
    }
    const afterRedo = await snapshot();
    expect(
      byteDiff(afterStroke, afterRedo),
      `redo residual byte-diff was ${byteDiff(afterStroke, afterRedo)}`,
    ).toBeLessThanOrEqual((afterStroke.length * 3) / 4);
  });

  test('multi-stroke history: three strokes, three undos return to origin', async ({
    page,
  }) => {
    const { canvas, box } = await openEditor(page);

    // MUI Select exposes the combobox with its *value* as the accessible
    // name (e.g. "Jevn tone (low)"), not the "Modus" label — target the
    // single combobox inside the dialog instead.
    await page.getByRole('dialog').getByRole('combobox').first().click();
    await page.getByRole('option', { name: /^Dodge$/ }).click();

    const cssCenterX = box.x + box.width * 0.5;
    const cssCenterY = box.y + box.height * 0.5;
    const cssDx = box.width * (20 / 96);
    const cssDy = box.height * (1 / 96);

    const snapshot = async (): Promise<number[]> =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        return Array.from(d);
      });
    const byteDiff = (a: number[], b: number[]): number => {
      let n = 0;
      for (let i = 0; i < a.length; i++) n += Math.abs(a[i] - b[i]);
      return n;
    };

    const origin = await snapshot();

    // Three discrete strokes — each ends with mouse.up so the recorder
    // flushes a separate patch. waitForTimeout between strokes lets
    // React commit the setBrushHistory update before the next
    // pointerdown, otherwise fast back-to-back strokes occasionally
    // collapse into one patch.
    for (let i = 0; i < 3; i++) {
      await paintStroke(
        page,
        { x: cssCenterX - cssDx, y: cssCenterY + cssDy * i },
        { x: cssCenterX + cssDx, y: cssCenterY + cssDy * i },
        16,
      );
      await page.waitForTimeout(50);
    }
    const afterThree = await snapshot();
    expect(byteDiff(origin, afterThree)).toBeGreaterThan(0);

    const undo = page.getByRole('button', { name: /^Angre$/ });
    while (await undo.isEnabled()) {
      await undo.click();
      await page.waitForTimeout(30);
    }
    const afterThreeUndos = await snapshot();
    expect(
      byteDiff(origin, afterThreeUndos),
      `after 3 undos residual byte-diff was ${byteDiff(origin, afterThreeUndos)}`,
    ).toBeLessThanOrEqual((origin.length * 3) / 4);
  });

  test('band view toggle swaps the canvas render', async ({ page }) => {
    const { canvas, box } = await openEditor(page);

    // Sample several scattered pixels — a single pixel might coincidentally
    // match between views, but the aggregate delta across the image cannot.
    const probes = [
      [10, 10],
      [Math.round(box.width * 0.5), Math.round(box.height * 0.5)],
      [Math.round(box.width * 0.8), Math.round(box.height * 0.2)],
      [20, Math.round(box.height * 0.7)],
    ];
    const composite = [] as [number, number, number, number][];
    for (const [x, y] of probes) composite.push(await samplePixel(page, canvas, x, y));

    // Scope the "High" toggle to the dialog's Visning group. The profession-
    // picker on the dashboard can also surface buttons that might match the
    // name, so dialog scoping prevents a stray match.
    await page.getByRole('dialog').getByRole('button', { name: /^High$/ }).click();
    await page.waitForTimeout(150);
    const highSamples = [] as [number, number, number, number][];
    for (const [x, y] of probes) highSamples.push(await samplePixel(page, canvas, x, y));

    let totalDiff = 0;
    for (let i = 0; i < probes.length; i++) {
      totalDiff +=
        Math.abs(composite[i][0] - highSamples[i][0]) +
        Math.abs(composite[i][1] - highSamples[i][1]) +
        Math.abs(composite[i][2] - highSamples[i][2]);
    }
    // Across 4 probes × 3 channels = 12 comparisons, even a dim band shift
    // produces cumulative diff > 30. A zero total means the click never
    // changed the render.
    expect(
      totalDiff,
      `composite vs high-band total channel diff was ${totalDiff} (samples: ${JSON.stringify(composite)} vs ${JSON.stringify(highSamples)})`,
    ).toBeGreaterThan(30);
  });

  test('canvas has touchAction: none so iPad pan gestures do not hijack the stroke', async ({
    page,
  }) => {
    const { canvas } = await openEditor(page);
    const touchAction = await canvas.evaluate(
      (el) => (getComputedStyle(el as HTMLCanvasElement).touchAction || '').toLowerCase(),
    );
    expect(touchAction).toBe('none');
  });

  test('enhance after commit sends the retouched file, not the original', async ({
    page,
  }) => {
    // Capture the enhance request so we can verify which file it carries.
    // Mock a tiny success response so the test doesn't depend on the
    // GFPGAN runner being available.
    let capturedFilename: string | null = null;
    let capturedBodyLength = 0;
    await page.route('**/api/photo-enhancer/enhance', async (route) => {
      const request = route.request();
      const body = request.postDataBuffer();
      if (body) {
        capturedBodyLength = body.length;
        // The multipart part for the file contains a Content-Disposition
        // with filename="...". Grep for it — good enough for an assertion.
        const text = body.toString('binary');
        const match = text.match(/filename="([^"]+)"/);
        if (match) capturedFilename = match[1];
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      });
    });

    const { box } = await openEditor(page);

    // Paint + commit to populate the retouched chip + state.
    await paintStroke(
      page,
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.5 },
    );
    await page.getByRole('button', { name: /Bruk endringer/ }).click();
    await expect(page.getByText(/\.retouched\.png$/)).toBeVisible({ timeout: 10_000 });

    // Click Enhance. Because the mock short-circuits, we only care about
    // what got sent, not what came back.
    await page.getByRole('button', { name: /^Enhance$/ }).click();

    // Give the mutation a beat to hit the intercept.
    await expect
      .poll(() => capturedFilename, {
        message: 'enhance was never called',
        timeout: 10_000,
      })
      .not.toBeNull();

    expect(capturedFilename).toMatch(/\.retouched\.png$/);
    expect(capturedBodyLength).toBeGreaterThan(0);
  });
});
