import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(frontendDir, 'client/public/marketplace-previews');
const previewUrl =
  process.env.MARKETPLACE_PREVIEW_URL ||
  'http://127.0.0.1:4177/marketplace-previews.html';

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts?.ready);

  const sceneLocators = page.locator('[data-scene]');
  const sceneCount = await sceneLocators.count();
  if (!sceneCount) {
    throw new Error(`Fant ingen [data-scene] på ${previewUrl}`);
  }

  for (let index = 0; index < sceneCount; index += 1) {
    const locator = sceneLocators.nth(index);
    const sceneId = await locator.getAttribute('data-scene');
    if (!sceneId) continue;
    const targetPath = path.resolve(outputDir, `${sceneId}.png`);
    await locator.scrollIntoViewIfNeeded();
    await locator.screenshot({
      path: targetPath,
      animations: 'disabled',
      type: 'png',
    });
    console.log(`Saved ${targetPath}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
