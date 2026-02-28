import { test, expect, type ConsoleMessage, type Page, type Request } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORY_ARC_ROUTE = '/story-arc-studio';
const FIXTURE_DURATION_SECONDS = 8;
const FIXTURE_PATH = path.join(os.tmpdir(), 'storyarc-regression-fixture.mp4');

type RuntimeErrorCollector = {
  browserRuntimeErrors: string[];
  stop: () => void;
};

type EditorHookSnapshot = {
  clipId: string;
  trackId: string;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
};

type EditorHookClip = {
  clipId: string;
  trackId: string;
  start: number;
  duration: number;
  name: string;
  sourceFile: string;
};

type EditorHookFixtureSeed = {
  primaryClipId: string;
  clipIds: string[];
  trackId: string;
  sourceFile: string;
};

type EditorHookApi = {
  selectClipById: (clipId: string) => boolean;
  listClips: () => EditorHookClip[];
  snapshot: (clipId?: string) => EditorHookSnapshot | null;
  trimSelected: (edge: 'in' | 'out', frames: number) => boolean;
  slipSelected: (frames: number) => boolean;
  slideSelected: (frames: number) => boolean;
  rollSelected: (frames: number) => boolean;
  setPlayhead: (seconds: number) => void;
  seedTimelineFixture: () => EditorHookFixtureSeed | null;
};

async function callEditorHook<
  K extends keyof EditorHookApi
>(
  page: Page,
  method: K,
  ...args: Parameters<EditorHookApi[K]>
): Promise<ReturnType<EditorHookApi[K]>> {
  return page.evaluate(({ methodName, params }) => {
    const context = window as Window & { __storyArcEditorTestHook?: EditorHookApi };
    const hook = context.__storyArcEditorTestHook;
    if (!hook) {
      throw new Error('Story Arc editor test hook is not available.');
    }
    const method = hook[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Story Arc editor test hook method "${methodName}" is not available.`);
    }
    return method(...params) as ReturnType<EditorHookApi[K]>;
  }, { methodName: method, params: args });
}

async function waitForSnapshotChange(
  page: Page,
  clipId: string,
  hasChanged: (snapshot: EditorHookSnapshot) => boolean,
  timeoutMs: number,
  errorMessage: string
): Promise<EditorHookSnapshot> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await callEditorHook(page, 'snapshot', clipId);
    if (snapshot && hasChanged(snapshot)) {
      return snapshot;
    }
    await page.waitForTimeout(120);
  }
  throw new Error(errorMessage);
}

async function waitForSelectedClip(
  page: Page,
  clipId: string,
  timeoutMs: number
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const selected = await callEditorHook(page, 'snapshot');
    if (selected?.clipId === clipId) {
      return;
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`Editor did not select clip "${clipId}" within timeout.`);
}

async function seedAndSelectPrimaryFixture(page: Page): Promise<EditorHookFixtureSeed> {
  const seeded = await callEditorHook(page, 'seedTimelineFixture');
  expect(seeded).not.toBeNull();
  if (!seeded) {
    throw new Error('Failed to seed deterministic Story Arc fixture.');
  }

  const startedAt = Date.now();
  let selected = false;
  while (Date.now() - startedAt < 8_000) {
    const byId = await callEditorHook(page, 'snapshot', seeded.primaryClipId);
    if (byId) {
      const didSelect = await callEditorHook(page, 'selectClipById', seeded.primaryClipId);
      if (didSelect) {
        selected = true;
        break;
      }
    }
    await page.waitForTimeout(120);
  }
  expect(selected).toBe(true);
  return seeded;
}

async function resolveEditableClipCandidates(page: Page, fixtureName: string): Promise<string[]> {
  const clips = await callEditorHook(page, 'listClips');
  const nonAudioClips = clips
    .filter((clip) => !clip.trackId.toLowerCase().startsWith('audio'))
    .filter((clip) => clip.duration > 0);

  if (nonAudioClips.length === 0) {
    throw new Error('No editable non-audio clips available in timeline.');
  }

  const hasRightNeighbor = (candidate: EditorHookClip): boolean => {
    return nonAudioClips.some(
      (other) =>
        other.clipId !== candidate.clipId &&
        other.trackId === candidate.trackId &&
        other.start >= candidate.start + candidate.duration - 0.001
    );
  };

  const priorityBuckets: EditorHookClip[][] = [
    nonAudioClips.filter((clip) => clip.sourceFile.includes(fixtureName) && hasRightNeighbor(clip)),
    nonAudioClips.filter(
      (clip) =>
        (clip.clipId.startsWith('insert_') || clip.clipId.startsWith('overwrite_')) &&
        hasRightNeighbor(clip)
    ),
    nonAudioClips.filter((clip) => hasRightNeighbor(clip)),
    nonAudioClips.filter((clip) => clip.sourceFile.includes(fixtureName)),
    nonAudioClips.filter(
      (clip) => clip.clipId.startsWith('insert_') || clip.clipId.startsWith('overwrite_')
    ),
    nonAudioClips,
  ];

  const orderedIds: string[] = [];
  for (const bucket of priorityBuckets) {
    for (const clip of bucket) {
      if (!orderedIds.includes(clip.clipId)) {
        orderedIds.push(clip.clipId);
      }
    }
  }
  return orderedIds;
}

async function setToolbarToggle(page: Page, label: string, enabled: boolean): Promise<void> {
  const button = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  const isEnabled = await button.evaluate((element) => element.className.includes('MuiButton-contained'));
  if (isEnabled !== enabled) {
    await button.click();
  }
}

function collectRuntimeErrors(page: Page): RuntimeErrorCollector {
  const browserRuntimeErrors: string[] = [];

  const onPageError = (error: Error) => {
    browserRuntimeErrors.push(`[pageerror] ${error.message}`);
  };

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const location = msg.location();
    const locationText = location.url
      ? ` @ ${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`
      : '';
    if (
      text.includes('Download the React DevTools') ||
      text.includes('404 (Not Found)') ||
      text.includes('[Vercel Speed Insights]') ||
      text.includes('The resource <URL> was preloaded') ||
      text.includes('WebSocket connection')
    ) {
      return;
    }
    browserRuntimeErrors.push(`[console:error] ${text}${locationText}`);
  };

  const onRequestFailed = (request: Request) => {
    if (request.resourceType() === 'websocket') return;
    const requestUrl = request.url();
    const failureText = request.failure()?.errorText ?? 'unknown request failure';
    if (
      requestUrl.includes('google-analytics.com/') ||
      requestUrl.includes('googletagmanager.com/') ||
      requestUrl.includes('doubleclick.net/') ||
      (requestUrl.startsWith('blob:') && failureText.includes('ERR_ABORTED'))
    ) {
      return;
    }
    browserRuntimeErrors.push(`[requestfailed] ${failureText} @ ${requestUrl}`);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);

  return {
    browserRuntimeErrors,
    stop: () => {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

function ensureRegressionVideoFixture(): string {
  const ffmpegArgs = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=size=1280x720:rate=30:duration=${FIXTURE_DURATION_SECONDS}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=660:sample_rate=44100:duration=${FIXTURE_DURATION_SECONDS}`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    FIXTURE_PATH,
  ];

  const result = spawnSync('ffmpeg', ffmpegArgs, {
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  if (result.status !== 0 || !existsSync(FIXTURE_PATH)) {
    throw new Error(`Failed to create regression fixture video: ${result.stderr || result.stdout}`);
  }

  return FIXTURE_PATH;
}

async function gotoStoryArcStudio(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('storyArcStudio_onboardingCompleted', 'true');
  });
  await page.goto(STORY_ARC_ROUTE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('Story Arc Studio').first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Source / Program Monitors').first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('storyarc-asset-browser')).toBeVisible({ timeout: 60_000 });
}

async function dismissBlockingDialogs(page: Page) {
  const onboardingHeading = page.getByText('Story Arc Studio Onboarding').first();
  const onboardingVisible = await onboardingHeading
    .isVisible({ timeout: 3_000 })
    .catch(() => false);

  if (!onboardingVisible) return;

  const skipButton = page.getByRole('button', { name: /^Skip$/i }).first();
  if (await skipButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipButton.click();
  }

  const closeButton = page.getByRole('button', { name: /^Close$/i }).last();
  if (await closeButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeButton.click();
  }

  await expect(page.getByText('Story Arc Studio Onboarding').first()).toHaveCount(0, { timeout: 10_000 });
}

test.describe('Story Arc Regression', () => {
  test('upload -> auto-bind -> program monitor, insert/overwrite, auto-captions', async ({ page }) => {
    test.setTimeout(420_000);
    const fixturePath = ensureRegressionVideoFixture();
    const fixtureName = path.basename(fixturePath);
    const runtimeErrors = collectRuntimeErrors(page);

    try {
      await gotoStoryArcStudio(page);
      await dismissBlockingDialogs(page);

      await page.getByTestId('asset-tab-media').click();
      await page.getByTestId('asset-subtab-local').click();
      await page.getByTestId('asset-upload-toggle').click();

      await page.getByTestId('universal-file-upload-input').setInputFiles(fixturePath);

      const uploadedCard = page
        .locator('[data-testid^="asset-media-card-"]')
        .filter({ hasText: fixtureName })
        .first();
      await expect(uploadedCard).toBeVisible({ timeout: 90_000 });

      await uploadedCard.getByRole('button', { name: /Add to timeline/i }).click();
      await page.getByTestId('asset-add-dialog-confirm').click();

      const sourceVideo = page.getByTestId('source-monitor-video');
      const programVideo = page.getByTestId('program-monitor-video');

      await expect(sourceVideo).toBeVisible({ timeout: 60_000 });
      await expect(programVideo).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText('No video clip available for preview')).toHaveCount(0);

      await page.getByTestId('monitor-guides-toggle').click();
      await expect(page.getByTestId('source-monitor-composition-overlay')).toBeVisible();
      await expect(page.getByTestId('program-monitor-composition-overlay')).toBeVisible();
      await page.getByTestId('monitor-guides-settings').click();
      await expect(page.getByTestId('composition-guides-dialog')).toBeVisible();
      await page.getByTestId('composition-guide-target-select').click();
      await page.getByRole('option', { name: 'Program only' }).click();
      await page.getByTestId('composition-aspect-mask-select').click();
      await page.getByRole('option', { name: '2.39:1' }).click();
      await page.getByTestId('composition-guides-done').click();
      await expect(page.getByTestId('composition-guides-dialog')).toHaveCount(0);
      await expect(page.getByTestId('source-monitor-composition-overlay')).toHaveCount(0);
      await expect(page.getByTestId('program-monitor-composition-overlay')).toBeVisible();

      await page.getByTestId('source-monitor-panel').click();
      await expect(page.getByTestId('active-monitor-chip')).toContainText('SRC');
      await expect(page.getByTestId('program-mark-in-chip')).toContainText('--:--:--');
      await page.getByTestId('active-mark-in').click();
      await expect(page.getByTestId('source-mark-in-chip')).not.toContainText('--:--:--');

      await page.getByTestId('program-monitor-panel').click();
      await expect(page.getByTestId('active-monitor-chip')).toContainText('PGM');
      await page.getByTestId('active-mark-in').click();
      await expect(page.getByTestId('program-mark-in-chip')).not.toContainText('--:--:--');

      await page.getByTestId('source-step-forward').click();
      await page.getByTestId('source-step-forward').click();
      await page.getByTestId('source-mark-in-button').click();
      for (let index = 0; index < 40; index += 1) {
        await page.getByTestId('source-step-forward').click();
      }
      await page.getByTestId('source-mark-out-button').click();

      await page.getByTestId('source-insert-button').click();
      await expect(page.getByText('Inserted source clip into timeline')).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('program-mark-in-button').click();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.getByTestId('program-mark-out-button').click();
      await page.getByTestId('source-overwrite-button').click();
      await expect(page.getByText(/Overwrote timeline with source clip/)).toBeVisible({ timeout: 30_000 });

      for (let index = 0; index < 20; index += 1) {
        await page.keyboard.press('ArrowRight');
      }
      await page.getByTestId('source-insert-button').click();
      await expect(page.getByText('Inserted source clip into timeline')).toBeVisible({ timeout: 30_000 });

      await setToolbarToggle(page, 'Magnetic', false);
      await setToolbarToggle(page, 'Ripple', false);

      await page.getByRole('button', { name: 'Trim (T)' }).click();
      const trimSeed = await seedAndSelectPrimaryFixture(page);
      const trimBefore = await callEditorHook(page, 'snapshot', trimSeed.primaryClipId);
      expect(trimBefore).not.toBeNull();
      expect(await callEditorHook(page, 'trimSelected', 'out', 10)).toBe(true);
      await waitForSnapshotChange(
        page,
        trimSeed.primaryClipId,
        (snapshot) => Math.abs(snapshot.duration - (trimBefore as EditorHookSnapshot).duration) > 0.0001,
        8_000,
        'Trim operation did not update fixture clip duration.'
      );

      await page.getByRole('button', { name: 'Slip (Y)' }).click();
      const slipSeed = await seedAndSelectPrimaryFixture(page);
      const slipBefore = await callEditorHook(page, 'snapshot', slipSeed.primaryClipId);
      expect(slipBefore).not.toBeNull();
      expect(await callEditorHook(page, 'slipSelected', 8)).toBe(true);
      await waitForSnapshotChange(
        page,
        slipSeed.primaryClipId,
        (snapshot) => Math.abs(snapshot.inPoint - (slipBefore as EditorHookSnapshot).inPoint) > 0.0001,
        8_000,
        'Slip operation did not update fixture inPoint.'
      );

      await page.getByRole('button', { name: 'Slide (U)' }).click();
      const slideSeed = await seedAndSelectPrimaryFixture(page);
      const slideBefore = await callEditorHook(page, 'snapshot', slideSeed.primaryClipId);
      expect(slideBefore).not.toBeNull();
      expect(await callEditorHook(page, 'slideSelected', 6)).toBe(true);
      await waitForSnapshotChange(
        page,
        slideSeed.primaryClipId,
        (snapshot) => Math.abs(snapshot.start - (slideBefore as EditorHookSnapshot).start) > 0.0001,
        8_000,
        'Slide operation did not update fixture start.'
      );

      await page.getByRole('button', { name: 'Roll (R)' }).click();
      const rollSeed = await seedAndSelectPrimaryFixture(page);
      const rightNeighborId = rollSeed.clipIds[2];
      const rollBeforePrimary = await callEditorHook(page, 'snapshot', rollSeed.primaryClipId);
      const rollBeforeRight = await callEditorHook(page, 'snapshot', rightNeighborId);
      expect(rollBeforePrimary).not.toBeNull();
      expect(rollBeforeRight).not.toBeNull();
      expect(await callEditorHook(page, 'rollSelected', 6)).toBe(true);
      await waitForSnapshotChange(
        page,
        rollSeed.primaryClipId,
        (snapshot) => Math.abs(snapshot.duration - (rollBeforePrimary as EditorHookSnapshot).duration) > 0.0001,
        8_000,
        'Roll operation did not update fixture primary duration.'
      );
      await waitForSnapshotChange(
        page,
        rightNeighborId,
        (snapshot) => Math.abs(snapshot.duration - (rollBeforeRight as EditorHookSnapshot).duration) > 0.0001,
        8_000,
        'Roll operation did not update fixture right duration.'
      );

      await page.getByTestId('open-sync-dialog').click();
      await expect(page.getByText('Sync Multi-Angle Clips')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('sync-run-button').click();
      await expect(page.getByText('Sync Results & Manual Adjustment')).toBeVisible({ timeout: 120_000 });
      await page.getByTestId('sync-apply-button').click();
      await expect(page.getByText('Sync Multi-Angle Clips')).toHaveCount(0, { timeout: 20_000 });

      // Re-select uploaded media explicitly to make it the active caption source.
      await uploadedCard.click();

      await page.getByTestId('open-auto-captions').click();
      await expect(page.getByTestId('auto-captions-dialog')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('auto-captions-generate').click();

      await expect(
        page.getByText(/Captions generated \(\d+ segments\)\. Export ready in Effects Dock\./)
      ).toBeVisible({
        timeout: 300_000,
      });
      await expect(page.getByTestId('auto-captions-dialog')).toHaveCount(0, { timeout: 30_000 });
    } finally {
      runtimeErrors.stop();
    }

    expect(runtimeErrors.browserRuntimeErrors).toEqual([]);
  });
});
