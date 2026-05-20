/**
 * Slice 9X.72 — E2E verifisering at dashboard-seksjoner følger dark theme.
 *
 * Sjekker at:
 *   1. Kundeforespørsler & Kommunikasjon-blokken har dark gradient (ikke hvit)
 *   2. Smart Arbeidsflyt-kortet har dark gradient
 *   3. Evendi Bookinger-kortet (når synlig) har dark gradient
 *   4. Tekst er #fff5e8 eller lignende lys-tone (ikke MUI text.primary default)
 *
 * Krever live server på baseURL (playwright.config.ts: localhost:5001)
 * og innlogget session-token via PLAYWRIGHT_ADMIN_TOKEN.
 */

import { test, expect } from '@playwright/test';

const ADMIN_TOKEN = process.env.PLAYWRIGHT_ADMIN_TOKEN || '';

// Parser RGBA-string til komponenter — gjør oss i stand til å sjekke om
// en farge er "dark" (lav lightness) eller "light" (høy lightness).
function parseColor(str: string): { r: number; g: number; b: number; a: number } | null {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? +m[4] : 1 };
}

function isDarkBackground(rgba: string): boolean {
  const c = parseColor(rgba);
  if (!c) return false;
  // Brightness (HSP-modell)
  const brightness = Math.sqrt(0.299 * c.r ** 2 + 0.587 * c.g ** 2 + 0.114 * c.b ** 2);
  return brightness < 128;
}

test.describe('Slice 9X.72 — Dashboard dark-theme-konsistens', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!ADMIN_TOKEN, 'PLAYWRIGHT_ADMIN_TOKEN ikke satt');
    await context.addCookies([{
      name: 'session-token', value: ADMIN_TOKEN,
      domain: 'localhost', path: '/',
    }]);
    await page.goto('/');
    // Vent på at dashbordet rendres
    await page.waitForLoadState('networkidle');
  });

  test('Kundeforespørsler & Kommunikasjon har dark bakgrunn', async ({ page }) => {
    const heading = page.getByText('Kundeforespørsler & Kommunikasjon');
    await expect(heading).toBeVisible({ timeout: 10000 });

    const block = heading.locator('xpath=ancestor::div[contains(@class, "MuiBox")][1]');
    const bg = await block.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor || window.getComputedStyle(el).background,
    );

    // Bakgrunnen skal ikke være hvit (rgba(255,255,255,*))
    expect(bg).not.toMatch(/rgba?\(255,\s*255,\s*255,\s*[01]?\.?\d*\)/);

    // Tekstfargen skal være lys-tone (ikke MUI default svart)
    const textColor = await heading.evaluate((el) =>
      window.getComputedStyle(el).color,
    );
    const c = parseColor(textColor);
    expect(c, 'tekstfarge skal være parsable').toBeTruthy();
    if (c) {
      // Lys tekst skal ha RGB-sum > 600 (f.eks. #fff5e8 = 255+245+232 = 732)
      expect(c.r + c.g + c.b, 'tekst skal være lys på dark bakgrunn').toBeGreaterThan(600);
    }
  });

  test('Smart Arbeidsflyt-kortet har dark gradient', async ({ page }) => {
    const heading = page.getByText('Smart Arbeidsflyt');
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, 'Smart Arbeidsflyt-seksjonen ikke synlig på denne profesjonen');
      return;
    }

    const card = heading.locator('xpath=ancestor::*[contains(@class, "MuiCard")][1]');
    const bgImage = await card.evaluate((el) =>
      window.getComputedStyle(el).backgroundImage || window.getComputedStyle(el).background,
    );

    // Skal ha gradient med rgba(15,10,7,...) — dark base
    expect(bgImage).toMatch(/rgba?\(15,\s*10,\s*7/);

    // Border-color skal være accent (rgba(255,186,108,...) ELLER customBranding-variant)
    const borderColor = await card.evaluate((el) =>
      window.getComputedStyle(el).borderColor,
    );
    expect(borderColor).toMatch(/rgba?\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\)/);
  });

  test('Evendi Bookinger-kortet (hvis synlig) har dark gradient', async ({ page }) => {
    // Sett evendi-installed flag før reload
    await page.evaluate(() => window.localStorage.setItem('evendi-installed', 'true'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    const heading = page.getByText('Evendi Bookinger');
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, 'Evendi Bookinger ikke synlig (data mangler eller ikke vendor)');
      return;
    }

    const card = heading.locator('xpath=ancestor::*[contains(@class, "MuiCard")][1]');
    const bg = await card.evaluate((el) =>
      window.getComputedStyle(el).backgroundImage || window.getComputedStyle(el).background,
    );

    expect(bg).toMatch(/rgba?\(15,\s*10,\s*7/);
  });

  test('Ingen hvite kort på dashboardet (visual regression)', async ({ page }) => {
    // Finn alle MuiCard og MuiBox med eksplisitt background.paper eller white
    const lightCards = await page.evaluate(() => {
      const els = document.querySelectorAll('.MuiCard-root, .MuiPaper-root');
      const offenders: Array<{ selector: string; bg: string }> = [];
      els.forEach((el, idx) => {
        const bg = window.getComputedStyle(el).backgroundColor;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const [, r, g, b] = m;
          // Hvit eller nesten-hvit
          if (+r > 240 && +g > 240 && +b > 240) {
            offenders.push({
              selector: `${el.tagName}#${idx}`,
              bg,
            });
          }
        }
      });
      return offenders;
    });

    // Forventer maks 2-3 hvite kort (f.eks. select-popovere som ikke har dashbord-tema)
    expect(lightCards.length, `For mange hvite kort: ${JSON.stringify(lightCards)}`).toBeLessThan(5);
  });
});
