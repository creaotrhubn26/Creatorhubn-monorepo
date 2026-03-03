import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORY_ARC_ROUTE = '/story-arc-studio';
const FIXTURE_DURATION_SECONDS = 8;
const FIXTURE_PATH = path.join(os.tmpdir(), 'storyarc-render-budget-fixture.mp4');

type StoryArcEditorHookApi = {
  seedTimelineFixture: () => { primaryClipId: string; clipIds: string[]; trackId: string; sourceFile: string } | null;
};

type ProfessionalTimelineHookApi = {
  setPlayhead: (seconds: number) => void;
};

type SeededTimelineFixture = { primaryClipId: string; clipIds: string[]; trackId: string; sourceFile: string };

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
    throw new Error(`Failed to create render budget fixture video: ${result.stderr || result.stdout}`);
  }

  return FIXTURE_PATH;
}

async function gotoStoryArcStudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('storyArcStudio_onboardingCompleted', 'true');
  });

  await page.goto(STORY_ARC_ROUTE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('Story Arc Studio').first()).toBeVisible({ timeout: 90_000 });
}

async function dismissBlockingDialogs(page: Page): Promise<void> {
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

async function uploadFixtureToTimeline(page: Page): Promise<void> {
  const fixturePath = ensureFixtureVideo();
  const fixtureName = path.basename(fixturePath);

  await expect(page.getByTestId('storyarc-asset-browser')).toBeVisible({ timeout: 90_000 });
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
}

async function bootstrapStoryArcForBudget(page: Page): Promise<void> {
  await gotoStoryArcStudio(page);
  await dismissBlockingDialogs(page);
  await uploadFixtureToTimeline(page);
  await waitForEditorHooks(page, 60_000);
}

async function seedDeterministicFixture(page: Page, timeoutMs = 20_000): Promise<SeededTimelineFixture> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const seeded = await page.evaluate(() => {
      const context = window as Window & { __storyArcEditorTestHook?: StoryArcEditorHookApi };
      return context.__storyArcEditorTestHook?.seedTimelineFixture() ?? null;
    });
    if (seeded) {
      await page.waitForTimeout(150);
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      return seeded;
    }
    await page.waitForTimeout(120);
  }
  throw new Error('Failed to seed deterministic timeline fixture.');
}

test.describe('ProfessionalTimeline render budget', () => {
  test('playhead update latency stays within budget', async ({ page }) => {
    test.setTimeout(240_000);

    await bootstrapStoryArcForBudget(page);
    await seedDeterministicFixture(page);

    const metrics = await page.evaluate(async () => {
      const context = window as Window & {
        __professionalTimelineTestHook?: ProfessionalTimelineHookApi;
      };

      const timelineHook = context.__professionalTimelineTestHook;
      if (!timelineHook) {
        throw new Error('Timeline hook is unavailable.');
      }

      const samples: number[] = [];
      const warmupIterations = 10;
      const measuredIterations = 90;
      const iterationCount = warmupIterations + measuredIterations;
      const maxTargetSeconds = 8;

      for (let index = 0; index < iterationCount; index += 1) {
        const ratio = index / Math.max(1, iterationCount - 1);
        const targetSeconds = ratio * maxTargetSeconds;
        const startedAt = performance.now();
        timelineHook.setPlayhead(targetSeconds);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (index >= warmupIterations) {
          samples.push(performance.now() - startedAt);
        }
      }

      const sorted = [...samples].sort((left, right) => left - right);
      const percentile = (value: number) => {
        if (sorted.length === 0) {
          return 0;
        }
        const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value));
        return sorted[index];
      };

      return {
        avg: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: sorted[sorted.length - 1] ?? 0,
      };
    });

    expect(metrics.p95, `p95 latency too high: ${metrics.p95.toFixed(2)}ms`).toBeLessThan(85);
    expect(metrics.p99, `p99 latency too high: ${metrics.p99.toFixed(2)}ms`).toBeLessThan(145);
  });

  test('hover and zoom interactions stay responsive', async ({ page }) => {
    test.setTimeout(240_000);

    await bootstrapStoryArcForBudget(page);
    await seedDeterministicFixture(page);

    const metrics = await page.evaluate(async () => {
      const scrollArea = document.querySelector('[data-testid="professional-timeline-scroll-area"]') as HTMLElement | null;
      if (!scrollArea) {
        throw new Error('Timeline scroll area is unavailable.');
      }

      const hoverSamples: number[] = [];
      const zoomSamples: number[] = [];
      const hoverWarmup = 10;
      const hoverIterations = 60 + hoverWarmup;
      const zoomWarmup = 6;
      const zoomIterations = 35 + zoomWarmup;

      for (let index = 0; index < hoverIterations; index += 1) {
        const x = 220 + (index % 20) * 18;
        const y = 90 + (index % 6) * 24;
        const hoverStartedAt = performance.now();
        scrollArea.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (index >= hoverWarmup) {
          hoverSamples.push(performance.now() - hoverStartedAt);
        }
      }

      for (let index = 0; index < zoomIterations; index += 1) {
        const zoomStartedAt = performance.now();
        scrollArea.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: index % 2 === 0 ? -120 : 120,
          clientX: 420,
          clientY: 130,
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (index >= zoomWarmup) {
          zoomSamples.push(performance.now() - zoomStartedAt);
        }
      }

      const percentile = (values: number[], p: number): number => {
        const sorted = [...values].sort((left, right) => left - right);
        if (sorted.length === 0) {
          return 0;
        }
        const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
        return sorted[index];
      };

      return {
        hoverP95: percentile(hoverSamples, 0.95),
        zoomP95: percentile(zoomSamples, 0.95),
      };
    });

    expect(metrics.hoverP95, `hover p95 latency too high: ${metrics.hoverP95.toFixed(2)}ms`).toBeLessThan(70);
    expect(metrics.zoomP95, `zoom p95 latency too high: ${metrics.zoomP95.toFixed(2)}ms`).toBeLessThan(120);
  });

  test('drag interaction stays within frame budget', async ({ page }) => {
    test.setTimeout(240_000);

    await bootstrapStoryArcForBudget(page);
    await seedDeterministicFixture(page);

    const metrics = await page.evaluate(async () => {
      const clip = document.querySelector('[data-testid^="timeline-clip-"]') as HTMLElement | null;
      if (!clip) {
        throw new Error('Timeline clip is unavailable for drag benchmark.');
      }

      const rect = clip.getBoundingClientRect();
      const startX = rect.left + Math.min(24, Math.max(8, rect.width * 0.35));
      const startY = rect.top + rect.height / 2;

      const samples: number[] = [];
      const warmupMoves = 5;

      clip.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }));

      for (let index = 0; index < 34; index += 1) {
        const moveStartedAt = performance.now();
        const deltaX = (index + 1) * 9;
        window.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: startX + deltaX,
          clientY: startY,
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (index >= warmupMoves) {
          samples.push(performance.now() - moveStartedAt);
        }
      }

      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: startX + 320,
        clientY: startY,
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const sorted = [...samples].sort((left, right) => left - right);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95))] ?? 0;
      return { p95 };
    });

    expect(metrics.p95, `drag p95 latency too high: ${metrics.p95.toFixed(2)}ms`).toBeLessThan(75);
  });
});
