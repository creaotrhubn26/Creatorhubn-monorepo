#!/usr/bin/env node
/**
 * setup-google-ads-conversions.playwright.mjs
 *
 * Interaktivt Playwright-flow for å sette opp Google Ads conversion-actions:
 *
 *   1. Åpner Google Ads i headed Chromium (persistent profile — login består).
 *   2. Du logger inn (om nødvendig) og navigerer til Tools → Conversions.
 *   3. Du oppretter 3 conversion actions:
 *        - lead_submitted   (Website → Submit lead form)
 *        - demo_booked      (Website → Book appointment)
 *        - signup           (Website → Sign-up)
 *   4. Script scraper conversion-tabellen for AW-id + labels.
 *   5. Skriver `GOOGLE_ADS_CONVERSION_ID` + 3 labels til Render env.
 *   6. Trigger ny deploy.
 *
 * Kjøres lokalt:
 *   node backend/scripts/setup-google-ads-conversions.playwright.mjs
 *
 * Krever:
 *   - playwright (allerede i devDependencies)
 *   - RENDER_API_KEY i miljø (kreves bare for steg 5)
 */

import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const ADS_HOST = "https://ads.google.com";
const RENDER_SERVICE_ID = "srv-d76ob60ule4c73dv2p60"; // creatorhub-backend
const VERCEL_PROJECT_ID = "prj_Xw3uaKEtM64cVUaI6C7SaOt2jDfW"; // creatorhub-frontend

const profileDir = path.resolve(process.cwd(), "output/google-ads-setup/chromium-profile");

const rl = readline.createInterface({ input, output });
const ask = (q) => rl.question(q);

console.log("\n🎯 Google Ads conversion-setup\n" + "─".repeat(50));
console.log("1) Åpner Google Ads i ny browser-profil.");
console.log("2) Du logger inn (kun første gang) og oppretter 3 conversion actions:");
console.log("     - lead_submitted (Submit lead form)");
console.log("     - demo_booked    (Book appointment)");
console.log("     - signup         (Sign-up)");
console.log("3) Trykk Enter når du er ferdig — så scraper jeg AW-ID + labels.\n");

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const page = context.pages()[0] || await context.newPage();

// Direkte til conversion-summary-siden hvis logget inn — ellers redirect til login
await page.goto(`${ADS_HOST}/aw/conversions/summary`, { waitUntil: "domcontentloaded" });
console.log("→ Browser åpen. Logg inn med samme konto som har customer-ID 5872.\n");

await ask("Trykk Enter når du er ferdig med å opprette de 3 conversion-actionene: ");

// Scrape conversion-table
console.log("\n→ Scraper conversion-tabellen...");

// Sørg for at vi er på conversions-listen
const currentUrl = page.url();
if (!currentUrl.includes("/conversions")) {
  await page.goto(`${ADS_HOST}/aw/conversions/summary`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
}

// Snapshot UI: hvilke conversion-rows finnes?
// Google Ads UI er materialUI-ish; rad-cellene er deler av en data-table.
const rows = await page.evaluate(() => {
  const out = [];
  // Forsøk flere selectorer — Google endrer UI ofte
  const selectors = [
    "tr[data-row-id]",
    "tbody tr[role='row']",
    "div[role='row']",
  ];
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      els.forEach((el) => {
        const text = (el.textContent || "").trim().replace(/\s+/g, " ");
        if (text) out.push({ selector: sel, text: text.slice(0, 200) });
      });
      if (out.length > 0) break;
    }
  }
  return out;
});

console.log(`\nFant ${rows.length} rad-elementer:\n`);
rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.text}`));

console.log("\n⚠️  Google Ads UI eksponerer ikke AW-ID/label direkte i conversion-listen.");
console.log("   Du må åpne hver conversion → 'Tag setup' → 'Use Google Tag Manager or install tag yourself' for å se konverterings-ID + label.\n");
console.log("   Format som vises:");
console.log("   gtag('event', 'conversion', { 'send_to': 'AW-XXXXXXXXXX/abcDEF12345' });\n");

console.log("Lim inn de 3 verdiene manuelt (du finner dem på hver conversion sin tag-setup-side):\n");

const awId = (await ask("AW-ID (format AW-XXXXXXXXXX): ")).trim();
const labelLead = (await ask("Label for lead_submitted (11 tegn): ")).trim();
const labelDemo = (await ask("Label for demo_booked (11 tegn): ")).trim();
const labelSignup = (await ask("Label for signup (11 tegn): ")).trim();

if (!awId.startsWith("AW-")) {
  console.error("❌ AW-ID må starte med 'AW-'. Avbryter.");
  await context.close();
  process.exit(1);
}

console.log("\n→ Skriver til Render + Vercel env-vars...\n");

const RENDER_API_KEY = process.env.RENDER_API_KEY;
if (!RENDER_API_KEY) {
  console.error("⚠️  RENDER_API_KEY ikke satt i miljø — kan ikke lagre på Render.");
  console.log("\nDu kan lime disse inn manuelt på Render (Settings → Environment):\n");
  console.log(`  GOOGLE_ADS_CONVERSION_ID=${awId}`);
  console.log(`  GOOGLE_ADS_LABEL_LEAD=${labelLead}`);
  console.log(`  GOOGLE_ADS_LABEL_DEMO=${labelDemo}`);
  console.log(`  GOOGLE_ADS_LABEL_SIGNUP=${labelSignup}\n`);
} else {
  const renderVars = [
    { key: "GOOGLE_ADS_CONVERSION_ID", value: awId },
    { key: "GOOGLE_ADS_LABEL_LEAD", value: labelLead },
    { key: "GOOGLE_ADS_LABEL_DEMO", value: labelDemo },
    { key: "GOOGLE_ADS_LABEL_SIGNUP", value: labelSignup },
  ];
  for (const v of renderVars) {
    const r = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/${v.key}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${RENDER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: v.value }),
      },
    );
    if (r.ok) {
      console.log(`  ✓ ${v.key} satt på Render`);
    } else {
      console.error(`  ✗ ${v.key} feilet: HTTP ${r.status}`);
    }
  }

  console.log("\n→ Trigger deploy på Render...");
  const dep = await fetch(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RENDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    },
  );
  if (dep.ok) {
    const data = await dep.json();
    console.log(`  ✓ Render-deploy startet: ${data.id}`);
  } else {
    console.error(`  ✗ Deploy-trigger feilet: HTTP ${dep.status}`);
  }
}

console.log("\n✅ Ferdig.\n");
console.log("Neste:");
console.log("  - Backend serverer /api/public/ads-config med disse env-vars");
console.log("  - Frontend henter config + firer conversion-events via gtag");
console.log("  - Test: åpne theroleroom.com/for-byraer → fyll lead-form → sjekk i Google Ads → Conversions → Diagnostics");
console.log("    (kan ta opptil 24t før conversions vises i Google Ads UI)\n");

await ask("Trykk Enter for å lukke browseren: ");
await context.close();
await rl.close();
