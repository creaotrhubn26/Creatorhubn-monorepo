#!/usr/bin/env node
/**
 * record-demo.mjs — synlig Playwright-recorder for Google OAuth-verifiserings-video.
 *
 * Åpner et SYNLIG nettleservindu + tar opp video. DU logger inn med Google og
 * kobler kontoen manuelt (script-et kan ikke håndtere passordet ditt), trykker
 * ENTER, og deretter klikker script-et gjennom hele verifiserings-demoen
 * (inkl. Ads/Analytics/Search Console/Tag Manager) mens alt tas opp.
 *
 * Kjør:
 *   cd /Users/danielqazi/Creatorhubn-monorepo
 *   node frontend/scripts/google-verification/record-demo.mjs
 *
 * Video havner i output/google-verification/videos/*.webm (last opp til YouTube
 * Unlisted, eller konverter med convert-video.sh).
 */
import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";

// Playwright er installert globalt (Homebrew/npm -g). Bare-import "playwright"
// løses ikke i et standalone-script, så vi importerer den absolutte stien.
const PW_PATH = process.env.PLAYWRIGHT_PATH
  || "/opt/homebrew/lib/node_modules/playwright/index.js";
const pwMod = await import(PW_PATH);
const chromium = pwMod.chromium ?? pwMod.default?.chromium;
if (!chromium) {
  console.error("Fant ikke playwright.chromium på", PW_PATH);
  process.exit(1);
}

const BASE = process.env.DEMO_BASE || "https://creatorhubn.com";
const outDir = path.resolve(process.cwd(), "output/google-verification");
const videoDir = path.join(outDir, "videos");
const profileDir = path.join(outDir, "profile");
await fs.mkdir(videoDir, { recursive: true });
await fs.mkdir(profileDir, { recursive: true });

const viewport = { width: 1440, height: 900 };
const DEMO_PATH = "/google-verification-demo";

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 280);
        y += 280;
        if (y >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 320);
    });
  });
  await page.waitForTimeout(1200);
}

const log = (m) => console.log(`[recorder] ${m}`);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport,
  recordVideo: { dir: videoDir, size: viewport },
  args: [`--window-size=${viewport.width},${viewport.height}`],
});
const page = context.pages()[0] ?? (await context.newPage());

log(`Åpner ${BASE}/login i et synlig vindu …`);
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => {});

console.log("\n──────────────────────────────────────────────────────────────");
console.log("  GJØR DETTE I VINDUET (opptaket går allerede):");
console.log("   1) Logg inn med Google (vis gjerne consent-skjermen).");
console.log("   2) Koble Google-kontoen (gi tilgang) hvis ikke gjort.");
console.log(`   3) Naviger til ${BASE}${DEMO_PATH}`);
console.log("  Script-et fortsetter AUTOMATISK når du er på demo-siden.");
console.log("──────────────────────────────────────────────────────────────\n");

const findDemoPage = () => {
  for (const p of context.pages()) {
    try { if (p.url().includes(DEMO_PATH)) return p; } catch { /* cross-origin (OAuth) */ }
  }
  return null;
};

const deadline = Date.now() + 12 * 60 * 1000; // 12 min til innlogging + kobling + navigering
let demoPage = null;
while (Date.now() < deadline) {
  const found = findDemoPage();
  if (found) {
    await found.waitForTimeout(3000);
    if (findDemoPage()) { demoPage = found; break; }
  }
  await page.waitForTimeout(2500);
}
if (!demoPage) {
  log("Tidsavbrudd — nådde aldri demo-siden. Lukker.");
  await context.close();
  process.exit(1);
}
await demoPage.bringToFront().catch(() => {});
log("Demo-siden oppdaget — starter gjennomgang.");
await demoPage.waitForTimeout(2500);

log("Blar gjennom siden (viser alle seksjoner) …");
await autoScroll(demoPage);

// Klikker demo-handlingene. Ads-knappene (nye) er de viktigste; Workspace
// best-effort. Hopper pent over knapper som ikke finnes.
const actionLabels = [
  "List Google Ads accounts",
  "List GA4 accounts",
  "List Search Console sites",
  "List Tag Manager accounts",
  "Load Drive Files",
  "Create Gmail Draft",
  "Create YouTube Playlist",
];

for (const label of actionLabels) {
  try {
    const btn = demoPage.getByRole("button", { name: label, exact: false }).first();
    if ((await btn.count()) === 0) { log(`(ikke funnet) ${label}`); continue; }
    await btn.scrollIntoViewIfNeeded();
    await demoPage.waitForTimeout(800);
    await btn.click({ timeout: 6000 });
    log(`Klikket: ${label}`);
    await demoPage.waitForTimeout(2800); // la resultatet vises i opptaket
  } catch (err) {
    log(`Hoppet over "${label}": ${err.message}`);
  }
}

await demoPage.waitForTimeout(2500);
log("Ferdig — lukker og lagrer video …");
await context.close();

const files = (await fs.readdir(videoDir)).filter((f) => f.endsWith(".webm"));
console.log("\n✅ Video lagret i:", videoDir);
files.forEach((f) => console.log("   -", path.join(videoDir, f)));
console.log("\nLast .webm-en opp til YouTube (Unlisted), eller konverter til .mp4 med convert-video.sh.\n");
process.exit(0);
