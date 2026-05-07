import { chromium } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "decks", "output");

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 14 * 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const url = "file://" + join(OUT, "role-room-production-team.html");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // Capture each slide separately by scrolling
  const slideCount = await page.locator("section.slide").count();
  for (let i = 0; i < slideCount; i++) {
    const box = await page.locator("section.slide").nth(i).boundingBox();
    if (!box) continue;
    await page.screenshot({
      path: join(OUT, `preview-prod-slide-${String(i + 1).padStart(2, "0")}.png`),
      clip: { x: box.x, y: box.y, width: 1600, height: 900 },
    });
  }
  await browser.close();
  console.log(`Captured ${slideCount} slides`);
}

main();
