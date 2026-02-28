import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORY_ARC_ROUTE = '/story-arc-studio';
const FIXTURE_DURATION_SECONDS = 8;
const FIXTURE_PATH = path.join(os.tmpdir(), 'storyarc-edit-tools-fixture.mp4');

type EditorHookSnapshot = {
  clipId: string;
  trackId: string;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
};

type EditorHookFixtureSeed = {
  primaryClipId: string;
  clipIds: string[];
  trackId: string;
  sourceFile: string;
};

type EditorHookApi = {
  selectClipById: (clipId: string) => boolean;
  snapshot: (clipId?: string) => EditorHookSnapshot | null;
  trimSelected: (edge: 'in' | 'out', frames: number) => boolean;
  slipSelected: (frames: number) => boolean;
  slideSelected: (frames: number) => boolean;
  rollSelected: (frames: number) => boolean;
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
    const target = hook[methodName];
    if (typeof target !== 'function') {
      throw new Error(`Story Arc editor test hook method "${methodName}" is not available.`);
    }
    return target(...params) as ReturnType<EditorHookApi[K]>;
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
    await page.waitForTimeout(100);
  }
  throw new Error(errorMessage);
}

async function setToolbarToggle(page: Page, label: string, enabled: boolean): Promise<void> {
  const button = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  const isEnabled = await button.evaluate((element) => element.className.includes('MuiButton-contained'));
  if (isEnabled !== enabled) {
    await button.click();
  }
}

function ensureFixtureVideo(): string {
  const ffmpegArgs = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=size=1280x720:rate=30:duration=${FIXTURE_DURATION_SECONDS}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:sample_rate=44100:duration=${FIXTURE_DURATION_SECONDS}`,
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
    throw new Error(`Failed to create Story Arc fixture video: ${result.stderr || result.stdout}`);
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
  await expect(page.getByTestId('storyarc-asset-browser')).toBeVisible({ timeout: 90_000 });
}

async function dismissBlockingDialogs(page: Page) {
  const onboardingHeading = page.getByText('Story Arc Studio Onboarding').first();
  const onboardingVisible = await onboardingHeading.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!onboardingVisible) {
    return;
  }

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

async function seedAndSelectPrimary(page: Page): Promise<EditorHookFixtureSeed> {
  const seeded = await callEditorHook(page, 'seedTimelineFixture');
  expect(seeded).not.toBeNull();
  if (!seeded) {
    throw new Error('Failed to seed deterministic timeline fixture.');
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

test.describe('Story Arc Isolated Edit Tools', () => {
  test('hard-pass trim/slip/slide/roll over seeded fixture', async ({ page }) => {
    test.setTimeout(360_000);
    const fixturePath = ensureFixtureVideo();
    const fixtureName = path.basename(fixturePath);

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

    await expect(page.getByTestId('source-monitor-video')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('program-monitor-video')).toBeVisible({ timeout: 60_000 });

    await setToolbarToggle(page, 'Magnetic', false);
    await setToolbarToggle(page, 'Ripple', false);

    await page.getByRole('button', { name: 'Trim (T)' }).click();
    const trimSeed = await seedAndSelectPrimary(page);
    const trimBefore = await callEditorHook(page, 'snapshot', trimSeed.primaryClipId);
    expect(trimBefore).not.toBeNull();
    expect(await callEditorHook(page, 'trimSelected', 'out', 10)).toBe(true);
    const trimAfter = await waitForSnapshotChange(
      page,
      trimSeed.primaryClipId,
      (snapshot) => Math.abs(snapshot.duration - (trimBefore as EditorHookSnapshot).duration) > 0.0001,
      8_000,
      'Trim operation did not update fixture clip duration.'
    );
    expect(trimAfter.duration).toBeGreaterThan((trimBefore as EditorHookSnapshot).duration);

    await page.getByRole('button', { name: 'Slip (Y)' }).click();
    const slipSeed = await seedAndSelectPrimary(page);
    const slipBefore = await callEditorHook(page, 'snapshot', slipSeed.primaryClipId);
    expect(slipBefore).not.toBeNull();
    expect(await callEditorHook(page, 'slipSelected', 8)).toBe(true);
    const slipAfter = await waitForSnapshotChange(
      page,
      slipSeed.primaryClipId,
      (snapshot) => Math.abs(snapshot.inPoint - (slipBefore as EditorHookSnapshot).inPoint) > 0.0001,
      8_000,
      'Slip operation did not update fixture inPoint.'
    );
    expect(Math.abs(slipAfter.duration - (slipBefore as EditorHookSnapshot).duration)).toBeLessThan(0.0001);
    expect(Math.abs(slipAfter.start - (slipBefore as EditorHookSnapshot).start)).toBeLessThan(0.0001);

    await page.getByRole('button', { name: 'Slide (U)' }).click();
    const slideSeed = await seedAndSelectPrimary(page);
    const slideBefore = await callEditorHook(page, 'snapshot', slideSeed.primaryClipId);
    expect(slideBefore).not.toBeNull();
    expect(await callEditorHook(page, 'slideSelected', 6)).toBe(true);
    const slideAfter = await waitForSnapshotChange(
      page,
      slideSeed.primaryClipId,
      (snapshot) => Math.abs(snapshot.start - (slideBefore as EditorHookSnapshot).start) > 0.0001,
      8_000,
      'Slide operation did not update fixture start.'
    );
    expect(Math.abs(slideAfter.duration - (slideBefore as EditorHookSnapshot).duration)).toBeLessThan(0.0001);

    await page.getByRole('button', { name: 'Roll (R)' }).click();
    const rollSeed = await seedAndSelectPrimary(page);
    const rightNeighborId = rollSeed.clipIds[2];
    const rollBeforePrimary = await callEditorHook(page, 'snapshot', rollSeed.primaryClipId);
    const rollBeforeRight = await callEditorHook(page, 'snapshot', rightNeighborId);
    expect(rollBeforePrimary).not.toBeNull();
    expect(rollBeforeRight).not.toBeNull();
    expect(await callEditorHook(page, 'rollSelected', 6)).toBe(true);

    const rollAfterPrimary = await waitForSnapshotChange(
      page,
      rollSeed.primaryClipId,
      (snapshot) => Math.abs(snapshot.duration - (rollBeforePrimary as EditorHookSnapshot).duration) > 0.0001,
      8_000,
      'Roll operation did not update primary fixture duration.'
    );
    const rollAfterRight = await waitForSnapshotChange(
      page,
      rightNeighborId,
      (snapshot) => Math.abs(snapshot.duration - (rollBeforeRight as EditorHookSnapshot).duration) > 0.0001,
      8_000,
      'Roll operation did not update right fixture duration.'
    );

    expect(rollAfterPrimary.duration).toBeGreaterThan((rollBeforePrimary as EditorHookSnapshot).duration);
    expect(rollAfterRight.duration).toBeLessThan((rollBeforeRight as EditorHookSnapshot).duration);
  });
});
