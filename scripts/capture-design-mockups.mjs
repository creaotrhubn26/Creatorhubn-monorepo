#!/usr/bin/env node
/**
 * capture-design-mockups.mjs
 *
 * Tar full-page screenshots av prod-grensesnittet og legger på MOCK-
 * watermark slik at det er tydelig at det er mockup (ikke produksjons-
 * skjermbilder klare for ekstern bruk).
 *
 * Output: mockups/<slug>-<viewport>.png
 *
 * Kjør:
 *   node scripts/capture-design-mockups.mjs
 *   node scripts/capture-design-mockups.mjs --url https://theroleroom.com/presse
 *   node scripts/capture-design-mockups.mjs --headful
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'mockups');

const BASE_URL = process.env.MOCKUP_BASE_URL ?? 'https://theroleroom.com';

const PAGES = [
  { slug: 'home', path: '/', label: 'Hjemmeside' },
  { slug: 'talentportal', path: '/talentportal', label: 'Talentportal' },
  { slug: 'for-studenter', path: '/for-studenter', label: 'For studenter (student-SEO)' },
  { slug: 'film-tv-utdanning', path: '/film-tv-utdanning', label: 'Film og TV-utdanning' },
  { slug: 'innholdsprodusenter', path: '/innholdsprodusenter', label: 'Innholdsprodusenter' },
  { slug: 'alternatives', path: '/alternatives', label: 'Alternativer-indeks' },
  { slug: 'vs-studiobinder', path: '/vs-studiobinder', label: 'vs StudioBinder' },
  { slug: 'vs-castingnetworks', path: '/vs-castingnetworks', label: 'vs Casting Networks' },
  { slug: 'presse', path: '/presse', label: 'Pressepakke' },
  { slug: 'utdanningsinstitusjon', path: '/utdanningsinstitusjon', label: 'For utdanningsinstitusjoner' },
  { slug: 'en-home', path: '/en', label: 'EN — Home (multi-lang)' },
  { slug: 'en-for-studenter', path: '/en/for-studenter', label: 'EN — For students' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// Watermark-CSS injiseres etter side har lastet, før screenshot tas.
// Diagonal repeterende "MOCK"-tekst + corner-badge.
const WATERMARK_CSS = `
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 999998;
    pointer-events: none;
    background-image: repeating-linear-gradient(
      -28deg,
      transparent 0,
      transparent 280px,
      rgba(239, 68, 68, 0.08) 280px,
      rgba(239, 68, 68, 0.08) 320px
    );
  }
  body::after {
    content: 'MOCK · DESIGN PREVIEW · ${new Date().toISOString().slice(0, 10)} · MOCK · DESIGN PREVIEW · MOCK';
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    z-index: 999999;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 900;
    font-size: 56px;
    color: rgba(239, 68, 68, 0.22);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    white-space: nowrap;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  /* Corner-badge øverst til høyre */
  #mock-corner-badge {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 1000000;
    padding: 8px 14px;
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 900;
    font-size: 12px;
    letter-spacing: 0.12em;
    border-radius: 4px;
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    text-transform: uppercase;
  }
`;

const WATERMARK_HTML_BADGE = `
  if (!document.getElementById('mock-corner-badge')) {
    const badge = document.createElement('div');
    badge.id = 'mock-corner-badge';
    badge.textContent = 'MOCK · DESIGN PREVIEW';
    document.body.appendChild(badge);
  }
`;

function parseArgs(argv) {
  const args = { headful: false, url: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headful') args.headful = true;
    else if (a === '--url') args.url = argv[++i];
  }
  return args;
}

async function captureOne(browser, page, viewport, label) {
  const url = `${BASE_URL}${page.path}`;
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
  });
  const tab = await ctx.newPage();

  try {
    await tab.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  } catch {
    // Noen sider trenger lenger tid — fortsett uansett
  }
  // La animasjoner stabilisere
  await tab.waitForTimeout(1500);

  // Injiser watermark
  await tab.addStyleTag({ content: WATERMARK_CSS });
  await tab.evaluate(WATERMARK_HTML_BADGE);
  await tab.waitForTimeout(200);

  const outPath = join(OUTPUT_DIR, `${page.slug}-${viewport.name}.png`);
  await tab.screenshot({ path: outPath, fullPage: true });

  await ctx.close();
  console.log(`  ✓ ${label} (${viewport.name}) → mockups/${page.slug}-${viewport.name}.png`);
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`Mockup-capture mot ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: !args.headful,
    channel: args.headful ? 'chrome' : undefined,
  });

  const pagesToCapture = args.url
    ? [{ slug: 'custom', path: new URL(args.url).pathname, label: args.url }]
    : PAGES;

  const errors = [];

  try {
    for (const page of pagesToCapture) {
      for (const viewport of VIEWPORTS) {
        try {
          await captureOne(browser, page, viewport, page.label);
        } catch (err) {
          console.error(`  ✗ ${page.label} (${viewport.name}): ${err.message}`);
          errors.push({ page: page.label, viewport: viewport.name, error: err.message });
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nFerdig: ${pagesToCapture.length * VIEWPORTS.length - errors.length} screenshots, ${errors.length} feilet.`);
  if (errors.length > 0) {
    console.log('Feil:');
    for (const e of errors) console.log(`  - ${e.page} (${e.viewport}): ${e.error}`);
  }
}

main().catch((err) => {
  console.error('Fatal feil:', err);
  process.exit(1);
});
