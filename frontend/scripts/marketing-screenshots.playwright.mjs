/**
 * marketing-screenshots.playwright.mjs
 *
 * H — Playwright-screenshots av demo-modus + airbrushing.
 *
 * Genererer rene screenshots av theroleroom.com- og creatorhubn.com-
 * sidene til bruk i blog-covers, OG-bilder, pitch deck, sales-decks
 * og presse-kit.
 *
 * Airbrushing — CSS-injection som skjuler:
 *   - Banner-/cookie-popups
 *   - Dev/admin-pills i hjørner
 *   - "Beta"/"Preview"-merker (kan beholdes hvis ønsket via --keep-beta)
 *   - Scrollbars
 *
 * Viewports:
 *   - mobile  : 390 × 844 (iPhone 14)
 *   - tablet  : 1024 × 1366 (iPad Pro)
 *   - desktop : 1440 × 900 (MacBook Pro 14")
 *
 * Bruk:
 *   node scripts/marketing-screenshots.playwright.mjs
 *   node scripts/marketing-screenshots.playwright.mjs --base https://theroleroom.com
 *   node scripts/marketing-screenshots.playwright.mjs --routes /pitch,/faq
 *   node scripts/marketing-screenshots.playwright.mjs --viewport desktop
 *
 * Output: client/public/marketing-screenshots/{route}-{viewport}.png
 */

import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '..', 'client', 'public', 'marketing-screenshots');

// CLI args
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    argMap[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : args[i + 1] || true;
  }
}

const BASE_URL = argMap.base || 'https://theroleroom.com';
const KEEP_BETA = argMap['keep-beta'] === true || argMap['keep-beta'] === 'true';
const DEFAULT_ROUTES = [
  { path: '/', name: 'home', wait: 'networkidle' },
  { path: '/for-byraer', name: 'for-byraer', wait: 'networkidle' },
  { path: '/faq', name: 'faq', wait: 'domcontentloaded' },
  { path: '/pitch', name: 'pitch', wait: 'networkidle' },
  { path: '/talent-registry', name: 'talent-registry', wait: 'networkidle' },
];
const ROUTES = argMap.routes
  ? String(argMap.routes).split(',').map((r) => ({
      path: r.trim(),
      name: r.trim().replace(/^\//, '').replace(/[\/]+$/, '').replace(/[\/]/g, '-') || 'home',
      wait: 'networkidle',
    }))
  : DEFAULT_ROUTES;

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  tablet: { width: 1024, height: 1366, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
};
const VIEWPORT_KEYS = argMap.viewport
  ? [argMap.viewport]
  : Object.keys(VIEWPORTS);

// Airbrush-CSS — limes inn FØR screenshot
const AIRBRUSH_CSS = `
  /* Skjul cookie-popups (Cookiebot, Klaro, generelle) */
  #CybotCookiebotDialog, .cookiebot-dialog, .klaro-consent-modal,
  [class*='cookie-banner'], [class*='cookie-popup'], [class*='cookie-consent'],
  [id*='cookie-banner'], [id*='cookie-popup'], [data-cookieconsent='banner'] {
    display: none !important;
  }

  /* Skjul dev/admin-pills (memory: PR #289 demo-modus-toggle) */
  [data-dev-pill='true'], [data-admin-pill='true'], .dev-only, .admin-only,
  .debug-overlay, [class*='DevTools'], [class*='__react-dev-overlay__'] {
    display: none !important;
  }

  ${KEEP_BETA ? '' : `
  /* Skjul beta/preview-merker */
  [data-beta-badge='true'], .beta-badge, .preview-badge,
  [class*='__BETA'], [class*='__PREVIEW'] {
    display: none !important;
  }
  `}

  /* Skjul scrollbars (renere screenshots) */
  ::-webkit-scrollbar { display: none !important; }
  body, html { scrollbar-width: none !important; -ms-overflow-style: none !important; }

  /* Pause animasjoner så vi ikke fanger mid-state */
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }

  /* Force loaded-state for lazy-load-bilder så vi ikke fanger placeholders */
  img[loading='lazy'] { content-visibility: visible !important; }
`;

async function captureRoute(browser, route, viewportName, viewport) {
  const ctx = await browser.newContext({
    ...viewport,
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
    userAgent: viewportName === 'mobile'
      ? devices['iPhone 14'].userAgent
      : viewportName === 'tablet'
        ? devices['iPad Pro 11'].userAgent
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 RoleRoom-MarketingShot',
    reducedMotion: 'reduce',
    forcedColors: 'none',
  });
  const page = await ctx.newPage();

  const url = `${BASE_URL.replace(/\/$/, '')}${route.path}`;
  console.log(`  → ${url} (${viewportName})`);

  try {
    await page.goto(url, { waitUntil: route.wait, timeout: 30_000 });

    // Inject airbrush CSS
    await page.addStyleTag({ content: AIRBRUSH_CSS });

    // Vent litt på at fonter + bilder rekker å laste
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Scroll til topp for konsistens (i tilfelle vi landet midt på siden)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const filename = `${route.name}-${viewportName}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({
      path: outputPath,
      fullPage: viewportName === 'mobile', // Mobile fullpage; desktop only viewport
      type: 'png',
      omitBackground: false,
    });
    console.log(`    ✓ ${filename}`);
    return { ok: true, filename, url };
  } catch (err) {
    console.log(`    ✗ ${url} → ${err.message?.slice(0, 100)}`);
    return { ok: false, url, error: err.message };
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log('=== Marketing screenshots ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Routes:    ${ROUTES.map((r) => r.path).join(', ')}`);
  console.log(`Viewports: ${VIEWPORT_KEYS.join(', ')}`);
  console.log(`Output:    ${OUTPUT_DIR}`);
  console.log('');

  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const route of ROUTES) {
      console.log(`Route: ${route.path} (${route.name})`);
      for (const vpKey of VIEWPORT_KEYS) {
        const vp = VIEWPORTS[vpKey];
        if (!vp) {
          console.log(`  ! unknown viewport: ${vpKey}`);
          continue;
        }
        results.push(await captureRoute(browser, route, vpKey, vp));
      }
    }
  } finally {
    await browser.close();
  }

  console.log('');
  console.log('=== Summary ===');
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${ok} OK, ${failed} feilet`);
  if (failed > 0) {
    console.log('Feilede:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.url}: ${r.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
