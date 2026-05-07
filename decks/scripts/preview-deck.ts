import { chromium } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "decks", "output");
const PERSONAS = ["production-team", "content-producer", "dance-studio"];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const p of PERSONAS) {
    const url = "file://" + join(OUT, `role-room-${p}.html`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const previewPath = join(OUT, `preview-${p}-cover.png`);
    await page.screenshot({ path: previewPath, clip: { x: 0, y: 0, width: 1600, height: 900 } });
    console.log("  →", previewPath);
  }
  await browser.close();
}

main();
