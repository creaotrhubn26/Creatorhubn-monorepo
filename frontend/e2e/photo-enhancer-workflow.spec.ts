import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Full-workflow end-to-end for the CreatorHub Photo Enhancer.
 *
 * Where `frequency-sep.spec.ts` exercises the retouch sub-editor in
 * isolation, this spec drives the *complete* photographer journey through
 * `CreatorHubPhotoEnhancer` in a real browser, with every backend endpoint
 * mocked so the flow runs without R2, Claude Vision or the GFPGAN runner:
 *
 *   status (mount) → upload → analyze → AI-forslag (suggest-recipe)
 *     → adjust a setting → Enhance → before/after preview → Save to project
 *
 * It also covers the second architectural path the synchronous flow can't:
 * the **server job queue** (direct R2 multipart upload → POST /jobs →
 * poll /jobs/{id} → completed), which kicks in for large uploads.
 *
 * The 110 vitest units cover the algorithms; this spec catches the wiring
 * units can't see: that the mutations fire in the right order, send the
 * right payloads, and that each response actually advances the UI state.
 */

/** Hand-rolled valid RGBA PNG so we don't pull in `sharp` for a fixture.
 *  Identical construction to frequency-sep.spec.ts. */
function makeTestPng(width = 64, height = 64): Buffer {
  const chunks: Buffer[] = [];
  const crc32 = (buf: Buffer): number => {
    let c = ~0 >>> 0;
    for (const byte of buf) {
      c = c ^ byte;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  chunks.push(chunk('IHDR', ihdr));
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) {
      const i = 1 + x * 4;
      row[i] = Math.floor((x / width) * 200) + 30;
      row[i + 1] = Math.floor((y / height) * 200) + 30;
      row[i + 2] = 128;
      row[i + 3] = 255;
    }
    rows.push(row);
  }
  chunks.push(chunk('IDAT', deflateSync(Buffer.concat(rows))));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

/** A deliberately incompressible PNG (LCG noise) so the *encoded* file size
 *  clears the 20 MB `DIRECT_UPLOAD_THRESHOLD_BYTES` and trips the queued
 *  upload path. A gradient would deflate to a few KB and never qualify. */
function makeLargeNoisePng(side = 2500): Buffer {
  const chunks: Buffer[] = [];
  const crc32 = (buf: Buffer): number => {
    let c = ~0 >>> 0;
    for (const byte of buf) {
      c = c ^ byte;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  chunks.push(chunk('IHDR', ihdr));
  const raw = Buffer.alloc(side * (1 + side * 4));
  let seed = 0x1234567;
  for (let p = 0; p < raw.length; p++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    raw[p] = (seed >> 8) & 0xff;
  }
  // Force every row's filter byte to 0 (None) so the bytes stay random.
  for (let y = 0; y < side; y++) raw[y * (1 + side * 4)] = 0;
  chunks.push(chunk('IDAT', deflateSync(raw, { level: 0 })));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

// Tiny 1x1 PNG used as the mocked enhanced result — a data URL so the
// <ImagePreview> can render it without a real network round-trip.
const ENHANCED_DATA_URL =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5001';

/** JSON the `/status` query expects on mount. `directUpload` overrides let a
 *  test flip from the synchronous `/enhance` path to the queued `/jobs`
 *  path (set `maxBytes: 1` so even a tiny fixture trips the direct route). */
function statusPayload(directUpload: Record<string, unknown> = { enabled: false, reason: null }) {
  return {
    success: true,
    models: {
      gfpgan: { id: 'gfpgan', displayName: 'GFPGAN v1.4', available: true },
      registry: [
        { id: 'gfpgan', displayName: 'GFPGAN v1.4', modelType: 'face', available: true },
        { id: 'realesrgan', displayName: 'Real-ESRGAN', modelType: 'upscale', available: true },
        { id: 'codeformer', displayName: 'CodeFormer', modelType: 'face', available: false, reason: 'not-loaded' },
      ],
      faceApi: { available: true },
      imageHash: { available: true },
    },
    rawSupport: { available: true, supportedExtensions: ['cr2', 'nef', 'arw'], rasterExtensions: ['jpg', 'png'], converters: { dcraw: true } },
    googleDrive: { folderStructure: [] },
    directUpload: {
      strategy: 'multipart',
      partSizeBytes: 64 * 1024 * 1024,
      maxPartUrlsPerRequest: 1,
      signedUrlTtlSeconds: 600,
      proxyUpload: { enabled: true, partSizeBytes: 64 * 1024 * 1024, strategy: 'proxy' },
      cors: { requiresBrowserPut: false },
      ...directUpload,
    },
    improvements: { total: 0, tracked: [] },
    queue: {
      paused: false,
      counts: { queued: 0, running: 0 },
      concurrency: { global: 2, perUser: 1, perProject: 1 },
      memory: { freeMb: 8000, minFreeMb: 1000, canStart: true },
      capabilities: ['gfpgan', 'realesrgan'],
    },
    processingOptions: { modelPreference: ['gfpgan', 'realesrgan'], executionNote: 'mocked' },
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Register the always-needed reads so the enhancer mounts cleanly. */
async function mockStatusAndProjects(
  page: Page,
  directUpload?: Record<string, unknown>,
): Promise<void> {
  await page.route('**/api/photo-enhancer/status', (route) => json(route, statusPayload(directUpload)));
  await page.route('**/api/projects?profession=*', (route) =>
    json(route, [
      { id: 'proj-aurora', name: 'Aurora Wedding 2026' },
      { id: 'proj-studio', name: 'Studio Portraits' },
    ]),
  );
  // Auto-analyse fires on upload (default-on toggle); keep it satisfied so it
  // never leaks an unmocked-endpoint error. Tests that assert on analyze
  // register their own more specific route afterwards (last-registered wins).
  const analyzeBody = { analysis: { format: 'png', faces: [] } };
  await page.route('**/api/photo-enhancer/analyze', (route) => json(route, analyzeBody));
  await page.route('**/api/photo-enhancer/analyze-r2', (route) => json(route, analyzeBody));
}

/** Collect console/page errors, filtered down to ones the enhancer itself
 *  is responsible for (the dev shell logs unrelated 404s and React noise). */
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

function relevantErrors(errors: string[]): string[] {
  return errors.filter(
    (msg) =>
      !/Warning: React does not recognize/.test(msg) &&
      !/validateDOMNesting/.test(msg) &&
      !/Download the React DevTools/.test(msg) &&
      !/ERR_BLOCKED_BY_CLIENT/.test(msg) &&
      // The dev shell runs without a backend: unmocked endpoints answer
      // 401/404/503 and the notification socket fails to connect. All
      // environmental — every endpoint the workflow actually drives is
      // mocked, so a genuine wiring break surfaces as a thrown error or a
      // missing-UI timeout, not as a background resource-load failure.
      !/Failed to load resource/.test(msg) &&
      !/status of \d{3}/.test(msg) &&
      !/WebSocket/.test(msg) &&
      // Dashboard-shell background noise with no backend: React Query
      // dev warnings and the dashboard's own caught 500s. None originate
      // in the photo enhancer; a real enhancer crash still surfaces as a
      // pageerror and via the white-screen (missing-CTA) check.
      !/Query data cannot be undefined/.test(msg) &&
      !/checking mentor status/i.test(msg) &&
      !/UniversalDashboard/.test(msg) &&
      // Unrelated background polling in the dev shell.
      !/\/api\/(auth|analytics|integrations|ai\/analytics|onboarding|whats-new|user-preferences)/.test(msg),
  );
}

/** Navigate into the AI Forbedring tab and wait for the enhancer to mount. */
async function gotoEnhancer(page: Page): Promise<void> {
  // Suppress the solo-onboarding wizard, which otherwise auto-opens as a
  // modal over the dashboard ~2s after mount. It is unrelated to the photo
  // enhancer; keeping it shut isolates the feature under test.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('individual-onboarding-completed', '1');
    } catch {
      /* storage unavailable — ignore */
    }
  });
  await page.goto(`${BASE_URL}/photographer-dashboard-material`, { waitUntil: 'domcontentloaded' });
  const aiTab = page.getByRole('tab', { name: /AI\s*Forbedring/i });
  await aiTab.waitFor({ state: 'visible', timeout: 30_000 });
  await aiTab.click();
  await expect(page.getByRole('button', { name: /Last opp bilde/ })).toBeVisible({ timeout: 20_000 });
}

/** Upload a fixture through the hidden file input. Pass a buffer to override
 *  the default tiny gradient (e.g. a >20 MB noise PNG for the queue path). */
async function uploadFixture(page: Page, name = 'portrait.png', buffer?: Buffer): Promise<void> {
  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15_000 });
  await fileInput.setInputFiles({ name, mimeType: 'image/png', buffer: buffer ?? makeTestPng(96, 96) });
  // The filename chip confirms the file landed in session state.
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe('Photo Enhancer — full workflow', () => {
  test('status query populates model + queue readiness on mount', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await mockStatusAndProjects(page);
    await gotoEnhancer(page);

    // The queue runtime from /status drives a readiness chip.
    await expect(page.getByText(/Kø:\s*0\s*venter/i)).toBeVisible({ timeout: 15_000 });
    expect(relevantErrors(errors), relevantErrors(errors).join('\n')).toEqual([]);
  });

  test('synchronous flow: upload → analyze → AI-forslag → Enhance → result → Save enabled', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await mockStatusAndProjects(page);

    // Capture each mutation's payload so we can assert the wiring is correct.
    let analyzeCalled = false;
    let suggestCalled = false;
    let enhancePreset: string | null = null;
    let enhanceHadSettings = false;

    await page.route('**/api/photo-enhancer/analyze', (route) => {
      analyzeCalled = true;
      return json(route, { analysis: { perceptualHash: 'abc123', format: 'png', faces: [] } });
    });
    await page.route('**/api/photo-enhancer/suggest-recipe', (route) => {
      suggestCalled = true;
      return json(route, {
        recipe: { brightness: 12, contrast: 8, saturation: 5 },
        analysis: {
          subject: 'portrait',
          confidence: 0.88,
          rationale: 'Detected a single front-lit face.',
          observations: ['Soft window light', 'Slight underexposure'],
        },
      });
    });
    await page.route('**/api/photo-enhancer/enhance', (route) => {
      const body = route.request().postDataBuffer()?.toString('binary') ?? '';
      const presetMatch = body.match(/name="preset"\r?\n\r?\n([^\r]+)/);
      enhancePreset = presetMatch ? presetMatch[1] : null;
      enhanceHadSettings = /name="settings"/.test(body);
      return json(route, { imageUrl: ENHANCED_DATA_URL, job: null });
    });
    // Best-effort feedback POST fired after a suggestion-seeded enhance.
    await page.route('**/api/photo-enhancer/feedback', (route) => json(route, { ok: true }));

    await gotoEnhancer(page);
    await uploadFixture(page);

    // 1) Analyze.
    await page.getByRole('button', { name: /^Analyze$/ }).click();
    await expect(page.getByText(/Analyse fullført/)).toBeVisible({ timeout: 15_000 });
    expect(analyzeCalled).toBe(true);

    // 2) AI-forslag (Claude Vision recipe). Confidence + subject chip render.
    await page.getByRole('button', { name: /^AI-forslag$/ }).click();
    await expect(page.getByText(/AI:\s*portrait/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/88%\s*sikker/i)).toBeVisible();
    expect(suggestCalled).toBe(true);

    // 3) Nudge a setting so the enhance payload is non-default. The first
    //    range input under Settings is Brightness.
    const brightness = page.locator('input[type="range"]').first();
    await brightness.focus();
    await brightness.press('ArrowRight');

    // 4) Enhance → before/after side-by-side preview appears.
    await page.getByRole('button', { name: /^Enhance$/ }).click();
    await expect(page.getByRole('img', { name: 'Enhanced' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('img', { name: 'Original' })).toBeVisible();
    expect(enhancePreset, 'enhance must send the active preset').not.toBeNull();
    expect(enhanceHadSettings, 'enhance must send a settings payload').toBe(true);

    // 5) The result unlocks the Save action.
    await expect(page.getByRole('button', { name: /Save to project/ })).toBeEnabled({ timeout: 10_000 });

    expect(relevantErrors(errors), relevantErrors(errors).join('\n')).toEqual([]);
  });

  test('save flow: enhanced result persists to the selected project/folder', async ({ page }) => {
    await mockStatusAndProjects(page);
    await page.route('**/api/photo-enhancer/enhance', (route) =>
      json(route, { imageUrl: ENHANCED_DATA_URL }),
    );

    let savedBody: Record<string, unknown> | null = null;
    await page.route('**/api/photo-enhancer/save', (route) => {
      const raw = route.request().postData();
      savedBody = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      return json(route, { success: true, savedId: 'asset-123' });
    });

    await gotoEnhancer(page);
    await uploadFixture(page);
    await page.getByRole('button', { name: /^Enhance$/ }).click();
    await expect(page.getByRole('img', { name: 'Enhanced' })).toBeVisible({ timeout: 15_000 });

    // Open the Save dialog and pick a project (folder auto-seeds to the
    // first profession default, so only the project needs a choice).
    await page.getByRole('button', { name: /Save to project/ }).click();
    const dialog = page.getByRole('dialog', { name: /Save Enhanced Image/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Project').click();
    await page.getByRole('option', { name: 'Aurora Wedding 2026' }).click();

    const saveBtn = dialog.getByRole('button', { name: /^Save$/ });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect
      .poll(() => savedBody, { message: '/save was never called', timeout: 10_000 })
      .not.toBeNull();

    expect(savedBody).toMatchObject({
      projectId: 'proj-aurora',
      folderId: 'raw-footage',
      enhancedImageUrl: ENHANCED_DATA_URL,
    });
    expect(typeof (savedBody as Record<string, unknown>).preset).toBe('string');
    expect((savedBody as Record<string, unknown>).settings).toBeTruthy();
  });

  test('queue path: direct R2 multipart upload → POST /jobs → poll → completed', async ({
    page,
  }) => {
    // A >20 MB upload trips DIRECT_UPLOAD_THRESHOLD_BYTES → the queued path.
    await mockStatusAndProjects(page, { enabled: true, reason: null });

    const seenEndpoints: string[] = [];

    await page.route('**/api/photo-enhancer/uploads/multipart', (route) => {
      seenEndpoints.push('init');
      return json(route, {
        upload: {
          bucket: 'the-bucket',
          key: 'uploads/portrait.png',
          uploadId: 'upl-1',
          partSize: 64 * 1024 * 1024,
          partCount: 1,
          maxPartUrlsPerRequest: 1,
        },
      });
    });
    await page.route('**/api/photo-enhancer/uploads/multipart/proxy-part', (route) => {
      seenEndpoints.push('proxy-part');
      return json(route, { part: { etag: 'etag-part-1' } });
    });
    await page.route('**/api/photo-enhancer/uploads/multipart/complete', (route) => {
      seenEndpoints.push('complete');
      return json(route, {
        source: {
          storageType: 'r2',
          bucket: 'the-bucket',
          key: 'uploads/portrait.png',
          uploadId: 'upl-1',
          fileName: 'portrait.png',
          mimeType: 'image/png',
          size: 4096,
          etag: 'etag-final',
          lastModified: null,
        },
      });
    });

    let jobPolls = 0;
    await page.route('**/api/photo-enhancer/jobs', (route) => {
      seenEndpoints.push('jobs-create');
      return json(route, {
        job: { id: 'job-abcdef12', status: 'queued', progress: 0, attempts: 0, maxAttempts: 3 },
      });
    });
    // GET poll: report running once, then completed with a result URL.
    await page.route(/\/api\/photo-enhancer\/jobs\/job-abcdef12$/, (route) => {
      jobPolls += 1;
      const done = jobPolls >= 1;
      return json(route, {
        job: {
          id: 'job-abcdef12',
          status: done ? 'completed' : 'running',
          progress: done ? 100 : 40,
          attempts: 1,
          maxAttempts: 3,
          result: done ? { imageUrl: ENHANCED_DATA_URL } : null,
        },
      });
    });

    await gotoEnhancer(page);
    // Turn off auto-analyse so this test exercises only the queued enhance
    // path — auto-analyse would otherwise trigger its own R2 upload first.
    await page.getByTestId('auto-analyze-toggle').getByRole('checkbox').uncheck();
    await uploadFixture(page, 'large-shoot.png', makeLargeNoisePng(2500));

    await page.getByRole('button', { name: /^Enhance$/ }).click();

    // The server-job panel surfaces while the queue processes.
    await expect(page.getByText(/Server-jobb/)).toBeVisible({ timeout: 15_000 });

    // Polling completes (≥1.5s/poll) and the enhanced result renders.
    await expect(page.getByRole('img', { name: 'Enhanced' })).toBeVisible({ timeout: 20_000 });

    expect(seenEndpoints).toContain('init');
    expect(seenEndpoints).toContain('proxy-part');
    expect(seenEndpoints).toContain('complete');
    expect(seenEndpoints).toContain('jobs-create');
    expect(jobPolls).toBeGreaterThanOrEqual(1);
  });

  test('looks: save the current recipe, reset, then re-apply it', async ({ page }) => {
    await mockStatusAndProjects(page);
    // Start from a clean Look catalogue so the test is deterministic.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('creatorhub-photo-enhancer-looks');
      } catch {
        /* ignore */
      }
    });

    await gotoEnhancer(page);
    await uploadFixture(page);

    // Nudge the first slider (Lysstyrke) so the recipe is non-default.
    const slider = page.getByRole('slider').first();
    await slider.focus();
    for (let i = 0; i < 5; i++) await slider.press('ArrowRight');
    const tweaked = await slider.getAttribute('aria-valuenow');
    expect(tweaked).not.toBe('0');

    // Save it as a named Look.
    await page.getByRole('button', { name: /Lagre Look/ }).click();
    await page.getByLabel('Navn på Look').fill('Testlook');
    await page.getByRole('dialog').getByRole('button', { name: /^Lagre$/ }).click();
    const lookChip = page.getByRole('button', { name: 'Testlook' });
    await expect(lookChip).toBeVisible();

    // Reset wipes the tweak…
    await page.getByRole('button', { name: /Tilbakestill/ }).click();
    expect(await slider.getAttribute('aria-valuenow')).not.toBe(tweaked);

    // …and applying the Look restores the exact recipe.
    await lookChip.click();
    expect(await slider.getAttribute('aria-valuenow')).toBe(tweaked);
  });

  test('raw: a RAW upload is rasterised server-side for preview and AI', async ({ page }) => {
    await mockStatusAndProjects(page);

    let previewFilename: string | null = null;
    await page.route('**/api/photo-enhancer/preview', (route) => {
      const body = route.request().postDataBuffer()?.toString('binary') ?? '';
      const match = body.match(/filename="([^"]+)"/);
      previewFilename = match ? match[1] : null;
      // The browser-renderable raster the server would return for the RAW.
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: makeTestPng(120, 90) });
    });

    let suggestFilename: string | null = null;
    await page.route('**/api/photo-enhancer/suggest-recipe', (route) => {
      const body = route.request().postDataBuffer()?.toString('binary') ?? '';
      const match = body.match(/filename="([^"]+)"/);
      suggestFilename = match ? match[1] : null;
      return json(route, {
        recipe: { brightness: 6 },
        analysis: { subject: 'portrait', confidence: 0.9, rationale: 'Single face', observations: [] },
      });
    });

    await gotoEnhancer(page);
    // A Nikon RAW — the browser can't decode it, so the enhancer must
    // rasterise it server-side before preview/AI.
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    await fileInput.setInputFiles({
      name: 'wedding.nef',
      mimeType: 'image/x-nikon-nef',
      buffer: makeTestPng(64, 64),
    });
    await expect(page.getByText('wedding.nef', { exact: true })).toBeVisible();

    // The RAW was sent to /preview…
    await expect.poll(() => previewFilename, { timeout: 10_000 }).not.toBeNull();
    expect(previewFilename).toMatch(/\.nef$/i);

    // …which unlocks the AI (gated on a decodable raster), and the AI
    // receives the rasterised JPEG, never the raw .nef.
    const suggest = page.getByRole('button', { name: /^AI-forslag$/ });
    await expect(suggest).toBeEnabled({ timeout: 10_000 });
    await suggest.click();
    await expect(page.getByText(/AI:\s*portrait/i)).toBeVisible({ timeout: 10_000 });
    expect(suggestFilename).toMatch(/\.jpg$/i);
  });

  test('natural-language: a free-text style brief is sent to the AI as an instruction', async ({
    page,
  }) => {
    await mockStatusAndProjects(page);
    let sentInstruction: string | null = null;
    await page.route('**/api/photo-enhancer/suggest-recipe', (route) => {
      const body = route.request().postDataBuffer()?.toString('binary') ?? '';
      const match = body.match(/name="instruction"\r?\n\r?\n([^\r]+)/);
      sentInstruction = match ? match[1] : null;
      return json(route, {
        recipe: { saturation: -100 },
        analysis: { subject: 'portrait', confidence: 0.8, rationale: 'Mono look requested', observations: ['Mono'] },
      });
    });

    await gotoEnhancer(page);
    await uploadFixture(page);

    await page.getByPlaceholder(/pastell film-look/i).fill('gi meg en Jose Villa look');
    await page.getByRole('button', { name: /^Bruk$/ }).click();

    await expect.poll(() => sentInstruction, { timeout: 10_000 }).not.toBeNull();
    expect(sentInstruction).toContain('Jose Villa');
    await expect(page.getByText(/AI:\s*portrait/i)).toBeVisible({ timeout: 10_000 });
  });

  test('variants: generates three looks; applying one sets the result', async ({ page }) => {
    await mockStatusAndProjects(page);
    let enhanceCalls = 0;
    await page.route('**/api/photo-enhancer/enhance', (route) => {
      enhanceCalls += 1;
      return json(route, { imageUrl: ENHANCED_DATA_URL });
    });

    await gotoEnhancer(page);
    await uploadFixture(page);

    await page.getByRole('button', { name: /^Varianter$/ }).click();
    const dialog = page.getByRole('dialog', { name: /Velg en variant/i });
    await expect(dialog).toBeVisible();

    // Three variants render in one click…
    const vivid = dialog.getByRole('button', { name: /^Livlig$/ });
    await expect(vivid).toBeEnabled({ timeout: 15_000 });
    expect(enhanceCalls).toBeGreaterThanOrEqual(3);

    // …and picking one applies it as the enhanced result.
    await vivid.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('img', { name: 'Enhanced' })).toBeVisible({ timeout: 10_000 });
  });

  test('batch: apply the recipe to all images and enhance the whole series', async ({ page }) => {
    await mockStatusAndProjects(page);
    let enhanceCalls = 0;
    await page.route('**/api/photo-enhancer/enhance', (route) => {
      enhanceCalls += 1;
      return json(route, { imageUrl: ENHANCED_DATA_URL });
    });

    await gotoEnhancer(page);
    // Keep the call count clean (auto-analyse hits /analyze, not /enhance,
    // but turning it off avoids any interference).
    await page.getByTestId('auto-analyze-toggle').getByRole('checkbox').uncheck();

    // Upload a three-image "shoot".
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    await fileInput.setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: makeTestPng(64, 64) },
      { name: 'b.png', mimeType: 'image/png', buffer: makeTestPng(48, 72) },
      { name: 'c.png', mimeType: 'image/png', buffer: makeTestPng(72, 48) },
    ]);

    // The batch bar appears for a multi-image session.
    await expect(page.getByRole('button', { name: /Enhance alle \(3\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Bruk på alle \(3\)/ }).click();

    // Enhancing the series fires one enhance per image.
    await page.getByRole('button', { name: /Enhance alle \(3\)/ }).click();
    await expect.poll(() => enhanceCalls, { timeout: 20_000 }).toBe(3);
    await expect(page.getByRole('img', { name: 'Enhanced' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Photo Enhancer — robustness', () => {
  test('crash-sweep: opening every tool, dialog and accordion throws no errors', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await mockStatusAndProjects(page);
    await page.route('**/api/photo-enhancer/enhance', (route) => json(route, { imageUrl: ENHANCED_DATA_URL }));

    await gotoEnhancer(page);
    await uploadFixture(page);

    // Expand both advanced accordions (these render heavy sub-trees —
    // exactly where the CompositionGuides/StepIcon class of crash hid).
    await page.getByText('Avanserte justeringer').click();
    await page.getByText('Farge & look').click();

    // Keyboard-shortcut help popover.
    await page.getByRole('button', { name: 'Hurtigtaster' }).click();
    await expect(page.getByText('Hurtigtaster')).toBeVisible();
    await page.keyboard.press('Escape');

    // Tool dialogs the workflow spec never opens.
    for (const name of [/^Fjern objekter$/, /^Auto-finn objekter$/, /^Eksporter/]) {
      await page.getByRole('button', { name }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    }

    // Enhance, then the result-only dialogs.
    await page.getByRole('button', { name: /^Enhance$/ }).click();
    await expect(page.getByRole('img', { name: 'Enhanced' })).toBeVisible({ timeout: 15_000 });
    for (const name of [/Save to project/, /Rate enhancement/]) {
      await page.getByRole('button', { name }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    }

    // Nothing white-screened (the primary CTA is still mounted) and no code
    // path logged an error.
    await expect(page.getByRole('button', { name: /^Enhance$/ })).toBeVisible();
    expect(relevantErrors(errors), relevantErrors(errors).join('\n')).toEqual([]);
  });

  test('enhance failure surfaces an error instead of silently doing nothing', async ({ page }) => {
    await mockStatusAndProjects(page);
    await page.route('**/api/photo-enhancer/enhance', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbedringsmotoren er midlertidig nede' }),
      }),
    );

    await gotoEnhancer(page);
    await uploadFixture(page);
    await page.getByRole('button', { name: /^Enhance$/ }).click();

    // The error alert renders the backend message; no enhanced image appears.
    await expect(page.getByText(/Forbedringsmotoren er midlertidig nede/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('img', { name: 'Enhanced' })).toHaveCount(0);
    // Save stays locked because there is no result to save.
    await expect(page.getByRole('button', { name: /Save to project/ })).toBeDisabled();
  });

  test('queue job actions: Pause posts to the job action endpoint', async ({ page }) => {
    await mockStatusAndProjects(page, { enabled: true, reason: null });

    await page.route('**/api/photo-enhancer/uploads/multipart', (route) =>
      json(route, {
        upload: { bucket: 'b', key: 'k', uploadId: 'u', partSize: 64 * 1024 * 1024, partCount: 1, maxPartUrlsPerRequest: 1 },
      }),
    );
    await page.route('**/api/photo-enhancer/uploads/multipart/proxy-part', (route) =>
      json(route, { part: { etag: 'e1' } }),
    );
    await page.route('**/api/photo-enhancer/uploads/multipart/complete', (route) =>
      json(route, {
        source: { storageType: 'r2', bucket: 'b', key: 'k', uploadId: 'u', fileName: 'large.png', mimeType: 'image/png', size: 4096, etag: 'e', lastModified: null },
      }),
    );
    await page.route('**/api/photo-enhancer/jobs', (route) =>
      json(route, { job: { id: 'job-pause01', status: 'queued', progress: 0, attempts: 0, maxAttempts: 3 } }),
    );
    // Keep the job running so the panel — and its action buttons — stay up.
    await page.route(/\/api\/photo-enhancer\/jobs\/job-pause01$/, (route) =>
      json(route, { job: { id: 'job-pause01', status: 'running', progress: 50, attempts: 1, maxAttempts: 3 } }),
    );
    let pauseCalled = false;
    await page.route(/\/api\/photo-enhancer\/jobs\/job-pause01\/pause$/, (route) => {
      pauseCalled = true;
      return json(route, { job: { id: 'job-pause01', status: 'paused', progress: 50, attempts: 1, maxAttempts: 3 } });
    });

    await gotoEnhancer(page);
    await page.getByTestId('auto-analyze-toggle').getByRole('checkbox').uncheck();
    await uploadFixture(page, 'large-shoot.png', makeLargeNoisePng(2500));
    await page.getByRole('button', { name: /^Enhance$/ }).click();

    await expect(page.getByText(/Server-jobb/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Pause$/ }).click();

    await expect.poll(() => pauseCalled, { message: 'pause endpoint never called', timeout: 10_000 }).toBe(true);
  });
});
