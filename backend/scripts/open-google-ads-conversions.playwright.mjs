#!/usr/bin/env node
/**
 * open-google-ads-conversions.playwright.mjs
 *
 * Forenklet versjon av setup-google-ads-conversions.playwright.mjs:
 * - Åpner Google Ads i headed Chromium (persistent profile)
 * - Naviger direkte til Conversions-listen
 * - Lar browseren stå åpen så Daniel kan opprette conversion-actions
 *
 * Etter at Daniel har hentet AW-ID + 3 labels, lim dem inn i chat — så
 * lagrer Claude dem på Render via API direkte.
 *
 * Kjøres lokalt:
 *   node backend/scripts/open-google-ads-conversions.playwright.mjs
 */

import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ADS_URL = "https://ads.google.com/aw/conversions/summary";
const profileDir = path.resolve(process.cwd(), "output/google-ads-setup/chromium-profile");

console.log(`\n🎯 Åpner Google Ads → Conversions`);
console.log(`   Profile: ${profileDir}`);
console.log(`   URL: ${ADS_URL}\n`);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const page = context.pages()[0] || await context.newPage();
await page.goto(ADS_URL, { waitUntil: "domcontentloaded" });

console.log("✓ Browser åpen. Logg inn (customer-ID slutter på 5872).\n");
console.log("Trinn:");
console.log("  1. Tools & settings → Conversions → New conversion → Website");
console.log("  2. Opprett 3 actions:");
console.log("       - lead_submitted   (Submit lead form)");
console.log("       - demo_booked      (Book appointment)");
console.log("       - signup           (Sign-up)");
console.log("  3. For hver: åpne → Tag setup → Use Google Tag Manager or install tag yourself");
console.log("     Noter AW-XXXXXXXXXX (samme alle 3) + 11-tegns LABEL (unik per action)\n");
console.log("  4. Lim verdiene inn i Claude-chat:");
console.log("       AW-XXXXXXXXXX");
console.log("       LABEL_LEAD: ...");
console.log("       LABEL_DEMO: ...");
console.log("       LABEL_SIGNUP: ...\n");
console.log("Browseren forblir åpen til du lukker den manuelt.\n");

// Hold browseren åpen til Daniel lukker den manuelt.
await context.waitForEvent("close", { timeout: 0 });
