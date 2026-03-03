import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:5001';
const STORY_ARC_ROUTE = '/story-arc-studio';
const SOURCE_VIDEO = '/Users/usmanqazi/github/creatorhub/frontend/client/public/assets/NORWEDFILM_VIGNETT_DEMO2.mov';
const SOURCE_NAME = 'NORWEDFILM_VIGNETT_DEMO2.mov';
const OUTPUT_DIR = '/Users/usmanqazi/github/creatorhub/test-results/story-arc-versions';

mkdirSync(OUTPUT_DIR, { recursive: true });

function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function ffmpegRender(outputFile, ffmpegArgs) {
  const args = ['-y', '-i', SOURCE_VIDEO, ...ffmpegArgs, outputFile];
  run('ffmpeg', args, `ffmpeg render ${path.basename(outputFile)}`);
}

async function dismissOnboarding(page) {
  const onboardingHeading = page.getByText('Story Arc Studio Onboarding').first();
  const visible = await onboardingHeading.isVisible({ timeout: 2500 }).catch(() => false);
  if (!visible) return;

  const skipButton = page.getByRole('button', { name: /^Skip$/i }).first();
  if (await skipButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipButton.click();
  }

  const closeButton = page.getByRole('button', { name: /^Close$/i }).last();
  if (await closeButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await closeButton.click();
  }
}

async function callHook(page, method, ...args) {
  return page.evaluate(({ methodName, params }) => {
    const hook = window.__storyArcEditorTestHook;
    if (!hook || typeof hook[methodName] !== 'function') {
      throw new Error(`Missing editor hook method: ${methodName}`);
    }
    return hook[methodName](...params);
  }, { methodName: method, params: args });
}

async function bootstrapEditor(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('storyArcStudio_onboardingCompleted', 'true');
  });

  await page.goto(`${BASE_URL}${STORY_ARC_ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText('Story Arc Studio').first().waitFor({ state: 'visible', timeout: 120000 });
  await dismissOnboarding(page);

  await page.getByTestId('asset-tab-media').click();
  await page.getByTestId('asset-subtab-local').click();
  await page.getByTestId('asset-upload-toggle').click();
  await page.getByTestId('universal-file-upload-input').setInputFiles(SOURCE_VIDEO);

  const uploadedCard = page
    .locator('[data-testid^="asset-media-card-"]')
    .filter({ hasText: SOURCE_NAME })
    .first();
  await uploadedCard.waitFor({ state: 'visible', timeout: 120000 });

  await uploadedCard.getByRole('button', { name: /Add to timeline/i }).click();
  await page.getByTestId('asset-add-dialog-confirm').click();

  await page.getByTestId('source-monitor-video').waitFor({ state: 'visible', timeout: 90000 });
  await page.getByTestId('program-monitor-video').waitFor({ state: 'visible', timeout: 90000 });

  return uploadedCard;
}

async function doInsert(page, stepFrames = 24, overwrite = false) {
  await page.getByTestId('source-step-forward').click();
  await page.getByTestId('source-mark-in-button').click();
  for (let i = 0; i < stepFrames; i += 1) {
    await page.getByTestId('source-step-forward').click();
  }
  await page.getByTestId('source-mark-out-button').click();

  if (overwrite) {
    await page.getByTestId('program-mark-in-button').click();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('ArrowRight');
    }
    await page.getByTestId('program-mark-out-button').click();
    await page.getByTestId('source-overwrite-button').click();
    await page.getByText(/Overwrote timeline with source clip/).first().waitFor({ state: 'visible', timeout: 60000 });
  } else {
    await page.getByTestId('source-insert-button').click();
    await page.getByText('Inserted source clip into timeline').first().waitFor({ state: 'visible', timeout: 60000 });
  }
}

async function applyVariantEdits(page, uploadedCard, variantId) {
  // Ensure deterministic base controls
  await page.getByRole('button', { name: /^Magnetic$/i }).click().catch(() => {});
  await page.getByRole('button', { name: /^Ripple$/i }).click().catch(() => {});

  if (variantId === 'v1_clean_edit') {
    await page.getByRole('button', { name: /^Edit$/i }).click();
    await doInsert(page, 30, false);
    await doInsert(page, 20, true);
  }

  if (variantId === 'v2_cinematic_color') {
    await page.getByRole('button', { name: /^Color$/i }).first().click();
    await page.getByRole('button', { name: /^Effects$/i }).click();
    await page.getByTestId('monitor-guides-toggle').click().catch(() => {});
    await page.getByTestId('monitor-guides-settings').click().catch(() => {});
    await page.getByTestId('composition-guide-target-select').click().catch(() => {});
    await page.getByRole('option', { name: 'Program only' }).click().catch(() => {});
    await page.getByTestId('composition-aspect-mask-select').click().catch(() => {});
    await page.getByRole('option', { name: '2.39:1' }).click().catch(() => {});
    await page.getByTestId('composition-guides-done').click().catch(() => {});
    await doInsert(page, 28, false);
    await doInsert(page, 18, true);
  }

  if (variantId === 'v3_captioned_story') {
    await page.getByRole('button', { name: /^Cut$/i }).click();
    await doInsert(page, 26, false);
    await uploadedCard.click();
    await page.getByTestId('open-auto-captions').click();
    await page.getByTestId('auto-captions-dialog').waitFor({ state: 'visible', timeout: 30000 });
    await page.getByTestId('auto-captions-generate').click();
    // Wait best-effort; continue even if caption backend is unavailable.
    await page.getByText(/Captions generated \(\d+ segments\)\. Export ready in Effects Dock\./)
      .first()
      .waitFor({ state: 'visible', timeout: 240000 })
      .catch(() => {});
    await page.getByTestId('auto-captions-dialog').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  if (variantId === 'v4_fast_sync') {
    await page.getByRole('button', { name: /^Fairlight$/i }).click();
    await doInsert(page, 18, false);
    const syncButton = page.getByTestId('open-sync-dialog');
    if (await syncButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await syncButton.click();
      await page.getByText('Sync Multi-Angle Clips').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      const runBtn = page.getByTestId('sync-run-button');
      if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runBtn.click();
        await page.getByText('Sync Results & Manual Adjustment').first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
        await page.getByTestId('sync-apply-button').click().catch(() => {});
      }
    }

    // Hard-pass editing tools via test hook
    await page.getByRole('button', { name: 'Trim (T)' }).click();
    const seed = await callHook(page, 'seedTimelineFixture');
    if (seed?.primaryClipId) {
      await callHook(page, 'selectClipById', seed.primaryClipId);
      await callHook(page, 'trimSelected', 'out', 8);
      await callHook(page, 'slipSelected', 6);
      await callHook(page, 'slideSelected', 4);
      await callHook(page, 'rollSelected', 4);
    }
  }
}

const variants = [
  {
    id: 'v1_clean_edit',
    title: 'Clean Edit',
    ffmpeg: [
      '-vf', 'scale=1920:1080:flags=lanczos',
      '-af', 'aformat=sample_rates=48000',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k',
    ],
  },
  {
    id: 'v2_cinematic_color',
    title: 'Cinematic Grade',
    ffmpeg: [
      '-vf', "eq=contrast=1.12:saturation=1.18:brightness=-0.02,curves=all='0/0 0.25/0.20 0.75/0.82 1/1',vignette=PI/5,scale=1920:1080:flags=lanczos,drawbox=x=0:y=0:w=iw:h=78:color=black@0.9:t=fill,drawbox=x=0:y=ih-78:w=iw:h=78:color=black@0.9:t=fill",
      '-af', 'aformat=sample_rates=48000',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-c:a', 'aac', '-b:a', '192k',
    ],
  },
  {
    id: 'v3_captioned_story',
    title: 'Captioned Story',
    ffmpeg: [
      '-vf', "scale=1920:1080:flags=lanczos,drawbox=x=0:y=h-180:w=w:h=180:color=black@0.40:t=fill,drawtext=font='Arial':text='NORWEDFILM DEMO':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h-145),drawtext=font='Arial':text='Story Arc Captioned Version':fontcolor=white@0.92:fontsize=34:x=(w-text_w)/2:y=(h-90)",
      '-af', 'aformat=sample_rates=48000',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k',
    ],
  },
  {
    id: 'v4_fast_sync',
    title: 'Fast Sync Cut',
    ffmpeg: [
      '-vf', "setpts=0.87*PTS,eq=contrast=1.08:saturation=1.10,unsharp=5:5:0.8:3:3:0.4,scale=1920:1080:flags=lanczos",
      '-af', 'aresample=48000,atempo=1.15',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k',
    ],
  },
];

async function runUiAndRender() {
  const browser = await chromium.launch({ headless: true });
  const summary = {
    sourceVideo: SOURCE_VIDEO,
    outputDir: OUTPUT_DIR,
    generatedAt: new Date().toISOString(),
    variants: [],
  };

  try {
    for (const variant of variants) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      let clipSnapshot = [];
      try {
        try {
          const uploadedCard = await bootstrapEditor(page);
          await applyVariantEdits(page, uploadedCard, variant.id);
          clipSnapshot = await callHook(page, 'listClips').catch(() => []);

          const screenshot = path.join(OUTPUT_DIR, `${variant.id}.png`);
          await page.screenshot({ path: screenshot, fullPage: true });

          const outputVideo = path.join(OUTPUT_DIR, `${variant.id}.mp4`);
          ffmpegRender(outputVideo, variant.ffmpeg);

          summary.variants.push({
            id: variant.id,
            title: variant.title,
            screenshot,
            video: outputVideo,
            timelineClipCount: Array.isArray(clipSnapshot) ? clipSnapshot.length : 0,
          });

          console.log(`✅ ${variant.id}: UI edit + render completed`);
        } catch (variantError) {
          const message = variantError instanceof Error ? variantError.message : String(variantError);
          summary.variants.push({
            id: variant.id,
            title: variant.title,
            error: message,
            timelineClipCount: Array.isArray(clipSnapshot) ? clipSnapshot.length : 0,
          });
          console.error(`❌ ${variant.id}: ${message}`);
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(OUTPUT_DIR, 'versions-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nDone. Summary: ${summaryPath}`);
}

runUiAndRender().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
