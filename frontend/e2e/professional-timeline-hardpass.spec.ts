import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORY_ARC_ROUTE = '/story-arc-studio';
const FIXTURE_DURATION_SECONDS = 8;
const FIXTURE_PATH = path.join(os.tmpdir(), 'storyarc-professional-timeline-fixture.mp4');

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

type StoryArcEditorHookApi = {
  selectClipById: (clipId: string) => boolean;
  listClips: () => Array<{
    clipId: string;
    trackId: string;
    trackType: 'video' | 'audio' | 'adjustment' | 'subtitle' | 'graphics';
    start: number;
    duration: number;
    name: string;
    sourceFile: string;
  }>;
  snapshot: (clipId?: string) => EditorHookSnapshot | null;
  seedTimelineFixture: () => EditorHookFixtureSeed | null;
};

type ProfessionalTimelineHookApi = {
  getSelectedClipIds: () => string[];
  getInOut: () => { inPoint: number | null; outPoint: number | null };
  getMarkers: () => Array<{ id: string; time: number; label?: string }>;
  getPlayhead: () => number;
  addMarkerAtPlayhead: () => void;
  clearMarkers: () => void;
  setPlayhead: (seconds: number) => void;
  setInPointAtPlayhead: () => void;
  setOutPointAtPlayhead: () => void;
  clearInOutPoints: () => void;
  jumpToPreviousMarker: () => void;
  jumpToNextMarker: () => void;
  nudgeSelectedByFrames: (frames: number) => boolean;
  selectClipsByTimeRange: (startTime: number, endTime: number, trackIds?: string[]) => string[];
  getSnappedTime: (timeSeconds: number, ignoreClipId?: string) => number;
  dropMedia: (
    media: {
      id?: string;
      name?: string;
      url?: string;
      type?: string;
      mimeType?: string;
      duration?: number;
      camera?: string;
      syncGroup?: string;
      tags?: string[];
    },
    trackId: string,
    startTime: number
  ) => boolean;
};

async function callStoryArcHook<K extends keyof StoryArcEditorHookApi>(
  page: Page,
  method: K,
  ...args: Parameters<StoryArcEditorHookApi[K]>
): Promise<ReturnType<StoryArcEditorHookApi[K]>> {
  return page.evaluate(
    ({ methodName, params }) => {
      const context = window as Window & { __storyArcEditorTestHook?: StoryArcEditorHookApi };
      const hook = context.__storyArcEditorTestHook;
      if (!hook) {
        throw new Error('Story Arc editor test hook is not available.');
      }
      const targetMethod = hook[methodName];
      if (typeof targetMethod !== 'function') {
        throw new Error(`Story Arc editor hook method "${String(methodName)}" is not available.`);
      }
      return targetMethod(...params) as ReturnType<StoryArcEditorHookApi[K]>;
    },
    { methodName: method, params: args }
  );
}

async function callProfessionalTimelineHook<K extends keyof ProfessionalTimelineHookApi>(
  page: Page,
  method: K,
  ...args: Parameters<ProfessionalTimelineHookApi[K]>
): Promise<ReturnType<ProfessionalTimelineHookApi[K]>> {
  return page.evaluate(
    ({ methodName, params }) => {
      const context = window as Window & { __professionalTimelineTestHook?: ProfessionalTimelineHookApi };
      const hook = context.__professionalTimelineTestHook;
      if (!hook) {
        throw new Error('Professional timeline test hook is not available.');
      }
      const targetMethod = hook[methodName];
      if (typeof targetMethod !== 'function') {
        throw new Error(`Professional timeline hook method "${String(methodName)}" is not available.`);
      }
      return targetMethod(...params) as ReturnType<ProfessionalTimelineHookApi[K]>;
    },
    { methodName: method, params: args }
  );
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
    throw new Error(`Failed to create ProfessionalTimeline fixture video: ${result.stderr || result.stdout}`);
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

async function waitForSnapshotChange(
  page: Page,
  clipId: string,
  hasChanged: (snapshot: EditorHookSnapshot) => boolean,
  timeoutMs: number,
  errorMessage: string
): Promise<EditorHookSnapshot> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await callStoryArcHook(page, 'snapshot', clipId);
    if (snapshot && hasChanged(snapshot)) {
      return snapshot;
    }
    await page.waitForTimeout(120);
  }
  throw new Error(errorMessage);
}

async function waitForEditorHooks(page: Page, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const hooksReady = await page.evaluate(() => {
      const context = window as Window & {
        __storyArcEditorTestHook?: unknown;
        __professionalTimelineTestHook?: unknown;
      };
      return Boolean(context.__storyArcEditorTestHook && context.__professionalTimelineTestHook);
    });
    if (hooksReady) {
      return;
    }
    await page.waitForTimeout(120);
  }
  throw new Error('Editor hooks were not available within timeout.');
}

test.describe('ProfessionalTimeline hard-pass regression', () => {
  test('marquee, nudge, in/out, marker-nav, drop, snap are deterministic', async ({ page }) => {
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

    await waitForEditorHooks(page, 60_000);

    const seeded = await callStoryArcHook(page, 'seedTimelineFixture');
    expect(seeded).not.toBeNull();
    if (!seeded) {
      throw new Error('Failed to seed deterministic fixture for ProfessionalTimeline hard-pass test.');
    }

    const seedWaitStart = Date.now();
    let primarySelected = false;
    while (Date.now() - seedWaitStart < 8_000) {
      const seededSnapshot = await callStoryArcHook(page, 'snapshot', seeded.primaryClipId);
      if (seededSnapshot) {
        primarySelected = await callStoryArcHook(page, 'selectClipById', seeded.primaryClipId);
        if (primarySelected) {
          break;
        }
      }
      await page.waitForTimeout(120);
    }
    expect(primarySelected).toBe(true);

    const marqueeSelected = await callProfessionalTimelineHook(page, 'selectClipsByTimeRange', 0, 12, [seeded.trackId]);
    expect(marqueeSelected.length).toBeGreaterThanOrEqual(2);

    const marqueeStart = Date.now();
    let selectedIdsAfterMarquee = await callProfessionalTimelineHook(page, 'getSelectedClipIds');
    while (Date.now() - marqueeStart < 4_000 && selectedIdsAfterMarquee.length < 2) {
      await page.waitForTimeout(120);
      selectedIdsAfterMarquee = await callProfessionalTimelineHook(page, 'getSelectedClipIds');
    }
    expect(selectedIdsAfterMarquee.length).toBeGreaterThanOrEqual(2);

    await callStoryArcHook(page, 'selectClipById', seeded.primaryClipId);
    const beforeNudge = await callStoryArcHook(page, 'snapshot', seeded.primaryClipId);
    expect(beforeNudge).not.toBeNull();

    const nudgeApplied = await callProfessionalTimelineHook(page, 'nudgeSelectedByFrames', 6);
    expect(nudgeApplied).toBe(true);

    const afterNudge = await waitForSnapshotChange(
      page,
      seeded.primaryClipId,
      (snapshot) => Math.abs(snapshot.start - (beforeNudge as EditorHookSnapshot).start) > 0.0001,
      8_000,
      'Nudge did not update selected clip start position.'
    );

    expect(afterNudge.start).toBeGreaterThan((beforeNudge as EditorHookSnapshot).start);

    await callProfessionalTimelineHook(page, 'setPlayhead', Math.max(0, afterNudge.start + 0.5));
    await page.waitForTimeout(120);
    await callProfessionalTimelineHook(page, 'setInPointAtPlayhead');
    await callProfessionalTimelineHook(page, 'setPlayhead', Math.max(0, afterNudge.start + 1.5));
    await page.waitForTimeout(120);
    await callProfessionalTimelineHook(page, 'setOutPointAtPlayhead');

    const inOutStart = Date.now();
    let inOut = await callProfessionalTimelineHook(page, 'getInOut');
    while (Date.now() - inOutStart < 3_000 && (inOut.inPoint === null || inOut.outPoint === null)) {
      await page.waitForTimeout(100);
      inOut = await callProfessionalTimelineHook(page, 'getInOut');
    }
    expect(inOut.inPoint).not.toBeNull();
    expect(inOut.outPoint).not.toBeNull();
    expect((inOut.outPoint as number) - (inOut.inPoint as number)).toBeGreaterThan(0);

    await callProfessionalTimelineHook(page, 'clearMarkers');
    await callProfessionalTimelineHook(page, 'setPlayhead', 0.75);
    await callProfessionalTimelineHook(page, 'addMarkerAtPlayhead');
    await callProfessionalTimelineHook(page, 'setPlayhead', 2.1);
    await callProfessionalTimelineHook(page, 'addMarkerAtPlayhead');

    const markers = await callProfessionalTimelineHook(page, 'getMarkers');
    expect(markers.length).toBeGreaterThanOrEqual(2);

    await callProfessionalTimelineHook(page, 'setPlayhead', 0);
    await callProfessionalTimelineHook(page, 'jumpToNextMarker');
    const playheadAfterNext = await callProfessionalTimelineHook(page, 'getPlayhead');
    const isNextOnMarker = markers.some((marker) => Math.abs(marker.time - playheadAfterNext) < 0.05);
    expect(isNextOnMarker).toBe(true);

    await page.waitForTimeout(120);
    await callProfessionalTimelineHook(page, 'jumpToPreviousMarker');
    const playheadAfterPrevious = await callProfessionalTimelineHook(page, 'getPlayhead');
    const isPreviousOnMarker = markers.some((marker) => Math.abs(marker.time - playheadAfterPrevious) < 0.05);
    expect(isPreviousOnMarker).toBe(true);

    const rightNeighbor = await callStoryArcHook(page, 'snapshot', seeded.clipIds[2]);
    expect(rightNeighbor).not.toBeNull();

    const snapped = await callProfessionalTimelineHook(
      page,
      'getSnappedTime',
      (rightNeighbor as EditorHookSnapshot).start + 0.02,
      seeded.primaryClipId
    );
    expect(snapped).toBeCloseTo((rightNeighbor as EditorHookSnapshot).start, 2);

    const clipCountBeforeDrop = (await callStoryArcHook(page, 'listClips')).length;
    const dropAccepted = await callProfessionalTimelineHook(page, 'dropMedia', {
      id: 'hardpass-drop-clip',
      name: 'Hardpass Drop Clip',
      url: `file://${fixturePath}`,
      type: 'video',
      mimeType: 'video/mp4',
    }, seeded.trackId, 4.5);

    expect(dropAccepted).toBe(true);

    const dropStart = Date.now();
    let clipCountAfterDrop = clipCountBeforeDrop;
    while (Date.now() - dropStart < 8_000) {
      clipCountAfterDrop = (await callStoryArcHook(page, 'listClips')).length;
      if (clipCountAfterDrop > clipCountBeforeDrop) {
        break;
      }
      await page.waitForTimeout(120);
    }

    expect(clipCountAfterDrop).toBeGreaterThan(clipCountBeforeDrop);
  });
});
